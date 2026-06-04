import { domainToASCII } from 'node:url';

function normalizeUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim();

  try {
    const url = new URL(raw);
    const asciiHost = domainToASCII(url.hostname);
    if (asciiHost) {
      url.hostname = asciiHost;
    }

    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return raw;
  }
}

function normalizeOrigin(value: string | undefined, fallback: string): string {
  const raw = normalizeUrl(value, fallback);

  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  appUrl: normalizeOrigin(process.env.APP_URL, 'http://localhost:3000'),
  apiUrl: normalizeUrl(process.env.API_URL, 'http://localhost:3001'),
  publicBaseUrl: normalizeUrl(
    process.env.PUBLIC_BASE_URL,
    'http://localhost:3000',
  ),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/projectoria?schema=public',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? '',
  },
  jwt: {
    secret: process.env.JWT_ACCESS_SECRET ?? 'change_me_access_secret',
    ttl: process.env.JWT_ACCESS_TTL ?? '8h',
    cookieName: process.env.JWT_COOKIE_NAME ?? 'projectoria_access',
  },
  csrf: {
    cookieName: process.env.CSRF_COOKIE_NAME ?? 'projectoria_csrf',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Платформа ТюмГУ <noreply@utmn.local>',
  },
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'mock',
    apiUrl: process.env.LLM_API_URL ?? '',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? '',
  },
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL ?? '',
    emailWorkflowUrl: process.env.N8N_EMAIL_WORKFLOW_URL ?? '',
    llmWebhookUrl: process.env.N8N_LLM_WEBHOOK_URL ?? '',
    llmTimeoutMs: Number(process.env.N8N_LLM_TIMEOUT_MS ?? 900000),
  },
  throttle: {
    ttl: Number(process.env.THROTTLE_TTL ?? 60),
    limit: Number(process.env.THROTTLE_LIMIT ?? 20),
  },
});
