'use client';

import { KeyboardEvent, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { AdminOnly } from '@/components/admin-only';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';

interface Department {
  id: string;
  code: string;
  name: string;
  competencies: string[];
  isActive: boolean;
  recipients: DepartmentRecipient[];
}

interface DepartmentRecipient {
  id?: string;
  email: string;
  displayName?: string | null;
  competencies: string[];
}

interface CompetencyEditorProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

function createEmptyRecipient(): DepartmentRecipient {
  return { displayName: '', email: '', competencies: [] };
}

function normalizeCompetencies(values: string[]): string[] {
  const normalized = new Map<string, string>();
  for (const raw of values) {
    const competency = raw.trim();
    if (!competency) {
      continue;
    }
    normalized.set(competency.toLowerCase(), competency);
  }
  return [...normalized.values()];
}

function parseCompetencies(value: string): string[] {
  return value
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRecipients(recipients: DepartmentRecipient[]): DepartmentRecipient[] {
  const normalized = new Map<string, DepartmentRecipient>();

  for (const recipient of recipients) {
    const email = recipient.email.toLowerCase().trim();
    if (!email) {
      continue;
    }
    normalized.set(email, {
      email,
      displayName: recipient.displayName?.trim() || null,
      competencies: normalizeCompetencies(recipient.competencies),
    });
  }

  return [...normalized.values()];
}

function getDepartmentSignature(item: Department): string {
  return JSON.stringify({
    name: item.name.trim(),
    competencies: normalizeCompetencies(item.competencies),
    isActive: item.isActive,
    recipients: normalizeRecipients(item.recipients),
  });
}

function CompetencyEditor({
  values,
  onChange,
  placeholder = 'Введите компетенцию',
}: CompetencyEditorProps) {
  const [input, setInput] = useState('');

  const add = () => {
    const additions = parseCompetencies(input);
    if (additions.length === 0) {
      return;
    }
    onChange(normalizeCompetencies([...values, ...additions]));
    setInput('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    add();
  };

  return (
    <div className="competency-editor">
      <div className="competency-tags">
        {values.length > 0 ? (
          values.map((competency) => (
            <span className="competency-tag" key={competency}>
              <span>{competency}</span>
              <button
                type="button"
                className="competency-tag-remove"
                onClick={() => onChange(values.filter((item) => item !== competency))}
                aria-label={`Удалить компетенцию ${competency}`}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="competency-empty">Не указаны</span>
        )}
      </div>
      <div className="competency-controls">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!input.trim()}>
          Добавить
        </Button>
      </div>
    </div>
  );
}

export default function AdminDepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [initialSignatures, setInitialSignatures] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>(
    {},
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Department[]>('/departments', {
        method: 'GET',
        withCsrf: false,
      });
      setItems(data);
      setInitialSignatures(
        Object.fromEntries(data.map((item) => [item.id, getDepartmentSignature(item)])),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const isDraftDepartment = (departmentId: string): boolean =>
    departmentId.startsWith('draft-');

  const isDepartmentDirty = (item: Department): boolean =>
    isDraftDepartment(item.id) || getDepartmentSignature(item) !== initialSignatures[item.id];

  const addDraftDepartment = () => {
    const id = `draft-${Date.now()}`;
    const draft: Department = {
      id,
      code: '',
      name: '',
      competencies: [],
      isActive: true,
      recipients: [createEmptyRecipient()],
    };
    setItems((prev) => [draft, ...prev]);
    setExpandedDepartments((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  const createDepartment = async (department: Department) => {
    if (!department.name.trim()) {
      return;
    }

    setSavingId(department.id);
    setError(null);
    try {
      await apiRequest('/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: department.name,
          competencies: normalizeCompetencies(department.competencies),
          recipients: normalizeRecipients(department.recipients),
        }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const saveDepartment = async (department: Department) => {
    if (isDraftDepartment(department.id)) {
      await createDepartment(department);
      return;
    }

    if (!isDepartmentDirty(department)) {
      return;
    }

    setSavingId(department.id);
    setError(null);
    try {
      await apiRequest(`/departments/${department.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: department.name,
          competencies: normalizeCompetencies(department.competencies),
          isActive: department.isActive,
          recipients: normalizeRecipients(department.recipients),
        }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteDepartment = async (department: Department) => {
    if (isDraftDepartment(department.id)) {
      setItems((prev) => prev.filter((item) => item.id !== department.id));
      setExpandedDepartments((prev) => {
        const next = { ...prev };
        delete next[department.id];
        return next;
      });
      return;
    }

    const confirmed = window.confirm(
      `Удалить подразделение «${department.name}» из реестра? История рассылок и откликов сохранится.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(department.id);
    setError(null);
    try {
      await apiRequest(`/departments/${department.id}`, {
        method: 'DELETE',
      });
      setItems((prev) => prev.filter((item) => item.id !== department.id));
      setInitialSignatures((prev) => {
        const next = { ...prev };
        delete next[department.id];
        return next;
      });
      setExpandedDepartments((prev) => {
        const next = { ...prev };
        delete next[department.id];
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const patchDepartment = <K extends keyof Department>(
    departmentId: string,
    field: K,
    value: Department[K],
  ) => {
    setItems((prev) =>
      prev.map((department) =>
        department.id === departmentId ? { ...department, [field]: value } : department,
      ),
    );
  };

  const updateDepartmentRecipient = <K extends keyof DepartmentRecipient>(
    departmentId: string,
    index: number,
    field: K,
    value: DepartmentRecipient[K],
  ) => {
    setItems((prev) =>
      prev.map((department) =>
        department.id === departmentId
          ? {
              ...department,
              recipients: department.recipients.map((recipient, recipientIndex) =>
                recipientIndex === index ? { ...recipient, [field]: value } : recipient,
              ),
            }
          : department,
      ),
    );
  };

  const addDepartmentRecipient = (departmentId: string) => {
    setItems((prev) =>
      prev.map((department) =>
        department.id === departmentId
          ? { ...department, recipients: [...department.recipients, createEmptyRecipient()] }
          : department,
      ),
    );
  };

  const removeDepartmentRecipient = (departmentId: string, index: number) => {
    setItems((prev) =>
      prev.map((department) =>
        department.id === departmentId
          ? {
              ...department,
              recipients: department.recipients.filter(
                (_, recipientIndex) => recipientIndex !== index,
              ),
            }
          : department,
      ),
    );
  };

  const toggleDepartment = (departmentId: string) => {
    setExpandedDepartments((prev) => ({
      ...prev,
      [departmentId]: !prev[departmentId],
    }));
  };

  return (
    <ProtectedPage>
      <div className="page departments-page">
        <div className="page-head departments-page-head">
          <div>
            <h1 className="page-title">Подразделения</h1>
            <p className="page-subtitle">
              Компетенции подразделений и сотрудников для точной маршрутизации проектов.
            </p>
          </div>
        </div>

        <AdminOnly>
          {error ? <p className="message-danger">{error}</p> : null}

          <section className="department-workbench">
            <div className="department-workbench-head">
              <div>
                <h3 className="section-title">Рабочий список подразделений</h3>
                <p className="section-subtitle">
                  {items.length} всего, {items.filter((item) => item.isActive).length} активных
                </p>
              </div>
              <Button onClick={addDraftDepartment}>Добавить подразделение</Button>
            </div>

            {loading ? <p className="muted departments-loading">Загрузка...</p> : null}

            {!loading ? (
              <div className="department-workbench-list">
                {items.map((item) => {
                  const expanded = Boolean(expandedDepartments[item.id]);
                  const dirty = isDepartmentDirty(item);
                  const isSaving = savingId === item.id;
                  const isDeleting = deletingId === item.id;
                  const canSave = dirty && Boolean(item.name.trim()) && !isSaving && !isDeleting;

                  return (
                    <article
                      key={item.id}
                      className={cn(
                        'department-tool-card',
                        expanded && 'department-tool-card-expanded',
                        !item.isActive && 'department-tool-card-inactive',
                        dirty && 'department-tool-card-dirty',
                      )}
                    >
                      <div className="department-tool-summary">
                        <button
                          type="button"
                          className="department-tool-open"
                          onClick={() => toggleDepartment(item.id)}
                          aria-expanded={expanded}
                        >
                          <span className="department-tool-mark">{expanded ? '−' : '+'}</span>
                          <span className="department-tool-title">
                            <strong>{item.name || 'Новое подразделение'}</strong>
                          </span>
                        </button>

                        <div className="department-tool-metrics">
                          <span>
                            <b>{item.competencies.length}</b>
                            компетенций
                          </span>
                          <span>
                            <b>{item.recipients.length}</b>
                            адресатов
                          </span>
                        </div>

                        <label className="suggestion-toggle departments-toggle">
                          <input
                            type="checkbox"
                            checked={item.isActive}
                            onChange={(event) =>
                              patchDepartment(item.id, 'isActive', event.target.checked)
                            }
                          />
                          <span className="suggestion-toggle-track">
                            <span className="suggestion-toggle-thumb" />
                          </span>
                          <span className="suggestion-toggle-text">
                            {item.isActive ? 'Активно' : 'Неактивно'}
                          </span>
                        </label>

                        <div className="department-tool-actions">
                          <Button
                            variant="secondary"
                            disabled={!canSave}
                            onClick={() => void saveDepartment(item)}
                          >
                            {isSaving ? 'Сохраняем...' : 'Сохранить'}
                          </Button>
                          <Button
                            variant="danger"
                            disabled={isSaving || isDeleting}
                            onClick={() => void deleteDepartment(item)}
                          >
                            {isDeleting ? 'Удаляем...' : isDraftDepartment(item.id) ? 'Отменить' : 'Удалить'}
                          </Button>
                        </div>
                      </div>

                      {expanded ? (
                        <div className="department-tool-body">
                          <div className="department-tool-panel department-tool-profile">
                            <div className="department-tool-panel-head">
                              <h4 className="department-detail-title">Профиль</h4>
                            </div>
                            <div className="department-tool-profile-grid">
                              <div className="field">
                                <label className="label">Название</label>
                                <Input
                                  value={item.name}
                                  onChange={(event) =>
                                    patchDepartment(item.id, 'name', event.target.value)
                                  }
                                />
                              </div>
                              <div className="field">
                                <label className="label">Компетенции подразделения</label>
                                <CompetencyEditor
                                  values={item.competencies}
                                  onChange={(values) =>
                                    patchDepartment(item.id, 'competencies', values)
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div className="department-tool-panel">
                            <div className="department-tool-panel-head">
                              <div>
                                <h4 className="department-detail-title">Сотрудники</h4>
                                <p className="section-subtitle">
                                  {item.recipients.length > 0
                                    ? `${item.recipients.length} адресат(ов)`
                                    : 'Добавьте хотя бы один email для рассылки'}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                className="department-recipient-add"
                                onClick={() => addDepartmentRecipient(item.id)}
                              >
                                Добавить сотрудника
                              </Button>
                            </div>

                            {item.recipients.length > 0 ? (
                              <div className="department-employees-table-wrap">
                                <table className="department-employees-table">
                                  <thead>
                                    <tr>
                                      <th>ФИО / адресат</th>
                                      <th>Email</th>
                                      <th>Компетенции</th>
                                      <th aria-label="Действия" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.recipients.map((recipient, index) => (
                                      <tr key={index}>
                                        <td>
                                          <Input
                                            value={recipient.displayName ?? ''}
                                            onChange={(event) =>
                                              updateDepartmentRecipient(
                                                item.id,
                                                index,
                                                'displayName',
                                                event.target.value,
                                              )
                                            }
                                            placeholder="ФИО или название адресата"
                                          />
                                        </td>
                                        <td>
                                          <Input
                                            type="email"
                                            value={recipient.email}
                                            onChange={(event) =>
                                              updateDepartmentRecipient(
                                                item.id,
                                                index,
                                                'email',
                                                event.target.value,
                                              )
                                            }
                                            placeholder="employee@utmn.ru"
                                          />
                                        </td>
                                        <td>
                                          <CompetencyEditor
                                            values={recipient.competencies}
                                            onChange={(values) =>
                                              updateDepartmentRecipient(
                                                item.id,
                                                index,
                                                'competencies',
                                                values,
                                              )
                                            }
                                            placeholder="Компетенция сотрудника"
                                          />
                                        </td>
                                        <td>
                                          <button
                                            type="button"
                                            className="department-recipient-remove"
                                            onClick={() =>
                                              removeDepartmentRecipient(item.id, index)
                                            }
                                          >
                                            Удалить
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="muted department-recipient-empty">
                                Сотрудники еще не добавлены.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {items.length === 0 ? (
                  <p className="muted departments-empty">Подразделения отсутствуют.</p>
                ) : null}
              </div>
            ) : null}
          </section>

        </AdminOnly>
      </div>
    </ProtectedPage>
  );
}
