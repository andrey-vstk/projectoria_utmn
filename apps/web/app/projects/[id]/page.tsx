'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { ProtectedPage } from '@/components/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';
import { MAILING_STATUS_LABELS, PROJECT_STATUS_LABELS } from '@/lib/status';
import { ProjectDetail, ProjectSuggestion } from '@/lib/types';

interface SuggestionDraft {
  id: string;
  includeInMailing: boolean;
  customSubject?: string;
  customBody?: string;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SuggestionDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ProjectDetail>(`/projects/${projectId}`, {
        method: 'GET',
        withCsrf: false,
      });
      setProject(data);

      const map: Record<string, SuggestionDraft> = {};
      data.analysis?.suggestions.forEach((item) => {
        map[item.id] = {
          id: item.id,
          includeInMailing: item.includeInMailing,
          customSubject: item.customSubject ?? item.emailSubject,
          customBody: item.customBody ?? item.emailBody,
        };
      });
      setDrafts(map);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const canRunAnalysis = useMemo(() => {
    if (!project) return false;
    return ['DRAFT', 'FAILED', 'READY_FOR_REVIEW'].includes(project.status);
  }, [project]);

  const canApproveAndSend = useMemo(() => {
    if (!project) return false;
    return ['READY_FOR_REVIEW', 'APPROVED'].includes(project.status);
  }, [project]);

  const patchSuggestionsPayload = (suggestions: ProjectSuggestion[]) =>
    suggestions.map((item) => ({
      id: item.id,
      includeInMailing: drafts[item.id]?.includeInMailing ?? item.includeInMailing,
      customSubject: drafts[item.id]?.customSubject ?? item.customSubject ?? item.emailSubject,
      customBody: drafts[item.id]?.customBody ?? item.customBody ?? item.emailBody,
    }));

  const runAnalysis = async () => {
    setProcessing(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/analyze`, { method: 'POST', body: '{}' });
      await loadProject();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const saveSuggestions = async () => {
    if (!project?.analysis) return;

    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/suggestions`, {
        method: 'PATCH',
        body: JSON.stringify({
          suggestions: patchSuggestionsPayload(project.analysis.suggestions),
        }),
      });
      await loadProject();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const approveAndSend = async () => {
    if (!project?.analysis) return;

    setProcessing(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/approve-and-send`, {
        method: 'POST',
        body: JSON.stringify({
          suggestions: patchSuggestionsPayload(project.analysis.suggestions),
        }),
      });
      await loadProject();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ProtectedPage>
      <div className="page">
        {loading ? (
          <div className="page-loader">
            <div className="loader-ring" />
            <span>Загружаем проект...</span>
          </div>
        ) : null}

        {!loading && project ? (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">{project.title}</h1>
                <p className="page-subtitle">
                  Автор: {project.author.fullName} •{' '}
                  {new Date(project.createdAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <ProjectStatusBadge status={project.status} />
            </div>

            {error ? <p className="message-danger">{error}</p> : null}

            <Card className="card-soft">
              <div className="section-head">
                <div>
                  <h3 className="section-title">Исходный текст</h3>
                  <p className="section-subtitle">Содержимое запроса заказчика без изменений.</p>
                </div>
              </div>
              <p className="muted text-prewrap">{project.sourceText}</p>
            </Card>

            <Card>
              <div className="section-head">
                <div>
                  <h3 className="section-title">Анализ</h3>
                  <p className="section-subtitle">
                    Запуск LLM-обработки и обзор декомпозиции запроса.
                  </p>
                </div>
                <div className="section-actions">
                  <Button onClick={runAnalysis} disabled={!canRunAnalysis || processing}>
                    {processing ? 'Запуск...' : 'Запустить анализ'}
                  </Button>
                </div>
              </div>

              {project.analysis ? (
                <div className="stack-md">
                  <p>
                    <b>Summary:</b> {project.analysis.summary || '—'}
                  </p>

                  <div className="grid-2">
                    <Card className="card-soft">
                      <div className="section-head">
                        <div>
                          <h4 className="section-title">Декомпозиция задач</h4>
                        </div>
                      </div>
                      <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
                        {project.analysis.tasksJson?.map((task, index) => (
                          <li key={`${task.title}-${index}`}>
                            <b>{task.title}</b> ({task.priority})
                            <br />
                            <span className="muted">{task.description}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>

                    <Card className="card-soft">
                      <div className="section-head">
                        <div>
                          <h4 className="section-title">Статус генерации</h4>
                        </div>
                      </div>
                      <Badge tone="info">
                        {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                      <p className="muted" style={{ marginTop: 12 }}>
                        Можно вручную скорректировать тексты писем и исключить подразделения из
                        рассылки.
                      </p>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="muted">Анализ пока не запущен.</p>
              )}
            </Card>

            {project.analysis ? (
              <Card>
                <div className="section-head">
                  <div>
                    <h3 className="section-title">Рекомендации по подразделениям</h3>
                    <p className="section-subtitle">
                      Отредактируйте письма и выберите подразделения перед рассылкой.
                    </p>
                  </div>
                  <div className="section-actions">
                    <Button variant="secondary" onClick={saveSuggestions} disabled={saving}>
                      {saving ? 'Сохраняем...' : 'Сохранить правки'}
                    </Button>
                    <Button onClick={approveAndSend} disabled={!canApproveAndSend || processing}>
                      {processing ? 'Отправка...' : 'Подтвердить и разослать'}
                    </Button>
                  </div>
                </div>

                <div className="stack-md">
                  {project.analysis.suggestions.map((item) => (
                    <Card key={item.id} className="card-soft">
                      <div className="section-head">
                        <div>
                          <h4 className="section-title">
                            {item.department.code} — {item.department.name}
                          </h4>
                          <p className="section-subtitle">
                            Адресаты: {item.department.recipients.map((r) => r.email).join(', ')}
                          </p>
                        </div>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={drafts[item.id]?.includeInMailing ?? item.includeInMailing}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  id: item.id,
                                  includeInMailing: e.target.checked,
                                },
                              }))
                            }
                          />
                          Отправлять
                        </label>
                      </div>

                      <div className="stack-sm">
                        <p>
                          <b>Почему релевантно:</b> {item.relevanceReason}
                        </p>
                        <p>
                          <b>Адаптированное объяснение:</b> {item.adaptedPitch}
                        </p>
                      </div>

                      <div className="field">
                        <label className="label">Тема письма</label>
                        <Textarea
                          value={drafts[item.id]?.customSubject ?? item.emailSubject}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                id: item.id,
                                includeInMailing:
                                  prev[item.id]?.includeInMailing ?? item.includeInMailing,
                                customSubject: e.target.value,
                              },
                            }))
                          }
                          style={{ minHeight: 84 }}
                        />
                      </div>

                      <div className="field">
                        <label className="label">Текст письма</label>
                        <Textarea
                          value={drafts[item.id]?.customBody ?? item.emailBody}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                id: item.id,
                                includeInMailing:
                                  prev[item.id]?.includeInMailing ?? item.includeInMailing,
                                customBody: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card>
              <div className="section-head">
                <div>
                  <h3 className="section-title">Рассылка и отклики</h3>
                  <p className="section-subtitle">
                    Статусы отправки писем и факт отклика по уникальной ссылке.
                  </p>
                </div>
                <Link href={`/projects/${project.id}/responses`}>
                  <Button variant="secondary">Открыть список откликов</Button>
                </Link>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Подразделение</th>
                      <th>Статус письма</th>
                      <th>Отклик</th>
                      <th>Отправлено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.mailings.map((mailing) => (
                      <tr key={mailing.id}>
                        <td>
                          {mailing.department.code} — {mailing.department.name}
                        </td>
                        <td>{MAILING_STATUS_LABELS[mailing.status] ?? mailing.status}</td>
                        <td>{mailing.response ? 'Да' : '—'}</td>
                        <td>
                          {mailing.sentAt
                            ? new Date(mailing.sentAt).toLocaleString('ru-RU')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {project.mailings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="muted">
                          Письма еще не сформированы.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </ProtectedPage>
  );
}
