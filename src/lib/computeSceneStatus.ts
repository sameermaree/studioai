/**
 * computeSceneStatus.ts
 * Pure function — computes Scene production status from scene data + active jobs.
 * No side effects. No store access. Fully testable.
 */
import type { Scene, SceneProductionStatus, ProductionRenderJob } from '../types';

export function computeSceneStatus(
  scene: Scene,
  jobs: ProductionRenderJob[]
): SceneProductionStatus {
  const activeImageJob = jobs.find(
    (j) => j.scene_id === scene.id && j.type === 'image' &&
           (j.status === 'running' || j.status === 'queued')
  );
  const failedImageJob = jobs.find(
    (j) => j.scene_id === scene.id && j.type === 'image' && j.status === 'failed'
  );

  const activeAudioJob = jobs.find(
    (j) => j.scene_id === scene.id && j.type === 'audio' &&
           (j.status === 'running' || j.status === 'queued')
  );
  const failedAudioJob = jobs.find(
    (j) => j.scene_id === scene.id && j.type === 'audio' && j.status === 'failed'
  );

  const activeVideoJob = jobs.find(
    (j) => j.scene_id === scene.id && j.type === 'video' &&
           (j.status === 'running' || j.status === 'queued')
  );
  const failedVideoJob = jobs.find(
    (j) => j.scene_id === scene.id && j.type === 'video' && j.status === 'failed'
  );

  const imageStatus: SceneProductionStatus['image'] = {
    status: activeImageJob ? 'generating'
      : failedImageJob ? 'failed'
      : scene.render_url ? 'done'
      : 'none',
    url: scene.render_url ?? null,
  };

  const audioStatus: SceneProductionStatus['audio'] = {
    status: activeAudioJob ? 'generating'
      : failedAudioJob ? 'failed'
      : scene.audio_url ? 'done'
      : 'none',
    url: scene.audio_url ?? null,
  };

  const videoStatus: SceneProductionStatus['video'] = {
    status: activeVideoJob ? 'generating'
      : failedVideoJob ? 'failed'
      : scene.video_url ? 'done'
      : 'none',
    url: scene.video_url ?? null,
  };

  const overall: SceneProductionStatus['overall'] =
    audioStatus.status === 'done' && videoStatus.status === 'done' ? 'complete'
    : audioStatus.status === 'done' ? 'audio_ready'
    : imageStatus.status === 'done' ? 'image_ready'
    : 'empty';

  return { image: imageStatus, audio: audioStatus, video: videoStatus, overall };
}
