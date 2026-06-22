import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Проектория',
  description: 'MVP платформа обработки запросов индустриальных заказчиков',
  icons: {
    icon: '/utmn-logo.svg',
    shortcut: '/utmn-logo.svg',
    apple: '/utmn-logo.svg',
  },
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
