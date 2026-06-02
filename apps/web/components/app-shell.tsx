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
  isRead: boolean;
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
                <Badge tone="info">Уведомления: {unreadCount}</Badge>
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
