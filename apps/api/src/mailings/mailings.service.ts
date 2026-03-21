import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAILING_JOB, MAILING_QUEUE } from '../queues/queue.constants';
import { Queue } from 'bullmq';
import { MailingStatus, ProjectStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @InjectQueue(MAILING_QUEUE) private readonly mailingQueue: Queue,
  ) {}

  listByProject(projectId: string) {
    return this.prisma.mailing.findMany({
      where: { projectId },
      include: {
        department: true,
        response: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createDraftMailings(projectId: string): Promise<{ created: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        analysis: {
          include: {
            suggestions: {
              include: {
                department: {
                  include: {
                    recipients: {
                      where: { isActive: true },
                      select: { email: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    if (!project.analysis) {
      throw new BadRequestException('Сначала завершите анализ проекта');
    }

    const selected = project.analysis.suggestions.filter((s) => s.includeInMailing);
    if (selected.length === 0) {
      throw new BadRequestException('Нет подразделений для рассылки');
    }

    await this.prisma.mailing.deleteMany({
      where: { projectId, status: MailingStatus.DRAFT },
    });

    let created = 0;
    for (const suggestion of selected) {
      const recipients = suggestion.department.recipients.map((r) => r.email);
      if (recipients.length === 0) {
        continue;
      }

      await this.prisma.mailing.create({
        data: {
          projectId,
          departmentId: suggestion.departmentId,
          subject: suggestion.customSubject ?? suggestion.emailSubject,
          body: suggestion.customBody ?? suggestion.emailBody,
          recipients,
          status: MailingStatus.QUEUED,
          responseToken: randomBytes(32).toString('hex'),
        },
      });
      created += 1;
    }

    if (created === 0) {
      throw new BadRequestException(
        'Не удалось сформировать рассылку: у выбранных подразделений нет адресатов',
      );
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.SENDING,
        sendingAt: new Date(),
      },
    });

    const mailings = await this.prisma.mailing.findMany({
      where: { projectId, status: MailingStatus.QUEUED },
      select: { id: true },
    });

    for (const mailing of mailings) {
      await this.mailingQueue.add(
        MAILING_JOB,
        { mailingId: mailing.id, projectId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    }

    return { created };
  }

  async sendOne(mailingId: string): Promise<void> {
    const mailing = await this.prisma.mailing.findUnique({
      where: { id: mailingId },
      include: {
        project: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
        department: true,
      },
    });

    if (!mailing) {
      throw new NotFoundException('Письмо не найдено');
    }

    await this.prisma.mailing.update({
      where: { id: mailingId },
      data: { status: MailingStatus.SENDING, errorMessage: null },
    });

    try {
      const publicBaseUrl =
        this.configService.get<string>('publicBaseUrl') ?? 'http://localhost:3000';
      const responseUrl = `${publicBaseUrl}/respond/${mailing.responseToken}`;

      await this.mailService.sendDepartmentMail({
        recipients: mailing.recipients as string[],
        subject: mailing.subject,
        body: mailing.body,
        responseUrl,
        projectTitle: mailing.project.title,
      });

      await this.prisma.mailing.update({
        where: { id: mailingId },
        data: {
          status: MailingStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      await this.finalizeProjectStatus(mailing.projectId);
    } catch (error) {
      await this.prisma.mailing.update({
        where: { id: mailingId },
        data: {
          status: MailingStatus.FAILED,
          errorMessage: (error as Error).message,
        },
      });

      await this.prisma.project.update({
        where: { id: mailing.projectId },
        data: {
          status: ProjectStatus.FAILED,
          failedAt: new Date(),
        },
      });

      throw new InternalServerErrorException(
        `Ошибка отправки письма: ${(error as Error).message}`,
      );
    }
  }

  private async finalizeProjectStatus(projectId: string): Promise<void> {
    const mailings = await this.prisma.mailing.findMany({
      where: { projectId },
      select: { status: true },
    });

    const hasFailed = mailings.some((item) => item.status === MailingStatus.FAILED);
    if (hasFailed) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.FAILED,
          failedAt: new Date(),
        },
      });
      return;
    }

    const sentCount = mailings.filter((item) => item.status === MailingStatus.SENT).length;
    const totalCount = mailings.length;

    if (sentCount > 0 && sentCount === totalCount) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.SENT,
          sentAt: new Date(),
        },
      });
    }
  }
}
