import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SystemSettingsService } from './system-settings.service';

@Controller('system-settings')
@Roles(Role.ADMIN)
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  list() {
    return this.settingsService.list();
  }

  @Post()
  upsert(@Body() dto: UpsertSettingDto) {
    return this.settingsService.upsert(dto);
  }
}
