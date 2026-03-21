import { Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.listForUser(user.sub);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notificationsService.markRead(id, user.sub);
  }
}
