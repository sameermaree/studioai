/**
 * GenerationProgressTracker
 *
 * Reusable progress tracking for generation workflows.
 * Features:
 * - percentage tracking (0–100)
 * - current item / total items
 * - estimated remaining status
 * - disabled-while-generating state
 * - queue-safe generation (no duplicate runs)
 * - no duplicate loading systems
 */

export interface ProgressState {
  /** Whether any generation is currently active */
  isGenerating: boolean;
  /** Current progress percentage (0–100) */
  percentage: number;
  /** Current item index (1-based) */
  currentItem: number;
  /** Total items to process */
  totalItems: number;
  /** Human-readable label for the current step */
  currentLabel: string;
  /** Current phase name */
  phase: string;
  /** Estimated remaining description */
  estimatedRemaining: string;
  /** Error message, if failed */
  error: string | null;
  /** Whether this progress has completed successfully */
  isDone: boolean;
}

export const IDLE_PROGRESS: ProgressState = {
  isGenerating: false,
  percentage: 0,
  currentItem: 0,
  totalItems: 0,
  currentLabel: '',
  phase: 'idle',
  estimatedRemaining: '',
  error: null,
  isDone: false,
};

export const DONE_PROGRESS: ProgressState = {
  isGenerating: false,
  percentage: 100,
  currentItem: 0,
  totalItems: 0,
  currentLabel: 'Complete',
  phase: 'complete',
  estimatedRemaining: 'Done',
  error: null,
  isDone: true,
};

/**
 * Generate an "in-progress" state.
 */
export function makeProgress(params: {
  phase: string;
  currentItem: number;
  totalItems: number;
  label?: string;
  estimatedRemaining?: string;
}): ProgressState {
  const { phase, currentItem, totalItems, label } = params;
  const pct = totalItems > 0 ? Math.round((currentItem / totalItems) * 100) : 0;

  const estRemaining =
    params.estimatedRemaining ??
    (totalItems > 0 && currentItem > 0
      ? `~${Math.ceil((totalItems - currentItem) * 5)}s remaining`
      : 'Calculating...');

  return {
    isGenerating: true,
    percentage: Math.min(100, pct),
    currentItem,
    totalItems,
    currentLabel: label ?? `${phase}...`,
    phase,
    estimatedRemaining: estRemaining,
    error: null,
    isDone: false,
  };
}

/**
 * Generate an error state.
 */
export function makeError(phase: string, error: string, currentItem?: number, totalItems?: number): ProgressState {
  return {
    isGenerating: false,
    percentage: 0,
    currentItem: currentItem ?? 0,
    totalItems: totalItems ?? 0,
    currentLabel: `Failed: ${error}`,
    phase,
    estimatedRemaining: '',
    error,
    isDone: false,
  };
}

/**
 * Create a unique generation key to prevent duplicate loading.
 * Use this to check if a generation is already running.
 */
export function makeGenerationKey(type: string, id: string): string {
  return `${type}::${id}`;
}

/**
 * Simple callback-based progress tracker.
 * Instead of a new store, we accept callbacks so any store/hook can integrate it.
 */
export class ProgressTracker {
  private _isRunning = false;
  private _activeKeys = new Set<string>();

  /** Check if a specific key is already running (queue-safe) */
  isRunning(key: string): boolean {
    return this._activeKeys.has(key);
  }

  /** Claim a key for generation. Returns false if already claimed (prevents duplicate). */
  tryClaim(key: string): boolean {
    if (this._activeKeys.has(key)) return false;
    this._activeKeys.add(key);
    this._isRunning = true;
    return true;
  }

  /** Release a key after generation completes */
  release(key: string): void {
    this._activeKeys.delete(key);
    if (this._activeKeys.size === 0) {
      this._isRunning = false;
    }
  }

  /** Check if any generation is active */
  get isRunningAny(): boolean {
    return this._isRunning;
  }

  /** Get count of active generations */
  get activeCount(): number {
    return this._activeKeys.size;
  }
}

/**
 * Create a singleton progress tracker so all generation services share one lock.
 */
export const globalProgressTracker = new ProgressTracker();
