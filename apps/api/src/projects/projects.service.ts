import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MailingStatus,
  Prisma,
  ProjectStatus,
  ResponseDecision,
  Role,
} from '@prisma/client';
import { AnalysisService } from '../analysis/analysis.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { MailingsService } from '../mailings/mailings.service';
import { N8nService } from '../n8n/n8n.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveAndSendDto } from './dto/approve-and-send.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectSourceTextDto } from './dto/update-project-source-text.dto';
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
      department: {
        include: {
          recipients: {
            select: {
              email: true,
              displayName: true,
            },
          },
        },
      },
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

interface MailingRecipientProjectionInput {
  id: string;
  subject: string;
  status: MailingStatus;
  sentAt: Date | null;
  recipients: Prisma.JsonValue;
  department: {
    id: string;
    name: string;
    recipients: Array<{
      email: string;
      displayName: string | null;
    }>;
  };
  response: {
    id: string;
    responderEmail: string | null;
    responderName: string | null;
    decision: ResponseDecision;
    respondedAt: Date;
  } | null;
}

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
    return {
      ...project,
      mailings: this.expandMailingRecipients(project.mailings),
    };
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
      include: {
        author: true,
        _count: {
          select: { mailings: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);
    if (project._count.mailings > 0) {
      throw new BadRequestException(
        'Повторный анализ недоступен после начала рассылки',
      );
    }
    if (
      project.status === ProjectStatus.QUEUED ||
      project.status === ProjectStatus.PROCESSING
    ) {
      if (project.status === ProjectStatus.QUEUED) {
        await this.analysisService.enqueueAnalysis(projectId);
      }
      return { ok: true, alreadyQueued: true };
    }

    const allowedStatuses: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.READY_FOR_REVIEW,
      ProjectStatus.FAILED,
    ];

    if (!allowedStatuses.includes(project.status)) {
      throw new BadRequestException('Запуск анализа недоступен для текущего статуса');
    }

    const transition = await this.prisma.project.updateMany({
      where: {
        id: projectId,
        status: { in: allowedStatuses },
      },
      data: {
        status: ProjectStatus.QUEUED,
        queuedAt: new Date(),
        processingAt: null,
        readyAt: null,
        failedAt: null,
      },
    });

    if (transition.count === 0) {
      const current = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { status: true },
      });
      if (
        current?.status === ProjectStatus.QUEUED ||
        current?.status === ProjectStatus.PROCESSING
      ) {
        return { ok: true, alreadyQueued: true };
      }

      throw new BadRequestException('Запуск анализа недоступен для текущего статуса');
    }

    try {
      await this.analysisService.enqueueAnalysis(projectId);
    } catch (error) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: project.status,
          queuedAt: project.queuedAt,
          processingAt: project.processingAt,
          readyAt: project.readyAt,
          failedAt: project.failedAt,
        },
      });
      throw error;
    }

    return { ok: true };
  }

  async updateSourceText(
    projectId: string,
    dto: UpdateProjectSourceTextDto,
    currentUser: JwtPayload,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: { mailings: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);
    if (project._count.mailings > 0) {
      throw new BadRequestException(
        'Запрос нельзя изменить после начала рассылки',
      );
    }

    const allowedStatuses: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.READY_FOR_REVIEW,
      ProjectStatus.FAILED,
    ];
    if (!allowedStatuses.includes(project.status)) {
      throw new BadRequestException(
        'Запрос нельзя изменить во время обработки проекта',
      );
    }

    const sourceText = dto.sourceText.trim();
    if (sourceText.length < 20) {
      throw new BadRequestException(
        'Текст запроса должен содержать не менее 20 символов',
      );
    }
    if (sourceText === project.sourceText) {
      return { ok: true, analysisReset: false };
    }

    await this.prisma.$transaction([
      this.prisma.analysisResult.deleteMany({
        where: { projectId },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: {
          sourceText,
          status: ProjectStatus.DRAFT,
          queuedAt: null,
          processingAt: null,
          readyAt: null,
          approvedAt: null,
          sendingAt: null,
          sentAt: null,
          failedAt: null,
        },
      }),
    ]);

    return { ok: true, analysisReset: true };
  }

  async updateSuggestions(
    projectId: string,
    dto: UpdateSuggestionsDto,
    currentUser: JwtPayload,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        analysis: true,
        _count: {
          select: { mailings: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);
    if (!project.analysis) {
      throw new BadRequestException('Результат анализа еще не сформирован');
    }
    if (
      project._count.mailings > 0 ||
      project.status !== ProjectStatus.READY_FOR_REVIEW
    ) {
      throw new BadRequestException(
        'Рекомендации нельзя изменить после начала рассылки',
      );
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
      include: {
        analysis: true,
        _count: {
          select: { mailings: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    this.checkProjectAccess(project.authorId, currentUser);
    if (!project.analysis) {
      throw new BadRequestException('Нет данных анализа');
    }
    if (
      project._count.mailings > 0 ||
      project.status !== ProjectStatus.READY_FOR_REVIEW
    ) {
      throw new BadRequestException('Рассылка уже была подтверждена');
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

    const mailings = await this.prisma.mailing.findMany({
      where: { projectId },
      include: {
        department: {
          include: {
            recipients: {
              select: {
                email: true,
                displayName: true,
              },
            },
          },
        },
        response: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.expandMailingRecipients(mailings);
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

  private expandMailingRecipients(mailings: MailingRecipientProjectionInput[]) {
    return mailings.flatMap((mailing) => {
      const recipientEmails = this.normalizeJsonRecipients(mailing.recipients);
      const knownRecipients = new Map(
        mailing.department.recipients.map((recipient) => [
          recipient.email.toLowerCase().trim(),
          recipient.displayName?.trim() || null,
        ]),
      );

      return recipientEmails.map((email) => {
        const displayName = knownRecipients.get(email);
        const response = this.getResponseForRecipient(
          mailing.response,
          email,
          recipientEmails.length,
        );

        return {
          id: `${mailing.id}:${email}`,
          mailingId: mailing.id,
          subject: mailing.subject,
          status: mailing.status,
          sentAt: mailing.sentAt,
          department: {
            id: mailing.department.id,
            name: mailing.department.name,
          },
          recipient: {
            type: displayName ? 'EMPLOYEE' : 'DEPARTMENT',
            name: displayName || mailing.department.name,
            email,
          },
          response,
        };
      });
    });
  }

  private normalizeJsonRecipients(recipients: Prisma.JsonValue): string[] {
    if (!Array.isArray(recipients)) {
      return [];
    }

    return this.normalizeRecipients(
      recipients.filter((recipient): recipient is string => typeof recipient === 'string'),
    );
  }

  private getResponseForRecipient(
    response: MailingRecipientProjectionInput['response'],
    recipientEmail: string,
    recipientCount: number,
  ) {
    if (!response) {
      return null;
    }

    const responderEmail = response.responderEmail?.toLowerCase().trim();
    if (responderEmail === recipientEmail || recipientCount === 1) {
      return response;
    }

    return null;
  }
}
