import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalLlmProvider } from './external-llm.provider';
import { LLM_PROVIDER } from './llm.provider';
import { LlmService } from './llm.service';
import { MockLlmProvider } from './mock-llm.provider';
import { N8nLlmProvider } from './n8n-llm.provider';

@Module({
  providers: [
    MockLlmProvider,
    ExternalLlmProvider,
    N8nLlmProvider,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, MockLlmProvider, ExternalLlmProvider, N8nLlmProvider],
      useFactory: (
        configService: ConfigService,
        mockProvider: MockLlmProvider,
        externalProvider: ExternalLlmProvider,
        n8nProvider: N8nLlmProvider,
      ) => {
        const provider = (configService.get<string>('llm.provider') ?? 'mock')
          .trim()
          .toLowerCase();
        if (provider === 'external') {
          return externalProvider;
        }
        if (provider === 'n8n') {
          return n8nProvider;
        }
        return mockProvider;
      },
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
