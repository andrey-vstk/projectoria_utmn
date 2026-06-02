import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentRecipientDto } from './dto/department-recipient.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

const DEPARTMENT_INCLUDE = {
  recipients: {
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
    },
  },
} satisfies Prisma.DepartmentInclude;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.department.findMany({
      include: DEPARTMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  listActive() {
    return this.prisma.department.findMany({
      where: { isActive: true },
      include: DEPARTMENT_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateDepartmentDto) {
    const code = dto.code?.trim() || (await this.generateCode());
    const recipients = this.normalizeRecipients(dto.recipients);

    return this.prisma.department.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        recipients: {
          createMany: {
            data: recipients,
          },
        },
      },
      include: DEPARTMENT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException('Подразделение не найдено');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.recipients) {
        await tx.departmentRecipient.updateMany({
          where: { departmentId: id },
          data: { isActive: false },
        });

        for (const recipient of this.normalizeRecipients(dto.recipients)) {
          const existing = await tx.departmentRecipient.findFirst({
            where: { departmentId: id, email: recipient.email },
          });

          if (existing) {
            await tx.departmentRecipient.update({
              where: { id: existing.id },
              data: { isActive: true, displayName: recipient.displayName },
            });
            continue;
          }

          await tx.departmentRecipient.create({
            data: {
              departmentId: id,
              ...recipient,
              isActive: true,
            },
          });
        }
      }

      return tx.department.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          isActive: dto.isActive,
        },
        include: DEPARTMENT_INCLUDE,
      });
    });
  }

  async softDelete(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException('Подразделение не найдено');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.departmentRecipient.updateMany({
        where: { departmentId: id },
        data: { isActive: false },
      });

      return tx.department.update({
        where: { id },
        data: { isActive: false },
      });
    });
  }

  private normalizeRecipients(recipients: DepartmentRecipientDto[]) {
    const normalized = new Map<string, { email: string; displayName: string | null }>();

    for (const recipient of recipients) {
      const email = recipient.email.toLowerCase().trim();
      if (!email) {
        continue;
      }

      normalized.set(email, {
        email,
        displayName: recipient.displayName?.trim() || null,
      });
    }

    return [...normalized.values()];
  }

  private async generateCode(): Promise<string> {
    for (;;) {
      const code = `DEP-${randomBytes(3).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.department.findUnique({ where: { code } });
      if (!existing) {
        return code;
      }
    }
  }
}
