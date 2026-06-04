'use client';

import Image from 'next/image';
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push(searchParams.get('next') ?? '/');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Ошибка авторизации');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page-login">
      <Card className="auth-card">
        <div className="auth-logo-wrap">
          <Image
            src="/utmn-logo.svg"
            alt="Логотип ТюмГУ"
            width={58}
            height={58}
            className="auth-logo"
            priority
          />
        </div>
        <h1 className="auth-title">Вход в систему</h1>
        <p className="auth-subtitle">
          Доступ открыт только для сотрудников из разрешенного списка университета.
        </p>

        <form onSubmit={onSubmit} className="auth-form">
          <div className="field">
            <label className="label">Email</label>
            <Input
              type="email"
              placeholder="name@utmn.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label">Пароль</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? <div className="message-danger">{error}</div> : null}

          <Button type="submit" disabled={loading}>
            {loading ? 'Выполняем вход...' : 'Войти'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page auth-page-login">
          <Card className="auth-card">
            <p className="muted">Загрузка формы входа...</p>
          </Card>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
