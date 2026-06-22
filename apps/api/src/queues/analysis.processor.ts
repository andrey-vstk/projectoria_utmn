import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalysisService } from '../analysis/analysis.service';
import { ANALYSIS_QUEUE } from './queue.constants';

@Injectable()
@Processor(ANALYSIS_QUEUE)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private readonly analysisService: AnalysisService) {
    super();
  }

  async process(job: Job<{ projectId: string }>): Promise<void> {
    this.logger.log(`Start analysis job ${job.id} for project ${job.data.projectId}`);
    await this.analysisService.processProject(job.data.projectId);
  }
}
