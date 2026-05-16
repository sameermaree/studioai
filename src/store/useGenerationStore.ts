import { create } from 'zustand';
import type { GenerationProgress, GenerationStatus } from '../types/generation';

export type GenerationKey =
  | `extract-characters-${string}`   // episodeId
  | `extract-locations-${string}`    // episodeId
  | `generate-character-prompt-${string}` // characterBibleEntryId
  | `generate-character-image-${string}` // characterBibleEntryId
  | `generate-location-prompt-${string}` // locationBibleEntryId
  | `generate-location-image-${string}` // locationBibleEntryId
  | `generate-scene-image-${string}`    // sceneId
  | `generate-all-scenes-${string}`;    // episodeId

interface GenerationState {
  /** Map of generation keys to their progress */
  progress: Record<string, GenerationProgress>;
  
  /** Set progress for a generation key */
  setProgress: (key: GenerationKey, progress: GenerationProgress) => void;
  
  /** Update progress fields for a generation key */
  updateProgress: (key: GenerationKey, updates: Partial<GenerationProgress>) => void;
  
  /** Check if a specific key is currently running */
  isRunning: (key: GenerationKey) => boolean;
  
  /** Check if any generation with a prefix is running. E.g. `generate-character-image-` */
  isCategoryRunning: (prefix: string) => boolean;
  
  /** Reset a generation key to idle */
  resetProgress: (key: GenerationKey) => void;
  
  /** Clear all generations */
  clearAll: () => void;
}

function isActiveStatus(status: GenerationStatus): boolean {
  return status === 'queued' || status === 'generating' || status === 'saving';
}

export const useGenerationStore = create<GenerationState>()((set, get) => ({
  progress: {},

  setProgress: (key, progress) => {
    set((state) => ({
      progress: { ...state.progress, [key]: progress },
    }));
  },

  updateProgress: (key, updates) => {
    set((state) => {
      const current = state.progress[key];
      if (!current) return state;
      return {
        progress: { ...state.progress, [key]: { ...current, ...updates } },
      };
    });
  },

  isRunning: (key) => {
    const p = get().progress[key];
    if (!p) return false;
    return isActiveStatus(p.status);
  },

  isCategoryRunning: (prefix) => {
    const entries = Object.entries(get().progress);
    return entries.some(
      ([key, p]) => key.startsWith(prefix) && isActiveStatus(p.status)
    );
  },

  resetProgress: (key) => {
    set((state) => {
      const next = { ...state.progress };
      delete next[key];
      return { progress: next };
    });
  },

  clearAll: () => set({ progress: {} }),
}));
