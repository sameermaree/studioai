import type { Platform, PublishTarget, Language } from '../../types';

export interface PublishRequest {
  episode_id: string;
  platform: Platform;
  title: string;
  description: string;
  hashtags: string[];
  language: Language;
  scheduled_at?: string;
}

export async function publishToTarget(request: PublishRequest): Promise<PublishTarget> {
  return {
    id: crypto.randomUUID(),
    platform: request.platform,
    episode_id: request.episode_id,
    status: request.scheduled_at ? 'scheduled' : 'publishing',
    title: request.title,
    description: request.description,
    hashtags: request.hashtags,
    language: request.language,
    scheduled_at: request.scheduled_at ?? null,
    published_at: null,
    external_url: null,
    thumbnail_url: null,
    captions: [],
    created_at: new Date().toISOString(),
  };
}

export async function generateTitle(_episodeDescription: string, _language: Language): Promise<string> {
  return 'AI Generated Title - Episode';
}

export async function generateHashtags(_description: string, _platform: Platform): Promise<string[]> {
  return ['#AIContent', '#Generated', '#Automated'];
}
