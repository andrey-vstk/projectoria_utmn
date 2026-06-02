import { Injectable } from '@nestjs/common';
import { LlmProvider } from './llm.provider';
import { LlmAnalysisInput, LlmStructuredResult } from './llm.types';

@Injectable()
export class MockLlmProvider implements LlmProvider {
  readonly providerName = 'mock';
  readonly modelName = 'mock-v1';

  async analyze(input: LlmAnalysisInput): Promise<LlmStructuredResult> {
    const normalized = input.sourceText.toLowerCase();

    const baseTasks = [
      {
        title: 'Уточнение требований заказчика',
        description:
          'Подготовить список уточняющих вопросов по целям, ограничениям и критериям успеха.',
        priority: 'high' as const,
      },
      {
        title: 'План пилотного проекта',
        description:
          'Сформировать дорожную карту MVP с контрольными точками и метриками.',
        priority: 'medium' as const,
      },
    ];

    const suggestions = input.departments
      .filter((department) => {
        const code = department.code.toLowerCase();
        if (normalized.includes('данн') || normalized.includes('ml')) {
          return code.includes('шкн');
        }
        if (normalized.includes('инженер') || normalized.includes('прототип')) {
          return code.includes('пиш');
        }
        if (normalized.includes('эконом') || normalized.includes('бизнес')) {
          return code.includes('фэи');
        }
        if (normalized.includes('лаборатор') || normalized.includes('эксперимент')) {
          return code.includes('шен');
        }
        return true;
      })
      .slice(0, 3)
      .map((department) => ({
        departmentCode: department.code,
        relevanceReason: `Подразделение ${department.name} потенциально обладает релевантной экспертизой.`,
        problemFragment: input.sourceText.slice(0, 280),
        adaptedPitch: `Для ${department.name}: можно запустить пилот с фокусом на прикладной результат для индустриального партнера.`,
        emailSubject: `[Проект] Потенциальное участие ${department.code}`,
        emailBody: [
          `Здравствуйте!`,
          '',
          `Есть новый проект "${input.projectTitle}".`,
          `Почему это может быть интересно ${department.name}:`,
          `- ${department.name} может закрыть часть задач своей экспертизой.`,
          '',
          'Сообщите решение об участии по ссылкам в письме.',
        ].join('\n'),
      }));

    if (suggestions.length === 0 && input.departments.length > 0) {
      const fallback = input.departments[0];
      suggestions.push({
        departmentCode: fallback.code,
        relevanceReason: 'Недостаточно данных для точной маршрутизации, нужен ручной отбор.',
        problemFragment: input.sourceText.slice(0, 280),
        adaptedPitch:
          'Данных недостаточно для уверенной декомпозиции, требуется дополнительное интервью с заказчиком.',
        emailSubject: `[Проект] Требуется экспертная оценка (${fallback.code})`,
        emailBody:
          'Данных в стенограмме недостаточно. Просьба подключиться к уточнению требований.',
      });
    }

    return {
      summary: `Черновой анализ: ${input.sourceText.slice(0, 180)}${
        input.sourceText.length > 180 ? '...' : ''
      }`,
      tasks: baseTasks,
      departmentSuggestions: suggestions,
    };
  }
}
