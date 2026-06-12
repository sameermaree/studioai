/**
 * TimelinePage.tsx
 * Main Timeline page. Route: /timeline/:episodeId
 * Phase 1: Storyboard view + reorder + duration edit.
 * Phase 2: Adds playback engine.
 */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTimelineStore } from '../../store/useTimelineStore';
import { useStudioStore } from '../../store/useStudioStore';
import { TimelineHeader } from './TimelineHeader';
import { SceneTrack } from './SceneTrack';
import { SceneDetailPanel } from './SceneDetailPanel';
import { EmptyTimeline } from './EmptyTimeline';
import { useTimelineScenes } from '../../hooks/useTimelineScenes';
import { PreviewPanel } from './PreviewPanel';
import { Loader2 } from 'lucide-react';

export function TimelinePage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();

  const { openEpisode, closeEpisode, activeEpisodeId, selectedSceneId } = useTimelineStore();
  const episodes = useStudioStore((s) => s.episodes);
  const { totalScenes } = useTimelineScenes();

  const episode = episodes.find((e) => e.id === episodeId);

  useEffect(() => {
    if (!episodeId) {
      navigate('/episodes', { replace: true });
      return;
    }
    const ep = episodes.find((e) => e.id === episodeId);
    if (ep) {
      openEpisode(episodeId, ep.scenes);
    }
    return () => {
      closeEpisode();
    };
  }, [episodeId, episodes]);

  // Loading: store not hydrated yet
  if (!activeEpisodeId && episodeId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-studio-500 animate-spin" />
      </div>
    );
  }

  // Episode not found
  if (!episode) {
    return (
      <div className="flex-1 flex flex-col">
        <EmptyTimeline reason="no-episode" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-studio-950 overflow-hidden">
      {/* Header bar */}
      <TimelineHeader />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main area: PreviewPanel + SceneTrack */}
        {totalScenes === 0 ? (
          <div className="flex-1"><EmptyTimeline reason="no-scenes" /></div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Preview — fixed width */}
            <div className="w-72 shrink-0 flex flex-col">
              <PreviewPanel />
            </div>
            {/* Track — scrollable */}
            <div className="flex-1 overflow-auto p-4">
              <SceneTrack />
            </div>
          </div>
        )}

        {/* Scene detail panel — only when selected */}
        {selectedSceneId && <SceneDetailPanel />}
      </div>
    </div>
  );
}

export default TimelinePage;
