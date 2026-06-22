interface DepartmentInvitationInput {
  projectTitle: string;
  departmentName: string;
  relevanceReason?: string | null;
  adaptedPitch?: string | null;
  problemFragment?: string | null;
}

function cleanText(value: string | null | undefined, fallback: string): string {
  const text = value?.trim();
  return text || fallback;
}

export function buildDepartmentInvitationSubject(
  input: Pick<DepartmentInvitationInput, 'projectTitle'>,
): string {
  return `Предложение участия в проекте «${input.projectTitle}»`;
}

export function buildDepartmentInvitationBody(
  input: DepartmentInvitationInput,
): string {
  const relevanceReason = cleanText(
    input.relevanceReason,
    'Требуется экспертная оценка релевантности подразделения.',
  );
  const adaptedPitch = cleanText(
    input.adaptedPitch,
    'Можно подключиться к уточнению требований и оценке возможного участия.',
  );
  const problemFragment = cleanText(
    input.problemFragment,
    'Фрагмент запроса заказчика не выделен.',
  );

  return [
    'Коллеги, здравствуйте!',
    '',
    `Команда «Проектории» предлагает подразделению «${input.departmentName}» рассмотреть участие в разработке проекта «${input.projectTitle}».`,
    '',
    'Проект поступил от внешнего заказчика. Нужно оценить, может ли подразделение подключиться к выполнению подходящей части работ.',
    '',
    'Почему это направление подходит:',
    relevanceReason,
    '',
    'Предлагаемая зона участия:',
    adaptedPitch,
    '',
    'Фрагмент запроса заказчика:',
    problemFragment,
    '',
    'Пожалуйста, выберите решение по кнопке в письме: принять участие или отказаться.',
  ].join('\n');
}
