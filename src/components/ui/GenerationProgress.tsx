import { Loader2, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import type { GenerationProgress as GenProgress } from '../../types/generation';

interface GenerationProgressProps {
  progress: GenProgress;
  compact?: boolean;
}

const statusIcon = {
  idle: Circle,
  queued: Loader2,
  generating: Loader2,
  saving: Loader2,
  done: CheckCircle2,
  failed: AlertCircle,
};

const statusColors: Record<string, string> = {
  idle: 'text-studio-500',
  queued: 'text-amber-400',
  generating: 'text-blue-400',
  saving: 'text-accent-400',
  done: 'text-emerald-400',
  failed: 'text-danger-400',
};

const progressBarColors: Record<string, string> = {
  idle: 'bg-studio-700',
  queued: 'bg-amber-500',
  generating: 'bg-blue-500',
  saving: 'bg-accent-500',
  done: 'bg-emerald-500',
  failed: 'bg-danger-500',
};

export function GenerationProgress({ progress, compact = false }: GenerationProgressProps) {
  const { status, progress: pct, label, itemName, error, currentIndex, totalItems } = progress;
  const Icon = statusIcon[status];
  const colorClass = statusColors[status];
  const barColor = progressBarColors[status];

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {status === 'queued' || status === 'generating' || status === 'saving' ? (
          <Icon className={`w-3.5 h-3.5 animate-spin ${colorClass}`} />
        ) : (
          <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        )}
        <span className="text-studio-400">{label}</span>
        {pct > 0 && <span className="font-mono text-studio-500">{pct}%</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {status === 'queued' || status === 'generating' || status === 'saving' ? (
            <Icon className={`w-4 h-4 animate-spin shrink-0 ${colorClass}`} />
          ) : (
            <Icon className={`w-4 h-4 shrink-0 ${colorClass}`} />
          )}
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{label}</p>
            {itemName && (
              <p className="text-xs text-studio-400 truncate">{itemName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {totalItems && currentIndex !== undefined ? (
            <span className="text-xs text-studio-500 font-mono">
              {currentIndex}/{totalItems}
            </span>
          ) : null}
          <span className={`text-xs font-mono ${colorClass}`}>{pct}%</span>
        </div>
      </div>

      <div className="w-full bg-studio-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>

      {error && status === 'failed' && (
        <p className="text-xs text-danger-400 mt-1">{error}</p>
      )}
    </div>
  );
}
