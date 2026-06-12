/**
 * useTimelineStore.ts
 * Timeline-specific state — ordering, selection, zoom.
 * Does NOT duplicate scene data — reads from useStudioStore.
 * Designed for Phase 1. Playback state added in Phase 2.
 */
import { create } from 'zustand';
import type { Scene } from '../types';

type ZoomLevel = 0.5 | 1.0 | 1.5 | 2.0;
const PIXELS_PER_SECOND_BASE = 60;

interface TimelineState {
  // ── Context ───────────────────────────────────────
  activeEpisodeId: string | null;

  // ── Scene Ordering ────────────────────────────────
  // Array of scene IDs in display order.
  // Source of truth for ordering during drag.
  // Persisted to studioStore on drag end.
  sceneOrder: string[];

  // ── Selection ─────────────────────────────────────
  selectedSceneId: string | null;

  // ── Drag State ────────────────────────────────────
  isDragging: boolean;

  // ── Zoom ──────────────────────────────────────────
  zoom: ZoomLevel;
  pixelsPerSecond: number;

  // ── Playback (Phase 2) ───────────────────────────
  isPlaying: boolean;
  currentTime: number;
  activeSceneId: string | null;

  // ── Actions ──────────────────────────────────────
  openEpisode: (episodeId: string, scenes: Scene[]) => void;
  closeEpisode: () => void;
  setSceneOrder: (order: string[]) => void;
  selectScene: (sceneId: string | null) => void;
  setIsDragging: (val: boolean) => void;
  setZoom: (level: ZoomLevel) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeInSeconds: number) => void;
  tick: (totalDuration: number) => void;
  setActiveScene: (sceneId: string | null) => void;
}

export const useTimelineStore = create<TimelineState>()((set, get) => ({
  activeEpisodeId: null,
  sceneOrder: [],
  selectedSceneId: null,
  isDragging: false,
  zoom: 1.0,
  pixelsPerSecond: PIXELS_PER_SECOND_BASE,
  isPlaying: false,
  currentTime: 0,
  activeSceneId: null,

  openEpisode: (episodeId, scenes) => {
    // Sort scenes by .order; fix duplicates/nulls by using array index
    const sorted = [...scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Detect ordering issues
    const orders = sorted.map((s) => s.order);
    const hasDuplicates = new Set(orders).size !== orders.length;
    const hasNulls = orders.some((o) => o == null);

    if (hasDuplicates || hasNulls) {
      console.log('[TIMELINE] Fixed scene ordering for episode', episodeId);
    }

    set({
      activeEpisodeId: episodeId,
      sceneOrder: sorted.map((s) => s.id),
      selectedSceneId: null,
      isDragging: false,
    });
  },

  closeEpisode: () =>
    set({
      activeEpisodeId: null,
      sceneOrder: [],
      selectedSceneId: null,
      isDragging: false,
      isPlaying: false,
      currentTime: 0,
      activeSceneId: null,
    }),

  setSceneOrder: (order) => set({ sceneOrder: order }),

  selectScene: (sceneId) => set({ selectedSceneId: sceneId }),

  setIsDragging: (val) => set({ isDragging: val }),

  setZoom: (level) =>
    set({
      zoom: level,
      pixelsPerSecond: PIXELS_PER_SECOND_BASE * level,
    }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentTime: 0, activeSceneId: null }),
  seek: (timeInSeconds) => set({ currentTime: Math.max(0, timeInSeconds) }),
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),

  tick: (totalDuration) => {
    const { currentTime, isPlaying } = get();
    if (!isPlaying) return;
    const next = currentTime + 0.1;
    if (next >= totalDuration) {
      set({ isPlaying: false, currentTime: totalDuration, activeSceneId: null });
    } else {
      set({ currentTime: next });
    }
  },
}));