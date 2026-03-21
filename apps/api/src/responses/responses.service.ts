import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublicResponseDto } from './dto/create-public-response.dto';

@Injectable()
export class ResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  async getTokenStatus(token: string) {
    const mailing = await this.prisma.mailing.findUnique({
      where: { responseToken: token },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        response: true,
      },
    });

    if (!mailing) {
      throw new NotFoundException('Ссылка не найдена');
    }

    return {
      valid: true,
      tokenUsed: mailing.tokenUsed,
      alreadyResponded: Boolean(mailing.response),
      project: mailing.project,
      department: mailing.department,
    };
  }

  async submitByToken(
    token: string,
    dto: CreatePublicResponseDto,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const mailing = await this.prisma.mailing.findUnique({
      where: { responseToken: token },
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
        response: true,
      },
    });

    if (!mailing) {
      throw new NotFoundException('Ссылка отклика не найдена');
    }

    if (mailing.response) {
      return {
        ok: true,
        alreadyResponded: true,
      };
    }

    if (mailing.tokenUsed) {
      throw new BadRequestException('Ссылка уже была использована');
    }

    const response = await this.prisma.$transaction(async (tx) => {
      const created = await tx.response.create({
        data: {
          projectId: mailing.projectId,
          departmentId: mailing.departmentId,
          mailingId: mailing.id,
          responderEmail: dto.responderEmail?.toLowerCase().trim(),
          responderName: dto.responderName?.trim(),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          tokenSnapshot: token,
        },
      });

      await tx.mailing.update({
        where: { id: mailing.id },
        data: { tokenUsed: true },
      });

      return created;
    });

    await this.notificationsService.create({
      userId: mailing.project.authorId,
      projectId: mailing.projectId,
      type: NotificationType.RESPONSE_RECEIVED,
      title: 'Новый отклик по проекту',
      message: `Отклик от ${mailing.department.name}${
        dto.responderEmail ? ` (${dto.responderEmail})` : ''
      }`,
    });

    await this.mailService.sendNotification({
      to: mailing.project.author.email,
      subject: `Новый отклик по проекту "${mailing.project.title}"`,
      text: [
        `По проекту "${mailing.project.title}" получен отклик.`,
        `Подразделение: ${mailing.department.name} (${mailing.department.code})`,
        dto.responderName ? `Имя: ${dto.responderName}` : '',
        dto.responderEmail ? `Email: ${dto.responderEmail}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });

    return {
      ok: true,
      alreadyResponded: false,
      responseId: response.id,
    };
  }
}
