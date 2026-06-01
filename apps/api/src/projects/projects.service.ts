import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, Role } from '@prisma/client';
import { AnalysisService } from '../analysis/analysis.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { MailingsService } from '../mailings/mailings.service';
import { N8nService } from '../n8n/n8n.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveAndSendDto } from './dto/approve-and-send.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateSuggestionsDto } from './dto/update-suggestions.dto';

const LIST_INCLUDE = {
  author: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  analysis: {
    select: {
      id: true,
      generationStatus: true,
      summary: true,
      updatedAt: true,
    },
  },
  _count: {
    select: {
      mailings: true,
      responses: true,
    },
  },
} satisfies Prisma.ProjectInclude;

const DETAIL_INCLUDE = {
  author: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  analysis: {
    include: {
      suggestions: {
        include: {
          department: {
            include: {
              recipients: {
                where: { isActive: true },
                select: { email: true, displayName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  },
  mailings: {
    include: {
      department: true,
      response: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  responses: {
    include: {
      department: true,
    },
    orderBy: { respondedAt: 'desc' },
  },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analysisService: AnalysisService,
    private readonly mailingsService: MailingsService,
    private readonly n8nService: N8nService,
  ) {}

  list(currentUser: JwtPayload) {
    return this.prisma.project.findMany({
      where:
        currentUser.role === Role.ADMIN ? {} : { authorId: currentUser.sub },
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(projectId: string, currentUser: JwtPayload) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: DETAIL_INCLUDE,
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    this.checkProjectAccess(project.authorId, currentUser);
    return project;
  }

  async create(dto: CreateProjectDto, currentUser: JwtPayload) {
    const project = await this.prisma.project.create({
      data: {
        title: dto.title.trim(),
        sourceText: dto.sourceText.trim(),
        authorId: currentUser.sub,
        status: ProjectStatus.DRAFT,
      },
      include: LIST_INCLUDE,
    });

    await this.n8nService.notifyProjectCreated({
      projectId: project.id,
      title: project.title,
      sourceText: project.sourceText,
      authorId: project.author.id,
      authorEmail: project.author.email,
    });

    return project;
  }

  async queueAnalysis(projectId: string, currentUser: JwtPayload) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { author: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);

    const allowedStatuses: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.READY_FOR_REVIEW,
      ProjectStatus.FAILED,
    ];

    if (!allowedStatuses.includes(project.status)) {
      throw new BadRequestException('Запуск анализа недоступен для текущего статуса');
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.QUEUED,
        queuedAt: new Date(),
      },
    });

    await this.analysisService.enqueueAnalysis(projectId);
    return { ok: true };
  }

  async updateSuggestions(
    projectId: string,
    dto: UpdateSuggestionsDto,
    currentUser: JwtPayload,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { analysis: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);
    if (!project.analysis) {
      throw new BadRequestException('Результат анализа еще не сформирован');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const patch of dto.suggestions) {
        const suggestion = await tx.departmentSuggestion.findUnique({
          where: { id: patch.id },
        });

        if (!suggestion || suggestion.analysisResultId !== project.analysis?.id) {
          continue;
        }

        const normalizedRecipients =
          patch.recipients === undefined
            ? undefined
            : this.normalizeRecipients(patch.recipients);

        await tx.departmentSuggestion.update({
          where: { id: patch.id },
          data: {
            includeInMailing: patch.includeInMailing,
            customSubject: patch.customSubject,
            customBody: patch.customBody,
            customRecipients:
              patch.recipients === undefined
                ? undefined
                : (normalizedRecipients as unknown as Prisma.InputJsonValue),
          },
        });
      }
    });

    return this.getById(projectId, currentUser);
  }

  async approveAndSend(
    projectId: string,
    dto: ApproveAndSendDto,
    currentUser: JwtPayload,
  ) {
    if (dto.suggestions && dto.suggestions.length > 0) {
      await this.updateSuggestions(projectId, { suggestions: dto.suggestions }, currentUser);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { analysis: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);
    if (!project.analysis) {
      throw new BadRequestException('Нет данных анализа');
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    const result = await this.mailingsService.createDraftMailings(projectId);
    return { ok: true, mailingsCreated: result.created };
  }

  async listResponses(projectId: string, currentUser: JwtPayload) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, authorId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);

    return this.prisma.response.findMany({
      where: { projectId },
      include: {
        department: true,
      },
      orderBy: { respondedAt: 'desc' },
    });
  }

  private checkProjectAccess(authorId: string, currentUser: JwtPayload): void {
    if (currentUser.role === Role.ADMIN) {
      return;
    }
    if (currentUser.sub !== authorId) {
      throw new ForbiddenException('Нет доступа к проекту');
    }
  }

  private normalizeRecipients(recipients: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const raw of recipients) {
      const email = raw.toLowerCase().trim();
      if (!email || seen.has(email)) {
        continue;
      }

      seen.add(email);
      normalized.push(email);
    }

    return normalized;
  }
}
