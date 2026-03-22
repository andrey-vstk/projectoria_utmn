'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'INITIATOR';
  status: 'ACTIVE' | 'DISABLED';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'INITIATOR'>('INITIATOR');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<UserItem[]>('/users', {
        method: 'GET',
        withCsrf: false,
      });
      setUsers(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          fullName,
          password,
          role,
        }),
      });
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('INITIATOR');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateUser = async (user: UserItem) => {
    setError(null);
    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: user.role,
          status: user.status,
        }),
      });
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
            <h1 className="page-title">Админка: пользователи</h1>
            <p className="page-subtitle">
              Создание аккаунтов, смена роли и отключение доступа сотрудников.
            </p>
          </div>
        </div>

        <AdminOnly>
          <Card className="card-soft">
            <div className="section-head">
              <div>
                <h3 className="section-title">Создать пользователя</h3>
              </div>
            </div>

            <form onSubmit={createUser} className="grid-3">
              <div className="field">
                <label className="label">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">ФИО</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="field">
                <label className="label">Пароль</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Роль</label>
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'INITIATOR')}
                >
                  <option value="INITIATOR">Инициатор</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </div>
              <div style={{ alignSelf: 'end' }}>
                <Button type="submit">Добавить</Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="section-head">
              <div>
                <h3 className="section-title">Список пользователей</h3>
              </div>
            </div>

            {loading ? <p className="muted">Загрузка...</p> : null}
            {error ? <p className="message-danger">{error}</p> : null}

            {!loading ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>ФИО</th>
                      <th>Роль</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>{user.fullName}</td>
                        <td>
                          <select
                            className="input"
                            value={user.role}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((u) =>
                                  u.id === user.id
                                    ? { ...u, role: e.target.value as UserItem['role'] }
                                    : u,
                                ),
                              )
                            }
                          >
                            <option value="INITIATOR">Инициатор</option>
                            <option value="ADMIN">Администратор</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="input"
                            value={user.status}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((u) =>
                                  u.id === user.id
                                    ? { ...u, status: e.target.value as UserItem['status'] }
                                    : u,
                                ),
                              )
                            }
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="DISABLED">DISABLED</option>
                          </select>
                        </td>
                        <td>
                          <Button variant="secondary" onClick={() => void updateUser(user)}>
                            Сохранить
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          Пользователи не найдены.
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
