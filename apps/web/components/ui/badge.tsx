import { cn } from '@/lib/cn';

type Tone = 'accent' | 'neutral' | 'success' | 'danger' | 'info';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}
