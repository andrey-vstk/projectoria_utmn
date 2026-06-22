import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nService } from '../n8n/n8n.service';
import { buildLlmPrompt } from './llm.prompt';
import { LlmProvider } from './llm.provider';
import { LlmAnalysisInput, LlmStructuredResult } from './llm.types';
import { OllamaHealthService } from './ollama-health.service';

@Injectable()
export class N8nLlmProvider implements LlmProvider {
  readonly providerName = 'n8n';
  readonly modelName?: string;
  private readonly logger = new Logger(N8nLlmProvider.name);
  private readonly ollamaBaseUrl: string;
  private readonly ollamaProxyChatUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly n8nService: N8nService,
    private readonly ollamaHealthService: OllamaHealthService,
  ) {
    const configuredModel = this.configService.get<string>('llm.model')?.trim();
    this.modelName = configuredModel || 'qwen3.6:35b';
    this.ollamaBaseUrl = this.configService.get<string>('llm.ollamaBaseUrl') ?? '';
    this.ollamaProxyChatUrl =
      this.configService.get<string>('n8n.ollamaProxyChatUrl') ?? '';
  }

  async analyze(input: LlmAnalysisInput): Promise<LlmStructuredResult> {
    await this.withStageRetry(input.projectId, 'подключение к модели', () =>
      this.ollamaHealthService.assertModelAvailable(this.modelName ?? ''),
    );

    const prompt = buildLlmPrompt(input);
    const payload = {
      projectId: input.projectId,
      model: this.modelName,
      ollamaBaseUrl: this.ollamaBaseUrl,
      ollamaChatUrl: `${this.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`,
      ollamaProxyChatUrl: this.ollamaProxyChatUrl,
      prompt,
      projectTitle: input.projectTitle,
      sourceText: input.sourceText,
      departments: input.departments,
      expectedSchema: {
        summary: 'string',
        tasks: [{ title: 'string', description: 'string', priority: 'high|medium|low' }],
        departmentSuggestions: [
          {
            departmentCode: 'string',
            relevanceReason: 'string',
            problemFragment: 'string',
            adaptedPitch: 'string',
            emailSubject: 'string',
            emailBody: 'string',
          },
        ],
      },
    };

    return this.withStageRetry(input.projectId, 'генерация анализа', async () => {
      const raw = await this.n8nService.runLlmWorkflow(payload, input.projectId);
      if (raw === null) {
        throw new BadGatewayException(
          'Не задан N8N_LLM_WEBHOOK_URL для провайдера LLM через n8n',
        );
      }

      const parsed = this.normalizeResult(raw);
      this.validateResult(parsed);
      return parsed;
    });
  }

  private async withStageRetry<T>(
    projectId: string | undefined,
    stageName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const maxElapsedMs = this.resolveAnalysisRetryLimitMs();
    let attempt = 0;

    for (;;) {
      if (projectId && this.n8nService.isProjectAnalysisCancelled(projectId)) {
        throw new Error('Анализ остановлен пользователем.');
      }

      try {
        return await operation();
      } catch (error) {
        if (
          projectId &&
          (this.n8nService.isProjectAnalysisCancelled(projectId) ||
            this.n8nService.isAnalysisCancellationError(error))
        ) {
          throw new Error('Анализ остановлен пользователем.');
        }

        if (!this.shouldRetryStageError(error)) {
          throw error;
        }

        const delayMs = Math.min(10_000 * 2 ** attempt, 60_000);
        attempt += 1;
        const nextAttemptFitsLimit = Date.now() + delayMs - startedAt < maxElapsedMs;

        if (!projectId || !nextAttemptFitsLimit) {
          throw error;
        }

        this.logger.warn(
          `Analysis stage "${stageName}" failed for project ${projectId}, retry ${attempt} in ${Math.round(
            delayMs / 1000,
          )}s: ${(error as Error).message}`,
        );
        await this.n8nService.waitBeforeAnalysisRetry(projectId, delayMs);
      }
    }
  }

  private resolveAnalysisRetryLimitMs(): number {
    const timeoutMs = this.configService.get<number>('n8n.llmTimeoutMs');
    return timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : 1800000;
  }

  private shouldRetryStageError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return !(
      message.includes('не задан n8n_llm_webhook_url') ||
      message.includes('не задан ollama_base_url') ||
      message.includes('не задана модель llm')
    );
  }

  private normalizeResult(raw: unknown): LlmStructuredResult {
    const firstLayer = this.unwrap(raw);
    if (this.isLlmStructuredResult(firstLayer)) {
      return firstLayer;
    }

    if (typeof firstLayer === 'string') {
      const parsed = this.parseJsonString(firstLayer);
      if (this.isLlmStructuredResult(parsed)) {
        return parsed;
      }
    }

    if (typeof firstLayer === 'object' && firstLayer !== null) {
      const obj = firstLayer as Record<string, unknown>;
      const candidateKeys = ['result', 'data', 'output', 'content', 'answer', 'json'];
      for (const key of candidateKeys) {
        const candidate = this.unwrap(obj[key]);
        if (this.isLlmStructuredResult(candidate)) {
          return candidate;
        }
        if (typeof candidate === 'string') {
          const parsed = this.parseJsonString(candidate);
          if (this.isLlmStructuredResult(parsed)) {
            return parsed;
          }
        }
      }
    }

    throw new BadGatewayException(
      'N8N LLM workflow вернул ответ не в ожидаемом формате JSON',
    );
  }

  private unwrap(value: unknown): unknown {
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    return value;
  }

  private parseJsonString(value: string): unknown {
    const text = value.trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const jsonText =
      firstBrace >= 0 && lastBrace >= 0
        ? text.slice(firstBrace, lastBrace + 1)
        : text;

    try {
      return JSON.parse(jsonText) as unknown;
    } catch {
      return null;
    }
  }

  private isLlmStructuredResult(value: unknown): value is LlmStructuredResult {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.summary === 'string' &&
      Array.isArray(candidate.tasks) &&
      Array.isArray(candidate.departmentSuggestions)
    );
  }

  private validateResult(result: LlmStructuredResult): void {
    if (!result.summary.trim()) {
      throw new BadGatewayException('N8N LLM workflow вернул пустой summary');
    }

    if (!Array.isArray(result.tasks)) {
      throw new BadGatewayException('N8N LLM workflow не вернул массив tasks');
    }

    if (!Array.isArray(result.departmentSuggestions)) {
      throw new BadGatewayException(
        'N8N LLM workflow не вернул массив departmentSuggestions',
      );
    }
  }
}
