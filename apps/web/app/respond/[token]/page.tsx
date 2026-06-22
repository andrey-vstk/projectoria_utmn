'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';

interface StatusPayload {
  valid: boolean;
  tokenUsed: boolean;
  alreadyResponded: boolean;
  decision?: ResponseDecision | null;
  project: { id: string; title: string; summary: string };
  proposedTask: string;
  department: { id: string; code: string; name: string };
}

type ResponseDecision = 'ACCEPTED' | 'DECLINED';

export default function PublicResponsePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [decision, setDecision] = useState<ResponseDecision>('ACCEPTED');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedDecision = searchParams.get('decision');
    const responderEmail = searchParams.get('responderEmail');
    const responderName = searchParams.get('responderName');
    if (requestedDecision === 'ACCEPTED' || requestedDecision === 'DECLINED') {
      setDecision(requestedDecision);
    }
    if (responderEmail) {
      setEmail(responderEmail);
    }
    if (responderName) {
      setName(responderName);
    }
  }, []);

  useEffect(() => {
    apiRequest<StatusPayload>(`/public/responses/${token}/status`, {
      method: 'GET',
      withCsrf: false,
    })
      .then(setStatus)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/public/responses/${token}`, {
        method: 'POST',
        withCsrf: false,
        body: JSON.stringify({
          decision,
          responderName: name || status?.department.name || undefined,
          responderEmail: email || undefined,
        }),
      });
      setStatus((prev) => (prev ? { ...prev, tokenUsed: true, decision } : prev));
      setMessage(
        decision === 'ACCEPTED'
          ? 'Участие в проекте подтверждено.'
          : 'Отказ от участия зафиксирован.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const responderLabel = name || status?.department.name || '';

  return (
    <div className="response-public-page response-page">
      <Card className="response-card">
        <header className="response-header">
          <span className="response-eyebrow">Проектория · ТюмГУ</span>
          <h1 className="response-title">Решение об участии</h1>
          <p className="response-header-text">
            Подтвердите готовность подразделения подключиться к проекту.
          </p>
        </header>

        {loading ? <p className="muted">Проверяем ссылку...</p> : null}
        {error ? <p className="message-danger">{error}</p> : null}

        {status ? (
          <div className="stack-md">
            <section className="response-project-card">
              <span className="response-section-label">Проект</span>
              <h2>{status.project.title}</h2>
              <div className="response-project-meta">
                <span>Подразделение</span>
                <b>{status.department.name}</b>
              </div>
            </section>

            <details className="response-project-details">
              <summary>Подробнее о проекте и задаче</summary>
              <div className="response-project-details-content">
                <section>
                  <h2>Сводка по проекту</h2>
                  <p>{status.project.summary || 'Сводка не указана.'}</p>
                </section>
                <section>
                  <h2>Предлагаемая задача</h2>
                  <p>{status.proposedTask || 'Описание задачи не указано.'}</p>
                </section>
              </div>
            </details>

            <section className="response-recipient-card">
              <span className="response-recipient-icon" aria-hidden="true">
                @
              </span>
              <div>
                <span className="response-section-label">Персональная ссылка для ответа</span>
                <strong>{responderLabel}</strong>
                <span className="response-recipient-email">
                  {email || 'Ответ будет зафиксирован от имени подразделения'}
                </span>
              </div>
            </section>

            {status.tokenUsed ? (
              <p className="notice response-status-notice">
                Решение уже зафиксировано:{' '}
                <b>
                  {status.decision === 'DECLINED'
                    ? 'участие отклонено'
                    : 'участие подтверждено'}
                </b>
                .
              </p>
            ) : (
              <form onSubmit={onSubmit} className="stack-sm response-action-form">
                <div className="field">
                  <label className="label">Решение подразделения</label>
                  <div className="response-decision-grid">
                    <label
                      className={`response-decision-option ${
                        decision === 'ACCEPTED' ? 'response-decision-option-active' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="decision"
                        value="ACCEPTED"
                        checked={decision === 'ACCEPTED'}
                        onChange={() => setDecision('ACCEPTED')}
                      />
                      <span className="response-decision-title">Подтвердить участие</span>
                      <span className="response-decision-description">
                        Подразделение готово подключиться к проекту.
                      </span>
                    </label>
                    <label
                      className={`response-decision-option response-decision-option-decline ${
                        decision === 'DECLINED' ? 'response-decision-option-active' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="decision"
                        value="DECLINED"
                        checked={decision === 'DECLINED'}
                        onChange={() => setDecision('DECLINED')}
                      />
                      <span className="response-decision-title">Отказаться от участия</span>
                      <span className="response-decision-description">
                        Подразделение не будет участвовать в проекте.
                      </span>
                    </label>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="response-submit"
                  variant={decision === 'DECLINED' ? 'danger' : 'primary'}
                  disabled={submitting}
                >
                  {submitting
                    ? 'Сохраняем...'
                    : decision === 'ACCEPTED'
                      ? 'Подтвердить участие'
                      : 'Подтвердить отказ'}
                </Button>
              </form>
            )}
          </div>
        ) : null}

        {message ? <p className="message-success">{message}</p> : null}
      </Card>
    </div>
  );
}
