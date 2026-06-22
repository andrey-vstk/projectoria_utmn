import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CreatePublicResponseDto } from './dto/create-public-response.dto';
import { PublicRateLimitGuard } from './public-rate-limit.guard';
import { ResponsesService } from './responses.service';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

@Controller('public')
@Public()
@UseGuards(PublicRateLimitGuard)
export class PublicResponsesController {
  constructor(private readonly responsesService: ResponsesService) {}

  @Get('responses/:token/status')
  status(@Param('token') token: string) {
    return this.responsesService.getTokenStatus(token);
  }

  @Post('responses/:token')
  submit(
    @Param('token') token: string,
    @Body() dto: CreatePublicResponseDto,
    @Req() req: Request,
  ) {
    const userAgentHeader = req.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader.join(' ')
      : userAgentHeader;

    return this.responsesService.submitByToken(token, dto, {
      ipAddress: req.ip,
      userAgent,
    });
  }

  @Get('respond/:token')
  async htmlPage(
    @Param('token') token: string,
    @Query('responderEmail') responderEmail: string | undefined,
    @Query('responderName') responderName: string | undefined,
    @Res() res: Response,
  ) {
    const status = await this.responsesService.getTokenStatus(token);
    const safeProjectTitle = escapeHtml(status.project.title);
    const safeProjectSummary = escapeHtml(status.project.summary);
    const safeProposedTask = escapeHtml(status.proposedTask);
    const safeDepartmentName = escapeHtml(status.department.name);
    const resolvedResponderName = responderName?.trim() || status.department.name;
    const safeResponderName = escapeHtml(resolvedResponderName);
    const safeResponderEmail = escapeHtml(responderEmail ?? '');
    const encodedToken = encodeURIComponent(token);

    if (status.tokenUsed) {
      res
        .status(200)
        .send(
          '<html><body style="font-family:Arial;padding:40px"><h2>Отклик уже зафиксирован</h2></body></html>',
        );
      return;
    }

    res.status(200).send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Отклик на проект</title>
    <style>
      body { font-family:Arial,sans-serif; background:radial-gradient(circle at 8% 2%,rgba(0,174,239,.08),transparent 32%),radial-gradient(circle at 92% 5%,rgba(0,174,239,.09),transparent 27%),linear-gradient(180deg,#f9fcff 0%,#eef3f8 100%); margin:0; padding:40px 18px; color:#1f2937; }
      .card { max-width:680px; margin:0 auto; background:#fff; border:1px solid #cce5f1; border-radius:22px; padding:28px; box-shadow:0 22px 56px rgba(19,85,111,.13); }
      .eyebrow { margin:0 0 7px; color:#087ca8; font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
      h1 { margin:0 0 22px; font-size:28px; color:#12344d; }
      .project { padding:16px; border-radius:14px; background:linear-gradient(135deg,#eefaff,#f8fcff); border:1px solid #d4eaf4; }
      .recipient { display:flex; gap:12px; align-items:center; margin:16px 0; padding:14px 16px; border-radius:14px; background:#f4fbf8; border:1px solid #cce9dd; }
      .recipient-icon { display:grid; place-items:center; width:34px; height:34px; border-radius:50%; background:#d8f1e7; color:#187251; font-weight:800; }
      .recipient strong,.recipient span { display:block; }
      .recipient .label { margin-bottom:3px; color:#4b647a; font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
      .recipient .email { margin-top:3px; color:#577082; font-size:13px; }
      .actions { display:flex; gap:10px; flex-wrap:wrap; }
      button { border:none; border-radius:10px; padding:13px 17px; cursor:pointer; background:#00AEEF; color:#fff; font-weight:700; }
      button.decline { background:#fff1f1; color:#991b1b; border:1px solid #fecaca; }
      details { margin:16px 0; border:1px solid #d9eefb; border-radius:10px; background:#f8fbfe; }
      summary { padding:12px 14px; cursor:pointer; color:#12344d; font-weight:700; }
      .details-content { padding:0 14px 14px; }
      .details-content h2 { margin:12px 0 4px; font-size:15px; color:#12344d; }
      .details-content p { margin:0; white-space:pre-line; }
      .muted { color:#64748b; font-size:14px; }
      .success { color:#0f766e; }
      .error { color:#b91c1c; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="eyebrow">Проектория · ТюмГУ</p>
      <h1>Решение об участии в проекте</h1>
      <div class="project">
        <p><b>Проект:</b> ${safeProjectTitle}</p>
        <p><b>Подразделение:</b> ${safeDepartmentName}</p>
      </div>
      <details>
        <summary>Подробнее о проекте и задаче</summary>
        <div class="details-content">
          <h2>Сводка по проекту</h2>
          <p>${safeProjectSummary || 'Сводка не указана.'}</p>
          <h2>Предлагаемая задача</h2>
          <p>${safeProposedTask || 'Описание задачи не указано.'}</p>
        </div>
      </details>
      <div class="recipient">
        <span class="recipient-icon">@</span>
        <div>
          <span class="label">Персональная ссылка для ответа</span>
          <strong>${safeResponderName}</strong>
          <span class="email">${safeResponderEmail || 'Ответ будет зафиксирован от имени подразделения'}</span>
        </div>
      </div>
      <form id="response-form" data-responder-email="${safeResponderEmail}" data-responder-name="${safeResponderName}">
        <div class="actions">
          <button type="submit" name="decision" value="ACCEPTED">Подтвердить участие</button>
          <button type="submit" name="decision" value="DECLINED" class="decline">Отказаться от участия</button>
        </div>
      </form>
      <p id="result"></p>
    </div>
    <script>
      const form = document.getElementById('response-form');
      const result = document.getElementById('result');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
          decision: event.submitter?.value || 'ACCEPTED',
          responderName: form.dataset.responderName
        };
        if (form.dataset.responderEmail) payload.responderEmail = form.dataset.responderEmail;
        const response = await fetch('/public/responses/${encodedToken}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          result.className = 'success';
          result.textContent = 'Спасибо, ваш отклик зафиксирован.';
          form.style.display = 'none';
        } else {
          const err = await response.json().catch(() => ({}));
          result.className = 'error';
          result.textContent = err.message || 'Не удалось сохранить отклик.';
        }
      });
    </script>
  </body>
</html>`);
  }
}
