export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  QUEUED: 'В очереди',
  PROCESSING: 'Обработка',
  READY_FOR_REVIEW: 'Готово к проверке',
  APPROVED: 'Подтверждено',
  SENDING: 'Рассылка',
  SENT: 'Отправлено',
  FAILED: 'Ошибка',
};

export const PROJECT_STATUS_TONE: Record<string, string> = {
  DRAFT: 'neutral',
  QUEUED: 'info',
  PROCESSING: 'info',
  READY_FOR_REVIEW: 'accent',
  APPROVED: 'accent',
  SENDING: 'info',
  SENT: 'success',
  FAILED: 'danger',
};

export const MAILING_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  QUEUED: 'В очереди',
  SENDING: 'Отправка',
  SENT: 'Отправлено',
  FAILED: 'Ошибка',
  SKIPPED: 'Пропущено',
};

export const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активен',
  DISABLED: 'Отключен',
};
