/**
 * PlaybackControls.tsx
 * Play/Pause, SeekBar, TimeDisplay, Stop.
 * Reads from useTimelineStore. Calls play/pause/seek/stop.
 */
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { useTimelineScenes } from '../../hooks/useTimelineScenes';

export function PlaybackControls() {
  const { isPlaying, currentTime, play, pause, stop, seek } = useTimelineStore();
  const { totalDuration, orderedScenes } = useTimelineScenes();

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  const hasScenes = orderedScenes.length > 0;
  const hasImages = orderedScenes.some((ts) => ts.scene.render_url);

  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * totalDuration);
  };

  const skipToPrev = () => {
    const { activeSceneId } = useTimelineStore.getState();
    const idx = orderedScenes.findIndex((ts) => ts.scene.id === activeSceneId);
    if (idx > 0) seek(orderedScenes[idx - 1].startTime);
    else seek(0);
  };

  const skipToNext = () => {
    const { activeSceneId } = useTimelineStore.getState();
    const idx = orderedScenes.findIndex((ts) => ts.scene.id === activeSceneId);
    if (idx < orderedScenes.length - 1) seek(orderedScenes[idx + 1].startTime);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* SeekBar */}
      <div
        className={`h-1.5 rounded-full bg-studio-800 cursor-pointer group relative
          ${hasScenes ? 'hover:h-2 transition-all' : 'opacity-30 cursor-not-allowed'}`}
        onClick={hasScenes ? handleSeekBarClick : undefined}
      >
        <div
          className="h-full bg-accent-500 rounded-full transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent-400 rounded-full
            shadow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress * 100}% - 6px)` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Skip prev */}
        <button
          onClick={skipToPrev}
          disabled={!hasScenes}
          className="p-1 text-studio-500 hover:text-white disabled:opacity-30 transition-colors"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={isPlaying ? pause : play}
          disabled={!hasScenes || !hasImages}
          className="w-9 h-9 rounded-full bg-accent-600 hover:bg-accent-500 disabled:bg-studio-800
            disabled:opacity-40 flex items-center justify-center transition-colors"
          title={!hasImages ? 'Generate images first' : isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <Pause className="w-4 h-4 text-white" />
            : <Play className="w-4 h-4 text-white ms-0.5" />
          }
        </button>

        {/* Stop */}
        <button
          onClick={stop}
          disabled={!hasScenes}
          className="p-1 text-studio-500 hover:text-white disabled:opacity-30 transition-colors"
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        {/* Skip next */}
        <button
          onClick={skipToNext}
          disabled={!hasScenes}
          className="p-1 text-studio-500 hover:text-white disabled:opacity-30 transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Time display */}
        <span className="ms-auto text-xs font-mono text-studio-400">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
