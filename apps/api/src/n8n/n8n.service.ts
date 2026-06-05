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

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  constructor(private readonly configService: ConfigService) {}

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

  async runLlmWorkflow(payload: Record<string, unknown>): Promise<unknown | null> {
    const url = this.configService.get<string>('n8n.llmWebhookUrl');
    if (!url) {
      return null;
    }

    const configuredTimeoutMs = this.configService.get<number>('n8n.llmTimeoutMs');
    const timeoutMs =
      configuredTimeoutMs && Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
        ? configuredTimeoutMs
        : 1800000;

    const response = await this.postJsonWithTimeout(url, payload, timeoutMs);

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

      const timeoutId = setTimeout(() => {
        req.destroy(
          new Error(`Истек таймаут ожидания n8n LLM workflow: ${timeoutMinutes} мин`),
        );
      }, timeoutMs);

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      req.write(body);
      req.end();
    });
  }
}
