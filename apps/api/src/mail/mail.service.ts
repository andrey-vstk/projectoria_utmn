import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { N8nService } from '../n8n/n8n.service';

interface SendDepartmentMailInput {
  recipients: string[];
  subject: string;
  body: string;
  responseUrl: string;
  declineResponseUrl: string;
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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatBodyForHtml(body: string): string {
    return this.escapeHtml(body).replace(/\n/g, '<br/>');
  }

  private addResponderEmail(url: string, recipient: string): string {
    const personalizedUrl = new URL(url);
    personalizedUrl.searchParams.set('responderEmail', recipient);
    return personalizedUrl.toString();
  }

  private buildDepartmentMailHtml(
    input: SendDepartmentMailInput,
    responseUrl: string,
    declineResponseUrl: string,
  ): string {
    const safeProjectTitle = this.escapeHtml(input.projectTitle);
    const safeBody = this.formatBodyForHtml(input.body);
    const safeResponseUrl = this.escapeHtml(responseUrl);
    const safeDeclineResponseUrl = this.escapeHtml(declineResponseUrl);

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:760px;margin:0 auto;padding:20px;background:#f8fbfe;border:1px solid #d8e7f2;border-radius:14px">
        <p style="margin:0 0 10px;font-size:12px;color:#4b647a;letter-spacing:0.04em;text-transform:uppercase">Платформа «Проектория» · Тюменский государственный университет</p>
        <h2 style="margin:0 0 14px;font-size:24px;color:#102536">${safeProjectTitle}</h2>
        <p style="margin:0 0 16px">Коллеги, вам направлено предложение по участию в университетском проекте, сформированное на основе текстового запроса индустриального партнера.</p>

        <div style="background:#ffffff;border:1px solid #d8e7f2;border-radius:10px;padding:14px 16px;margin:0 0 16px">
          <p style="margin:0 0 8px;font-weight:700;color:#12344d">Суть предложения для подразделения:</p>
          <p style="margin:0;white-space:pre-line">${safeBody}</p>
        </div>

        <p style="margin:0 0 12px">Пожалуйста, сообщите решение подразделения по участию в проекте.</p>
        <p style="margin:0 0 16px;display:flex;gap:10px;flex-wrap:wrap">
          <a href="${safeResponseUrl}" style="background:#00AEEF;color:#ffffff;padding:12px 16px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:700">
            Подтвердить участие
          </a>
          <a href="${safeDeclineResponseUrl}" style="background:#fff1f1;color:#991b1b;border:1px solid #fecaca;padding:11px 15px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:700">
            Отказаться от участия
          </a>
        </p>
      </div>
    `;
  }

  private buildDepartmentMailText(
    input: SendDepartmentMailInput,
    responseUrl: string,
    declineResponseUrl: string,
  ): string {
    return [
      'Платформа «Проектория» · Тюменский государственный университет',
      '',
      `Проект: ${input.projectTitle}`,
      '',
      'Коллеги, вам направлено предложение по участию в университетском проекте,',
      'сформированное на основе текстового запроса индустриального партнера.',
      '',
      'Суть предложения для подразделения:',
      input.body,
      '',
      'Для подтверждения участия перейдите по ссылке:',
      responseUrl,
      '',
      'Для отказа от участия перейдите по ссылке:',
      declineResponseUrl,
    ].join('\n');
  }

  async sendDepartmentMail(input: SendDepartmentMailInput): Promise<void> {
    for (const recipient of input.recipients) {
      const responseUrl = this.addResponderEmail(input.responseUrl, recipient);
      const declineResponseUrl = this.addResponderEmail(
        input.declineResponseUrl,
        recipient,
      );
      const payload = {
        to: [recipient],
        subject: input.subject,
        body: input.body,
        responseUrl,
        acceptResponseUrl: responseUrl,
        declineResponseUrl,
        projectTitle: input.projectTitle,
      };

      const sentViaN8n = await this.n8nService.sendEmailViaWorkflow(payload);
      if (sentViaN8n) {
        continue;
      }

      await this.transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to: recipient,
        subject: input.subject,
        text: this.buildDepartmentMailText(input, responseUrl, declineResponseUrl),
        html: this.buildDepartmentMailHtml(input, responseUrl, declineResponseUrl),
      });
    }
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
