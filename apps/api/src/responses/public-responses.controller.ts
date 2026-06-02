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
    @Res() res: Response,
  ) {
    const status = await this.responsesService.getTokenStatus(token);
    const safeProjectTitle = escapeHtml(status.project.title);
    const safeProjectSummary = escapeHtml(status.project.summary);
    const safeProposedTask = escapeHtml(status.proposedTask);
    const safeDepartmentName = escapeHtml(status.department.name);
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
      body { font-family: Arial, sans-serif; background: #f7fbfd; margin:0; padding:40px; color:#1f2937; }
      .card { max-width: 560px; margin:0 auto; background:#fff; border:1px solid #d9eefb; border-radius:12px; padding:24px; }
      h1 { margin-top:0; font-size:24px; }
      input { width:100%; padding:10px; margin: 8px 0 16px; border-radius:8px; border:1px solid #c7d2e0; box-sizing:border-box; }
      .actions { display:flex; gap:10px; flex-wrap:wrap; }
      button { border:none; border-radius:8px; padding:12px 16px; cursor:pointer; background:#00AEEF; color:#fff; font-weight:600; }
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
      <h1>Решение об участии в проекте</h1>
      <p><b>Проект:</b> ${safeProjectTitle}</p>
      <p><b>Подразделение:</b> ${safeDepartmentName}</p>
      <details>
        <summary>Подробнее о проекте и задаче</summary>
        <div class="details-content">
          <h2>Сводка по проекту</h2>
          <p>${safeProjectSummary || 'Сводка не указана.'}</p>
          <h2>Предлагаемая задача</h2>
          <p>${safeProposedTask || 'Описание задачи не указано.'}</p>
        </div>
      </details>
      <p class="muted">Email и имя можно оставить пустыми, отклик будет зафиксирован по токену ссылки.</p>
      <form id="response-form">
        <label>Email</label>
        <input type="email" name="responderEmail" value="${safeResponderEmail}" placeholder="name@utmn.ru" />
        <label>Имя</label>
        <input type="text" name="responderName" placeholder="ФИО" />
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
        const data = Object.fromEntries(new FormData(form).entries());
        const payload = { decision: event.submitter?.value || 'ACCEPTED' };
        if (data.responderEmail) payload.responderEmail = data.responderEmail;
        if (data.responderName) payload.responderName = data.responderName;
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
