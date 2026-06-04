import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Проектория',
  description: 'MVP платформа обработки запросов индустриальных заказчиков',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
