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
  recipients: Array<{ email: string }>;
}

function normalizeRecipients(recipients: Array<{ email: string }>): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const recipient of recipients) {
    const email = recipient.email.toLowerCase().trim();
    if (!email || seen.has(email)) {
      continue;
    }
    seen.add(email);
    normalized.push(email);
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

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recipients, setRecipients] = useState('');

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

  const parseRecipients = (value: string): string[] =>
    value
      .split(/[,\n;]+/g)
      .map((item) => item.trim())
      .filter(Boolean);

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
          code,
          name,
          description,
          recipients: parseRecipients(recipients),
        }),
      });
      setCode('');
      setName('');
      setDescription('');
      setRecipients('');
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
          recipients: department.recipients.map((r) => r.email),
        }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
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
              <div className="field">
                <label className="label">Код</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
              <div className="field">
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
                <label className="label">Email получателей (через запятую)</label>
                <Input
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="dep1@utmn.local, dep2@utmn.local"
                  required
                />
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
                      <th className="departments-col-code">Код</th>
                      <th>Название</th>
                      <th>Email</th>
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
                        <td>
                          <span className="departments-code-chip">{item.code}</span>
                        </td>
                        <td>
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
                          <Input
                            value={item.recipients.map((r) => r.email).join(', ')}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((d) =>
                                  d.id === item.id
                                    ? {
                                        ...d,
                                        recipients: parseRecipients(e.target.value).map(
                                          (email) => ({ email }),
                                        ),
                                      }
                                    : d,
                                ),
                              )
                            }
                          />
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
                        <td colSpan={5} className="muted">
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
