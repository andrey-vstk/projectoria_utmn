import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  create(input: {
    userId: string;
    projectId?: string;
    title: string;
    message: string;
    type?: NotificationType;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.SYSTEM,
      },
    });
  }

  markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });
  }
}
