import { Controller, Get, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { MailingsService } from './mailings.service';

@Controller('mailings')
export class MailingsController {
  constructor(private readonly mailingsService: MailingsService) {}

  @Get('project/:projectId')
  @Roles(Role.ADMIN)
  listByProject(@Param('projectId') projectId: string) {
    return this.mailingsService.listByProject(projectId);
  }
}
