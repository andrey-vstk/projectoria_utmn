import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from '@/lib/status';
import { Badge } from './ui/badge';

export function ProjectStatusBadge({ status }: { status: string }) {
  const label = PROJECT_STATUS_LABELS[status] ?? status;
  const tone = (PROJECT_STATUS_TONE[status] as
    | 'accent'
    | 'neutral'
    | 'success'
    | 'danger'
    | 'info') ?? 'neutral';

  return <Badge tone={tone}>{label}</Badge>;
}
