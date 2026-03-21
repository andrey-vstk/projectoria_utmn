import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PublicResponsesController } from './public-responses.controller';
import { PublicRateLimitGuard } from './public-rate-limit.guard';
import { ResponsesService } from './responses.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PublicResponsesController],
  providers: [ResponsesService, PublicRateLimitGuard],
  exports: [ResponsesService],
})
export class ResponsesModule {}
