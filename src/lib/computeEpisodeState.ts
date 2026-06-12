/**
 * computeEpisodeState.ts
 * Pure functions — compute Episode workflow state and production stats.
 * No side effects. No store access.
 */
import type {
  Episode,
  EpisodeWorkflowState,
  EpisodeProductionStats,
  ProductionRenderJob,
} from '../types';

export function computeEpisodeWorkflowState(
  episode: Episode,
  jobs: ProductionRenderJob[]
): EpisodeWorkflowState {
  const scenes = episode.scenes ?? [];
  if (scenes.length === 0) return 'DRAFT';

  const episodeJobs = jobs.filter((j) => j.episode_id === episode.id);

  // EXPORTED
  if (episode.export_url) return 'EXPORTED';

  // EXPORTING
  const exportingJob = episodeJobs.find(
    (j) => j.type === 'export' && (j.status === 'running' || j.status === 'queued')
  );
  if (exportingJob) return 'EXPORTING';

  // EXPORT_READY (manual decision)
  if (episode.export_ready_marked) return 'EXPORT_READY';

  // AUDIO_READY
  const allAudioDone = scenes.every((s) => !!s.audio_url);
  const activeAudioJobs = episodeJobs.filter(
    (j) => j.type === 'audio' && (j.status === 'running' || j.status === 'queued')
  );
  if (allAudioDone && activeAudioJobs.length === 0) return 'AUDIO_READY';

  // AUDIO_PENDING
  const someAudioExists = scenes.some((s) => !!s.audio_url);
  if (activeAudioJobs.length > 0 || someAudioExists) return 'AUDIO_PENDING';

  // IMAGES_READY
  const allImagesDone = scenes.every((s) => !!s.render_url);
  const activeImageJobs = episodeJobs.filter(
    (j) => j.type === 'image' && (j.status === 'running' || j.status === 'queued')
  );
  if (allImagesDone && activeImageJobs.length === 0) return 'IMAGES_READY';

  // IMAGES_PENDING
  const someImagesExist = scenes.some((s) => !!s.render_url);
  if (activeImageJobs.length > 0 || someImagesExist) return 'IMAGES_PENDING';

  return 'DRAFT';
}

export function computeEpisodeStats(
  episode: Episode,
  jobs: ProductionRenderJob[]
): EpisodeProductionStats {
  const scenes = episode.scenes ?? [];
  const total = scenes.length;
  const episodeJobs = jobs.filter((j) => j.episode_id === episode.id);

  const withImage = scenes.filter((s) => !!s.render_url).length;
  const withAudio = scenes.filter((s) => !!s.audio_url).length;
  const withVideo = scenes.filter((s) => !!s.video_url).length;

  const activeJobs = episodeJobs.filter(
    (j) => j.status === 'running' || j.status === 'queued'
  ).length;

  const imagePercentage = total > 0 ? Math.round((withImage / total) * 100) : 0;
  const audioPercentage = total > 0 ? Math.round((withAudio / total) * 100) : 0;

  // Phase 1: completion = image percentage
  // Phase 3+: will factor in audio
  const completionPercentage = imagePercentage;

  return {
    total_scenes: total,
    scenes_with_image: withImage,
    scenes_with_audio: withAudio,
    scenes_with_video: withVideo,
    image_percentage: imagePercentage,
    audio_percentage: audioPercentage,
    active_jobs: activeJobs,
    completion_percentage: completionPercentage,
  };
}

/** Human-readable label for each workflow state */
export const WORKFLOW_STATE_LABELS: Record<EpisodeWorkflowState, string> = {
  DRAFT: 'Draft',
  IMAGES_PENDING: 'Generating Images',
  IMAGES_READY: 'Images Ready',
  AUDIO_PENDING: 'Generating Audio',
  AUDIO_READY: 'Audio Ready',
  EXPORT_READY: 'Ready to Export',
  EXPORTING: 'Exporting',
  EXPORTED: 'Exported',
};

export const WORKFLOW_STATE_COLORS: Record<EpisodeWorkflowState, string> = {
  DRAFT: 'text-studio-400 bg-studio-800/50 border-studio-700',
  IMAGES_PENDING: 'text-amber-400 bg-amber-900/20 border-amber-700/30',
  IMAGES_READY: 'text-blue-400 bg-blue-900/20 border-blue-700/30',
  AUDIO_PENDING: 'text-amber-400 bg-amber-900/20 border-amber-700/30',
  AUDIO_READY: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30',
  EXPORT_READY: 'text-green-400 bg-green-900/20 border-green-700/30',
  EXPORTING: 'text-purple-400 bg-purple-900/20 border-purple-700/30',
  EXPORTED: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/30',
};
