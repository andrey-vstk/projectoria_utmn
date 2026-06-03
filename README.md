# MVP: Платформа обработки индустриальных текстов (ТюмГУ)

## 1) Выбранная архитектура

**Основной стек (реализован):**
- Frontend: **Next.js 15 + TypeScript**
- Backend API: **NestJS 11 + TypeScript**
- БД: **PostgreSQL + Prisma**
- Фоновые задачи: **Redis + BullMQ**
- Auth: **локальные аккаунты, bcrypt, JWT в httpOnly cookie + CSRF header**
- Email: **SMTP (nodemailer)**
- Интеграции: **n8n webhook + n8n workflow (email + LLM через Ollama)**
- Контейнеризация: **Docker Compose**

Почему этот стек подходит для MVP:
- быстрое прототипирование + production-friendly модульность;
- четкое разделение синхронного API и асинхронной обработки;
- масштабирование: отдельные очереди, возможность выделить worker-процесс позже;
- легко заменить LLM-провайдера, SMTP-шлюз, добавить SSO/LDAP.

## 2) Структура репозитория

```txt
.
├── apps
│   ├── api
│   │   ├── prisma
│   │   │   ├── migrations
│   │   │   │   └── 20260320100000_init/migration.sql
│   │   │   ├── schema.prisma
│   │   │   └── seed.js
│   │   ├── src
│   │   │   ├── auth
│   │   │   ├── users
│   │   │   ├── departments
│   │   │   ├── projects
│   │   │   ├── analysis
│   │   │   ├── mailings
│   │   │   ├── responses
│   │   │   ├── notifications
│   │   │   ├── llm
│   │   │   ├── n8n
│   │   │   ├── queues
│   │   │   ├── mail
│   │   │   ├── prisma
│   │   │   └── common
│   │   └── Dockerfile
│   └── web
│       ├── app
│       │   ├── login
│       │   ├── projects
│       │   ├── admin
│       │   └── respond
│       ├── components
│       ├── lib
│       └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 3) Реализованные роли

- `ADMIN`
  - управление пользователями
  - управление подразделениями и адресатами
  - просмотр всех проектов
  - управление системными настройками
- `INITIATOR`
  - создание проекта
  - запуск анализа
  - редактирование рекомендаций/писем
  - подтверждение и запуск рассылки
  - просмотр откликов по своим проектам

## 4) Схема БД (Prisma)

Сущности:
- `User` (аккаунт, роль, статус)
- `Department` + `DepartmentRecipient` (компетенции подразделений и сотрудников)
- `Project` (основной объект запроса)
- `AnalysisResult`
- `DepartmentSuggestion`
- `Mailing`
- `Response`
- `Notification`

Основные enum:
- `Role`: `ADMIN | INITIATOR`
- `ProjectStatus`: `DRAFT | QUEUED | PROCESSING | READY_FOR_REVIEW | APPROVED | SENDING | SENT | FAILED`
- `AnalysisStatus`: `PENDING | PROCESSING | READY | FAILED`
- `MailingStatus`: `DRAFT | QUEUED | SENDING | SENT | FAILED | SKIPPED`

Файл схемы: `apps/api/prisma/schema.prisma`  
Миграция: `apps/api/prisma/migrations/20260320100000_init/migration.sql`

## 5) Ключевые backend-модули

- `auth`: login/logout/me, JWT cookie, CSRF cookie
- `users`: CRUD аккаунтов (admin)
- `departments`: CRUD подразделений + emails
- `projects`: создание, список, детали, запуск анализа, правка предложений, подтверждение рассылки
- `analysis`: постановка в очередь и обработка LLM
- `mailings`: генерация писем, постановка задач отправки, статусы
- `responses`: публичный endpoint по токену, фиксация отклика
- `notifications`: уведомления в интерфейсе
- `llm`: `LLMProvider` + `MockLlmProvider` + `ExternalLlmProvider` + `N8nLlmProvider`
- `n8n`: webhook при создании проекта + optional email workflow
- `queues`: BullMQ processors (`analysis`, `mailing`)

## 6) API контракт (основные endpoints)

### Auth
- `POST /auth/login` (public)
- `POST /auth/logout`
- `GET /auth/me`

### Пользователи (admin)
- `GET /users`
- `POST /users`
- `PATCH /users/:id`

### Подразделения
- `GET /departments`
- `GET /departments/active`
- `POST /departments` (admin)
- `PATCH /departments/:id` (admin)
- `DELETE /departments/:id` (admin, soft-delete)

### Проекты
- `GET /projects`
- `POST /projects`
- `POST /projects/extract-text` (MVP: `.txt`)
- `GET /projects/:id`
- `POST /projects/:id/analyze`
- `PATCH /projects/:id/suggestions`
- `POST /projects/:id/approve-and-send`
- `GET /projects/:id/responses`

### Уведомления
- `GET /notifications`
- `PATCH /notifications/:id/read`

### Публичные отклики
- `GET /public/respond/:token` (HTML fallback)
- `GET /public/responses/:token/status`
- `POST /public/responses/:token`

### Health
- `GET /health` (public)

## 7) Асинхронный pipeline

1. Инициатор создает проект (`DRAFT`).
2. Нажимает «Запустить анализ» -> проект `QUEUED`, job в `analysis-queue`.
3. Worker переводит проект в `PROCESSING`, вызывает LLM.
4. Результат сохраняется в `AnalysisResult` + `DepartmentSuggestion`, проект -> `READY_FOR_REVIEW`.
5. Пользователь редактирует рекомендации/письма.
6. Нажимает «Подтвердить и разослать» -> проект `APPROVED`, затем `SENDING`, создаются `Mailing` и jobs в `mailing-queue`.
7. Письма уходят через SMTP (или n8n workflow), статусы `MailingStatus` обновляются.
8. По ссылке из письма фиксируется `Response`, создается `Notification`, инициатору уходит email.

## 8) LLM: схема и prompt

- Абстракция: `apps/api/src/llm/llm.provider.ts`
- Prompt-шаблон: `apps/api/src/llm/llm.prompt.ts`
- Провайдеры:
  - `MockLlmProvider` (`LLM_PROVIDER=mock`)
  - `ExternalLlmProvider` (`LLM_PROVIDER=external`)
  - `N8nLlmProvider` (`LLM_PROVIDER=n8n`, `N8N_LLM_WEBHOOK_URL=...`)

Ожидаемый JSON LLM:
```json
{
  "summary": "...",
  "tasks": [{ "title": "...", "description": "...", "priority": "high|medium|low" }],
  "departmentSuggestions": [
    {
      "departmentCode": "ШКН",
      "relevanceReason": "...",
      "problemFragment": "...",
      "adaptedPitch": "...",
      "emailSubject": "...",
      "emailBody": "..."
    }
  ]
}
```

## 9) Frontend UX/UI

Реализованы страницы:
- `/login` — вход
- `/` — список проектов
- `/projects/new` — создание проекта + загрузка `.txt`
- `/projects/[id]` — полный workflow проекта
- `/projects/[id]/responses` — отклики
- `/admin/users` — пользователи
- `/admin/departments` — подразделения
- `/respond/[token]` — публичный отклик

Дизайн-система:
- фирменный акцент: `#00AEEF`
- оттенки: `80/60/40/20/5` в CSS tokens
- светлый строгий стиль, карточки/таблицы/chips, адаптив
- placeholder под логотип в header (`ЛОГО`)

## 10) Запуск через Docker Compose (рекомендуется)

### 10.1 Подготовка env
```bash
cp .env.example .env
```

### 10.2 Запуск
```bash
docker compose up --build
```

Сервисы:
- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- MailHog UI: `http://localhost:8025`
- n8n: `http://localhost:5678`
- Ollama: `http://localhost:11434`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

При старте API контейнер выполняет:
- `prisma migrate deploy`
- `seed`
- запуск приложения

## 11) Локальный запуск без Docker

Нужны: Node.js 20+, PostgreSQL 16+, Redis 7+.

```bash
# корень
cp .env.example .env

# backend
cd apps/api
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev

# frontend (в отдельном терминале)
cd apps/web
npm install
npm run dev
```

## 12) Первый админ и seed

Seed (`apps/api/prisma/seed.js`) создает:
- admin-пользователя из env:
  - `SEED_ADMIN_EMAIL`
  - `SEED_ADMIN_PASSWORD`
  - `SEED_ADMIN_NAME`
- подразделения:
  - `ШКН`, `ШЕН`, `ПИШ`, `ФЭИ`
- базовые recipient emails

## 13) SMTP настройка

Ключевые env:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

В dev по умолчанию используется MailHog (`1025`), письма видны в `http://localhost:8025`.

## 14) Интеграция с n8n

- `N8N_WEBHOOK_URL`: вызов при создании проекта
- `N8N_EMAIL_WORKFLOW_URL`: если задан, отправка email делегируется в n8n workflow
- `N8N_LLM_WEBHOOK_URL`: webhook n8n для LLM-анализа (через Ollama или другую локальную модель)
- `N8N_LLM_TIMEOUT_MS`: таймаут ожидания ответа LLM workflow

Что делает приложение:
- хранит бизнес-состояние, статусы, токены отклика
- инициирует webhook/workflow
- продолжает управлять очередями и статусами анализа/рассылки

Что может делать n8n:
- дополнительная оркестрация
- интеграция с корпоративным почтовым шлюзом
- внешние уведомления/логирование
- визуальная цепочка LLM-обработки (prompting, постобработка, валидация)

### Рекомендуемый сценарий для вашей цели (локально, без утечки данных)

0. Подтянуть модель в Ollama:
```bash
docker compose exec ollama ollama pull llama3.1:8b
```

1. В `.env`:
```env
LLM_PROVIDER=n8n
# если API в Docker Compose:
N8N_LLM_WEBHOOK_URL=http://n8n:5678/webhook/llm-analyze
# если API запускается локально вне Docker:
# N8N_LLM_WEBHOOK_URL=http://localhost:5678/webhook/llm-analyze
LLM_MODEL=ollama-локальная-модель
```

2. В n8n собрать workflow:
- `Webhook` (POST `/llm-analyze`)
- `Code`/`Set` (сбор prompt из `prompt` или входных полей)
- `HTTP Request` к `http://ollama:11434/api/chat` (или `/api/generate`)
- `Code` (нормализовать ответ до JSON по схеме)
- `Respond to Webhook`

3. `Respond to Webhook` должен вернуть JSON структуры:
```json
{
  "summary": "string",
  "tasks": [{ "title": "string", "description": "string", "priority": "high|medium|low" }],
  "departmentSuggestions": [
    {
      "departmentCode": "string",
      "relevanceReason": "string",
      "problemFragment": "string",
      "adaptedPitch": "string",
      "emailSubject": "string",
      "emailBody": "string"
    }
  ]
}
```

Подробный контракт: `docs/n8n/llm-workflow-contract.md`.
Готовый import workflow: `docs/n8n/workflows/llm-analyze-ollama.workflow.json`.

## 15) Безопасность

Реализовано:
- bcrypt-хеширование паролей
- JWT в `httpOnly` cookie
- CSRF: double-submit (`csrf cookie` + `x-csrf-token`)
- RBAC (`ADMIN`, `INITIATOR`)
- публичный endpoint с rate-limit guard
- class-validator DTO валидация

## 16) Тесты

Базовые unit-тесты:
- `auth.service.spec.ts`
- `projects.service.spec.ts`
- `responses.service.spec.ts`

Команда:
```bash
cd apps/api
npm test
```

## 17) Планы расширения

- SSO/LDAP: добавить новый auth provider в `auth` модуль без изменения доменной модели
- замена SMTP на корпоративный gateway: через `MailService`
- смена LLM: через `LLMProvider`
- масштабирование: вынести worker в отдельный сервис (тот же код processors)

---

## Примечание по текущей среде разработки

В этой среде генерации отсутствуют `node`/`npm`, поэтому сборка и запуск тестов здесь не были выполнены. Код и конфигурация подготовлены для запуска в вашей среде (локально или через Docker Compose).
