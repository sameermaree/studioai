import { useLanguage } from '../../hooks/useLanguage';
import type { EpisodeStatus } from '../../types';

export function EpisodeStatusBadge({ status }: { status: EpisodeStatus }) {
  const { t } = useLanguage();

  const styles: Record<string, string> = {
    draft: 'text-studio-400',
    in_production: 'text-blue-400',
    rendering: 'text-amber-400',
    rendered: 'text-accent-400',
    published: 'text-emerald-400',
  };

  const statusLabels: Record<string, string> = {
    draft: t.episodes.statuses.draft,
    in_production: t.episodes.statuses.generating,
    rendering: t.episodes.statuses.rendering,
    rendered: t.episodes.statuses.completed,
    published: t.episodes.statuses.published,
  };

  return (
    <span className={`text-xs font-medium ${styles[status] ?? 'text-studio-400'}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}
