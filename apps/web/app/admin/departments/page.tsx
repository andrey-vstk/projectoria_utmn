'use client';

import { FormEvent, useEffect, useState } from 'react';
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

export default function AdminDepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

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
    }
  };

  const disableDepartment = async (id: string) => {
    setError(null);
    try {
      await apiRequest(`/departments/${id}`, { method: 'DELETE', body: '{}' });
      await load();
    } catch (e) {
      setError((e as Error).message);
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
          <Card>
            <h3>Добавить подразделение</h3>
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
                  style={{ minHeight: 80 }}
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
            {loading ? <p className="muted">Загрузка...</p> : null}
            {error ? <p className="danger">{error}</p> : null}

            {!loading ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Название</th>
                      <th>Email</th>
                      <th>Активно</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
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
                        <td>
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
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button variant="secondary" onClick={() => void updateDepartment(item)}>
                              Сохранить
                            </Button>
                            <Button variant="danger" onClick={() => void disableDepartment(item.id)}>
                              Отключить
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
