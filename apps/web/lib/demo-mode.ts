'use client';

import type { CurrentUser } from './auth-context';
import { ProjectDetail, ProjectListItem, ProjectSuggestion } from './types';
import { RealtimeNotification } from './realtime';

const DEMO_SESSION_KEY = 'projectoria_demo_session';
const DEMO_STATE_KEY = 'projectoria_demo_state';
const DEMO_CSRF_TOKEN = 'demo-csrf-token';
const DEMO_API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const DEMO_USER: CurrentUser = {
  id: 'demo-user-admin',
  email: 'demo@projectoria.local',
  fullName: 'Демо-администратор',
  role: 'ADMIN',
  status: 'ACTIVE',
};

type DemoRole = 'ADMIN' | 'INITIATOR';
type DemoUserStatus = 'ACTIVE' | 'DISABLED';

type DemoUser = CurrentUser & {
  role: DemoRole;
  status: DemoUserStatus;
  createdAt: string;
  updatedAt: string;
};

type DemoDepartment = {
  id: string;
  code: string;
  name: string;
  competencies: string[];
  isActive: boolean;
  recipients: Array<{
    id: string;
    email: string;
    displayName: string | null;
    competencies: string[];
    isActive: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

type DemoMailing = ProjectDetail['mailings'][number];
type DemoResponse = ProjectDetail['responses'][number];
type DemoAnalysis = NonNullable<ProjectDetail['analysis']>;

type DemoProject = Omit<ProjectDetail, 'analysis' | 'mailings' | 'responses'> & {
  analysis: DemoAnalysis | null;
  mailings: DemoMailing[];
  responses: DemoResponse[];
  approvedAt?: string | null;
  sendingAt?: string | null;
  sentAt?: string | null;
};

type DemoState = {
  users: DemoUser[];
  departments: DemoDepartment[];
  projects: DemoProject[];
  notifications: RealtimeNotification[];
  createdAt: string;
};

type DemoLlmResult = {
  summary: string;
  tasks: Array<{ title: string; description: string; priority: string }>;
  departmentSuggestions: Array<{
    departmentCode: string;
    relevanceReason: string;
    problemFragment: string;
    adaptedPitch: string;
    emailSubject?: string;
    emailBody?: string;
  }>;
};

type DemoApiResult<T> =
  | { handled: true; value: T }
  | { handled: false };

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
}

function addMinutes(baseIso: string, minutes: number): string {
  const date = new Date(baseIso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseJsonBody<T>(body: BodyInit | null | undefined): T {
  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }
  return {} as T;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeCompetencies(values: string[] | undefined): string[] {
  const normalized = new Map<string, string>();
  for (const raw of values ?? []) {
    const value = raw.trim();
    if (value) {
      normalized.set(value.toLowerCase(), value);
    }
  }
  return [...normalized.values()];
}

function normalizeRecipients(
  values:
    | Array<{
        email: string;
        displayName?: string | null;
        competencies?: string[];
      }>
    | undefined,
): DemoDepartment['recipients'] {
  const normalized = new Map<string, DemoDepartment['recipients'][number]>();
  for (const raw of values ?? []) {
    const email = raw.email?.toLowerCase().trim();
    if (!email) {
      continue;
    }
    normalized.set(email, {
      id: makeId('demo-recipient'),
      email,
      displayName: raw.displayName?.trim() || null,
      competencies: normalizeCompetencies(raw.competencies),
      isActive: true,
    });
  }
  return [...normalized.values()];
}

function userShort(user: DemoUser): ProjectDetail['author'] {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  };
}

function createDemoDepartments(): DemoDepartment[] {
  const createdAt = daysAgo(35);
  return [
    {
      id: 'demo-dep-ai',
      code: 'AI-LAB',
      name: 'Лаборатория искусственного интеллекта',
      competencies: ['LLM', 'NLP', 'RAG', 'Компьютерное зрение', 'MLOps'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-ai-1',
          email: 'ai.lab@utmn.ru',
          displayName: 'Общий адрес AI-лаборатории',
          competencies: ['LLM', 'прототипирование', 'оценка качества моделей'],
          isActive: true,
        },
        {
          id: 'demo-rec-ai-2',
          email: 'smirnova.ai@utmn.ru',
          displayName: 'Смирнова Анна',
          competencies: ['NLP', 'промпт-инжиниринг', 'RAG'],
          isActive: true,
        },
        {
          id: 'demo-rec-ai-3',
          email: 'volkov.cv@utmn.ru',
          displayName: 'Волков Максим',
          competencies: ['компьютерное зрение', 'разметка данных'],
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-dep-dev',
      code: 'DEV-CENTER',
      name: 'Центр разработки цифровых сервисов',
      competencies: ['Web-разработка', 'Backend', 'Frontend', 'DevOps', 'Интеграции'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-dev-1',
          email: 'digital.center@utmn.ru',
          displayName: 'Центр разработки',
          competencies: ['проектирование архитектуры', 'MVP', 'API'],
          isActive: true,
        },
        {
          id: 'demo-rec-dev-2',
          email: 'petrov.backend@utmn.ru',
          displayName: 'Петров Иван',
          competencies: ['backend', 'PostgreSQL', 'очереди задач'],
          isActive: true,
        },
        {
          id: 'demo-rec-dev-3',
          email: 'orlov.frontend@utmn.ru',
          displayName: 'Орлов Сергей',
          competencies: ['frontend', 'UX', 'личные кабинеты'],
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-dep-data',
      code: 'DATA-SCIENCE',
      name: 'Центр анализа данных',
      competencies: ['Data Science', 'BI', 'Прогнозирование', 'Дашборды', 'ETL'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-data-1',
          email: 'data.center@utmn.ru',
          displayName: 'Центр анализа данных',
          competencies: ['аналитика', 'дашборды', 'ETL'],
          isActive: true,
        },
        {
          id: 'demo-rec-data-2',
          email: 'kuznetsova.bi@utmn.ru',
          displayName: 'Кузнецова Мария',
          competencies: ['BI', 'визуализация', 'Power BI'],
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-dep-geo',
      code: 'GEO',
      name: 'Институт наук о Земле',
      competencies: ['ГИС', 'геология', 'экология', 'картография', 'мониторинг территорий'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-geo-1',
          email: 'geo.projects@utmn.ru',
          displayName: 'Проектная группа геонаук',
          competencies: ['ГИС', 'полевые данные', 'геоаналитика'],
          isActive: true,
        },
        {
          id: 'demo-rec-geo-2',
          email: 'nikitin.geo@utmn.ru',
          displayName: 'Никитин Павел',
          competencies: ['геология', 'месторождения', 'картография'],
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-dep-bio',
      code: 'BIO',
      name: 'Школа естественных наук',
      competencies: ['Биотехнологии', 'лабораторные исследования', 'экология', 'химический анализ'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-bio-1',
          email: 'bio.lab@utmn.ru',
          displayName: 'Лабораторный комплекс',
          competencies: ['лабораторные испытания', 'протоколы', 'качество проб'],
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-dep-management',
      code: 'MGMT',
      name: 'Школа менеджмента и проектного управления',
      competencies: ['Бизнес-анализ', 'управление проектами', 'логистика', 'исследование рынка'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-mgmt-1',
          email: 'management.projects@utmn.ru',
          displayName: 'Проектный офис менеджмента',
          competencies: ['бизнес-процессы', 'логистика', 'KPI'],
          isActive: true,
        },
        {
          id: 'demo-rec-mgmt-2',
          email: 'sokolova.pm@utmn.ru',
          displayName: 'Соколова Елена',
          competencies: ['проектное управление', 'коммуникации с заказчиком'],
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-dep-law',
      code: 'LAW',
      name: 'Юридическая клиника и центр комплаенса',
      competencies: ['договоры', 'персональные данные', 'правовое сопровождение', 'комплаенс'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-law-1',
          email: 'legal.clinic@utmn.ru',
          displayName: 'Юридическая клиника',
          competencies: ['договоры', '152-ФЗ', 'NDA'],
          isActive: true,
        },
      ],
    },
    {
      id: 'demo-dep-edu',
      code: 'EDU',
      name: 'Центр образовательных технологий',
      competencies: ['EdTech', 'методология обучения', 'онлайн-курсы', 'оценка компетенций'],
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      recipients: [
        {
          id: 'demo-rec-edu-1',
          email: 'edtech@utmn.ru',
          displayName: 'Команда EdTech',
          competencies: ['онлайн-обучение', 'LMS', 'методология'],
          isActive: true,
        },
      ],
    },
  ];
}

function createDemoUsers(): DemoUser[] {
  const base = daysAgo(45);
  return [
    { ...DEMO_USER, role: 'ADMIN', status: 'ACTIVE', createdAt: base, updatedAt: base },
    {
      id: 'demo-user-initiator-1',
      email: 'sokolova.pm@utmn.ru',
      fullName: 'Соколова Елена',
      role: 'INITIATOR',
      status: 'ACTIVE',
      createdAt: daysAgo(34),
      updatedAt: daysAgo(3),
    },
    {
      id: 'demo-user-initiator-2',
      email: 'petrov.backend@utmn.ru',
      fullName: 'Петров Иван',
      role: 'INITIATOR',
      status: 'ACTIVE',
      createdAt: daysAgo(32),
      updatedAt: daysAgo(5),
    },
    {
      id: 'demo-user-admin-2',
      email: 'curator@utmn.ru',
      fullName: 'Куратор проектного офиса',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: daysAgo(29),
      updatedAt: daysAgo(2),
    },
    {
      id: 'demo-user-initiator-3',
      email: 'research.demo@utmn.ru',
      fullName: 'Демидова Наталья',
      role: 'INITIATOR',
      status: 'DISABLED',
      createdAt: daysAgo(28),
      updatedAt: daysAgo(1),
    },
    {
      id: 'demo-user-initiator-4',
      email: 'analytics.demo@utmn.ru',
      fullName: 'Аналитик витрины проектов',
      role: 'INITIATOR',
      status: 'ACTIVE',
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
    },
  ];
}

function departmentById(departments: DemoDepartment[], id: string): DemoDepartment {
  const department = departments.find((item) => item.id === id);
  if (!department) {
    throw new Error(`Demo department ${id} not found`);
  }
  return department;
}

function recipientsForSuggestion(department: DemoDepartment): ProjectSuggestion['department']['recipients'] {
  return department.recipients
    .filter((recipient) => recipient.isActive)
    .map((recipient) => ({
      email: recipient.email,
      displayName: recipient.displayName,
      competencies: recipient.competencies,
    }));
}

function makeSuggestion(
  departments: DemoDepartment[],
  id: string,
  departmentId: string,
  relevanceReason: string,
  problemFragment: string,
  adaptedPitch: string,
  includeInMailing = true,
): ProjectSuggestion {
  const department = departmentById(departments, departmentId);
  return {
    id,
    departmentId,
    relevanceReason,
    problemFragment,
    adaptedPitch,
    emailSubject: `Участие в проекте: ${problemFragment.slice(0, 58)}`,
    emailBody: [
      `Здравствуйте, команда «${department.name}».`,
      '',
      `Предлагаем рассмотреть участие в проекте. ${adaptedPitch}`,
      '',
      `Почему это может быть релевантно: ${relevanceReason}`,
      '',
      'Если направление подходит, подтвердите участие через форму отклика. Если нет, можно отказаться, чтобы проектный офис быстрее перестроил маршрутизацию.',
    ].join('\n'),
    includeInMailing,
    customSubject: null,
    customBody: null,
    customRecipients: null,
    department: {
      id: department.id,
      code: department.code,
      name: department.name,
      recipients: recipientsForSuggestion(department),
    },
  };
}

function makeAnalysis(
  departments: DemoDepartment[],
  projectId: string,
  summary: string,
  suggestions: ProjectSuggestion[],
  tasks: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low' }> = [
    {
      title: 'Уточнение требований и границ MVP',
      description:
        'Провести короткую сессию с заказчиком, зафиксировать целевой сценарий, ограничения, ожидаемый результат и критерии приемки.',
      priority: 'high',
    },
    {
      title: 'Проектирование решения и данных',
      description:
        'Описать архитектуру, роли пользователей, интеграции, источники данных и формат результата для пилотного запуска.',
      priority: 'high',
    },
    {
      title: 'Сбор команды и подготовка пилота',
      description:
        'Подключить профильные подразделения, распределить зоны ответственности и подготовить демо-версию для заказчика.',
      priority: 'medium',
    },
  ],
): DemoAnalysis {
  return {
    id: `demo-analysis-${projectId}`,
    summary,
    tasksJson: tasks,
    rawJson: {
      summary,
      suggestedDepartments: suggestions.map((item) => item.department.name),
    },
    generationStatus: 'READY',
    errorMessage: null,
    suggestions,
  };
}

function createDemoProjects(users: DemoUser[], departments: DemoDepartment[]): DemoProject[] {
  const manager = userShort(users[1]);
  const developer = userShort(users[2]);
  const curator = userShort(users[3]);
  const researcher = userShort(users[4]);
  const analyst = userShort(users[5]);

  const created1 = daysAgo(12, 11);
  const suggestions1 = [
    makeSuggestion(
      departments,
      'demo-sug-1-ai',
      'demo-dep-ai',
      'В запросе требуется интеллектуальный помощник, который отвечает строго по утвержденной базе знаний и умеет передавать сложные обращения оператору.',
      'RAG-помощник для первой линии поддержки',
      'Команда может подготовить RAG-прототип, схему индексации регламентов, сценарий проверки достоверности ответов и набор метрик качества.',
    ),
    makeSuggestion(
      departments,
      'demo-sug-1-dev',
      'demo-dep-dev',
      'Для пилота нужны кабинет оператора, роли пользователей, журнал обращений, история передачи оператору и интеграция с базой знаний.',
      'Кабинет оператора и сервисная интеграция',
      'Центр разработки может закрыть web-интерфейс, backend, авторизацию и безопасный контур интеграции с внутренними сервисами.',
    ),
    makeSuggestion(
      departments,
      'demo-sug-1-law',
      'demo-dep-law',
      'В обращениях могут встречаться персональные данные, сведения об обучении и чувствительная внутренняя информация.',
      'Правовой контур обработки обращений',
      'Юридическая команда поможет описать правила обработки данных, ограничения пилота и формулировки уведомлений для пользователей.',
      false,
    ),
  ];

  const project1: DemoProject = {
    id: 'demo-project-ai-support',
    title: 'AI-помощник для обработки обращений студентов',
    sourceText: [
      'Диалог с заказчиком:',
      'Заказчик: Нам нужно снизить нагрузку на операторов первой линии. Сейчас большая часть обращений повторяется: расписание, справки, общежития, порядок подачи заявлений, пересдачи и контакты ответственных подразделений.',
      'Проектный офис: Что считается успешным результатом пилота?',
      'Заказчик: Чтобы помощник закрыл не менее 40% типовых вопросов без участия оператора, а сложные обращения передавал человеку с краткой сводкой и ссылками на найденные документы.',
      'Проектный офис: Важно, чтобы бот не выдумывал ответы?',
      'Заказчик: Да, ответы должны ссылаться на внутренние регламенты и страницы. Если бот не уверен, он должен честно сказать, что информации недостаточно, и передать обращение оператору.',
      'Проектный офис: Какие интеграции критичны для MVP?',
      'Заказчик: Авторизация, база знаний, журнал обращений и кабинет оператора. Интеграцию с CRM и расширенную аналитику можно оставить на второй этап.',
      'Дополнение: пилот нужно показать на ограниченном наборе документов по учебному процессу, чтобы проверить качество ответов и риски использования генеративной модели.',
    ].join('\n'),
    status: 'READY_FOR_REVIEW',
    queuedAt: addMinutes(created1, 5),
    processingAt: addMinutes(created1, 7),
    readyAt: addMinutes(created1, 12),
    failedAt: null,
    createdAt: created1,
    updatedAt: addMinutes(created1, 12),
    author: curator,
    analysis: makeAnalysis(
      departments,
      'demo-project-ai-support',
      'Запрос направлен на создание AI-помощника первой линии поддержки. Для MVP нужны RAG по утвержденной базе знаний, кабинет оператора, журнал обращений, безопасная передача сложных кейсов человеку и методика оценки качества ответов.',
      suggestions1,
      [
        {
          title: 'Сформировать корпус базы знаний',
          description:
            'Отобрать регламенты и страницы по учебному процессу, нормализовать структуру документов и определить правила обновления источников.',
          priority: 'high',
        },
        {
          title: 'Собрать RAG-прототип помощника',
          description:
            'Настроить поиск по базе знаний, генерацию ответа со ссылками на источники и сценарий отказа от ответа при низкой уверенности.',
          priority: 'high',
        },
        {
          title: 'Разработать кабинет оператора',
          description:
            'Сделать просмотр истории обращений, принятие сложных кейсов, статусы обработки и краткую LLM-сводку для оператора.',
          priority: 'medium',
        },
        {
          title: 'Проверить качество и риски пилота',
          description:
            'Подготовить тестовый набор вопросов, метрики точности, правила ручной проверки и рекомендации по защите персональных данных.',
          priority: 'medium',
        },
      ],
    ),
    mailings: [],
    responses: [],
  };

  const created2 = daysAgo(9, 14);
  const suggestions2 = [
    makeSuggestion(
      departments,
      'demo-sug-2-data',
      'demo-dep-data',
      'Заказчик хочет объединить Excel-данные подрядчиков, складские остатки, план поставок и фактические отклонения в единой аналитической витрине.',
      'Прогнозирование спроса и BI-витрина логистики',
      'Центр анализа данных может подготовить ETL-контур, модель прогноза на 4-8 недель, витрину показателей и мониторинг отклонений.',
    ),
    makeSuggestion(
      departments,
      'demo-sug-2-dev',
      'demo-dep-dev',
      'Нужно web-приложение для загрузки шаблонов Excel, валидации данных, сверки поставок, уведомлений и хранения истории изменений.',
      'Веб-сервис для загрузки и контроля поставок',
      'Центр разработки может реализовать интерфейс загрузки, backend-валидацию, роли пользователей, журнал изменений и интеграцию с уведомлениями.',
    ),
    makeSuggestion(
      departments,
      'demo-sug-2-mgmt',
      'demo-dep-management',
      'Задача затрагивает маршруты согласования, ответственность за отклонения, SLA подрядчиков и управленческие отчеты.',
      'Целевой процесс снабжения и SLA',
      'Школа менеджмента поможет описать будущий процесс, роли участников, контрольные точки и измеримые эффекты пилота.',
    ),
  ];
  const project2Analysis = makeAnalysis(
    departments,
    'demo-project-logistics',
    'Запрос описывает цифровой контур планирования поставок для промышленного партнера. MVP должен принимать Excel-шаблоны подрядчиков, проверять качество данных, прогнозировать потребность на 4-8 недель, показывать риски срыва сроков и формировать управленческий дашборд.',
    suggestions2,
    [
      {
        title: 'Описать модель данных поставок',
        description:
          'Зафиксировать обязательные поля Excel-шаблонов, справочники материалов, статусы поставок, правила валидации и формат хранения истории.',
        priority: 'high',
      },
      {
        title: 'Собрать ETL и проверку качества данных',
        description:
          'Реализовать загрузку файлов, контроль дублей и пропусков, протокол ошибок и нормализацию данных для аналитики.',
        priority: 'high',
      },
      {
        title: 'Подготовить прогноз и риск-индикаторы',
        description:
          'Построить прогноз потребности, рассчитать отклонения от плана, выделить критичные позиции и настроить сигналы для руководителя.',
        priority: 'high',
      },
      {
        title: 'Спроектировать управленческий дашборд',
        description:
          'Согласовать показатели, фильтры, роли пользователей и сценарий демонстрации пилота на одной производственной площадке.',
        priority: 'medium',
      },
    ],
  );
  const mailings2 = createMailingsFromSuggestions('demo-project-logistics', suggestions2, addMinutes(created2, 40));
  attachDemoResponses(mailings2, ['ACCEPTED', 'DECLINED', 'NONE', 'ACCEPTED', 'NONE', 'ACCEPTED']);

  const project2: DemoProject = {
    id: 'demo-project-logistics',
    title: 'Платформа прогнозирования поставок для промышленного партнера',
    sourceText: [
      'Описание проекта от заказчика:',
      'Промышленный партнер управляет поставками материалов на несколько площадок. Сейчас подрядчики присылают разные Excel-файлы, сотрудники вручную сводят остатки, план поставок и фактические даты отгрузки. Из-за этого сложно быстро понять, какие позиции сорвут сроки и где нужен резерв.',
      'Заказчик хочет начать с MVP для одной площадки. Приложение должно принимать унифицированный шаблон, проверять заполнение, показывать ошибки, хранить историю загрузок и формировать прогноз потребности на 4-8 недель.',
      'Отдельно нужен дашборд руководителя: критичные материалы, отклонение от плана, надежность подрядчиков, ближайшие риски и краткое пояснение, почему система считает поставку проблемной.',
      'На втором этапе возможны интеграции с ERP, но для презентации достаточно web-интерфейса, загрузки файлов и понятной аналитической витрины.',
    ].join('\n\n'),
    status: 'SENT',
    queuedAt: addMinutes(created2, 4),
    processingAt: addMinutes(created2, 8),
    readyAt: addMinutes(created2, 14),
    approvedAt: addMinutes(created2, 36),
    sendingAt: addMinutes(created2, 38),
    sentAt: addMinutes(created2, 42),
    failedAt: null,
    createdAt: created2,
    updatedAt: addMinutes(created2, 42),
    author: manager,
    analysis: project2Analysis,
    mailings: mailings2,
    responses: mailings2.filter((mailing) => mailing.response).map((mailing) => ({
      id: mailing.response!.id,
      responderEmail: mailing.response!.responderEmail,
      responderName: mailing.response!.responderName,
      decision: mailing.response!.decision,
      respondedAt: mailing.response!.respondedAt,
      department: { id: mailing.department.id, code: '', name: mailing.department.name },
    })),
  };

  const created3 = daysAgo(6, 16);
  const suggestions3 = [
    makeSuggestion(
      departments,
      'demo-sug-3-geo',
      'demo-dep-geo',
      'Запрос связан с геоданными, картографией, экологическими рисками, маршрутами техники, точками отбора проб и историей инцидентов.',
      'ГИС-модель участка и карта экологических рисков',
      'Институт наук о Земле может подготовить структуру геоданных, слои карты, классификацию рисков и методику пилотного мониторинга участка.',
    ),
    makeSuggestion(
      departments,
      'demo-sug-3-data',
      'demo-dep-data',
      'Нужны сбор разрозненных данных из Excel, shapefile и отчетов, нормализация истории инцидентов и расчет динамики рисков.',
      'Аналитика инцидентов и витрина показателей',
      'Центр анализа данных поможет собрать ETL-контур, метрики риска, витрину показателей и расчет приоритетов для наблюдения.',
    ),
    makeSuggestion(
      departments,
      'demo-sug-3-dev',
      'demo-dep-dev',
      'Заказчик хочет интерактивный интерфейс для просмотра карты, фильтрации слоев, карточек объектов и выгрузки отчета для руководства.',
      'Интерактивный web-интерфейс карты',
      'Центр разработки может собрать web-прототип с ролями, слоями карты, карточками объектов, журналом изменений и экспортом отчета.',
    ),
  ];
  const project3: DemoProject = {
    id: 'demo-project-geo-monitoring',
    title: 'ГИС-мониторинг экологических рисков на месторождении',
    sourceText: [
      'Диалог с заказчиком:',
      'Заказчик: Нам нужна карта рисков для месторождения: зоны подтопления, маршруты техники, точки отбора проб, история инцидентов и участки, где регулярно возникают нарушения регламента.',
      'Проектный офис: Есть ли данные в цифровом виде?',
      'Заказчик: Часть есть в Excel и shapefile, часть в отчетах подрядчиков. Данные разного качества, но для пилота можно ограничиться одним участком и несколькими типами рисков.',
      'Проектный офис: Какой результат нужен для демонстрации?',
      'Заказчик: Интерактивная карта со слоями, карточками объектов, историей инцидентов и цветовой оценкой риска. Руководитель должен увидеть, где требуется внимание и почему.',
      'Проектный офис: Нужны прогнозы или достаточно мониторинга?',
      'Заказчик: Для первого этапа достаточно мониторинга и правил ранжирования рисков. Но архитектуру нужно заложить так, чтобы позже добавить прогноз по новым наблюдениям.',
    ].join('\n'),
    status: 'READY_FOR_REVIEW',
    queuedAt: addMinutes(created3, 6),
    processingAt: addMinutes(created3, 8),
    readyAt: addMinutes(created3, 15),
    failedAt: null,
    createdAt: created3,
    updatedAt: addMinutes(created3, 15),
    author: analyst,
    analysis: makeAnalysis(
      departments,
      'demo-project-geo-monitoring',
      'Запрос направлен на создание ГИС-прототипа экологического мониторинга месторождения. Для MVP нужно объединить разрозненные геоданные, показать зоны риска, маршруты техники, точки отбора проб, историю инцидентов и подготовить понятный сценарий демонстрации руководству.',
      suggestions3,
      [
        {
          title: 'Инвентаризировать источники геоданных',
          description:
            'Собрать Excel, shapefile и отчеты, описать качество данных, обязательные атрибуты объектов и правила привязки к карте.',
          priority: 'high',
        },
        {
          title: 'Сформировать карту рисков участка',
          description:
            'Определить слои карты, типы рисков, цветовую шкалу, карточки объектов и правила отображения истории инцидентов.',
          priority: 'high',
        },
        {
          title: 'Подготовить интерактивный прототип',
          description:
            'Реализовать web-карту с фильтрами, слоями, карточками объектов, журналом изменений и экспортом краткого отчета.',
          priority: 'medium',
        },
        {
          title: 'Описать методику пилотного мониторинга',
          description:
            'Зафиксировать сценарий регулярного обновления данных, ответственных участников и критерии успешности пилота.',
          priority: 'medium',
        },
      ],
    ),
    mailings: [],
    responses: [],
  };

  const created4 = daysAgo(0, 9);
  const project4: DemoProject = {
    id: 'demo-project-edtech',
    title: 'Онлайн-тренажер для адаптации новых сотрудников',
    sourceText: [
      'Краткое описание:',
      'Компания хочет запустить обучающий тренажер для новых сотрудников производственного блока. Сейчас адаптация проходит очно, материалы хранятся в разных презентациях, а HR не видит, какие темы вызывают больше всего ошибок.',
      'В MVP нужны интерактивные сценарии типовых рабочих ситуаций, тестирование знаний, прогресс пользователя, личный кабинет наставника и выгрузка результатов для HR. Заказчик отдельно просит предусмотреть разные роли: стажер, наставник, HR-специалист и администратор контента.',
      'Пока не хватает детализации по критериям оценки, перечню сценариев и формату отчетности, поэтому проект находится в черновике и ожидает уточняющей встречи.',
    ].join('\n\n'),
    status: 'DRAFT',
    queuedAt: null,
    processingAt: null,
    readyAt: null,
    failedAt: null,
    createdAt: created4,
    updatedAt: created4,
    author: developer,
    analysis: null,
    mailings: [],
    responses: [],
  };

  const created5 = daysAgo(4, 12);
  const project5: DemoProject = {
    id: 'demo-project-bio-quality',
    title: 'Система контроля качества лабораторных проб',
    sourceText: [
      'Описание проекта:',
      'Заказчик просит автоматизировать учет лабораторных проб, контроль сроков исследований и формирование паспорта качества. Сейчас сотрудники ведут журнал в Excel, вручную назначают ответственных и отдельно собирают итоговые протоколы.',
      'Предварительно требуется регистрация пробы, QR-метка, маршрут по лаборатории, контроль просрочек, история изменений, шаблон паспорта качества и уведомления ответственным сотрудникам.',
      'В исходных данных пока не указаны типы проб, регламенты хранения, требования к электронным подписям, роли пользователей и правила архивирования результатов. Поэтому проект оставлен в черновике до получения уточнений от заказчика.',
    ].join('\n\n'),
    status: 'DRAFT',
    queuedAt: null,
    processingAt: null,
    readyAt: null,
    failedAt: null,
    createdAt: created5,
    updatedAt: created5,
    author: researcher,
    analysis: null,
    mailings: [],
    responses: [],
  };

  return [project4, project3, project1, project2, project5];
}

function createMailingsFromSuggestions(
  projectId: string,
  suggestions: ProjectSuggestion[],
  sentAt: string,
): DemoMailing[] {
  const mailings: DemoMailing[] = [];
  let index = 0;
  for (const suggestion of suggestions.filter((item) => item.includeInMailing)) {
    const recipients = suggestion.customRecipients?.length
      ? suggestion.customRecipients.map((email) => ({ email, displayName: email, competencies: [] }))
      : suggestion.department.recipients;

    for (const recipient of recipients) {
      index += 1;
      const recipientEmail = recipient.email;
      const recipientName = recipient.displayName || suggestion.department.name;
      mailings.push({
        id: `demo-mailing-row-${projectId}-${index}`,
        mailingId: `demo-mailing-${projectId}-${index}`,
        subject: suggestion.customSubject ?? suggestion.emailSubject,
        status: 'SENT',
        sentAt,
        department: { id: suggestion.department.id, name: suggestion.department.name },
        recipient: {
          type: recipient.displayName ? 'EMPLOYEE' : 'DEPARTMENT',
          name: recipientName,
          email: recipientEmail,
        },
        response: null,
      });
    }
  }
  return mailings;
}

function attachDemoResponses(mailings: DemoMailing[], decisions: Array<'ACCEPTED' | 'DECLINED' | 'NONE'>): void {
  mailings.forEach((mailing, index) => {
    const decision = decisions[index % decisions.length];
    if (decision === 'NONE') {
      return;
    }
    const respondedAt = addMinutes(mailing.sentAt ?? nowIso(), 45 + index * 16);
    mailing.response = {
      id: `demo-response-${mailing.id}`,
      responderEmail: mailing.recipient.email,
      responderName: mailing.recipient.name,
      decision,
      respondedAt,
    };
  });
}

function createDemoNotifications(projects: DemoProject[]): RealtimeNotification[] {
  return [
    {
      id: 'demo-notification-1',
      projectId: 'demo-project-logistics',
      title: 'Получен отклик',
      message: 'Центр анализа данных подтвердил участие в проекте по прогнозированию поставок.',
      isRead: false,
      createdAt: addMinutes(projects[3].sentAt ?? daysAgo(7), 66),
    },
    {
      id: 'demo-notification-2',
      projectId: 'demo-project-ai-support',
      title: 'Анализ готов',
      message: 'AI-помощник для обработки обращений готов к проверке и рассылке.',
      isRead: false,
      createdAt: projects[2].readyAt ?? daysAgo(10),
    },
    {
      id: 'demo-notification-3',
      projectId: 'demo-project-bio-quality',
      title: 'Требуется уточнение',
      message: 'Для лабораторного проекта нужно добавить роли пользователей и типы проб.',
      isRead: true,
      createdAt: projects[4].failedAt ?? daysAgo(4),
    },
  ];
}

function createInitialDemoState(): DemoState {
  const users = createDemoUsers();
  const departments = createDemoDepartments();
  const projects = createDemoProjects(users, departments);
  return {
    users,
    departments,
    projects,
    notifications: createDemoNotifications(projects),
    createdAt: nowIso(),
  };
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
}

function readState(): DemoState {
  const storage = getStorage();
  if (!storage) {
    return createInitialDemoState();
  }

  const raw = storage.getItem(DEMO_STATE_KEY);
  if (!raw) {
    const state = createInitialDemoState();
    writeState(state);
    return state;
  }

  try {
    return JSON.parse(raw) as DemoState;
  } catch {
    const state = createInitialDemoState();
    writeState(state);
    return state;
  }
}

function writeState(state: DemoState): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
}

export function isDemoMode(): boolean {
  const storage = getStorage();
  return storage?.getItem(DEMO_SESSION_KEY) === 'active';
}

export function startDemoMode(): { user: CurrentUser; csrfToken: string } {
  const storage = getStorage();
  if (storage) {
    storage.setItem(DEMO_SESSION_KEY, 'active');
    storage.setItem(DEMO_STATE_KEY, JSON.stringify(createInitialDemoState()));
  }
  return { user: DEMO_USER, csrfToken: DEMO_CSRF_TOKEN };
}

export function stopDemoMode(): void {
  const storage = getStorage();
  storage?.removeItem(DEMO_SESSION_KEY);
  storage?.removeItem(DEMO_STATE_KEY);
}

export function getDemoSessionUser(): CurrentUser | null {
  return isDemoMode() ? DEMO_USER : null;
}

function advanceDemoState(state: DemoState): DemoState {
  return state;
}

function projectListItem(project: DemoProject): ProjectListItem {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    queuedAt: project.queuedAt,
    processingAt: project.processingAt,
    sendingAt: project.sendingAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    author: project.author,
    analysis: project.analysis
      ? {
          id: project.analysis.id,
          summary: project.analysis.summary,
          generationStatus: project.analysis.generationStatus,
          updatedAt: project.updatedAt,
        }
      : null,
    _count: {
      mailings: project.mailings.length,
      responses: project.mailings.filter((item) => item.response).length,
    },
  };
}

function findProject(state: DemoState, projectId: string): DemoProject {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error('Демо-проект не найден');
  }
  return project;
}

function updateProject(state: DemoState, projectId: string, patch: Partial<DemoProject>): DemoProject {
  let updated: DemoProject | null = null;
  state.projects = state.projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }
    updated = { ...project, ...patch, updatedAt: patch.updatedAt ?? nowIso() };
    return updated;
  });
  if (!updated) {
    throw new Error('Демо-проект не найден');
  }
  writeState(state);
  return updated;
}

function replaceProject(state: DemoState, project: DemoProject): DemoProject {
  state.projects = state.projects.map((item) => (item.id === project.id ? project : item));
  writeState(state);
  return project;
}

function updateSuggestionDepartments(project: DemoProject, departments: DemoDepartment[]): DemoProject {
  if (!project.analysis) {
    return project;
  }
  return {
    ...project,
    analysis: {
      ...project.analysis,
      suggestions: project.analysis.suggestions.map((suggestion) => {
        const department = departmentById(departments, suggestion.departmentId);
        return {
          ...suggestion,
          department: {
            id: department.id,
            code: department.code,
            name: department.name,
            recipients: recipientsForSuggestion(department),
          },
        };
      }),
    },
  };
}

function projectResponses(project: DemoProject): DemoMailing[] {
  return project.mailings;
}

function normalizeTaskPriority(priority: string): 'high' | 'medium' | 'low' {
  return priority === 'high' || priority === 'medium' || priority === 'low'
    ? priority
    : 'medium';
}

function buildSuggestionFromLlm(
  departments: DemoDepartment[],
  projectTitle: string,
  raw: DemoLlmResult['departmentSuggestions'][number],
  index: number,
): ProjectSuggestion | null {
  const department =
    departments.find((item) => item.code === raw.departmentCode) ??
    departments.find((item) =>
      raw.departmentCode
        ? item.code.toLowerCase() === raw.departmentCode.toLowerCase()
        : false,
    ) ??
    departments[index % departments.length];

  if (!department) {
    return null;
  }

  return {
    id: makeId('demo-suggestion'),
    departmentId: department.id,
    relevanceReason:
      raw.relevanceReason?.trim() ||
      `Подразделение «${department.name}» обладает релевантной экспертизой.`,
    problemFragment: raw.problemFragment?.trim() || projectTitle,
    adaptedPitch:
      raw.adaptedPitch?.trim() ||
      'Можно подключиться к уточнению требований и оценке пилотного решения.',
    emailSubject:
      raw.emailSubject?.trim() || `Предложение участия в проекте «${projectTitle}»`,
    emailBody:
      raw.emailBody?.trim() ||
      [
        'Коллеги, здравствуйте!',
        '',
        `Предлагаем рассмотреть участие в проекте «${projectTitle}».`,
        '',
        raw.adaptedPitch?.trim() ||
          'Просим оценить возможность подключения к проекту и предложить формат участия.',
      ].join('\n'),
    includeInMailing: true,
    customSubject: null,
    customBody: null,
    customRecipients: null,
    department: {
      id: department.id,
      code: department.code,
      name: department.name,
      recipients: recipientsForSuggestion(department),
    },
  };
}

function buildAnalysisFromLlm(
  project: DemoProject,
  departments: DemoDepartment[],
  llmResult: DemoLlmResult,
): DemoAnalysis {
  const suggestions = llmResult.departmentSuggestions
    .map((suggestion, index) =>
      buildSuggestionFromLlm(departments, project.title, suggestion, index),
    )
    .filter((suggestion): suggestion is ProjectSuggestion => Boolean(suggestion));

  return {
    id: makeId('demo-analysis'),
    summary: llmResult.summary,
    tasksJson: llmResult.tasks.map((task) => ({
      title: task.title,
      description: task.description,
      priority: normalizeTaskPriority(task.priority),
    })),
    rawJson: llmResult,
    generationStatus: 'READY',
    errorMessage: null,
    suggestions,
  };
}

async function runRealDemoAnalysis(
  state: DemoState,
  projectId: string,
): Promise<DemoProject> {
  let project = findProject(state, projectId);
  const startedAt = nowIso();
  project = updateProject(state, projectId, {
    status: 'PROCESSING',
    queuedAt: startedAt,
    processingAt: startedAt,
    readyAt: null,
    failedAt: null,
    analysis: null,
    mailings: [],
    responses: [],
  });

  try {
    const response = await fetch(`${DEMO_API_URL}/demo/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-projectoria-demo': 'true',
      },
      credentials: 'include',
      body: JSON.stringify({
        projectTitle: project.title,
        sourceText: project.sourceText,
        departments: state.departments
          .filter((department) => department.isActive)
          .map((department) => ({
            code: department.code,
            name: department.name,
            competencies: department.competencies,
            employeeCompetencies: [
              ...new Set(department.recipients.flatMap((recipient) => recipient.competencies)),
            ],
          })),
      }),
    });

    const payload = (await response.json()) as DemoLlmResult | { message?: string };
    if (!response.ok) {
      throw new Error(
        (payload as { message?: string }).message ||
          `Демо-анализ завершился ошибкой ${response.status}`,
      );
    }

    const readyAt = nowIso();
    const analysis = buildAnalysisFromLlm(project, state.departments, payload as DemoLlmResult);
    project = updateProject(state, projectId, {
      status: 'READY_FOR_REVIEW',
      readyAt,
      failedAt: null,
      updatedAt: readyAt,
      analysis,
    });
    pushNotification(state, {
      projectId: project.id,
      title: 'Анализ готов',
      message: `Реальная модель подготовила рекомендации по проекту «${project.title}».`,
    });
    writeState(state);
    return updateSuggestionDepartments(clone(project), state.departments);
  } catch (error) {
    updateProject(state, projectId, {
      status: 'DRAFT',
      queuedAt: null,
      processingAt: null,
      readyAt: null,
      failedAt: null,
      analysis: null,
    });
    throw error instanceof Error ? error : new Error('Не удалось выполнить демо-анализ');
  }
}

function pushNotification(state: DemoState, notification: Omit<RealtimeNotification, 'id' | 'createdAt' | 'isRead'>): void {
  state.notifications = [
    {
      ...notification,
      id: makeId('demo-notification'),
      isRead: false,
      createdAt: nowIso(),
    },
    ...state.notifications,
  ];
}

async function handleProjectExtractText(options: RequestInit): Promise<{ text: string; fileName: string }> {
  const body = options.body;
  if (typeof FormData === 'undefined' || !(body instanceof FormData)) {
    throw new Error('Файл не передан');
  }
  const file = body.get('file');
  if (!(file instanceof File)) {
    throw new Error('Файл не передан');
  }
  return {
    text: await file.text(),
    fileName: file.name,
  };
}

function handleProjects(path: string, method: string, options: RequestInit, state: DemoState): unknown {
  const parts = path.split('/').filter(Boolean);

  if (path === '/projects/extract-text' && method === 'POST') {
    return handleProjectExtractText(options);
  }

  if (path === '/projects' && method === 'GET') {
    return advanceDemoState(state).projects.map(projectListItem);
  }

  if (path === '/projects' && method === 'POST') {
    const body = parseJsonBody<{ title: string; sourceText: string }>(options.body);
    const createdAt = nowIso();
    const project: DemoProject = {
      id: makeId('demo-project'),
      title: body.title.trim(),
      sourceText: body.sourceText.trim(),
      status: 'DRAFT',
      queuedAt: null,
      processingAt: null,
      readyAt: null,
      failedAt: null,
      createdAt,
      updatedAt: createdAt,
      author: userShort(state.users[1] ?? state.users[0]),
      analysis: null,
      mailings: [],
      responses: [],
    };
    state.projects = [project, ...state.projects];
    writeState(state);
    return { id: project.id };
  }

  if (parts[0] !== 'projects' || !parts[1]) {
    return undefined;
  }

  const projectId = parts[1];

  if (parts.length === 2 && method === 'GET') {
    const advanced = advanceDemoState(state);
    return updateSuggestionDepartments(clone(findProject(advanced, projectId)), advanced.departments);
  }

  if (parts[2] === 'responses' && method === 'GET') {
    return projectResponses(findProject(advanceDemoState(state), projectId));
  }

  if (parts[2] === 'source-text' && method === 'PATCH') {
    const body = parseJsonBody<{ sourceText: string }>(options.body);
    return updateProject(state, projectId, {
      sourceText: body.sourceText.trim(),
      status: 'DRAFT',
      queuedAt: null,
      processingAt: null,
      readyAt: null,
      failedAt: null,
      approvedAt: null,
      sendingAt: null,
      sentAt: null,
      analysis: null,
      mailings: [],
      responses: [],
    });
  }

  if (parts[2] === 'analyze' && parts[3] === 'cancel' && method === 'POST') {
    return updateProject(state, projectId, {
      status: 'DRAFT',
      queuedAt: null,
      processingAt: null,
      readyAt: null,
      failedAt: null,
      analysis: null,
    });
  }

  if (parts[2] === 'analyze' && method === 'POST') {
    return runRealDemoAnalysis(state, projectId);
  }

  if (parts[2] === 'suggestions' && method === 'PATCH') {
    const body = parseJsonBody<{
      suggestions: Array<{
        id: string;
        includeInMailing: boolean;
        customSubject?: string;
        customBody?: string;
        recipients?: string[];
      }>;
    }>(options.body);
    const project = findProject(state, projectId);
    if (!project.analysis) {
      throw new Error('Результат анализа еще не сформирован');
    }
    const patches = new Map(body.suggestions.map((item) => [item.id, item]));
    project.analysis = {
      ...project.analysis,
      suggestions: project.analysis.suggestions.map((suggestion) => {
        const patch = patches.get(suggestion.id);
        if (!patch) {
          return suggestion;
        }
        return {
          ...suggestion,
          includeInMailing: patch.includeInMailing,
          customSubject: patch.customSubject ?? suggestion.customSubject,
          customBody: patch.customBody ?? suggestion.customBody,
          customRecipients: patch.recipients ?? suggestion.customRecipients,
        };
      }),
    };
    project.updatedAt = nowIso();
    replaceProject(state, project);
    return updateSuggestionDepartments(clone(project), state.departments);
  }

  if (parts[2] === 'approve-and-send' && method === 'POST') {
    const body = parseJsonBody<{ suggestions?: Array<{ id: string; includeInMailing: boolean; customSubject?: string; customBody?: string; recipients?: string[] }> }>(options.body);
    if (body.suggestions?.length) {
      handleProjects(`/projects/${projectId}/suggestions`, 'PATCH', { ...options, body: JSON.stringify({ suggestions: body.suggestions }) }, state);
    }
    const project = findProject(state, projectId);
    if (!project.analysis) {
      throw new Error('Результат анализа еще не сформирован');
    }
    const sentAt = nowIso();
    const mailings = createMailingsFromSuggestions(project.id, project.analysis.suggestions, sentAt);
    attachDemoResponses(mailings, ['ACCEPTED', 'NONE', 'DECLINED', 'ACCEPTED', 'NONE']);
    project.status = 'SENT';
    project.approvedAt = sentAt;
    project.sendingAt = sentAt;
    project.sentAt = sentAt;
    project.mailings = mailings;
    project.responses = mailings.filter((mailing) => mailing.response).map((mailing) => ({
      id: mailing.response!.id,
      responderEmail: mailing.response!.responderEmail,
      responderName: mailing.response!.responderName,
      decision: mailing.response!.decision,
      respondedAt: mailing.response!.respondedAt,
      department: { id: mailing.department.id, code: '', name: mailing.department.name },
    }));
    project.updatedAt = sentAt;
    pushNotification(state, {
      projectId: project.id,
      title: 'Демо-рассылка отправлена',
      message: `По проекту «${project.title}» сформированы письма и демо-отклики.`,
    });
    replaceProject(state, project);
    return updateSuggestionDepartments(clone(project), state.departments);
  }

  return undefined;
}

function handleUsers(path: string, method: string, options: RequestInit, state: DemoState): unknown {
  if (path === '/users' && method === 'GET') {
    return state.users;
  }

  if (path === '/users' && method === 'POST') {
    const body = parseJsonBody<{ email: string; fullName: string; role: DemoRole; status?: DemoUserStatus }>(options.body);
    const email = body.email.toLowerCase().trim();
    if (state.users.some((user) => user.email === email)) {
      throw new Error('Пользователь с таким email уже существует');
    }
    const createdAt = nowIso();
    const user: DemoUser = {
      id: makeId('demo-user'),
      email,
      fullName: body.fullName.trim(),
      role: body.role,
      status: body.status ?? 'ACTIVE',
      createdAt,
      updatedAt: createdAt,
    };
    state.users = [user, ...state.users];
    writeState(state);
    return user;
  }

  const match = path.match(/^\/users\/([^/]+)$/);
  if (!match) {
    return undefined;
  }
  const userId = match[1];

  if (method === 'PATCH') {
    const body = parseJsonBody<Partial<DemoUser> & { password?: string }>(options.body);
    let updated: DemoUser | null = null;
    state.users = state.users.map((user) => {
      if (user.id !== userId) {
        return user;
      }
      updated = {
        ...user,
        email: body.email?.toLowerCase().trim() ?? user.email,
        fullName: body.fullName?.trim() ?? user.fullName,
        role: body.role ?? user.role,
        status: body.status ?? user.status,
        updatedAt: nowIso(),
      };
      return updated;
    });
    if (!updated) {
      throw new Error('Пользователь не найден');
    }
    writeState(state);
    return updated;
  }

  if (method === 'DELETE') {
    if (userId === DEMO_USER.id) {
      throw new Error('Нельзя удалить демо-администратора');
    }
    state.users = state.users.filter((user) => user.id !== userId);
    writeState(state);
    return { ok: true };
  }

  return undefined;
}

function handleDepartments(path: string, method: string, options: RequestInit, state: DemoState): unknown {
  if (path === '/departments' && method === 'GET') {
    return state.departments.filter((department) => !('deletedAt' in department));
  }

  if (path === '/departments/active' && method === 'GET') {
    return state.departments.filter((department) => department.isActive);
  }

  if (path === '/departments' && method === 'POST') {
    const body = parseJsonBody<{ name: string; competencies?: string[]; recipients?: Array<{ email: string; displayName?: string | null; competencies?: string[] }> }>(options.body);
    const createdAt = nowIso();
    const department: DemoDepartment = {
      id: makeId('demo-dep'),
      code: `DEMO-${state.departments.length + 1}`,
      name: body.name.trim(),
      competencies: normalizeCompetencies(body.competencies),
      isActive: true,
      recipients: normalizeRecipients(body.recipients),
      createdAt,
      updatedAt: createdAt,
    };
    state.departments = [department, ...state.departments];
    writeState(state);
    return department;
  }

  const match = path.match(/^\/departments\/([^/]+)$/);
  if (!match) {
    return undefined;
  }
  const departmentId = match[1];

  if (method === 'PATCH') {
    const body = parseJsonBody<Partial<DemoDepartment> & { recipients?: Array<{ email: string; displayName?: string | null; competencies?: string[] }> }>(options.body);
    let updated: DemoDepartment | null = null;
    state.departments = state.departments.map((department) => {
      if (department.id !== departmentId) {
        return department;
      }
      updated = {
        ...department,
        name: body.name?.trim() ?? department.name,
        competencies: body.competencies ? normalizeCompetencies(body.competencies) : department.competencies,
        isActive: body.isActive ?? department.isActive,
        recipients: body.recipients ? normalizeRecipients(body.recipients) : department.recipients,
        updatedAt: nowIso(),
      };
      return updated;
    });
    if (!updated) {
      throw new Error('Подразделение не найдено');
    }
    writeState(state);
    return updated;
  }

  if (method === 'DELETE') {
    state.departments = state.departments.filter((department) => department.id !== departmentId);
    writeState(state);
    return { ok: true };
  }

  return undefined;
}

function handleNotifications(path: string, method: string, state: DemoState): unknown {
  if (path === '/notifications' && method === 'GET') {
    return state.notifications;
  }

  const match = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (match && method === 'PATCH') {
    state.notifications = state.notifications.map((notification) =>
      notification.id === match[1] ? { ...notification, isRead: true } : notification,
    );
    writeState(state);
    return { ok: true };
  }

  return undefined;
}

export async function handleDemoApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<DemoApiResult<T>> {
  if (!isDemoMode()) {
    return { handled: false };
  }

  const method = (options.method ?? 'GET').toUpperCase();

  try {
    if (path === '/auth/me' && method === 'GET') {
      return { handled: true, value: DEMO_USER as T };
    }

    if (path === '/auth/logout' && method === 'POST') {
      stopDemoMode();
      return { handled: true, value: { ok: true } as T };
    }

    const state = advanceDemoState(readState());
    const handlers = [
      handleNotifications(path, method, state),
      handleProjects(path, method, options, state),
      handleUsers(path, method, options, state),
      handleDepartments(path, method, options, state),
    ];

    for (const result of handlers) {
      if (result !== undefined) {
        const value = result instanceof Promise ? await result : result;
        return { handled: true, value: clone(value) as T };
      }
    }

    throw new Error(`Демо-режим не поддерживает запрос ${method} ${path}`);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Ошибка демо-режима');
  }
}
