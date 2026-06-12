/**
 * EpisodeProductionCard.tsx
 * Dashboard card for each episode — shows state, stats, smart action.
 */
import { useNavigate } from 'react-router-dom';
import { Film, Image, Volume2, Play, Download, Loader2, ChevronRight } from 'lucide-react';
import { WorkflowStateBadge } from '../shared/WorkflowStateBadge';
import { buildComfyUrl } from '../../lib/buildMediaUrl';
import type { Episode, EpisodeWorkflowState, EpisodeProductionStats } from '../../types';

interface Props {
  episode: Episode;
  workflowState: EpisodeWorkflowState;
  stats: EpisodeProductionStats;
}

export function EpisodeProductionCard({ episode, workflowState, stats }: Props) {
  const navigate = useNavigate();

  const thumbnailUrl = episode.thumbnail_url
    ? buildComfyUrl(episode.thumbnail_url)
    : episode.scenes.find((s) => s.render_url)
      ? buildComfyUrl(episode.scenes.find((s) => s.render_url)!.render_url!)
      : null;

  const primaryAction = getPrimaryAction(workflowState, episode.id, navigate);
  const updatedDate = new Date(episode.updated_at).toLocaleDateString();

  return (
    <div className="card-hover flex flex-col gap-3">
      {/* Thumbnail + State */}
      <div className="flex gap-3">
        <div className="w-20 h-14 rounded-lg bg-studio-800 overflow-hidden shrink-0">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={episode.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-6 h-6 text-studio-600" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{episode.title}</p>
          <p className="text-xs text-studio-500 mt-0.5">
            {stats.total_scenes} scenes · {updatedDate}
          </p>
          <div className="mt-1.5">
            <WorkflowStateBadge state={workflowState} size="sm" />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {stats.total_scenes > 0 && (
        <div className="space-y-1.5">
          {/* Images */}
          <div className="flex items-center gap-2">
            <Image className="w-3 h-3 text-studio-500 shrink-0" />
            <div className="flex-1 h-1.5 bg-studio-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.image_percentage}%` }}
              />
            </div>
            <span className="text-xs text-studio-400 font-mono w-10 text-right">
              {stats.scenes_with_image}/{stats.total_scenes}
            </span>
          </div>

          {/* Audio (Phase 3 — shown grayed if 0) */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-studio-600 shrink-0" />
            <div className="flex-1 h-1.5 bg-studio-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.audio_percentage}%` }}
              />
            </div>
            <span className="text-xs text-studio-500 font-mono w-10 text-right">
              {stats.scenes_with_audio}/{stats.total_scenes}
            </span>
          </div>
        </div>
      )}

      {/* Active jobs indicator */}
      {stats.active_jobs > 0 && (
        <div className="flex items-center gap-2 text-amber-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">{stats.active_jobs} job{stats.active_jobs > 1 ? 's' : ''} running</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-studio-800">
        <button
          onClick={() => navigate(`/timeline/${episode.id}`)}
          className="flex items-center gap-1 text-xs text-studio-400 hover:text-white transition-colors"
        >
          <Play className="w-3 h-3" />
          Timeline
        </button>

        {primaryAction && (
          <button
            onClick={primaryAction.action}
            className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors
              ${primaryAction.variant === 'primary'
                ? 'bg-accent-600 text-white hover:bg-accent-500'
                : 'bg-studio-800 text-studio-300 hover:bg-studio-700'}`}
          >
            {primaryAction.icon}
            {primaryAction.label}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function getPrimaryAction(
  state: EpisodeWorkflowState,
  episodeId: string,
  navigate: ReturnType<typeof useNavigate>
): { label: string; action: () => void; variant: 'primary' | 'secondary'; icon: React.ReactNode } | null {
  switch (state) {
    case 'IMAGES_READY':
      return {
        label: 'Review in Timeline',
        action: () => navigate(`/timeline/${episodeId}`),
        variant: 'primary',
        icon: <Play className="w-3 h-3" />,
      };
    case 'AUDIO_READY':
    case 'EXPORT_READY':
      return {
        label: 'Export',
        action: () => navigate(`/timeline/${episodeId}`),
        variant: 'primary',
        icon: <Download className="w-3 h-3" />,
      };
    case 'EXPORTED':
      return {
        label: 'Download',
        action: () => {},
        variant: 'secondary',
        icon: <Download className="w-3 h-3" />,
      };
    default:
      return null;
  }
}
