import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  upsert(dto: UpsertSettingDto) {
    return this.prisma.systemSetting.upsert({
      where: { key: dto.key.trim() },
      create: {
        key: dto.key.trim(),
        value: dto.value,
      },
      update: {
        value: dto.value,
      },
    });
  }
}
