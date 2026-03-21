'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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
    { href: '/projects/new', label: 'Новый проект' },
    { href: '/admin/users', label: 'Пользователи', adminOnly: true },
    { href: '/admin/departments', label: 'Подразделения', adminOnly: true },
    { href: '/admin/settings', label: 'Настройки', adminOnly: true },
  ];

  const visibleItems = items.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="app-shell">
      <header className="app-header">
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
            <p className="brand-title">Платформа индустриальных проектов</p>
            <p className="brand-subtitle">Тюменский государственный университет</p>
          </div>
        </div>
        {user ? (
          <div className="header-meta">
            <Badge tone="info">Уведомления: {unreadCount}</Badge>
            <span className="muted">
              {user.fullName} ({user.role === 'ADMIN' ? 'admin' : 'initiator'})
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
      </header>

      <div className={cn('app-layout', !user && 'app-layout-auth')}>
        {user ? (
          <aside className="app-sidebar">
            {visibleItems.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                className={cn(
                  'sidebar-link',
                  pathname === item.href && 'sidebar-link-active',
                )}
              >
                {item.label}
              </Link>
            ))}
          </aside>
        ) : null}
        <main className={cn('app-content', !user && 'app-content-auth')}>{children}</main>
      </div>
    </div>
  );
}
