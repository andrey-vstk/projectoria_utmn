'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { USER_STATUS_LABELS } from '@/lib/status';

type UserRole = 'ADMIN' | 'INITIATOR';
type UserStatus = 'ACTIVE' | 'DISABLED';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface AdminToggleProps<T extends string> {
  value: T;
  options: Array<ToggleOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

const ROLE_OPTIONS: Array<ToggleOption<UserRole>> = [
  {
    value: 'INITIATOR',
    label: 'Инициатор',
  },
  {
    value: 'ADMIN',
    label: 'Админ',
  },
];

const STATUS_OPTIONS: Array<ToggleOption<UserStatus>> = [
  {
    value: 'ACTIVE',
    label: USER_STATUS_LABELS.ACTIVE,
  },
  {
    value: 'DISABLED',
    label: USER_STATUS_LABELS.DISABLED,
  },
];

function AdminToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: AdminToggleProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      className={cn('admin-toggle', activeIndex === 1 && 'admin-toggle-second', className)}
      data-value={value}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      <span className="admin-toggle-thumb" aria-hidden />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={cn(
            'admin-toggle-option',
            option.value === value && 'admin-toggle-option-active',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser, refresh } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('INITIATOR');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<UserItem[]>('/users', {
        method: 'GET',
        withCsrf: false,
      });
      setUsers(data);
      setPasswordDrafts({});
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
          status,
        }),
      });
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('INITIATOR');
      setStatus('ACTIVE');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const patchUser = <K extends keyof UserItem>(userId: string, field: K, value: UserItem[K]) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, [field]: value } : user)),
    );
  };

  const setUserPasswordDraft = (userId: string, value: string) => {
    setPasswordDrafts((prev) => ({
      ...prev,
      [userId]: value,
    }));
  };

  const updateUser = async (user: UserItem) => {
    setSavingId(user.id);
    setError(null);
    try {
      const passwordDraft = passwordDrafts[user.id] ?? '';
      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          ...(passwordDraft.trim() ? { password: passwordDraft } : {}),
        }),
      });
      await load();
      if (currentUser?.id === user.id) {
        await refresh();
      }
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
            <h1 className="page-title">Пользователи</h1>
            <p className="page-subtitle">
              Создание аккаунтов, редактирование данных и управление доступом сотрудников.
            </p>
          </div>
        </div>

        <AdminOnly>
          <Card className="card-soft admin-users-create-card">
            <div className="section-head">
              <div>
                <h3 className="section-title">Создать пользователя</h3>
              </div>
            </div>

            <form onSubmit={createUser} className="admin-users-create-grid">
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
                  minLength={8}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Роль</label>
                <AdminToggle
                  value={role}
                  options={ROLE_OPTIONS}
                  onChange={setRole}
                  ariaLabel="Выбор роли нового пользователя"
                  className="admin-toggle-form"
                />
              </div>
              <div className="field">
                <label className="label">Статус</label>
                <AdminToggle
                  value={status}
                  options={STATUS_OPTIONS}
                  onChange={setStatus}
                  ariaLabel="Выбор статуса нового пользователя"
                  className="admin-toggle-form"
                />
              </div>
              <div className="admin-users-create-action">
                <Button type="submit">Добавить</Button>
              </div>
            </form>
          </Card>

          <section className="admin-users-list">
            <div className="section-head">
              <div>
                <h3 className="section-title">Список пользователей</h3>
              </div>
            </div>

            {loading ? <p className="muted">Загрузка...</p> : null}
            {error ? <p className="message-danger">{error}</p> : null}

            {!loading ? (
              <div className="admin-user-cards">
                {users.map((user) => {
                  const isSaving = savingId === user.id;

                  return (
                    <article className="admin-user-card" key={user.id}>
                      <div className="admin-user-card-head">
                        <div className="admin-user-heading">
                          <strong>{user.fullName || 'Без имени'}</strong>
                          <span>{user.email}</span>
                        </div>
                        <div className="admin-user-state">
                          <span>{user.role === 'ADMIN' ? 'Администратор' : 'Инициатор'}</span>
                          <span>{USER_STATUS_LABELS[user.status]}</span>
                        </div>
                      </div>

                      <div className="admin-user-edit-grid">
                        <div className="field">
                          <label className="label">Email</label>
                          <Input
                            type="email"
                            className="admin-user-input"
                            value={user.email}
                            onChange={(event) => patchUser(user.id, 'email', event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label className="label">ФИО</label>
                          <Input
                            className="admin-user-input"
                            value={user.fullName}
                            onChange={(event) =>
                              patchUser(user.id, 'fullName', event.target.value)
                            }
                          />
                        </div>
                        <div className="field">
                          <label className="label">Новый пароль</label>
                          <Input
                            type="password"
                            className="admin-user-input admin-user-password"
                            minLength={8}
                            placeholder="Не менять"
                            value={passwordDrafts[user.id] ?? ''}
                            onChange={(event) =>
                              setUserPasswordDraft(user.id, event.target.value)
                            }
                          />
                        </div>
                        <div className="field">
                          <label className="label">Роль</label>
                          <AdminToggle
                            value={user.role}
                            options={ROLE_OPTIONS}
                            onChange={(value) => patchUser(user.id, 'role', value)}
                            ariaLabel={`Выбор роли пользователя ${user.email}`}
                            className="admin-toggle-compact"
                          />
                        </div>
                        <div className="field">
                          <label className="label">Статус</label>
                          <AdminToggle
                            value={user.status}
                            options={STATUS_OPTIONS}
                            onChange={(value) => patchUser(user.id, 'status', value)}
                            ariaLabel={`Выбор статуса пользователя ${user.email}`}
                            className="admin-toggle-compact"
                          />
                        </div>
                        <div className="admin-user-save">
                          <Button
                            variant="secondary"
                            disabled={isSaving}
                            onClick={() => void updateUser(user)}
                          >
                            {isSaving ? 'Сохраняем...' : 'Сохранить'}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {users.length === 0 ? (
                  <p className="muted admin-users-empty">Пользователи не найдены.</p>
                ) : null}
              </div>
            ) : null}
          </section>
        </AdminOnly>
      </div>
    </ProtectedPage>
  );
}
