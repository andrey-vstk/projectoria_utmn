import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

@Injectable()
export class OllamaHealthService {
  constructor(private readonly configService: ConfigService) {}

  async assertModelAvailable(modelName: string): Promise<void> {
    const baseUrl = this.requireBaseUrl();

    const requestedModel = modelName.trim();
    if (!requestedModel) {
      throw new BadGatewayException(
        'Не задана модель LLM. Укажите LLM_MODEL в .env для проверки Ollama.',
      );
    }

    const timeoutMs = this.resolveTimeout();
    const tagsUrl = `${baseUrl}/api/tags`;
    const tags = await this.getOllamaTags(tagsUrl, timeoutMs);
    const availableModels = tags.models
      ?.map((item) => item.name || item.model)
      .filter((value): value is string => Boolean(value?.trim())) ?? [];

    const hasModel = tags.models?.some(
      (item) => item.name === requestedModel || item.model === requestedModel,
    );

    if (!hasModel) {
      throw new BadGatewayException(
        `Ollama отвечает, но модель "${requestedModel}" недоступна. Доступные модели: ${
          availableModels.length > 0 ? availableModels.join(', ') : 'список пуст'
        }`,
      );
    }
  }

  async runChat(
    payload: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const baseUrl = this.requireBaseUrl();
    const response = await this.requestText(
      `${baseUrl}/api/chat`,
      'POST',
      timeoutMs,
      JSON.stringify(payload),
      signal,
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `Ollama на сервере LLM ответила HTTP ${response.status} ${response.statusText}`,
      );
    }

    if (!response.text) {
      return {};
    }

    try {
      return JSON.parse(response.text) as unknown;
    } catch {
      throw new BadGatewayException('Ollama на сервере LLM вернула невалидный JSON от /api/chat');
    }
  }

  private requireBaseUrl(): string {
    const baseUrl = this.configService.get<string>('llm.ollamaBaseUrl')?.trim();
    if (!baseUrl) {
      throw new BadGatewayException(
        'Не задан OLLAMA_BASE_URL. API не может проверить и вызвать Ollama-сервер.',
      );
    }

    return baseUrl.replace(/\/$/, '');
  }

  private resolveTimeout(): number {
    const configuredTimeout = this.configService.get<number>('llm.ollamaCheckTimeoutMs');
    return configuredTimeout && Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 10000;
  }

  private getOllamaTags(url: string, timeoutMs: number): Promise<OllamaTagsResponse> {
    return this.requestText(url, 'GET', timeoutMs).then((response) => {
      if (!response.ok) {
        throw new BadGatewayException(
          `Ollama на сервере LLM ответила HTTP ${response.status} ${response.statusText}`,
        );
      }

      try {
        return JSON.parse(response.text) as OllamaTagsResponse;
      } catch {
        throw new BadGatewayException(
          'Ollama на сервере LLM вернула невалидный JSON от /api/tags',
        );
      }
    });
  }

  private requestText(
    url: string,
    method: 'GET' | 'POST',
    timeoutMs: number,
    body?: string,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; status: number; statusText: string; text: string }> {
    const target = new URL(url);
    const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const timeoutSeconds = Math.round(timeoutMs / 1000);

    return new Promise((resolve, reject) => {
      const req = request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          path: `${target.pathname}${target.search}`,
          method,
          headers: body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
              }
            : undefined,
        },
        (res) => {
          const chunks: string[] = [];
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => chunks.push(chunk));
          res.on('end', () => {
            clearTimeout(timeoutId);
            const text = chunks.join('');
            resolve({
              ok: Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
              status: res.statusCode ?? 0,
              statusText: res.statusMessage ?? '',
              text,
            });
          });
        },
      );

      const onAbort = () => {
        req.destroy(new BadGatewayException('Анализ остановлен пользователем.'));
      };

      const timeoutId = setTimeout(() => {
        req.destroy(
          new BadGatewayException(
            `Не удалось подключиться к Ollama-серверу за ${timeoutSeconds} сек. Проверьте OpenVPN и маршрут до сервера LLM.`,
          ),
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

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }
}
