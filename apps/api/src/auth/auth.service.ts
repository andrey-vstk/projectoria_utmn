import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { generateCsrfToken } from '../common/utils/csrf.util';
import { UsersService } from '../users/users.service';

interface AuthCookiesInput {
  res: Response;
  accessToken: string;
  csrfToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<{
    accessToken: string;
    csrfToken: string;
    user: { id: string; email: string; fullName: string; role: Role };
  }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Учетная запись отключена');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const csrfToken = generateCsrfToken();

    return {
      accessToken,
      csrfToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  applyAuthCookies(input: AuthCookiesInput): void {
    const cookieName =
      this.configService.get<string>('jwt.cookieName') ?? 'projectoria_access';
    const csrfCookieName =
      this.configService.get<string>('csrf.cookieName') ?? 'projectoria_csrf';
    const isProd = this.configService.get<string>('nodeEnv') === 'production';

    input.res.cookie(cookieName, input.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 8,
    });

    input.res.cookie(csrfCookieName, input.csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 8,
    });
  }

  clearAuthCookies(res: Response): void {
    const cookieName =
      this.configService.get<string>('jwt.cookieName') ?? 'projectoria_access';
    const csrfCookieName =
      this.configService.get<string>('csrf.cookieName') ?? 'projectoria_csrf';

    res.clearCookie(cookieName, { path: '/' });
    res.clearCookie(csrfCookieName, { path: '/' });
  }

  async me(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: Role;
    status: UserStatus;
  }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
  }
}
