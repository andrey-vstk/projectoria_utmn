import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, LlmProvider } from './llm.provider';
import { LlmAnalysisInput, LlmStructuredResult } from './llm.types';

@Injectable()
export class LlmService {
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  get providerName(): string {
    return this.provider.providerName;
  }

  get modelName(): string | undefined {
    return this.provider.modelName;
  }

  analyze(input: LlmAnalysisInput): Promise<LlmStructuredResult> {
    return this.provider.analyze(input);
  }
}
