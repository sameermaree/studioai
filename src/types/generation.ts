export type GenerationStatus = 'idle' | 'queued' | 'generating' | 'saving' | 'done' | 'failed';

export interface GenerationProgress {
  /** Current status */
  status: GenerationStatus;
  /** Progress percentage 0-100 */
  progress: number;
  /** Short label shown to user */
  label: string;
  /** Name of item being generated */
  itemName?: string;
  /** Error message if failed */
  error?: string;
  /** For batch operations: current index */
  currentIndex?: number;
  /** For batch operations: total items */
  totalItems?: number;
}

export const STAGED_PROGRESS: Record<GenerationStatus, number> = {
  idle: 0,
  queued: 10,
  generating: 40,
  saving: 85,
  done: 100,
  failed: 0,
};

export function createGenerationProgress(status: GenerationStatus, label: string, overrides?: Partial<GenerationProgress>): GenerationProgress {
  return {
    status,
    progress: STAGED_PROGRESS[status],
    label,
    ...overrides,
  };
}
