import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AnalysisStatus, Prisma, ProjectStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  buildDepartmentInvitationBody,
  buildDepartmentInvitationSubject,
} from '../common/utils/department-invitation.util';
import { DepartmentsService } from '../departments/departments.service';
import { LlmService } from '../llm/llm.service';
import { N8nService } from '../n8n/n8n.service';
import { PrismaService } from '../prisma/prisma.service';
import { ANALYSIS_JOB, ANALYSIS_QUEUE } from '../queues/queue.constants';

const ANALYSIS_CANCELLED_MESSAGE = 'Анализ остановлен пользователем.';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly departmentsService: DepartmentsService,
    private readonly n8nService: N8nService,
    @InjectQueue(ANALYSIS_QUEUE) private readonly analysisQueue: Queue,
  ) {}

  async enqueueAnalysis(projectId: string): Promise<void> {
    await this.analysisQueue.add(
      ANALYSIS_JOB,
      { projectId },
      {
        jobId: `analysis-${projectId}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async processProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    if (project.status !== ProjectStatus.QUEUED) {
      this.logger.warn(
        `Skip stale analysis job for ${projectId}: project status is ${project.status}`,
      );
      return;
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.PROCESSING,
        processingAt: new Date(),
      },
    });
    this.n8nService.beginProjectAnalysis(projectId);

    try {
      await this.prisma.analysisResult.upsert({
        where: { projectId },
        create: {
          projectId,
          summary: '',
          tasksJson: [] as Prisma.InputJsonValue,
          rawJson: {} as Prisma.InputJsonValue,
          generationStatus: AnalysisStatus.PROCESSING,
          llmProvider: this.llmService.providerName,
          llmModel: this.llmService.modelName,
        },
        update: {
          generationStatus: AnalysisStatus.PROCESSING,
          errorMessage: null,
          llmProvider: this.llmService.providerName,
          llmModel: this.llmService.modelName,
        },
      });

      if (this.n8nService.isProjectAnalysisCancelled(projectId)) {
        throw new Error(ANALYSIS_CANCELLED_MESSAGE);
      }

      const departments = await this.departmentsService.listActive();
      const llmResult = await this.llmService.analyze({
        projectId,
        projectTitle: project.title,
        sourceText: project.sourceText,
        departments: departments.map((d) => ({
          code: d.code,
          name: d.name,
          competencies: d.competencies,
          employeeCompetencies: [
            ...new Set(d.recipients.flatMap((recipient) => recipient.competencies)),
          ],
        })),
      });

      const currentProject = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { status: true },
      });
      if (currentProject?.status !== ProjectStatus.PROCESSING) {
        this.logger.warn(
          `Skip saving analysis result for ${projectId}: project status is ${currentProject?.status}`,
        );
        return;
      }

      const analysis = await this.prisma.analysisResult.update({
        where: { projectId },
        data: {
          summary: llmResult.summary,
          tasksJson: llmResult.tasks as unknown as Prisma.InputJsonValue,
          rawJson: llmResult as unknown as Prisma.InputJsonValue,
          generationStatus: AnalysisStatus.READY,
          errorMessage: null,
          llmProvider: this.llmService.providerName,
          llmModel: this.llmService.modelName,
        },
      });

      await this.prisma.departmentSuggestion.deleteMany({
        where: { analysisResultId: analysis.id },
      });

      for (const suggestion of llmResult.departmentSuggestions) {
        const department = departments.find(
          (item) => item.code === suggestion.departmentCode,
        );
        if (!department) {
          continue;
        }

        await this.prisma.departmentSuggestion.create({
          data: {
            analysisResultId: analysis.id,
            departmentId: department.id,
            relevanceReason: suggestion.relevanceReason,
            problemFragment: suggestion.problemFragment,
            adaptedPitch: suggestion.adaptedPitch,
            emailSubject: buildDepartmentInvitationSubject({
              projectTitle: project.title,
            }),
            emailBody: buildDepartmentInvitationBody({
              projectTitle: project.title,
              departmentName: department.name,
              relevanceReason: suggestion.relevanceReason,
              adaptedPitch: suggestion.adaptedPitch,
              problemFragment: suggestion.problemFragment,
            }),
            includeInMailing: true,
          },
        });
      }

      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.READY_FOR_REVIEW,
          readyAt: new Date(),
        },
      });
    } catch (error) {
      const message = this.n8nService.isAnalysisCancellationError(error)
        ? ANALYSIS_CANCELLED_MESSAGE
        : (error as Error).message;
      this.logger.error(`Analysis failed for ${projectId}: ${message}`);

      await this.prisma.analysisResult.update({
        where: { projectId },
        data: {
          generationStatus: AnalysisStatus.FAILED,
          errorMessage: message,
        },
      });

      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.FAILED,
          failedAt: new Date(),
        },
      });

      if (!this.n8nService.isAnalysisCancellationError(error)) {
        throw error;
      }
    } finally {
      this.n8nService.finishProjectAnalysis(projectId);
    }
  }

  async cancelProjectAnalysis(projectId: string): Promise<void> {
    this.n8nService.cancelProjectAnalysis(projectId);

    const job = await this.analysisQueue.getJob(`analysis-${projectId}`);
    if (job) {
      try {
        const state = await job.getState();
        if (state !== 'active') {
          await job.remove();
        }
      } catch (error) {
        this.logger.warn(
          `Could not remove analysis job for ${projectId}: ${(error as Error).message}`,
        );
      }
    }

    await this.prisma.analysisResult.upsert({
      where: { projectId },
      create: {
        projectId,
        summary: '',
        tasksJson: [] as Prisma.InputJsonValue,
        rawJson: {} as Prisma.InputJsonValue,
        generationStatus: AnalysisStatus.FAILED,
        errorMessage: ANALYSIS_CANCELLED_MESSAGE,
        llmProvider: this.llmService.providerName,
        llmModel: this.llmService.modelName,
      },
      update: {
        generationStatus: AnalysisStatus.FAILED,
        errorMessage: ANALYSIS_CANCELLED_MESSAGE,
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.FAILED,
        failedAt: new Date(),
      },
    });
  }
}
