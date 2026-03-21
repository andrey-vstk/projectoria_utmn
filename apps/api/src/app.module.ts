import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { AnalysisModule } from './analysis/analysis.module';
import { AuthModule } from './auth/auth.module';
import { AccessTokenGuard } from './common/guards/access-token.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DepartmentsModule } from './departments/departments.module';
import { HealthController } from './health.controller';
import { LlmModule } from './llm/llm.module';
import { MailModule } from './mail/mail.module';
import { MailingsModule } from './mailings/mailings.module';
import { N8nModule } from './n8n/n8n.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { QueueModule } from './queues/queue.module';
import { ResponsesModule } from './responses/responses.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { UsersModule } from './users/users.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password') || undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('throttle.ttl') ?? 60,
          limit: configService.get<number>('throttle.limit') ?? 20,
        },
      ],
    }),
    PrismaModule,
    N8nModule,
    MailModule,
    LlmModule,
    UsersModule,
    AuthModule,
    DepartmentsModule,
    AnalysisModule,
    MailingsModule,
    NotificationsModule,
    ResponsesModule,
    ProjectsModule,
    SystemSettingsModule,
    QueueModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
