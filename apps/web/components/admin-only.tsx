'use client';

import { useAuth } from '@/lib/auth-context';
import { Card } from './ui/card';

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') {
    return (
      <Card>
        <h3>Доступ ограничен</h3>
        <p className="muted">Эта страница доступна только администраторам.</p>
      </Card>
    );
  }

  return <>{children}</>;
}
