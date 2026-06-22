import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildLlmPrompt } from './llm.prompt';
import { LlmProvider } from './llm.provider';
import { LlmAnalysisInput, LlmStructuredResult } from './llm.types';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class ExternalLlmProvider implements LlmProvider {
  readonly providerName = 'external-api';
  readonly modelName?: string;

  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('llm.apiUrl') ?? '';
    this.apiKey = this.configService.get<string>('llm.apiKey') ?? '';
    this.modelName = this.configService.get<string>('llm.model') ?? 'gpt-4.1-mini';
  }

  async analyze(input: LlmAnalysisInput): Promise<LlmStructuredResult> {
    if (!this.apiUrl) {
      throw new InternalServerErrorException(
        'Не задан LLM_API_URL для внешнего провайдера',
      );
    }

    const prompt = buildLlmPrompt(input);
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Ты возвращаешь только валидный JSON без пояснений. Никакого markdown.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `LLM provider error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new BadGatewayException('LLM вернул пустой ответ');
    }

    const parsed = this.safeParseJson(text);
    this.validateResult(parsed);
    return parsed;
  }

  private safeParseJson(raw: string): LlmStructuredResult {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    const jsonText =
      firstBrace >= 0 && lastBrace >= 0
        ? raw.slice(firstBrace, lastBrace + 1)
        : raw;

    try {
      return JSON.parse(jsonText) as LlmStructuredResult;
    } catch {
      throw new BadGatewayException('LLM вернул невалидный JSON');
    }
  }

  private validateResult(result: LlmStructuredResult): void {
    if (!result.summary || !Array.isArray(result.tasks)) {
      throw new BadGatewayException('Ответ LLM не соответствует ожидаемой схеме');
    }
    if (!Array.isArray(result.departmentSuggestions)) {
      throw new BadGatewayException('Ответ LLM не содержит departmentSuggestions');
    }
  }
}
