import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AnalysisStatus, Prisma, ProjectStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { DepartmentsService } from '../departments/departments.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ANALYSIS_JOB, ANALYSIS_QUEUE } from '../queues/queue.constants';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
    private readonly departmentsService: DepartmentsService,
    @InjectQueue(ANALYSIS_QUEUE) private readonly analysisQueue: Queue,
  ) {}

  async enqueueAnalysis(projectId: string): Promise<void> {
    await this.analysisQueue.add(
      ANALYSIS_JOB,
      { projectId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
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

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.PROCESSING,
        processingAt: new Date(),
      },
    });

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

    try {
      const departments = await this.departmentsService.listActive();
      const llmResult = await this.llmService.analyze({
        projectTitle: project.title,
        sourceText: project.sourceText,
        departments: departments.map((d) => ({
          code: d.code,
          name: d.name,
          description: d.description,
        })),
      });

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
            emailSubject: suggestion.emailSubject,
            emailBody: suggestion.emailBody,
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
      const message = (error as Error).message;
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

      throw error;
    }
  }
}
