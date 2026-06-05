import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { OllamaHealthService } from './ollama-health.service';

@Controller('internal/ollama')
@Public()
export class OllamaProxyController {
  constructor(
    private readonly configService: ConfigService,
    private readonly ollamaHealthService: OllamaHealthService,
  ) {}

  @Post('api/chat')
  chat(@Body() payload: Record<string, unknown>) {
    const timeoutMs = this.configService.get<number>('n8n.llmTimeoutMs') ?? 1800000;
    return this.ollamaHealthService.runChat(payload, timeoutMs);
  }
}
