'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { ProjectListItem } from '@/lib/types';

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ProjectListItem[]>('/projects', {
        method: 'GET',
        withCsrf: false,
      });
      setProjects(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((project) =>
      ['QUEUED', 'PROCESSING', 'SENDING'].includes(project.status),
    ).length;
    const readyForReview = projects.filter((project) => project.status === 'READY_FOR_REVIEW')
      .length;
    const totalResponses = projects.reduce((sum, project) => sum + project._count.responses, 0);

    return {
      total,
      inProgress,
      readyForReview,
      totalResponses,
    };
  }, [projects]);

  return (
    <ProtectedPage>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Проекты</h1>
            <p className="page-subtitle">
              История запросов, анализов, рассылок и откликов индустриальных заказчиков.
            </p>
          </div>
          <Link href="/projects/new">
            <Button>Создать проект</Button>
          </Link>
        </div>

        {!loading ? (
          <div className="kpi-grid">
            <Card className="kpi-card">
              <p className="kpi-label">Всего проектов</p>
              <p className="kpi-value">{stats.total}</p>
            </Card>
            <Card className="kpi-card">
              <p className="kpi-label">В обработке</p>
              <p className="kpi-value">{stats.inProgress}</p>
            </Card>
            <Card className="kpi-card">
              <p className="kpi-label">Готово к проверке</p>
              <p className="kpi-value">{stats.readyForReview}</p>
            </Card>
            <Card className="kpi-card">
              <p className="kpi-label">Всего откликов</p>
              <p className="kpi-value">{stats.totalResponses}</p>
            </Card>
          </div>
        ) : null}

        <Card className="card-soft">
          <div className="section-head">
            <div>
              <h3 className="section-title">Реестр проектов</h3>
              <p className="section-subtitle">
                Открывайте карточку проекта для запуска анализа, правки писем и рассылки.
              </p>
            </div>
          </div>

          {error ? <p className="message-danger">{error}</p> : null}
          {loading ? (
            <p className="muted">Загрузка...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Проект</th>
                    <th>Статус</th>
                    <th>Автор</th>
                    <th>Рассылки</th>
                    <th>Отклики</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <Link href={`/projects/${project.id}`} className="table-link">
                          {project.title}
                        </Link>
                        {project.analysis?.summary ? (
                          <p className="muted" style={{ margin: '6px 0 0' }}>
                            {project.analysis.summary.slice(0, 135)}
                            {project.analysis.summary.length > 135 ? '...' : ''}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td>{project.author.fullName}</td>
                      <td>{project._count.mailings}</td>
                      <td>{project._count.responses}</td>
                      <td>{new Date(project.createdAt).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        Проекты не найдены.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </ProtectedPage>
  );
}
