/**
 * TimelineRuler.tsx
 * Horizontal time ruler showing seconds markers.
 */
interface Props {
  totalDuration: number;
  pixelsPerSecond: number;
}

export function TimelineRuler({ totalDuration, pixelsPerSecond }: Props) {
  const totalWidth = Math.max(totalDuration * pixelsPerSecond, 400);

  // Generate markers every 5 seconds
  const markerInterval = pixelsPerSecond >= 60 ? 5 : 10;
  const markerCount = Math.ceil(totalDuration / markerInterval) + 1;

  return (
    <div
      className="relative h-6 bg-studio-900 border-b border-studio-700 shrink-0"
      style={{ width: `${totalWidth}px`, minWidth: '100%' }}
    >
      {Array.from({ length: markerCount }).map((_, i) => {
        const t = i * markerInterval;
        const x = t * pixelsPerSecond;
        return (
          <div
            key={t}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${x}px` }}
          >
            <div className="w-px h-2 bg-studio-600" />
            <span className="text-[9px] text-studio-500 font-mono mt-0.5 select-none">
              {formatTime(t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
