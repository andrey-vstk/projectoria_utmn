'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/protected-page';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { subscribeToNotifications } from '@/lib/realtime';
import { MAILING_STATUS_LABELS, RESPONSE_DECISION_LABELS } from '@/lib/status';

interface ResponseItem {
  id: string;
  mailingId: string;
  status: string;
  sentAt?: string | null;
  department: {
    name: string;
  };
  recipient: {
    type: 'DEPARTMENT' | 'EMPLOYEE';
    name: string;
    email: string;
  };
  response?: {
    responderEmail?: string | null;
    responderName?: string | null;
    decision: string;
    respondedAt: string;
  } | null;
}

interface ProjectHeader {
  title: string;
}

type BadgeTone = 'neutral' | 'info' | 'success' | 'danger';

function getMailingStatusTone(status: string): BadgeTone {
  if (status === 'SENT') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'QUEUED' || status === 'SENDING') return 'info';
  return 'neutral';
}

export default function ProjectResponsesPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<ResponseItem[]>([]);
  const [projectTitle, setProjectTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options: { showLoader?: boolean } = {}) => {
    if (options.showLoader) {
      setLoading(true);
    }
    try {
      const [data, project] = await Promise.all([
        apiRequest<ResponseItem[]>(`/projects/${params.id}/responses`, {
          method: 'GET',
          withCsrf: false,
        }),
        apiRequest<ProjectHeader>(`/projects/${params.id}`, {
          method: 'GET',
          withCsrf: false,
        }),
      ]);
      setItems(data);
      setProjectTitle(project.title);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (options.showLoader) {
        setLoading(false);
      }
    }
  }, [params.id]);

  useEffect(() => {
    void load({ showLoader: true });
  }, [load]);

  useEffect(
    () =>
      subscribeToNotifications((notification) => {
        if (notification.projectId === params.id) {
          void load();
        }
      }),
    [load, params.id],
  );

  useEffect(() => {
    const refresh = () => void load();
    const poller = window.setInterval(refresh, 15_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(poller);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [load]);

  return (
    <ProtectedPage>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Отклики по проекту</h1>
            <p className="page-subtitle">
              {projectTitle
                ? `Проект: ${projectTitle}`
                : 'Все адресаты рассылки и полученные решения по проекту.'}
            </p>
          </div>
          <Link href={`/projects/${params.id}`} className="btn btn-secondary page-head-action">
            Назад к проекту
          </Link>
        </div>

        <Card className="card-soft">
          <div className="section-head">
            <div>
              <h3 className="section-title">Адресаты и отклики</h3>
            </div>
          </div>

          {loading ? <p className="muted">Загрузка...</p> : null}
          {error ? <p className="message-danger">{error}</p> : null}

          {!loading ? (
            <div className="table-wrap project-activity-table-wrap">
              <table className="project-activity-table responses-table">
                <thead>
                  <tr>
                    <th>Подразделение</th>
                    <th>Адресат</th>
                    <th>Статус письма</th>
                    <th>Результат</th>
                    <th>Получено</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="table-entity-cell">
                        <strong>{item.department.name}</strong>
                        <span>Подразделение проекта</span>
                      </td>
                      <td className="response-contact-cell">
                        <strong>{item.recipient.name}</strong>
                        <span>{item.recipient.email}</span>
                        <small className="table-recipient-type">
                          {item.recipient.type === 'EMPLOYEE'
                            ? 'Сотрудник'
                            : 'Подразделение'}
                        </small>
                      </td>
                      <td>
                        <Badge tone={getMailingStatusTone(item.status)}>
                          {MAILING_STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          tone={
                            !item.response
                              ? 'neutral'
                              : item.response.decision === 'ACCEPTED'
                                ? 'success'
                                : 'danger'
                          }
                        >
                          {item.response
                            ? (RESPONSE_DECISION_LABELS[item.response.decision] ??
                              item.response.decision)
                            : 'Без ответа'}
                        </Badge>
                      </td>
                      <td>
                        {item.response
                          ? new Date(item.response.respondedAt).toLocaleString('ru-RU')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Адресаты рассылки пока отсутствуют.
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
