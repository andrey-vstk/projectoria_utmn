import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DepartmentsModule } from '../departments/departments.module';
import { LlmModule } from '../llm/llm.module';
import { ANALYSIS_QUEUE } from '../queues/queue.constants';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [BullModule.registerQueue({ name: ANALYSIS_QUEUE }), LlmModule, DepartmentsModule],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
