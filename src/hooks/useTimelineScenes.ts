/**
 * useTimelineScenes.ts
 * Derived data hook for Timeline — joins sceneOrder from timelineStore
 * with actual scene data from studioStore. Computes positions and totals.
 */
import { useMemo } from 'react';
import { useTimelineStore } from '../store/useTimelineStore';
import { useStudioStore } from '../store/useStudioStore';
import { useRenderQueueStore } from '../store/useRenderQueueStore';
import { computeSceneStatus } from '../lib/computeSceneStatus';
import type { Scene, SceneProductionStatus } from '../types';

export interface TimelineScene {
  scene: Scene;
  index: number;
  startTime: number;          // cumulative seconds from episode start
  endTime: number;
  widthPx: number;            // duration × pixelsPerSecond
  productionStatus: SceneProductionStatus;
}

export interface TimelineScenesResult {
  orderedScenes: TimelineScene[];
  totalDuration: number;
  scenesWithImage: number;
  scenesWithAudio: number;
  totalScenes: number;
}

export function useTimelineScenes(): TimelineScenesResult {
  const { activeEpisodeId, sceneOrder, pixelsPerSecond } = useTimelineStore();
  const episodes = useStudioStore((s) => s.episodes);
  const jobs = useRenderQueueStore((s) => s.jobs);

  return useMemo(() => {
    if (!activeEpisodeId) {
      return {
        orderedScenes: [],
        totalDuration: 0,
        scenesWithImage: 0,
        scenesWithAudio: 0,
        totalScenes: 0,
      };
    }

    const episode = episodes.find((e) => e.id === activeEpisodeId);
    if (!episode) {
      return {
        orderedScenes: [],
        totalDuration: 0,
        scenesWithImage: 0,
        scenesWithAudio: 0,
        totalScenes: 0,
      };
    }

    // Build a map for O(1) lookup
    const scenesMap = new Map<string, Scene>();
    episode.scenes.forEach((s) => scenesMap.set(s.id, s));

    // Follow sceneOrder; fall back to episode.scenes order if IDs missing
    const orderedIds = sceneOrder.length > 0
      ? sceneOrder
      : [...episode.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((s) => s.id);

    let cumulativeTime = 0;
    const orderedScenes: TimelineScene[] = [];

    orderedIds.forEach((id, index) => {
      const scene = scenesMap.get(id);
      if (!scene) return;

      const duration = scene.duration ?? 5;
      const startTime = cumulativeTime;
      const endTime = cumulativeTime + duration;
      const widthPx = duration * pixelsPerSecond;
      const productionStatus = computeSceneStatus(scene, jobs);

      orderedScenes.push({
        scene,
        index,
        startTime,
        endTime,
        widthPx,
        productionStatus,
      });

      cumulativeTime = endTime;
    });

    const totalDuration = cumulativeTime;
    const scenesWithImage = orderedScenes.filter(
      (ts) => ts.productionStatus.image.status === 'done'
    ).length;
    const scenesWithAudio = orderedScenes.filter(
      (ts) => ts.productionStatus.audio.status === 'done'
    ).length;

    return {
      orderedScenes,
      totalDuration,
      scenesWithImage,
      scenesWithAudio,
      totalScenes: orderedScenes.length,
    };
  }, [activeEpisodeId, sceneOrder, pixelsPerSecond, episodes, jobs]);
}
