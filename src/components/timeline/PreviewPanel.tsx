/**
 * PreviewPanel.tsx
 * Shows the current scene image during playback.
 * Left panel of the Timeline layout.
 */
import { Image } from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { useTimelineScenes } from '../../hooks/useTimelineScenes';
import { PlaybackControls } from './PlaybackControls';
import { buildComfyUrl } from '../../lib/buildMediaUrl';

export function PreviewPanel() {
  const { activeSceneId, currentTime, isPlaying } = useTimelineStore();
  const { orderedScenes, totalDuration } = useTimelineScenes();

  // Active scene — from playback, or selected, or first
  const activeTs =
    orderedScenes.find((ts) => ts.scene.id === activeSceneId) ??
    orderedScenes[0];

  const scene = activeTs?.scene;
  const thumbnailUrl = scene?.render_url ? buildComfyUrl(scene.render_url) : null;

  // Progress within current scene
  const sceneProgress = activeTs
    ? Math.max(0, Math.min(1,
        (currentTime - activeTs.startTime) / (activeTs.scene.duration ?? 5)
      ))
    : 0;

  return (
    <div className="flex flex-col h-full bg-studio-900 border-r border-studio-800">
      {/* Scene image */}
      <div className="relative flex-1 bg-studio-950 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={scene?.title ?? ''}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Image className="w-10 h-10 text-studio-700" />
            <p className="text-xs text-studio-600">No image generated</p>
          </div>
        )}

        {/* Scene progress bar (thin strip at bottom of image) */}
        {isPlaying && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-studio-800">
            <div
              className="h-full bg-accent-500 transition-none"
              style={{ width: `${sceneProgress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Scene info */}
      <div className="px-4 py-3 border-t border-studio-800 space-y-3">
        {scene ? (
          <>
            <div>
              <p className="text-sm font-medium text-white truncate">{scene.title}</p>
              {scene.narration && (
                <p className="text-xs text-studio-400 mt-1 line-clamp-2 leading-relaxed">
                  {scene.narration}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-studio-600">
              {scene.camera_angle && <span>{scene.camera_angle}</span>}
              <span>{scene.duration ?? 5}s</span>
              {activeTs && (
                <span className="ms-auto">
                  Scene {activeTs.index + 1}/{orderedScenes.length}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-studio-600 text-center py-1">No scenes</p>
        )}

        {/* Playback controls */}
        <PlaybackControls />
      </div>
    </div>
  );
}
