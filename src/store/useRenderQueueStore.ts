/**
 * useRenderQueueStore.ts
 * Production Render Queue — tracks all generation jobs across the studio.
 * Separate from useGenerationStore (which tracks UI progress per key).
 * This store tracks persistent job records for Dashboard and Timeline display.
 */
import { create } from 'zustand';
import type { ProductionRenderJob } from '../types';

interface RenderQueueState {
  jobs: ProductionRenderJob[];

  // ── Actions ──────────────────────────────────────
  addJob: (job: Omit<ProductionRenderJob, 'id' | 'status' | 'progress' | 'retry_count' | 'created_at'>) => string;
  updateJob: (id: string, updates: Partial<ProductionRenderJob>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  cancelJob: (id: string) => void;

  // ── Selectors ─────────────────────────────────────
  getActiveJobs: () => ProductionRenderJob[];
  getJobsForEpisode: (episodeId: string) => ProductionRenderJob[];
  getJobsForScene: (sceneId: string) => ProductionRenderJob[];
  getActiveJobsForScene: (sceneId: string) => ProductionRenderJob[];
}

export const useRenderQueueStore = create<RenderQueueState>()((set, get) => ({
  jobs: [],

  addJob: (jobData) => {
    const id = crypto.randomUUID();
    const job: ProductionRenderJob = {
      ...jobData,
      id,
      status: 'queued',
      progress: 0,
      retry_count: 0,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ jobs: [...s.jobs, job] }));
    return id;
  },

  updateJob: (id, updates) => {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
  },

  removeJob: (id) => {
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
  },

  clearCompleted: () => {
    set((s) => ({
      jobs: s.jobs.filter(
        (j) => j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled'
      ),
    }));
  },

  cancelJob: (id) => {
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id && (j.status === 'queued' || j.status === 'running')
          ? { ...j, status: 'cancelled' as const }
          : j
      ),
    }));
  },

  getActiveJobs: () =>
    get().jobs.filter((j) => j.status === 'running' || j.status === 'queued'),

  getJobsForEpisode: (episodeId) =>
    get().jobs.filter((j) => j.episode_id === episodeId),

  getJobsForScene: (sceneId) =>
    get().jobs.filter((j) => j.scene_id === sceneId),

  getActiveJobsForScene: (sceneId) =>
    get().jobs.filter(
      (j) => j.scene_id === sceneId &&
             (j.status === 'running' || j.status === 'queued')
    ),
}));
