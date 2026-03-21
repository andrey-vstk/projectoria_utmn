import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    this.authService.applyAuthCookies({
      res,
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
    });

    return {
      user: result.user,
      csrfToken: result.csrfToken,
    };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
