import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { DemoController } from './demo.controller';

@Module({
  imports: [LlmModule],
  controllers: [DemoController],
})
export class DemoModule {}
