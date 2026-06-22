import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TextHttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
}

const ANALYSIS_CANCELLED_MESSAGE = 'Анализ остановлен пользователем.';

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);
  private readonly cancelledProjectIds = new Set<string>();
  private readonly projectControllers = new Map<string, Set<AbortController>>();

  constructor(private readonly configService: ConfigService) {}

  beginProjectAnalysis(projectId: string): void {
    this.cancelledProjectIds.delete(projectId);
  }

  finishProjectAnalysis(projectId: string): void {
    this.projectControllers.delete(projectId);
  }

  cancelProjectAnalysis(projectId: string): void {
    this.cancelledProjectIds.add(projectId);
    const controllers = this.projectControllers.get(projectId);
    controllers?.forEach((controller) => {
      if (!controller.signal.aborted) {
        controller.abort(new Error(ANALYSIS_CANCELLED_MESSAGE));
      }
    });
    this.projectControllers.delete(projectId);
  }

  isProjectAnalysisCancelled(projectId: string): boolean {
    return this.cancelledProjectIds.has(projectId);
  }

  isAnalysisCancellationError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message === ANALYSIS_CANCELLED_MESSAGE ||
        error.message.includes(ANALYSIS_CANCELLED_MESSAGE))
    );
  }

  async waitBeforeAnalysisRetry(projectId: string, delayMs: number): Promise<void> {
    await this.runCancellableProjectTask(projectId, (signal) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(resolve, delayMs);
        const abort = () => {
          clearTimeout(timeoutId);
          reject(new Error(ANALYSIS_CANCELLED_MESSAGE));
        };

        if (signal?.aborted) {
          abort();
          return;
        }

        signal?.addEventListener('abort', abort, { once: true });
      }),
    );
  }

  async runCancellableProjectTask<T>(
    projectId: string | undefined,
    task: (signal?: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (!projectId) {
      return task();
    }

    if (this.isProjectAnalysisCancelled(projectId)) {
      throw new Error(ANALYSIS_CANCELLED_MESSAGE);
    }

    const controller = new AbortController();
    const controllers = this.projectControllers.get(projectId) ?? new Set<AbortController>();
    controllers.add(controller);
    this.projectControllers.set(projectId, controllers);

    try {
      return await task(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(ANALYSIS_CANCELLED_MESSAGE);
      }
      throw error;
    } finally {
      controllers.delete(controller);
      if (controllers.size === 0) {
        this.projectControllers.delete(projectId);
      }
    }
  }

  async notifyProjectCreated(payload: Record<string, unknown>): Promise<void> {
    const url = this.configService.get<string>('n8n.webhookUrl');
    if (!url) {
      return;
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      this.logger.warn(`N8N webhook failed: ${(error as Error).message}`);
    }
  }

  async sendEmailViaWorkflow(payload: Record<string, unknown>): Promise<boolean> {
    const url = this.configService.get<string>('n8n.emailWorkflowUrl');
    if (!url) {
      return false;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch (error) {
      this.logger.warn(`N8N email workflow failed: ${(error as Error).message}`);
      return false;
    }
  }

  async runLlmWorkflow(
    payload: Record<string, unknown>,
    projectId?: string,
  ): Promise<unknown | null> {
    const url = this.configService.get<string>('n8n.llmWebhookUrl');
    if (!url) {
      return null;
    }

    const configuredTimeoutMs = this.configService.get<number>('n8n.llmTimeoutMs');
    const timeoutMs =
      configuredTimeoutMs && Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
        ? configuredTimeoutMs
        : 1800000;

    const response = await this.runCancellableProjectTask(projectId, (signal) =>
      this.postJsonWithTimeout(url, payload, timeoutMs, signal),
    );

    if (!response.ok) {
      throw new Error(
        `N8N LLM workflow returned ${response.status} ${response.statusText}`,
      );
    }

    const text = response.text;
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private postJsonWithTimeout(
    url: string,
    payload: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<TextHttpResponse> {
    const body = JSON.stringify(payload);
    const target = new URL(url);
    const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const timeoutMinutes = Math.round(timeoutMs / 60000);

    return new Promise((resolve, reject) => {
      const req = request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          path: `${target.pathname}${target.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks: string[] = [];
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => chunks.push(chunk));
          res.on('end', () => {
            clearTimeout(timeoutId);
            resolve({
              ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
              status: res.statusCode ?? 0,
              statusText: res.statusMessage ?? '',
              text: chunks.join(''),
            });
          });
        },
      );

      const abortRequest = (error: Error) => {
        req.destroy(error);
      };

      const onAbort = () => {
        abortRequest(new Error(ANALYSIS_CANCELLED_MESSAGE));
      };

      const timeoutId = setTimeout(() => {
        req.destroy(
          new Error(`Истек таймаут ожидания n8n LLM workflow: ${timeoutMinutes} мин`),
        );
      }, timeoutMs);

      if (signal?.aborted) {
        onAbort();
      } else {
        signal?.addEventListener('abort', onAbort, { once: true });
      }

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      });

      req.on('close', () => {
        signal?.removeEventListener('abort', onAbort);
      });

      req.write(body);
      req.end();
    });
  }
}
