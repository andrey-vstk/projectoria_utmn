'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { RESPONSE_DECISION_LABELS } from '@/lib/status';

interface ResponseItem {
  id: string;
  responderEmail?: string | null;
  responderName?: string | null;
  decision: string;
  respondedAt: string;
  department: {
    code: string;
    name: string;
  };
}

export default function ProjectResponsesPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ResponseItem[]>(`/projects/${params.id}/responses`, {
      method: 'GET',
      withCsrf: false,
    })
      .then(setItems)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <ProtectedPage>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Отклики по проекту</h1>
            <p className="page-subtitle">Решения подразделений по участию в проекте.</p>
          </div>
          <Link href={`/projects/${params.id}`}>
            <Button variant="secondary">Назад к проекту</Button>
          </Link>
        </div>

        <Card className="card-soft">
          <div className="section-head">
            <div>
              <h3 className="section-title">Журнал откликов</h3>
            </div>
          </div>

          {loading ? <p className="muted">Загрузка...</p> : null}
          {error ? <p className="message-danger">{error}</p> : null}

          {!loading ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Подразделение</th>
                    <th>Решение</th>
                    <th>Email</th>
                    <th>Имя</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.department.code} — {item.department.name}
                      </td>
                      <td>
                        <Badge tone={item.decision === 'ACCEPTED' ? 'success' : 'danger'}>
                          {RESPONSE_DECISION_LABELS[item.decision] ?? item.decision}
                        </Badge>
                      </td>
                      <td>{item.responderEmail ?? '—'}</td>
                      <td>{item.responderName ?? '—'}</td>
                      <td>{new Date(item.respondedAt).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Пока нет откликов.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>
    </ProtectedPage>
  );
}
