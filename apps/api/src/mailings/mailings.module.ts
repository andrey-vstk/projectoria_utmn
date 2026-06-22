import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailingsController } from './mailings.controller';
import { MailingsService } from './mailings.service';
import { MAILING_QUEUE } from '../queues/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: MAILING_QUEUE })],
  controllers: [MailingsController],
  providers: [MailingsService],
  exports: [MailingsService],
})
export class MailingsModule {}
