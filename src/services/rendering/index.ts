import type { RenderJob, RenderSettings, Scene } from '../../types';

export async function queueSceneRender(_scene: Scene, _settings: RenderSettings): Promise<RenderJob> {
  return {
    id: crypto.randomUUID(),
    episode_id: _scene.episode_id,
    scene_id: _scene.id,
    type: 'scene',
    status: 'queued',
    progress: 0,
    output_url: null,
    settings: _settings,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };
}

export async function queueEpisodeStitch(_episodeId: string, _settings: RenderSettings): Promise<RenderJob> {
  return {
    id: crypto.randomUUID(),
    episode_id: _episodeId,
    scene_id: null,
    type: 'episode',
    status: 'queued',
    progress: 0,
    output_url: null,
    settings: _settings,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };
}
