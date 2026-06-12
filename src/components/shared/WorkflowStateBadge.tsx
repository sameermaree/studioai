/**
 * WorkflowStateBadge.tsx
 * Shared badge — used in Dashboard and Timeline header.
 */
import type { EpisodeWorkflowState } from '../../types';
import { WORKFLOW_STATE_LABELS, WORKFLOW_STATE_COLORS } from '../../lib/computeEpisodeState';

interface Props {
  state: EpisodeWorkflowState;
  size?: 'sm' | 'md';
}

export function WorkflowStateBadge({ state, size = 'md' }: Props) {
  const label = WORKFLOW_STATE_LABELS[state];
  const colorClass = WORKFLOW_STATE_COLORS[state];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${colorClass}`}>
      {state === 'IMAGES_PENDING' || state === 'AUDIO_PENDING' || state === 'EXPORTING' ? (
        <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      ) : null}
      {label}
    </span>
  );
}
