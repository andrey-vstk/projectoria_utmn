import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { MailingsModule } from '../mailings/mailings.module';
import { AnalysisProcessor } from './analysis.processor';
import { MailingProcessor } from './mailing.processor';

@Module({
  imports: [AnalysisModule, MailingsModule],
  providers: [AnalysisProcessor, MailingProcessor],
})
export class QueueModule {}
