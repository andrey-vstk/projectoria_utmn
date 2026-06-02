'use client';

import { FormEvent, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { AdminOnly } from '@/components/admin-only';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';

interface Department {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  recipients: DepartmentRecipient[];
}

interface DepartmentRecipient {
  email: string;
  displayName?: string | null;
}

function createEmptyRecipient(): DepartmentRecipient {
  return { displayName: '', email: '' };
}

function normalizeRecipients(recipients: DepartmentRecipient[]): DepartmentRecipient[] {
  const seen = new Set<string>();
  const normalized: DepartmentRecipient[] = [];

  for (const recipient of recipients) {
    const email = recipient.email.toLowerCase().trim();
    if (!email || seen.has(email)) {
      continue;
    }
    seen.add(email);
    normalized.push({
      displayName: recipient.displayName?.trim() || null,
      email,
    });
  }

  return normalized;
}

function getDepartmentSignature(item: Department): string {
  return JSON.stringify({
    name: item.name.trim(),
    description: (item.description ?? '').trim(),
    isActive: item.isActive,
    recipients: normalizeRecipients(item.recipients),
  });
}

export default function AdminDepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [initialSignatures, setInitialSignatures] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recipients, setRecipients] = useState<DepartmentRecipient[]>([
    createEmptyRecipient(),
  ]);

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

  const isDepartmentDirty = (item: Department): boolean => {
    const initialSignature = initialSignatures[item.id];
    if (!initialSignature) {
      return false;
    }

    return getDepartmentSignature(item) !== initialSignature;
  };

  const createDepartment = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiRequest('/departments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          recipients: normalizeRecipients(recipients),
        }),
      });
      setName('');
      setDescription('');
      setRecipients([createEmptyRecipient()]);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateDepartment = async (department: Department) => {
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
          description: department.description,
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

  const updateNewRecipient = (
    index: number,
    field: keyof DepartmentRecipient,
    value: string,
  ) => {
    setRecipients((prev) =>
      prev.map((recipient, recipientIndex) =>
        recipientIndex === index ? { ...recipient, [field]: value } : recipient,
      ),
    );
  };

  const removeNewRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, recipientIndex) => recipientIndex !== index));
  };

  const updateDepartmentRecipient = (
    departmentId: string,
    index: number,
    field: keyof DepartmentRecipient,
    value: string,
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
          ? {
              ...department,
              recipients: [...department.recipients, createEmptyRecipient()],
            }
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

  return (
    <ProtectedPage>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Админка: подразделения</h1>
            <p className="page-subtitle">Управление справочником и адресатами рассылки.</p>
          </div>
        </div>

        <AdminOnly>
          <Card className="card-soft">
            <div className="section-head">
              <div>
                <h3 className="section-title">Добавить подразделение</h3>
              </div>
            </div>

            <form onSubmit={createDepartment} className="grid-2">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Название</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Описание</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ minHeight: 90 }}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Сотрудники и адресаты</label>
                <div className="department-recipient-editor department-recipient-editor-create">
                  <div className="department-recipient-editor-head">
                    <span>ФИО сотрудника или подразделение</span>
                    <span>Рабочая почта</span>
                  </div>
                  {recipients.map((recipient, index) => (
                    <div className="department-recipient-row" key={index}>
                      <Input
                        value={recipient.displayName ?? ''}
                        onChange={(event) =>
                          updateNewRecipient(index, 'displayName', event.target.value)
                        }
                        placeholder="Иванов Иван Иванович"
                      />
                      <Input
                        type="email"
                        value={recipient.email}
                        onChange={(event) =>
                          updateNewRecipient(index, 'email', event.target.value)
                        }
                        placeholder="employee@utmn.ru"
                        required
                      />
                      <button
                        type="button"
                        className="department-recipient-remove"
                        onClick={() => removeNewRecipient(index)}
                        disabled={recipients.length === 1}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    className="department-recipient-add"
                    onClick={() =>
                      setRecipients((prev) => [...prev, createEmptyRecipient()])
                    }
                  >
                    Добавить сотрудника
                  </Button>
                </div>
              </div>
              <div>
                <Button type="submit">Создать</Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="section-head">
              <div>
                <h3 className="section-title">Список подразделений</h3>
              </div>
            </div>

            {loading ? <p className="muted">Загрузка...</p> : null}
            {error ? <p className="message-danger">{error}</p> : null}

            {!loading ? (
              <div className="table-wrap departments-table-wrap">
                <table className="departments-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Сотрудники и адресаты</th>
                      <th className="departments-col-active">Активно</th>
                      <th className="departments-col-actions">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className={cn(!item.isActive && 'departments-row-inactive')}
                      >
                        <td className="departments-name-cell">
                          <span className="departments-cell-label">Подразделение</span>
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((d) =>
                                  d.id === item.id ? { ...d, name: e.target.value } : d,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="department-recipient-editor department-recipient-editor-table">
                            <span className="department-recipient-count">
                              {item.recipients.length} адресат(ов)
                            </span>
                            {item.recipients.map((recipient, index) => (
                              <div className="department-recipient-row" key={index}>
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
                                  placeholder={item.name}
                                />
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
                                <button
                                  type="button"
                                  className="department-recipient-remove"
                                  onClick={() => removeDepartmentRecipient(item.id, index)}
                                >
                                  Удалить
                                </button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="secondary"
                              className="department-recipient-add"
                              onClick={() => addDepartmentRecipient(item.id)}
                            >
                              Добавить сотрудника
                            </Button>
                          </div>
                        </td>
                        <td className="departments-col-active">
                          <label className="suggestion-toggle departments-toggle">
                            <input
                              type="checkbox"
                              checked={item.isActive}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((d) =>
                                    d.id === item.id ? { ...d, isActive: e.target.checked } : d,
                                  ),
                                )
                              }
                            />
                            <span className="suggestion-toggle-track">
                              <span className="suggestion-toggle-thumb" />
                            </span>
                            <span className="suggestion-toggle-text">
                              {item.isActive ? 'Активно' : 'Неактивно'}
                            </span>
                          </label>
                        </td>
                        <td className="departments-col-actions">
                          <div className="form-actions departments-actions">
                            <Button
                              variant="secondary"
                              disabled={!isDepartmentDirty(item) || savingId === item.id}
                              onClick={() => void updateDepartment(item)}
                            >
                              {savingId === item.id ? 'Сохраняем...' : 'Сохранить'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="muted">
                          Подразделения отсутствуют.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        </AdminOnly>
      </div>
    </ProtectedPage>
  );
}
