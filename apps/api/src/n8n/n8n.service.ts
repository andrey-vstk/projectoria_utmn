import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

    const timeoutMs = this.configService.get<number>('n8n.llmTimeoutMs') ?? 120000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `N8N LLM workflow returned ${response.status} ${response.statusText}`,
        );
      }

      const text = await response.text();
      if (!text) {
        return {};
      }

      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
