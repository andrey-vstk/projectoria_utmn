import { Injectable, MessageEvent } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import { filter, interval, map, merge, Observable, of, Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly events = new Subject<{
    userId: string;
    notification: Notification;
  }>();

  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(input: {
    userId: string;
    projectId?: string;
    title: string;
    message: string;
    type?: NotificationType;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        title: input.title,
        message: input.message,
        type: input.type ?? NotificationType.SYSTEM,
      },
    });

    this.events.next({ userId: input.userId, notification });
    return notification;
  }

  streamForUser(userId: string): Observable<MessageEvent> {
    return merge(
      of({ data: { type: 'connected' } }),
      this.events.pipe(
        filter((event) => event.userId === userId),
        map((event) => ({
          data: {
            type: 'notification',
            notification: event.notification,
          },
        })),
      ),
      interval(25_000).pipe(map(() => ({ data: { type: 'heartbeat' } }))),
    );
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
