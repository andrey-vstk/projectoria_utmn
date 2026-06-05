import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { N8nService } from '../n8n/n8n.service';
import { OllamaHealthService } from './ollama-health.service';

@Controller('internal/ollama')
@Public()
export class OllamaProxyController {
  constructor(
    private readonly configService: ConfigService,
    private readonly n8nService: N8nService,
    private readonly ollamaHealthService: OllamaHealthService,
  ) {}

  @Post('api/chat')
  chat(@Body() payload: Record<string, unknown>) {
    const timeoutMs = this.configService.get<number>('n8n.llmTimeoutMs') ?? 1800000;
    const projectId = typeof payload.projectId === 'string' ? payload.projectId : undefined;
    return this.n8nService.runCancellableProjectTask(projectId, (signal) =>
      this.ollamaHealthService.runChat(payload, timeoutMs, signal),
    );
  }
}
