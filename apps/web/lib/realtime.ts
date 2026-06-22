'use client';

export interface RealtimeNotification {
  id: string;
  projectId?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATION_EVENT = 'projectoria:notification';

export function announceNotification(notification: RealtimeNotification): void {
  window.dispatchEvent(
    new CustomEvent<RealtimeNotification>(NOTIFICATION_EVENT, {
      detail: notification,
    }),
  );
}

export function subscribeToNotifications(
  handler: (notification: RealtimeNotification) => void,
): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<RealtimeNotification>).detail);
  };

  window.addEventListener(NOTIFICATION_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATION_EVENT, listener);
}
