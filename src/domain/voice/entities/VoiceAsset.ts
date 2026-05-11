import { Asset, AssetCategory, AssetType } from '../../assets/entities/Asset';

export interface VoiceMetadata {
  language: 'en' | 'ar' | string;
  duration: number;
  character_id?: string;
  scene_id?: string;
  voice_id?: string;
  voice_name?: string;
  provider: string;
  word_timestamps?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  is_cloned?: boolean;
  pitch?: number;
  speed?: number;
  sample_rate?: number;
  emotion?: string;
}

/**
 * Create a voice asset from a generated audio file
 */
export function createVoiceAsset(
  options: {
    filename: string;
    displayName: string;
    path: string;
    url: string;
    metadata: VoiceMetadata;
    tags?: string[];
    sceneId?: string;
    characterId?: string;
  }
): Asset {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    filename: options.filename,
    display_name: options.displayName,
    type: 'audio' as AssetType,
    category: 'voice' as AssetCategory,
    mime_type: 'audio/mpeg',
    status: 'complete',
    path: options.path,
    url: options.url,
    metadata: {
      ...options.metadata,
      created_by: 'voice-generation',
    },
    tags: options.tags || [],
    related_entity_id: options.sceneId || options.characterId,
    related_entity_type: options.sceneId ? 'scene' : options.characterId ? 'character' : undefined,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Create a pending voice asset while generation is in progress
 */
export function createPendingVoiceAsset(
  options: {
    filename: string;
    displayName: string;
    language: 'en' | 'ar' | string;
    characterId?: string;
    sceneId?: string;
    voiceId?: string;
    voiceName?: string;
    provider: string;
    tags?: string[];
  }
): Asset {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    filename: options.filename,
    display_name: options.displayName,
    type: 'audio' as AssetType,
    category: 'voice' as AssetCategory,
    mime_type: 'audio/mpeg',
    status: 'pending',
    path: '',
    url: '',
    metadata: {
      language: options.language,
      character_id: options.characterId,
      scene_id: options.sceneId,
      voice_id: options.voiceId,
      voice_name: options.voiceName,
      provider: options.provider,
      duration: 0,
    },
    tags: options.tags || [],
    related_entity_id: options.sceneId || options.characterId,
    related_entity_type: options.sceneId ? 'scene' : options.characterId ? 'character' : undefined,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update a pending voice asset with completed data
 */
export function completeVoiceAsset(
  asset: Asset,
  url: string,
  path: string,
  metadata: Partial<VoiceMetadata>
): Asset {
  return {
    ...asset,
    status: 'complete',
    url,
    path,
    metadata: {
      ...asset.metadata,
      ...metadata,
    },
    updated_at: new Date().toISOString(),
  };
}