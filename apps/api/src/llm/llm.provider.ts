import { LlmAnalysisInput, LlmStructuredResult } from './llm.types';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  readonly providerName: string;
  readonly modelName?: string;
  analyze(input: LlmAnalysisInput): Promise<LlmStructuredResult>;
}
