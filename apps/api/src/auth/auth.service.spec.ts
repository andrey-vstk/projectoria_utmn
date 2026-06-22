import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };

    service = new AuthService(
      usersService as never,
      new JwtService({ secret: 'test-secret' }),
      new ConfigService({
        jwt: { cookieName: 'jwt' },
        csrf: { cookieName: 'csrf' },
      }),
    );
  });

  it('логинит пользователя с корректным паролем', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'user@utmn.local',
      fullName: 'User',
      role: Role.INITIATOR,
      status: UserStatus.ACTIVE,
      passwordHash,
    });

    const result = await service.login('user@utmn.local', 'password123');
    expect(result.user.email).toBe('user@utmn.local');
    expect(result.accessToken).toBeTruthy();
    expect(result.csrfToken).toBeTruthy();
  });

  it('блокирует неактивного пользователя', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'user@utmn.local',
      fullName: 'User',
      role: Role.INITIATOR,
      status: UserStatus.DISABLED,
      passwordHash,
    });

    await expect(service.login('user@utmn.local', 'password123')).rejects.toThrow(
      'Учетная запись отключена',
    );
  });
});
