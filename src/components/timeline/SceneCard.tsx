/**
 * SceneCard.tsx
 * Timeline scene card — shows thumbnail, title, status, duration editor.
 * Width is proportional to duration. Supports selection and drag (via parent).
 */
import { buildComfyUrl } from '../../lib/buildMediaUrl';
import { DurationEditor } from './DurationEditor';
import type { TimelineScene } from '../../hooks/useTimelineScenes';
import { GripVertical, Image, Volume2, Video, Camera } from 'lucide-react';

interface Props {
  ts: TimelineScene;
  isSelected: boolean;
  onClick: () => void;
  onDurationChange: (sceneId: string, duration: number) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function SceneCard({
  ts,
  isSelected,
  onClick,
  onDurationChange,
  dragHandleProps,
  isDragging,
}: Props) {
  const { scene, widthPx, productionStatus } = ts;
  const thumbnailUrl = buildComfyUrl(scene.render_url);
  const minWidth = 80; // never smaller than this
  const width = Math.max(widthPx, minWidth);

  const borderClass = isSelected
    ? 'border-accent-500 ring-1 ring-accent-500/30'
    : 'border-studio-700 hover:border-studio-500';

  const opacityClass = isDragging ? 'opacity-50' : 'opacity-100';

  return (
    <div
      className={`relative flex flex-col bg-studio-900 border rounded-lg overflow-hidden cursor-pointer
        transition-all duration-150 shrink-0 select-none
        ${borderClass} ${opacityClass}`}
      style={{ width: `${width}px`, minHeight: '100px' }}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative w-full bg-studio-800" style={{ height: '64px' }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={scene.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-6 h-6 text-studio-600" />
          </div>
        )}

        {/* Drag handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center
              bg-black/20 hover:bg-black/40 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3 text-white/50" />
          </div>
        )}

        {/* Index badge */}
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60
          flex items-center justify-center">
          <span className="text-[9px] text-white font-bold">{ts.index + 1}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1 p-1.5 flex-1">
        {/* Title */}
        <p className="text-xs font-medium text-white leading-tight truncate" title={scene.title}>
          {scene.title}
        </p>

        {/* Camera angle */}
        {scene.camera_angle && (
          <div className="flex items-center gap-1">
            <Camera className="w-2.5 h-2.5 text-studio-500 shrink-0" />
            <span className="text-[10px] text-studio-500 truncate">{scene.camera_angle}</span>
          </div>
        )}

        {/* Footer: status dots + duration */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {/* Production status dots */}
          <div className="flex items-center gap-1">
            <StatusDot
              icon={Image}
              status={productionStatus.image.status}
              label="Image"
            />
            <StatusDot
              icon={Volume2}
              status={productionStatus.audio.status}
              label="Audio"
            />
            <StatusDot
              icon={Video}
              status={productionStatus.video.status}
              label="Video"
            />
          </div>

          <DurationEditor
            duration={scene.duration ?? 5}
            onSave={(d) => onDurationChange(scene.id, d)}
          />
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none ring-1 ring-accent-400/40 rounded-lg" />
      )}
    </div>
  );
}

function StatusDot({
  icon: Icon,
  status,
  label,
}: {
  icon: React.ElementType;
  status: 'none' | 'generating' | 'done' | 'failed';
  label: string;
}) {
  const colorClass =
    status === 'done' ? 'text-emerald-400'
    : status === 'generating' ? 'text-amber-400'
    : status === 'failed' ? 'text-red-400'
    : 'text-studio-600';

  return (
    <div title={`${label}: ${status}`} className={`${colorClass} transition-colors`}>
      <Icon className={`w-3 h-3 ${status === 'generating' ? 'animate-pulse' : ''}`} />
    </div>
  );
}
