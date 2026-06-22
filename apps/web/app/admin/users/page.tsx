'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
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

function getUserSignature(user: UserItem): string {
  return JSON.stringify({
    email: user.email.trim().toLowerCase(),
    fullName: user.fullName.trim(),
    role: user.role,
    status: user.status,
  });
}

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [initialSignatures, setInitialSignatures] = useState<Record<string, string>>({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);

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
      setInitialSignatures(
        Object.fromEntries(data.map((item) => [item.id, getUserSignature(item)])),
      );
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
      setCreateOpen(false);
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

  const isUserDirty = (user: UserItem): boolean =>
    getUserSignature(user) !== initialSignatures[user.id] ||
    Boolean((passwordDrafts[user.id] ?? '').trim());

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const updateUser = async (user: UserItem) => {
    if (!isUserDirty(user)) {
      return;
    }

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

  const deleteUser = async (user: UserItem) => {
    const confirmed = window.confirm(
      `Удалить пользователя «${user.fullName || user.email}»? Это действие нельзя отменить.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(user.id);
    setError(null);
    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'DELETE',
      });
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setInitialSignatures((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      setPasswordDrafts((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      setExpandedUsers((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((item) => item.role === 'ADMIN').length,
      active: users.filter((item) => item.status === 'ACTIVE').length,
      disabled: users.filter((item) => item.status === 'DISABLED').length,
    }),
    [users],
  );

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
          <section className="users-access">
            <div className="users-access-head">
              <div>
                <span className="users-access-kicker">Доступ к системе</span>
                <h2>Команда проекта</h2>
                <p>
                  Управляйте аккаунтами без таблицы: основные данные, роль,
                  статус и пароль находятся в одной строке карточки.
                </p>
              </div>

              <div className="users-access-stats" aria-label="Статистика пользователей">
                <span>
                  <b>{stats.total}</b>
                  Всего
                </span>
                <span>
                  <b>{stats.admins}</b>
                  Админы
                </span>
                <span>
                  <b>{stats.active}</b>
                  Активны
                </span>
                <span>
                  <b>{stats.disabled}</b>
                  Отключены
                </span>
              </div>

              <Button
                type="button"
                className="users-access-action"
                variant={createOpen ? 'secondary' : 'primary'}
                onClick={() => setCreateOpen((value) => !value)}
              >
                {createOpen ? 'Закрыть' : 'Новый пользователь'}
              </Button>
            </div>

            {createOpen ? (
              <form onSubmit={createUser} className="users-create-drawer">
                <div className="users-create-intro">
                  <strong>Создание пользователя</strong>
                  <span>После создания аккаунт сразу появится в списке ниже.</span>
                </div>
                <div className="field">
                  <label className="label">Email</label>
                  <Input
                    type="email"
                    className="users-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">ФИО</label>
                  <Input
                    className="users-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">Пароль</label>
                  <Input
                    type="password"
                    className="users-input"
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
                    className="users-toggle"
                  />
                </div>
                <div className="field">
                  <label className="label">Статус</label>
                  <AdminToggle
                    value={status}
                    options={STATUS_OPTIONS}
                    onChange={setStatus}
                    ariaLabel="Выбор статуса нового пользователя"
                    className="users-toggle"
                  />
                </div>
                <Button type="submit" className="users-create-submit">
                  Создать аккаунт
                </Button>
              </form>
            ) : null}

            {error ? <p className="message-danger">{error}</p> : null}
          </section>

          <section className="users-directory-new">
            <div className="users-directory-head">
              <h2>Список пользователей</h2>
              {loading ? <span>Загрузка...</span> : <span>{users.length} записей</span>}
            </div>

            {!loading ? (
              <div className="users-directory-grid">
                {users.map((user) => {
                  const isSaving = savingId === user.id;
                  const isDeleting = deletingId === user.id;
                  const expanded = Boolean(expandedUsers[user.id]);
                  const dirty = isUserDirty(user);
                  const canSave = dirty && !isSaving && !isDeleting;
                  const canDelete = currentUser?.id !== user.id && !isSaving && !isDeleting;

                  return (
                    <article
                      className={cn(
                        'users-directory-card',
                        user.status === 'DISABLED' && 'users-directory-card-disabled',
                        expanded && 'users-directory-card-expanded',
                        dirty && 'users-directory-card-dirty',
                      )}
                      key={user.id}
                    >
                      <header className="users-directory-top">
                        <button
                          type="button"
                          className="users-directory-open"
                          onClick={() => toggleUser(user.id)}
                          aria-expanded={expanded}
                        >
                          <span className="users-directory-mark" aria-hidden>
                            <span />
                            <span />
                          </span>
                          <span className="users-directory-person">
                            <h3>{user.fullName || 'Без имени'}</h3>
                            <p>{user.email}</p>
                          </span>
                        </button>
                        <div className="users-directory-badges">
                          <span
                            className={cn(
                              'users-directory-badge',
                              user.role === 'ADMIN' && 'users-directory-badge-admin',
                            )}
                          >
                            {user.role === 'ADMIN' ? 'Администратор' : 'Инициатор'}
                          </span>
                          <span
                            className={cn(
                              'users-directory-badge',
                              'users-directory-badge-status',
                              user.status === 'DISABLED' && 'users-directory-badge-disabled',
                            )}
                          >
                            {USER_STATUS_LABELS[user.status]}
                          </span>
                          {dirty ? (
                            <span className="users-directory-badge users-directory-badge-dirty">
                              Есть правки
                            </span>
                          ) : null}
                        </div>
                      </header>

                      <div className="users-directory-collapse" aria-hidden={!expanded}>
                        <div className="users-directory-form">
                          <div className="field users-field-email">
                            <label className="label">Email</label>
                            <Input
                              type="email"
                              className="users-input"
                              value={user.email}
                              onChange={(event) =>
                                patchUser(user.id, 'email', event.target.value)
                              }
                            />
                          </div>
                          <div className="field users-field-name">
                            <label className="label">ФИО</label>
                            <Input
                              className="users-input"
                              value={user.fullName}
                              onChange={(event) =>
                                patchUser(user.id, 'fullName', event.target.value)
                              }
                            />
                          </div>
                          <div className="field users-field-password">
                            <label className="label">Новый пароль</label>
                            <Input
                              type="password"
                              className="users-input"
                              minLength={8}
                              placeholder="Не менять"
                              value={passwordDrafts[user.id] ?? ''}
                              onChange={(event) =>
                                setUserPasswordDraft(user.id, event.target.value)
                              }
                            />
                          </div>
                          <div className="field users-field-role">
                            <label className="label">Роль</label>
                            <AdminToggle
                              value={user.role}
                              options={ROLE_OPTIONS}
                              onChange={(value) => patchUser(user.id, 'role', value)}
                              ariaLabel={`Выбор роли пользователя ${user.email}`}
                              className="users-toggle"
                            />
                          </div>
                          <div className="field users-field-status">
                            <label className="label">Статус</label>
                            <AdminToggle
                              value={user.status}
                              options={STATUS_OPTIONS}
                              onChange={(value) => patchUser(user.id, 'status', value)}
                              ariaLabel={`Выбор статуса пользователя ${user.email}`}
                              className="users-toggle"
                            />
                          </div>
                          <div className="users-directory-actions">
                            <Button
                              variant="secondary"
                              disabled={!canSave}
                              onClick={() => void updateUser(user)}
                            >
                              {isSaving ? 'Сохраняем...' : 'Сохранить'}
                            </Button>
                            <Button
                              variant="danger"
                              disabled={!canDelete}
                              onClick={() => void deleteUser(user)}
                            >
                              {isDeleting ? 'Удаляем...' : 'Удалить'}
                            </Button>
                          </div>
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
