'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { ProtectedPage } from '@/components/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';
import { subscribeToNotifications } from '@/lib/realtime';
import {
  MAILING_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  RESPONSE_DECISION_LABELS,
} from '@/lib/status';
import { cn } from '@/lib/cn';
import { ProjectDetail, ProjectSuggestion } from '@/lib/types';

interface SuggestionDraft {
  id: string;
  includeInMailing: boolean;
  customSubject?: string;
  customBody?: string;
  customRecipients: string[];
}

interface LoadProjectOptions {
  preserveDrafts?: boolean;
  showBlockingLoader?: boolean;
  silent?: boolean;
}

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeRecipients(values: string[]): string[] {
  const seen = new Set<string>();
  const recipients: string[] = [];

  for (const raw of values) {
    const email = raw.toLowerCase().trim();
    if (!email || seen.has(email)) {
      continue;
    }
    seen.add(email);
    recipients.push(email);
  }

  return recipients;
}

function parseRecipientInput(value: string): string[] {
  return value
    .split(/[,\n;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveSuggestionRecipients(
  suggestion: ProjectSuggestion,
  draft?: SuggestionDraft,
): string[] {
  if (draft) {
    return normalizeRecipients(draft.customRecipients);
  }

  if (Array.isArray(suggestion.customRecipients)) {
    return normalizeRecipients(
      suggestion.customRecipients.filter(
        (value): value is string => typeof value === 'string',
      ),
    );
  }

  return normalizeRecipients(suggestion.department.recipients.map((item) => item.email));
}

function buildSuggestionsPayload(
  suggestions: ProjectSuggestion[],
  draftMap: Record<string, SuggestionDraft>,
) {
  return suggestions.map((item) => ({
    id: item.id,
    includeInMailing: draftMap[item.id]?.includeInMailing ?? item.includeInMailing,
    customSubject:
      draftMap[item.id]?.customSubject ?? item.customSubject ?? item.emailSubject,
    customBody: draftMap[item.id]?.customBody ?? item.customBody ?? item.emailBody,
    recipients: resolveSuggestionRecipients(item, draftMap[item.id]),
  }));
}

function getSuggestionsSignature(
  suggestions: ProjectSuggestion[],
  draftMap: Record<string, SuggestionDraft>,
): string {
  return JSON.stringify(buildSuggestionsPayload(suggestions, draftMap));
}

type BadgeTone = 'neutral' | 'info' | 'success' | 'danger';

function getMailingStatusTone(status: string): BadgeTone {
  if (status === 'SENT') {
    return 'success';
  }
  if (status === 'FAILED') {
    return 'danger';
  }
  if (status === 'QUEUED' || status === 'SENDING') {
    return 'info';
  }
  return 'neutral';
}

function getRealtimeProjectSignature(project: ProjectDetail): string {
  return [
    project.status,
    project.updatedAt,
    project.analysis?.generationStatus ?? '',
    project.analysis?.summary ?? '',
    project.analysis?.suggestions?.length ?? 0,
    project.analysis?.tasksJson?.length ?? 0,
    project.mailings
      .map(
        (mailing) =>
          `${mailing.id}:${mailing.status}:${mailing.sentAt ?? ''}:${
            mailing.response?.decision ?? ''
          }`,
      )
      .join(','),
    project.responses
      .map((response) => `${response.id}:${response.decision}:${response.respondedAt}`)
      .join(','),
  ].join('|');
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SuggestionDraft>>({});
  const [recipientInputs, setRecipientInputs] = useState<Record<string, string>>({});
  const [recipientErrors, setRecipientErrors] = useState<Record<string, string>>({});
  const [sourceTextDraft, setSourceTextDraft] = useState('');
  const [editingSourceText, setEditingSourceText] = useState(false);
  const [savingSourceText, setSavingSourceText] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [analysisNow, setAnalysisNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const lastSavedSignatureRef = useRef('');
  const skipNextAutosaveRef = useRef(false);

  const buildDraftMap = useCallback((data: ProjectDetail) => {
    const map: Record<string, SuggestionDraft> = {};
    data.analysis?.suggestions.forEach((item) => {
      map[item.id] = {
        id: item.id,
        includeInMailing: item.includeInMailing,
        customSubject: item.customSubject ?? item.emailSubject,
        customBody: item.customBody ?? item.emailBody,
        customRecipients: resolveSuggestionRecipients(item),
      };
    });
    return map;
  }, []);

  const loadProject = useCallback(async (options: LoadProjectOptions = {}) => {
    if (options.showBlockingLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await apiRequest<ProjectDetail>(`/projects/${projectId}`, {
        method: 'GET',
        withCsrf: false,
      });
      setProject((prev) => {
        if (!prev || !options.silent) {
          return data;
        }

        return getRealtimeProjectSignature(prev) === getRealtimeProjectSignature(data)
          ? prev
          : data;
      });
      if (!options.preserveDrafts) {
        const map = buildDraftMap(data);
        skipNextAutosaveRef.current = true;
        setDrafts(map);
        setSourceTextDraft(data.sourceText);
        setRecipientInputs({});
        setRecipientErrors({});
        if (data.analysis?.suggestions) {
          lastSavedSignatureRef.current = getSuggestionsSignature(
            data.analysis.suggestions,
            map,
          );
        } else {
          lastSavedSignatureRef.current = '';
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (options.showBlockingLoader) {
        setLoading(false);
      }
    }
  }, [buildDraftMap, projectId]);

  useEffect(() => {
    void loadProject({ showBlockingLoader: true });
  }, [loadProject]);

  useEffect(
    () =>
      subscribeToNotifications((notification) => {
        if (notification.projectId === projectId) {
          void loadProject({ preserveDrafts: true, silent: true });
        }
      }),
    [loadProject, projectId],
  );

  useEffect(() => {
    const refresh = () => void loadProject({ preserveDrafts: true, silent: true });
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
  }, [loadProject]);

  const analysisInProgress = useMemo(() => {
    if (!project) return false;
    return project.status === 'QUEUED' || project.status === 'PROCESSING';
  }, [project]);

  const suggestionsLocked = useMemo(() => {
    if (!project) return false;
    return (
      project.mailings.length > 0 ||
      ['APPROVED', 'SENDING', 'SENT'].includes(project.status)
    );
  }, [project]);

  const analysisStartedAt = useMemo(
    () => toTimestamp(project?.queuedAt ?? project?.processingAt),
    [project],
  );

  const analysisFinishedAt = useMemo(
    () => toTimestamp(project?.readyAt ?? project?.failedAt),
    [project],
  );

  const analysisElapsedMs = useMemo(() => {
    if (!analysisStartedAt) {
      return null;
    }
    const end = analysisInProgress ? analysisNow : analysisFinishedAt;
    if (!end || end < analysisStartedAt) {
      return null;
    }
    return end - analysisStartedAt;
  }, [analysisFinishedAt, analysisInProgress, analysisNow, analysisStartedAt]);

  useEffect(() => {
    if (!analysisInProgress) {
      return;
    }

    const timer = window.setInterval(() => {
      setAnalysisNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [analysisInProgress]);

  useEffect(() => {
    if (!analysisInProgress) {
      return;
    }

    const poller = window.setInterval(() => {
      void loadProject({ preserveDrafts: true, silent: true });
    }, 2500);

    return () => {
      window.clearInterval(poller);
    };
  }, [analysisInProgress, loadProject]);

  const canRunAnalysis = useMemo(() => {
    if (!project) return false;
    return (
      project.mailings.length === 0 &&
      ['DRAFT', 'FAILED', 'READY_FOR_REVIEW'].includes(project.status)
    );
  }, [project]);

  const canApproveAndSend = useMemo(() => {
    if (!project) return false;
    return !suggestionsLocked && project.status === 'READY_FOR_REVIEW';
  }, [project, suggestionsLocked]);

  const canEditSourceText = useMemo(() => {
    if (!project) return false;
    return (
      project.mailings.length === 0 &&
      ['DRAFT', 'FAILED', 'READY_FOR_REVIEW'].includes(project.status)
    );
  }, [project]);

  const hasSuccessfulAnalysis = useMemo(
    () => project?.analysis?.generationStatus === 'READY',
    [project],
  );

  const showAnalysisState = useMemo(() => {
    if (!project) return false;
    return analysisInProgress || Boolean(project.analysis) || project.status === 'FAILED';
  }, [analysisInProgress, project]);

  const analysisStateTone: 'success' | 'danger' | 'info' = useMemo(() => {
    if (analysisInProgress) {
      return 'info';
    }
    return hasSuccessfulAnalysis ? 'success' : 'danger';
  }, [analysisInProgress, hasSuccessfulAnalysis]);

  const createSuggestionDraft = useCallback(
    (suggestion: ProjectSuggestion, prevDraft?: SuggestionDraft): SuggestionDraft => ({
      id: suggestion.id,
      includeInMailing: prevDraft?.includeInMailing ?? suggestion.includeInMailing,
      customSubject:
        prevDraft?.customSubject ?? suggestion.customSubject ?? suggestion.emailSubject,
      customBody: prevDraft?.customBody ?? suggestion.customBody ?? suggestion.emailBody,
      customRecipients: resolveSuggestionRecipients(suggestion, prevDraft),
    }),
    [],
  );

  const updateSuggestionDraft = useCallback(
    (suggestion: ProjectSuggestion, patch: Partial<SuggestionDraft>) => {
      setDrafts((prev) => {
        const nextBase = createSuggestionDraft(suggestion, prev[suggestion.id]);
        return {
          ...prev,
          [suggestion.id]: {
            ...nextBase,
            ...patch,
          },
        };
      });
    },
    [createSuggestionDraft],
  );

  const addRecipients = useCallback(
    (suggestion: ProjectSuggestion) => {
      const rawInput = recipientInputs[suggestion.id] ?? '';
      const recipients = normalizeRecipients(parseRecipientInput(rawInput));

      if (recipients.length === 0) {
        return;
      }

      const invalid = recipients.filter((email) => !EMAIL_REGEX.test(email));
      if (invalid.length > 0) {
        setRecipientErrors((prev) => ({
          ...prev,
          [suggestion.id]: `Некорректные адреса: ${invalid.join(', ')}`,
        }));
        return;
      }

      setDrafts((prev) => {
        const currentDraft = createSuggestionDraft(suggestion, prev[suggestion.id]);
        return {
          ...prev,
          [suggestion.id]: {
            ...currentDraft,
            customRecipients: normalizeRecipients([
              ...currentDraft.customRecipients,
              ...recipients,
            ]),
          },
        };
      });

      setRecipientInputs((prev) => ({ ...prev, [suggestion.id]: '' }));
      setRecipientErrors((prev) => {
        const next = { ...prev };
        delete next[suggestion.id];
        return next;
      });
    },
    [createSuggestionDraft, recipientInputs],
  );

  const removeRecipient = useCallback(
    (suggestion: ProjectSuggestion, recipient: string) => {
      setDrafts((prev) => {
        const currentDraft = createSuggestionDraft(suggestion, prev[suggestion.id]);
        return {
          ...prev,
          [suggestion.id]: {
            ...currentDraft,
            customRecipients: currentDraft.customRecipients.filter(
              (email) => email !== recipient,
            ),
          },
        };
      });
    },
    [createSuggestionDraft],
  );

  const startEditingSourceText = () => {
    if (!project) return;
    setSourceTextDraft(project.sourceText);
    setEditingSourceText(true);
  };

  const cancelEditingSourceText = () => {
    if (!project) return;
    setSourceTextDraft(project.sourceText);
    setEditingSourceText(false);
  };

  const saveSourceText = async () => {
    if (!project) return;

    const sourceText = sourceTextDraft.trim();
    if (sourceText.length < 20) {
      setError('Текст запроса должен содержать не менее 20 символов');
      return;
    }
    if (sourceText === project.sourceText) {
      setEditingSourceText(false);
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setSavingSourceText(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/source-text`, {
        method: 'PATCH',
        body: JSON.stringify({ sourceText }),
      });
      setEditingSourceText(false);
      await loadProject();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingSourceText(false);
    }
  };

  const runAnalysis = async () => {
    setProcessing(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/analyze`, { method: 'POST', body: '{}' });
      await loadProject({ preserveDrafts: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const approveAndSend = async () => {
    if (!project?.analysis) return;

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setProcessing(true);
    setError(null);
    try {
      await apiRequest(`/projects/${projectId}/approve-and-send`, {
        method: 'POST',
        body: JSON.stringify({
          suggestions: buildSuggestionsPayload(project.analysis.suggestions, drafts),
        }),
      });
      await loadProject();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!project?.analysis || suggestionsLocked) {
      return;
    }

    const signature = getSuggestionsSignature(project.analysis.suggestions, drafts);
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      lastSavedSignatureRef.current = signature;
      return;
    }

    if (signature === lastSavedSignatureRef.current) {
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(async () => {
      try {
        await apiRequest(`/projects/${projectId}/suggestions`, {
          method: 'PATCH',
          body: JSON.stringify({
            suggestions: buildSuggestionsPayload(project.analysis!.suggestions, drafts),
          }),
        });
        lastSavedSignatureRef.current = signature;
      } catch (e) {
        setError((e as Error).message);
      }
    }, 700);
  }, [drafts, project, projectId, suggestionsLocked]);

  const resizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (!project?.analysis && !editingSourceText) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLTextAreaElement>('.auto-textarea')
        .forEach((element) => resizeTextarea(element));
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [drafts, editingSourceText, project?.analysis, resizeTextarea]);

  return (
    <ProtectedPage>
      <div className="page">
        {loading && !project ? (
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
                  <p className="section-subtitle">
                    {editingSourceText
                      ? 'После сохранения потребуется запустить анализ заново.'
                      : 'Содержимое запроса заказчика.'}
                  </p>
                </div>
                {editingSourceText ? (
                  <div className="section-actions">
                    <Button
                      variant="secondary"
                      onClick={cancelEditingSourceText}
                      disabled={savingSourceText}
                    >
                      Отмена
                    </Button>
                    <Button
                      onClick={saveSourceText}
                      disabled={
                        savingSourceText ||
                        sourceTextDraft.trim().length < 20 ||
                        sourceTextDraft.trim() === project.sourceText
                      }
                    >
                      {savingSourceText ? 'Сохраняем...' : 'Сохранить изменения'}
                    </Button>
                  </div>
                ) : canEditSourceText ? (
                  <Button variant="secondary" onClick={startEditingSourceText}>
                    Редактировать запрос
                  </Button>
                ) : null}
              </div>
              {editingSourceText ? (
                <div className="source-text-editor">
                  <Textarea
                    value={sourceTextDraft}
                    className="auto-textarea source-text-textarea"
                    onInput={(e) =>
                      resizeTextarea(e.currentTarget as HTMLTextAreaElement)
                    }
                    onChange={(e) => setSourceTextDraft(e.target.value)}
                  />
                  {project.analysis ? (
                    <p className="source-text-reset-notice">
                      Сохранение удалит текущую сводку, декомпозицию задач и рекомендации
                      по подразделениям.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="muted text-prewrap">{project.sourceText}</p>
              )}
            </Card>

            <Card>
              <div className="section-head">
                <div>
                  <h3 className="section-title">Анализ</h3>
                </div>
                <div className="section-actions">
                  <Button onClick={runAnalysis} disabled={!canRunAnalysis || processing}>
                    {processing
                      ? 'Запускаем...'
                      : hasSuccessfulAnalysis
                        ? 'Запустить повторный анализ'
                        : 'Запустить анализ'}
                  </Button>
                </div>
              </div>

              {showAnalysisState ? (
                <div className="notice analysis-progress">
                  {analysisInProgress ? <div className="loader-ring" /> : null}
                  <div>
                    {project ? (
                      <p className="analysis-time">
                        <Badge tone={analysisStateTone} className="analysis-status-badge">
                          {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                        </Badge>
                      </p>
                    ) : null}
                    {analysisInProgress ? (
                      <p className="muted analysis-time">
                        Время выполнения:{' '}
                        {analysisElapsedMs !== null ? formatDuration(analysisElapsedMs) : '...'}
                      </p>
                    ) : null}
                    {!analysisInProgress && analysisElapsedMs !== null ? (
                      <p className="muted analysis-time">
                        Время, потраченное на анализ: {formatDuration(analysisElapsedMs)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {project.analysis ? (
                <div className="stack-md">
                  <p>
                    <b>Сводка:</b> {project.analysis.summary || '—'}
                  </p>

                  <Card className="card-soft">
                    <div className="section-head">
                      <div>
                        <h4 className="section-title">Декомпозиция задач</h4>
                      </div>
                    </div>
                    <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
                      {project.analysis.tasksJson?.map((task, index) => (
                        <li key={`${task.title}-${index}`}>
                          <b>{task.title}</b>
                          <br />
                          <span className="muted">{task.description}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
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
                      {suggestionsLocked
                        ? 'Сообщения зафиксированы после подтверждения рассылки.'
                        : 'Отредактируйте письма и выберите подразделения перед рассылкой.'}
                    </p>
                  </div>
                  {!suggestionsLocked ? (
                    <div className="section-actions">
                      <Button
                        onClick={approveAndSend}
                        disabled={!canApproveAndSend || processing}
                      >
                        {processing ? 'Отправка...' : 'Подтвердить и разослать'}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="stack-md">
                  {project.analysis.suggestions.map((item, index) => {
                    const isEnabled =
                      drafts[item.id]?.includeInMailing ?? item.includeInMailing;
                    const recipients = resolveSuggestionRecipients(item, drafts[item.id]);
                    const recipientInput = recipientInputs[item.id] ?? '';

                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          'card-soft suggestion-card',
                          index % 2 === 0
                            ? 'suggestion-card-primary'
                            : 'suggestion-card-secondary',
                          !isEnabled && 'suggestion-card-disabled',
                        )}
                      >
                        <div className="suggestion-card-head">
                          <div className="suggestion-title-wrap">
                            <h4 className="section-title suggestion-title">
                              {item.department.name}
                            </h4>
                            <p className="section-subtitle suggestion-subtitle">
                              {recipients.length > 0
                                ? `${recipients.length} адресат(ов)`
                                : 'Нет адресатов'}
                            </p>
                          </div>
                          <div className="suggestion-head-meta">
                            <Badge
                              tone={isEnabled ? 'info' : 'neutral'}
                              className="suggestion-send-badge"
                            >
                              {isEnabled
                                ? 'В рассылке'
                                : suggestionsLocked
                                  ? 'Не отправлено'
                                  : 'Отключено'}
                            </Badge>
                            {!suggestionsLocked ? (
                              <label className="suggestion-toggle">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) =>
                                    updateSuggestionDraft(item, {
                                      includeInMailing: e.target.checked,
                                    })
                                  }
                                />
                                <span className="suggestion-toggle-track">
                                  <span className="suggestion-toggle-thumb" />
                                </span>
                                <span className="suggestion-toggle-text">
                                  {isEnabled ? 'Отправлять' : 'Не отправлять'}
                                </span>
                              </label>
                            ) : null}
                          </div>
                        </div>

                        <div
                          className={cn(
                            'suggestion-card-grid',
                            !isEnabled &&
                              !suggestionsLocked &&
                              'suggestion-content-disabled',
                          )}
                        >
                          <div className="suggestion-context">
                            <div className="suggestion-context-block">
                              <p className="suggestion-context-label">Почему релевантно</p>
                              <p className="suggestion-context-text">{item.relevanceReason}</p>
                            </div>
                            <div className="suggestion-context-block">
                              <p className="suggestion-context-label">
                                Адаптированное объяснение
                              </p>
                              <p className="suggestion-context-text">{item.adaptedPitch}</p>
                            </div>
                          </div>

                          <div className="suggestion-compose">
                            <div className="field mail-field mail-field-recipients">
                              <label className="label mail-field-label">Адресаты</label>
                              <div
                                className={cn(
                                  'suggestion-recipient-list',
                                  !suggestionsLocked && 'suggestion-recipient-list-edit',
                                )}
                              >
                                {recipients.length > 0 ? (
                                  recipients.map((recipient) =>
                                    suggestionsLocked ? (
                                      <span
                                        key={`${item.id}-${recipient}`}
                                        className="suggestion-recipient-pill"
                                      >
                                        {recipient}
                                      </span>
                                    ) : (
                                      <button
                                        key={`${item.id}-${recipient}`}
                                        type="button"
                                        className="suggestion-recipient-pill suggestion-recipient-pill-edit"
                                        onClick={() => removeRecipient(item, recipient)}
                                        disabled={!isEnabled}
                                        aria-label={`Удалить адрес ${recipient}`}
                                      >
                                        <span>{recipient}</span>
                                        <span className="suggestion-recipient-pill-remove">×</span>
                                      </button>
                                    ),
                                  )
                                ) : (
                                  <p className="muted suggestion-recipient-empty">
                                    {suggestionsLocked
                                      ? 'Адресаты не выбраны'
                                      : 'Добавьте адресатов для рассылки'}
                                  </p>
                                )}
                              </div>
                              {!suggestionsLocked ? (
                                <>
                                  <div className="suggestion-recipient-controls">
                                    <input
                                      type="text"
                                      className="input suggestion-recipient-input"
                                      placeholder="name@company.ru, second@company.ru"
                                      value={recipientInput}
                                      disabled={!isEnabled}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setRecipientInputs((prev) => ({
                                          ...prev,
                                          [item.id]: value,
                                        }));
                                        setRecipientErrors((prev) => {
                                          if (!prev[item.id]) {
                                            return prev;
                                          }
                                          const next = { ...prev };
                                          delete next[item.id];
                                          return next;
                                        });
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key !== 'Enter') {
                                          return;
                                        }
                                        e.preventDefault();
                                        addRecipients(item);
                                      }}
                                    />
                                    <Button
                                      variant="secondary"
                                      className="suggestion-recipient-add"
                                      onClick={() => addRecipients(item)}
                                      disabled={!isEnabled}
                                    >
                                      Добавить
                                    </Button>
                                  </div>
                                  {recipientErrors[item.id] ? (
                                    <p className="danger suggestion-recipient-error">
                                      {recipientErrors[item.id]}
                                    </p>
                                  ) : null}
                                </>
                              ) : null}
                            </div>

                            <div className="field mail-field mail-field-subject">
                              <label className="label mail-field-label">Тема письма</label>
                              {suggestionsLocked ? (
                                <p className="mail-field-static-text">
                                  {drafts[item.id]?.customSubject ?? item.emailSubject}
                                </p>
                              ) : (
                                <Textarea
                                  value={drafts[item.id]?.customSubject ?? item.emailSubject}
                                  className="auto-textarea"
                                  disabled={!isEnabled}
                                  onInput={(e) =>
                                    resizeTextarea(e.currentTarget as HTMLTextAreaElement)
                                  }
                                  onChange={(e) =>
                                    updateSuggestionDraft(item, {
                                      customSubject: e.target.value,
                                    })
                                  }
                                />
                              )}
                            </div>

                            <div className="field mail-field mail-field-body">
                              <label className="label mail-field-label">Текст письма</label>
                              {suggestionsLocked ? (
                                <p className="mail-field-static-text text-prewrap">
                                  {drafts[item.id]?.customBody ?? item.emailBody}
                                </p>
                              ) : (
                                <Textarea
                                  value={drafts[item.id]?.customBody ?? item.emailBody}
                                  className="auto-textarea"
                                  disabled={!isEnabled}
                                  onInput={(e) =>
                                    resizeTextarea(e.currentTarget as HTMLTextAreaElement)
                                  }
                                  onChange={(e) =>
                                    updateSuggestionDraft(item, {
                                      customBody: e.target.value,
                                    })
                                  }
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            <Card>
              <div className="section-head">
                <div>
                  <h3 className="section-title">Рассылка и отклики</h3>
                  <p className="section-subtitle">
                    Каждая строка соответствует адресу, на который было направлено письмо.
                  </p>
                </div>
                <Link href={`/projects/${project.id}/responses`}>
                  <Button variant="secondary">Открыть список откликов</Button>
                </Link>
              </div>

              <div className="table-wrap project-activity-table-wrap">
                <table className="project-activity-table">
                  <thead>
                    <tr>
                      <th>Подразделение</th>
                      <th>Адресат</th>
                      <th>Статус письма</th>
                      <th>Решение</th>
                      <th>Отправлено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.mailings.map((mailing) => (
                      <tr key={mailing.id}>
                        <td className="table-entity-cell">
                          <strong>{mailing.department.name}</strong>
                          <span>Подразделение проекта</span>
                        </td>
                        <td className="response-contact-cell">
                          <strong>{mailing.recipient.name}</strong>
                          <span>{mailing.recipient.email}</span>
                          <small className="table-recipient-type">
                            {mailing.recipient.type === 'EMPLOYEE'
                              ? 'Сотрудник'
                              : 'Подразделение'}
                          </small>
                        </td>
                        <td>
                          <Badge tone={getMailingStatusTone(mailing.status)}>
                            {MAILING_STATUS_LABELS[mailing.status] ?? mailing.status}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            tone={
                              !mailing.response
                                ? 'neutral'
                                : mailing.response.decision === 'ACCEPTED'
                                  ? 'success'
                                  : 'danger'
                            }
                          >
                            {mailing.response
                              ? (RESPONSE_DECISION_LABELS[mailing.response.decision] ??
                                mailing.response.decision)
                              : 'Без ответа'}
                          </Badge>
                        </td>
                        <td>
                          {mailing.sentAt
                            ? new Date(mailing.sentAt).toLocaleString('ru-RU')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {project.mailings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
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
