'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface Notification {
  id: string;
  projectId?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    apiRequest<Notification[]>('/notifications', { method: 'GET', withCsrf: false })
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [user, pathname]);

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
    { href: '/admin/settings', label: 'Настройки', adminOnly: true },
  ];

  const visibleItems = items.filter((item) => !item.adminOnly || user?.role === 'ADMIN');
  const hideHeader = !user && pathname === '/login';

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
                <div className="notification-menu">
                  <button type="button" className="notification-trigger">
                    <span>Уведомления</span>
                    <Badge tone={unreadCount > 0 ? 'info' : 'neutral'}>{unreadCount}</Badge>
                  </button>
                  <div className="notification-panel">
                    <div className="notification-panel-head">
                      <strong>Уведомления</strong>
                      <span>Непрочитанных: {unreadCount}</span>
                    </div>
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
                <span className="user-chip">
                  {user.fullName} ({user.role === 'ADMIN' ? 'Администратор' : 'Инициатор'})
                </span>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await logout();
                    router.push('/login');
                  }}
                >
                  Выйти
                </Button>
              </div>
            ) : null}
          </div>
        </header>
      ) : null}

      <div className="app-body">
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
              {visibleItems.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={cn('sidebar-link', isActiveLink(item.href) && 'sidebar-link-active')}
                >
                  {item.label}
                </Link>
              ))}
            </aside>
          ) : null}
          <main className={cn('app-content', !user && 'app-content-auth')}>{children}</main>
        </div>
      </div>
    </div>
  );
}
