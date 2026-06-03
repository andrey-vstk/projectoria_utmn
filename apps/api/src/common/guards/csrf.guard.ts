import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const cookieName =
      this.configService.get<string>('csrf.cookieName') ?? 'projectoria_csrf';
    const cookieToken = request.cookies?.[cookieName] as string | undefined;
    const headerToken =
      (request.headers['x-csrf-token'] as string | undefined) ??
      (request.headers['x-xsrf-token'] as string | undefined);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('CSRF token is invalid');
    }

    return true;
  }
}
