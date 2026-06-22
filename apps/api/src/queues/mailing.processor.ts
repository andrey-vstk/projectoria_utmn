import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailingsService } from '../mailings/mailings.service';
import { MAILING_QUEUE } from './queue.constants';

@Injectable()
@Processor(MAILING_QUEUE)
export class MailingProcessor extends WorkerHost {
  private readonly logger = new Logger(MailingProcessor.name);

  constructor(private readonly mailingsService: MailingsService) {
    super();
  }

  async process(job: Job<{ mailingId: string }>): Promise<void> {
    this.logger.log(`Start mailing job ${job.id} for mailing ${job.data.mailingId}`);
    await this.mailingsService.sendOne(job.data.mailingId);
  }
}
