import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { N8nService } from '../n8n/n8n.service';

interface SendDepartmentMailInput {
  recipients: string[];
  subject: string;
  body: string;
  responseUrl: string;
  projectTitle: string;
}

interface SendNotificationInput {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly n8nService: N8nService,
  ) {}

  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('smtp.host'),
      port: this.configService.get<number>('smtp.port'),
      secure: this.configService.get<boolean>('smtp.secure'),
      auth: this.configService.get<string>('smtp.user')
        ? {
            user: this.configService.get<string>('smtp.user'),
            pass: this.configService.get<string>('smtp.pass'),
          }
        : undefined,
    });
  }

  async sendDepartmentMail(input: SendDepartmentMailInput): Promise<void> {
    const payload = {
      to: input.recipients,
      subject: input.subject,
      body: input.body,
      responseUrl: input.responseUrl,
      projectTitle: input.projectTitle,
    };

    const sentViaN8n = await this.n8nService.sendEmailViaWorkflow(payload);
    if (sentViaN8n) {
      return;
    }

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <h2 style="margin:0 0 16px">${input.projectTitle}</h2>
        <p style="white-space:pre-line">${input.body.replace(/\n/g, '<br/>')}</p>
        <p style="margin-top:20px">
          <a href="${input.responseUrl}" style="background:#00AEEF;color:#fff;padding:12px 16px;text-decoration:none;border-radius:8px;display:inline-block">
            Хочу вступить в проект
          </a>
        </p>
      </div>
    `;

    await this.transporter.sendMail({
      from: this.configService.get<string>('smtp.from'),
      to: input.recipients.join(','),
      subject: input.subject,
      text: `${input.body}\n\nХочу вступить в проект: ${input.responseUrl}`,
      html,
    });
  }

  async sendNotification(input: SendNotificationInput): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    } catch (error) {
      this.logger.warn(`Notification email failed: ${(error as Error).message}`);
    }
  }
}
