import { LlmAnalysisInput } from './llm.types';

export function buildLlmPrompt(input: LlmAnalysisInput): string {
  const departmentsBlock = input.departments
    .map(
      (d) =>
        `- ${d.code}: ${d.name}${d.description ? ` (${d.description})` : ''}`,
    )
    .join('\n');

  return [
    'Ты аналитик университета, который помогает декомпозировать индустриальные запросы.',
    '',
    'Входные данные:',
    `Название проекта: ${input.projectTitle}`,
    `Текст стенограммы/запроса:`,
    input.sourceText,
    '',
    'Доступные подразделения:',
    departmentsBlock,
    '',
    'Требования к ответу:',
    '1) Верни СТРОГО JSON без markdown.',
    '2) Формат JSON:',
    '{',
    '  "summary": "Краткое описание проблемы",',
    '  "tasks": [',
    '    {',
    '      "title": "Название подзадачи",',
    '      "description": "Описание",',
    '      "priority": "high|medium|low"',
    '    }',
    '  ],',
    '  "departmentSuggestions": [',
    '    {',
    '      "departmentCode": "код подразделения",',
    '      "relevanceReason": "Почему релевантно",',
    '      "problemFragment": "Релевантный фрагмент исходного текста",',
    '      "adaptedPitch": "Пояснение на языке данного подразделения",',
    '      "emailSubject": "Тема письма",',
    '      "emailBody": "Текст письма"',
    '    }',
    '  ]',
    '}',
    '3) Не выдумывай факты, которых нет в исходном тексте.',
    '4) Если информации недостаточно, явно пиши, что данных недостаточно.',
    '5) Не делай одинаковые рекомендации для всех подразделений, учитывай реальную релевантность.',
    '6) Рекомендации выдавай только для потенциально релевантных подразделений.',
  ].join('\n');
}
