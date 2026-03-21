import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Counter {
  count: number;
  expiresAt: number;
}

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();
  private readonly ttlMs: number;
  private readonly limit: number;

  constructor(configService: ConfigService) {
    this.ttlMs = (configService.get<number>('throttle.ttl') ?? 60) * 1000;
    this.limit = configService.get<number>('throttle.limit') ?? 20;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.ip || 'unknown-ip';

    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: now + this.ttlMs });
      return true;
    }

    if (current.count >= this.limit) {
      throw new HttpException(
        'Слишком много запросов. Повторите позже.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.counters.set(key, current);
    return true;
  }
}
