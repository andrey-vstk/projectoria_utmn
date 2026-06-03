import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async list(): Promise<Array<Prisma.UserGetPayload<{ select: typeof USER_SELECT }>>> {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto): Promise<Prisma.UserGetPayload<{ select: typeof USER_SELECT }>> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const exists = await this.findByEmail(normalizedEmail);
    if (exists) {
      throw new BadRequestException('Пользователь с таким email уже существует');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: dto.fullName.trim(),
        passwordHash,
        role: dto.role,
        status: dto.status ?? UserStatus.ACTIVE,
      },
      select: USER_SELECT,
    });
  }

  async update(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<Prisma.UserGetPayload<{ select: typeof USER_SELECT }>> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const targetRole = dto.role ?? user.role;
    const targetStatus = dto.status ?? user.status;
    if (
      user.role === Role.ADMIN &&
      user.status === UserStatus.ACTIVE &&
      (targetRole !== Role.ADMIN || targetStatus !== UserStatus.ACTIVE)
    ) {
      const adminCount = await this.prisma.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Нельзя понизить роль последнего администратора');
      }
    }

    const normalizedEmail =
      dto.email === undefined ? undefined : dto.email.toLowerCase().trim();
    if (normalizedEmail && normalizedEmail !== user.email) {
      const existing = await this.findByEmail(normalizedEmail);
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Пользователь с таким email уже существует');
      }
    }

    const data: Prisma.UserUpdateInput = {
      email: normalizedEmail,
      fullName: dto.fullName?.trim(),
      role: dto.role,
      status: dto.status,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });
  }
}
