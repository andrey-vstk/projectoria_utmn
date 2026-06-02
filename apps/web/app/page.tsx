'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { ProtectedPage } from '@/components/protected-page';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';
import { ProjectListItem } from '@/lib/types';

const ACTIVE_PROJECT_STATUSES = new Set(['QUEUED', 'PROCESSING', 'SENDING']);

function toTimestamp(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} ч ${String(minutes).padStart(2, '0')} мин ${String(seconds).padStart(2, '0')} сек`;
  }

  if (minutes > 0) {
    return `${minutes} мин ${String(seconds).padStart(2, '0')} сек`;
  }

  return `${seconds} сек`;
}

function getProcessingStart(project: ProjectListItem): number | null {
  if (project.status === 'SENDING') {
    return toTimestamp(project.sendingAt ?? project.updatedAt);
  }

  return toTimestamp(project.queuedAt ?? project.processingAt ?? project.updatedAt);
}

function getProgressCaption(status: string): string {
  if (status === 'SENDING') {
    return 'В отправке';
  }

  return 'В обработке';
}

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusNow, setStatusNow] = useState(() => Date.now());

  const load = useCallback(async (options: { showLoader?: boolean } = {}) => {
    if (options.showLoader) {
      setLoading(true);
    }
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
      if (options.showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load({ showLoader: true });
  }, [load]);

  const hasActiveProjects = useMemo(
    () => projects.some((project) => ACTIVE_PROJECT_STATUSES.has(project.status)),
    [projects],
  );

  useEffect(() => {
    if (!hasActiveProjects) {
      return;
    }

    const ticker = window.setInterval(() => {
      setStatusNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(ticker);
    };
  }, [hasActiveProjects]);

  useEffect(() => {
    if (!hasActiveProjects) {
      return;
    }

    const poller = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      window.clearInterval(poller);
    };
  }, [hasActiveProjects, load]);

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
                    <th className="projects-status-col">Статус</th>
                    <th>Автор</th>
                    <th>Рассылки</th>
                    <th>Отклики</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const isActive = ACTIVE_PROJECT_STATUSES.has(project.status);
                    const startedAt = getProcessingStart(project);
                    const elapsedLabel =
                      startedAt && startedAt <= statusNow
                        ? formatDuration(statusNow - startedAt)
                        : '...';
                    const progressCaption = getProgressCaption(project.status);

                    return (
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
                        <td className="projects-status-col">
                          <div className="project-status-cell">
                            <ProjectStatusBadge
                              status={project.status}
                              className="project-status-badge-fixed"
                            />
                            {isActive ? (
                              <div className="project-status-meta">
                                <span className="project-status-spinner" aria-hidden />
                                <span className="project-status-time">
                                  {progressCaption}: {elapsedLabel}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td>{project.author.fullName}</td>
                        <td>{project._count.mailings}</td>
                        <td>{project._count.responses}</td>
                        <td>{new Date(project.createdAt).toLocaleString('ru-RU')}</td>
                      </tr>
                    );
                  })}
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
