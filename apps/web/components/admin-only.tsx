'use client';

import { useAuth } from '@/lib/auth-context';
import { Card } from './ui/card';

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') {
    return (
      <Card className="card-soft">
        <h3 className="section-title">Доступ ограничен</h3>
        <p className="section-subtitle">Эта страница доступна только администраторам.</p>
      </Card>
    );
  }

  return <>{children}</>;
}
