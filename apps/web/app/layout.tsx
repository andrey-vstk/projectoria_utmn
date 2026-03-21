import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import { Providers } from './providers';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Платформа индустриальных проектов ТюмГУ',
  description: 'MVP платформа обработки запросов индустриальных заказчиков',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={manrope.className}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
