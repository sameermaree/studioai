/**
 * SceneTrack.tsx
 * Horizontal scene track with reorder buttons and AudioTrack below.
 */
import { useState } from 'react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { useStudioStore } from '../../store/useStudioStore';
import { useTimelineScenes } from '../../hooks/useTimelineScenes';
import { usePlaybackEngine } from '../../hooks/usePlaybackEngine';
import { SceneCard } from './SceneCard';
import { TimelineRuler } from './TimelineRuler';
import { AudioTrack } from './AudioTrack';
import { ArrowUp, ArrowDown } from 'lucide-react';

export function SceneTrack() {
  const {
    selectedSceneId,
    selectScene,
    setSceneOrder,
    activeEpisodeId,
    pixelsPerSecond,
    activeSceneId,
  } = useTimelineStore();

  const { updateSceneOrders, updateSceneDuration } = useStudioStore();
  const { orderedScenes, totalDuration } = useTimelineScenes();
  const sceneOrder = useTimelineStore((s) => s.sceneOrder);
  const [generatingAudioId] = useState<string | null>(null);

  usePlaybackEngine();

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...sceneOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSceneOrder(newOrder);
    if (activeEpisodeId) updateSceneOrders(activeEpisodeId, newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === sceneOrder.length - 1) return;
    const newOrder = [...sceneOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSceneOrder(newOrder);
    if (activeEpisodeId) updateSceneOrders(activeEpisodeId, newOrder);
  };

  const handleDurationChange = (sceneId: string, duration: number) => {
    updateSceneDuration(sceneId, duration);
  };

  if (orderedScenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-studio-500 text-sm">
        No scenes in this episode.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Ruler */}
      <div className="overflow-x-auto">
        <TimelineRuler totalDuration={totalDuration} pixelsPerSecond={pixelsPerSecond} />
      </div>

      {/* Scene cards */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 p-3" style={{ minWidth: 'max-content' }}>
          {orderedScenes.map((ts, index) => (
            <div key={ts.scene.id} className="flex flex-col gap-1">
              <div className="flex justify-center gap-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-0.5 rounded text-studio-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Move left"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === orderedScenes.length - 1}
                  className="p-0.5 rounded text-studio-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Move right"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <SceneCard
                ts={ts}
                isSelected={selectedSceneId === ts.scene.id}
                isActive={activeSceneId === ts.scene.id}
                onClick={() => selectScene(ts.scene.id)}
                onDurationChange={handleDurationChange}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Audio track */}
      <div className="overflow-x-auto border-t border-studio-800/50">
        <div className="px-3 pt-2 pb-1">
          <p className="text-[10px] text-studio-700 uppercase tracking-widest">Audio</p>
        </div>
        <AudioTrack
          onGenerateAudio={(ts) => {
            if (!ts.scene.narration) return;
            import('../../services/sceneAudioService').then(({ speakText }) => {
              speakText(ts.scene.narration!);
            });
          }}
          generatingSceneId={generatingAudioId}
        />
      </div>
    </div>
  );
}
