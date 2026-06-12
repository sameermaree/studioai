/**
 * AudioTrack.tsx
 * Displays audio status per scene in the Timeline.
 * Shows generate button, playing indicator, duration.
 */
import { Volume2, Loader2, Play, Square, AlertCircle } from 'lucide-react';
import { speakText, stopSpeech } from '../../services/sceneAudioService';
import { useTimelineStore } from '../../store/useTimelineStore';
import { useTimelineScenes } from '../../hooks/useTimelineScenes';
import type { TimelineScene } from '../../hooks/useTimelineScenes';

interface Props {
  onGenerateAudio: (ts: TimelineScene) => void;
  generatingSceneId: string | null;
}

export function AudioTrack({ onGenerateAudio, generatingSceneId }: Props) {
  const { orderedScenes } = useTimelineScenes();
  const { isPlaying, activeSceneId, pixelsPerSecond } = useTimelineStore();

  if (orderedScenes.length === 0) return null;

  return (
    <div className="flex gap-2 px-3 pb-3" style={{ minWidth: 'max-content' }}>
      {orderedScenes.map((ts) => {
        const minWidth = 80;
        const width = Math.max(ts.widthPx, minWidth);
        const hasAudio = !!ts.scene.audio_url;
        const isGenerating = generatingSceneId === ts.scene.id;
        const isActiveAudio = isPlaying && activeSceneId === ts.scene.id && hasAudio;
        const hasNarration = !!ts.scene.narration?.trim();

        return (
          <div
            key={ts.scene.id}
            className={`shrink-0 flex items-center justify-between px-2 py-1.5 rounded-md border text-xs
              ${isActiveAudio
                ? 'bg-emerald-900/30 border-emerald-700/50'
                : hasAudio
                ? 'bg-studio-800/60 border-studio-700'
                : 'bg-studio-900/40 border-studio-800 border-dashed'}`}
            style={{ width: `${width}px` }}
          >
            {/* Left: icon + status */}
            <div className="flex items-center gap-1 min-w-0">
              {isActiveAudio ? (
                <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
              ) : hasAudio ? (
                <Volume2 className="w-3 h-3 text-studio-500 shrink-0" />
              ) : !hasNarration ? (
                <AlertCircle className="w-3 h-3 text-studio-700 shrink-0" title="No narration" />
              ) : (
                <Volume2 className="w-3 h-3 text-studio-700 shrink-0" />
              )}
              {hasAudio && ts.scene.audio_duration && (
                <span className="text-studio-500 font-mono truncate">
                  {Math.round(ts.scene.audio_duration)}s
                </span>
              )}
              {!hasAudio && hasNarration && (
                <span className="text-studio-700 truncate">no audio</span>
              )}
            </div>

            {/* Right: action */}
            {isGenerating ? (
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
            ) : hasAudio ? (
              <button
                onClick={() => {
                  if (ts.scene.narration) speakText(ts.scene.narration);
                }}
                className="p-0.5 text-studio-600 hover:text-emerald-400 transition-colors shrink-0"
                title="Preview narration"
              >
                <Play className="w-3 h-3" />
              </button>
            ) : hasNarration ? (
              <button
                onClick={() => onGenerateAudio(ts)}
                className="p-0.5 text-studio-600 hover:text-accent-400 transition-colors shrink-0"
                title="Generate audio"
              >
                <Volume2 className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
