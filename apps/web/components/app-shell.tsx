'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_URL, apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  announceNotification,
  RealtimeNotification,
} from '@/lib/realtime';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

type ThemeMode = 'light' | 'dark';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [theme, setTheme] = useState<ThemeMode>('light');

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    try {
      const data = await apiRequest<RealtimeNotification[]>('/notifications', {
        method: 'GET',
        withCsrf: false,
      });
      setNotifications(data);
    } catch {
      // Keep the current list while the realtime connection is reconnecting.
    }
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, pathname]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('projectoria_theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('projectoria_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const stream = new EventSource(`${API_URL}/notifications/stream`, {
      withCredentials: true,
    });
    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          notification?: RealtimeNotification;
        };
        if (payload.type !== 'notification' || !payload.notification) {
          return;
        }

        setNotifications((items) => [
          payload.notification!,
          ...items.filter((item) => item.id !== payload.notification!.id),
        ]);
        announceNotification(payload.notification);
      } catch {
        // Ignore malformed stream events and keep the connection alive.
      }
    };

    return () => stream.close();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const refresh = () => void loadNotifications();
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
  }, [loadNotifications, user]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const markNotificationRead = async (notificationId: string) => {
    setNotifications((items) =>
      items.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)),
    );

    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    } catch {
      setNotifications((items) =>
        items.map((item) => (item.id === notificationId ? { ...item, isRead: false } : item)),
      );
    }
  };

  const items = [
    { href: '/', label: 'Проекты' },
    { href: '/admin/users', label: 'Пользователи', adminOnly: true },
    { href: '/admin/departments', label: 'Подразделения', adminOnly: true },
  ];

  const primaryItems = items.filter((item) => !item.adminOnly);
  const adminItems =
    user?.role === 'ADMIN' ? items.filter((item) => item.adminOnly) : [];
  const isLoginPage = pathname === '/login';
  const hideHeader =
    !user && (isLoginPage || pathname.startsWith('/respond/'));

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="app-shell">
      {!hideHeader ? (
        <header className="app-header">
          <div className="app-header-inner">
            <div className="brand-area">
              <Image
                src="/utmn-logo.svg"
                alt="Логотип ТюмГУ"
                width={38}
                height={38}
                className="brand-logo"
                priority
              />
              <div>
                <p className="brand-title">Проектория</p>
                <p className="brand-subtitle">Тюменский государственный университет</p>
              </div>
            </div>
            {user ? (
              <div className="header-meta">
                <button
                  type="button"
                  className="theme-toggle"
                  onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
                  aria-label={
                    theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'
                  }
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    {theme === 'dark' ? (
                      <path
                        d="M12 4v2m0 12v2m8-8h-2M6 12H4m13.66-5.66-1.42 1.42M7.76 16.24l-1.42 1.42m11.32 0-1.42-1.42M7.76 7.76 6.34 6.34M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    ) : (
                      <path
                        d="M20.5 14.4A7.4 7.4 0 0 1 9.6 3.5a8.5 8.5 0 1 0 10.9 10.9Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <span>{theme === 'dark' ? 'Светлая' : 'Темная'}</span>
                </button>
                <div className="notification-menu">
                  <button type="button" className="notification-trigger">
                    <span>Уведомления</span>
                    <Badge tone={unreadCount > 0 ? 'info' : 'neutral'}>{unreadCount}</Badge>
                  </button>
                  <div className="notification-panel">
                    <div className="notification-list">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 8).map((notification) => (
                          <Link
                            key={notification.id}
                            href={
                              notification.projectId
                                ? `/projects/${notification.projectId}`
                                : '/'
                            }
                            className={cn(
                              'notification-item',
                              !notification.isRead && 'notification-item-unread',
                            )}
                            onClick={() => void markNotificationRead(notification.id)}
                          >
                            <span className="notification-item-title">
                              {!notification.isRead ? (
                                <span className="notification-unread-dot" />
                              ) : null}
                              {notification.title}
                            </span>
                            <span className="notification-item-message">
                              {notification.message}
                            </span>
                            <time>{new Date(notification.createdAt).toLocaleString('ru-RU')}</time>
                          </Link>
                        ))
                      ) : (
                        <p className="notification-empty">Новых уведомлений нет.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="header-user">
                  <span className="header-user-name">{user.fullName}</span>
                  <span className="header-user-role">
                    {user.role === 'ADMIN' ? 'Администратор' : 'Инициатор'}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  className="logout-button"
                  onClick={async () => {
                    await logout();
                    router.push('/login');
                  }}
                >
                  <svg
                    className="logout-button-icon"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M14.5 9.5a4.5 4.5 0 1 1-2.7-4.12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12.1 12.1 21 3.2m0 0v4.5m0-4.5h-4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Выйти</span>
                </Button>
              </div>
            ) : null}
          </div>
        </header>
      ) : null}

      <div className={cn('app-body', !user && 'app-body-auth')}>
        <div
          className={cn(
            'app-layout',
            !user && 'app-layout-auth',
            hideHeader && 'app-layout-no-header',
          )}
        >
          {user ? (
            <aside className="app-sidebar">
              <Link
                href="/projects/new"
                className={cn(
                  'sidebar-create-project',
                  isActiveLink('/projects/new') && 'sidebar-create-project-active',
                )}
              >
                <span>Создать проект</span>
              </Link>
              <nav className="sidebar-nav" aria-label="Основная навигация">
                <div className="sidebar-nav-section">
                  {primaryItems.map((item) => (
                    <Link
                      href={item.href}
                      key={item.href}
                      className={cn(
                        'sidebar-link',
                        isActiveLink(item.href) && 'sidebar-link-active',
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                {adminItems.length > 0 ? (
                  <div className="sidebar-nav-section sidebar-admin-section">
                    <p className="sidebar-section-title">Инструменты администратора</p>
                    {adminItems.map((item) => (
                      <Link
                        href={item.href}
                        key={item.href}
                        className={cn(
                          'sidebar-link sidebar-link-sub',
                          isActiveLink(item.href) && 'sidebar-link-active',
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </nav>
            </aside>
          ) : null}
          <main
            className={cn(
              'app-content',
              !user && 'app-content-auth',
              isLoginPage && 'app-content-login',
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
