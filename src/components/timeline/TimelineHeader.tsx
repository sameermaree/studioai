/**
 * TimelineHeader.tsx
 * Episode title, workflow state, duration, zoom, smart action, back button.
 */
import { ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTimelineStore } from '../../store/useTimelineStore';
import { useStudioStore } from '../../store/useStudioStore';
import { useRenderQueueStore } from '../../store/useRenderQueueStore';
import { useTimelineScenes } from '../../hooks/useTimelineScenes';
import { computeEpisodeWorkflowState } from '../../lib/computeEpisodeState';
import { WorkflowStateBadge } from '../shared/WorkflowStateBadge';

export function TimelineHeader() {
  const navigate = useNavigate();
  const { activeEpisodeId, zoom, setZoom } = useTimelineStore();
  const episodes = useStudioStore((s) => s.episodes);
  const jobs = useRenderQueueStore((s) => s.jobs);
  const { totalDuration, totalScenes, scenesWithImage } = useTimelineScenes();

  const episode = episodes.find((e) => e.id === activeEpisodeId);
  const workflowState = episode
    ? computeEpisodeWorkflowState(episode, jobs)
    : 'DRAFT';

  const zoomLevels = [0.5, 1.0, 1.5, 2.0] as const;
  const currentZoomIdx = zoomLevels.indexOf(zoom);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-studio-700 bg-studio-900 shrink-0">
      {/* Back */}
      <button
        onClick={() => navigate('/episodes')}
        className="flex items-center gap-1.5 text-studio-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Episodes</span>
      </button>

      <div className="w-px h-5 bg-studio-700" />

      {/* Episode title */}
      <div className="flex flex-col min-w-0">
        <h1 className="text-sm font-semibold text-white truncate">
          {episode?.title ?? 'Loading...'}
        </h1>
        <div className="flex items-center gap-2 mt-0.5">
          <WorkflowStateBadge state={workflowState} size="sm" />
          <span className="text-xs text-studio-500">
            {scenesWithImage}/{totalScenes} images · {formatDuration(totalDuration)}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1 bg-studio-800 rounded-lg p-1">
        <button
          onClick={() => currentZoomIdx > 0 && setZoom(zoomLevels[currentZoomIdx - 1])}
          disabled={currentZoomIdx === 0}
          className="p-1 rounded text-studio-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-studio-300 font-mono w-8 text-center">{zoom}x</span>
        <button
          onClick={() => currentZoomIdx < zoomLevels.length - 1 && setZoom(zoomLevels[currentZoomIdx + 1])}
          disabled={currentZoomIdx === zoomLevels.length - 1}
          className="p-1 rounded text-studio-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Smart action based on workflow state */}
      {workflowState === 'IMAGES_READY' && (
        <button className="btn-primary text-xs py-1.5 px-3">
          Generate Audio
        </button>
      )}
      {workflowState === 'AUDIO_READY' && (
        <button className="btn-primary text-xs py-1.5 px-3">
          Export Episode
        </button>
      )}
    </div>
  );
}
