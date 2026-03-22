'use client';

import Image from 'next/image';
import { FormEvent, Suspense, useMemo, useState } from 'react';
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

  const marqueeRows = useMemo(() => Array.from({ length: 4 }, (_, index) => index), []);
  const marqueeWords = useMemo(() => Array.from({ length: 8 }, () => 'ПРОЕКТОРИЯ'), []);

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
      <div className="auth-bg-marquee" aria-hidden>
        {marqueeRows.map((rowIndex) => (
          <div
            key={rowIndex}
            className={`auth-bg-marquee-row ${
              rowIndex % 2 === 1 ? 'auth-bg-marquee-row-reverse' : ''
            }`}
          >
            <div className="auth-bg-marquee-loop">
              <div className="auth-bg-marquee-track">
                {marqueeWords.map((word, wordIndex) => (
                  <span className="auth-bg-marquee-word" key={`row-${rowIndex}-left-${wordIndex}`}>
                    {word}
                  </span>
                ))}
              </div>
              <div className="auth-bg-marquee-track" aria-hidden>
                {marqueeWords.map((word, wordIndex) => (
                  <span className="auth-bg-marquee-word" key={`row-${rowIndex}-right-${wordIndex}`}>
                    {word}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

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
