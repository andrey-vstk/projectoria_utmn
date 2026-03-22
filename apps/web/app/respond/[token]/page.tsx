'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';

interface StatusPayload {
  valid: boolean;
  tokenUsed: boolean;
  alreadyResponded: boolean;
  project: { id: string; title: string };
  department: { id: string; code: string; name: string };
}

export default function PublicResponsePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          responderName: name || undefined,
          responderEmail: email || undefined,
        }),
      });
      setMessage('Спасибо, ваш отклик зафиксирован.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <h1 className="auth-title">Отклик на проект</h1>
        <p className="auth-subtitle">
          Подтвердите заинтересованность подразделения и оставьте контактные данные.
        </p>

        {loading ? <p className="muted">Проверяем ссылку...</p> : null}
        {error ? <p className="message-danger">{error}</p> : null}

        {status ? (
          <div className="stack-md">
            <Card className="card-soft">
              <p style={{ margin: 0 }}>
                <b>Проект:</b> {status.project.title}
              </p>
              <p style={{ margin: '10px 0 0' }}>
                <b>Подразделение:</b> {status.department.name} ({status.department.code})
              </p>
            </Card>

            {status.tokenUsed ? (
              <p className="notice">Ссылка уже была использована. Спасибо за отклик.</p>
            ) : (
              <form onSubmit={onSubmit} className="stack-sm">
                <div className="field">
                  <label className="label">Имя (опционально)</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Email (опционально)</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@utmn.ru"
                  />
                </div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Сохраняем...' : 'Хочу вступить в проект'}
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
