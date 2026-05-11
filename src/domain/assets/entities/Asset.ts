export type AssetType = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'subtitle' 
  | 'document'
  | 'project' 
  | 'other';

export type AssetStatus = 
  | 'pending' 
  | 'generating' 
  | 'complete' 
  | 'failed' 
  | 'deleted';

export type AssetCategory = 
  | 'character' 
  | 'background' 
  | 'scene' 
  | 'episode' 
  | 'voice' 
  | 'music' 
  | 'sound_effect'
  | 'export' 
  | 'other';

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  framerate?: number;
  format?: string;
  codec?: string;
  bitrate?: number;
  size?: number;
  created_by?: string;
  generated_by?: string;
  generation_params?: Record<string, any>;
  [key: string]: any;
}

export interface Asset {
  id: string;
  filename: string;
  display_name: string;
  type: AssetType;
  category: AssetCategory;
  mime_type: string;
  status: AssetStatus;
  path: string;
  url: string;
  thumbnail_url?: string;
  metadata: AssetMetadata;
  tags: string[];
  related_entity_id?: string;
  related_entity_type?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

/**
 * Create a new asset
 */
export function createAsset(
  options: {
    filename: string;
    displayName?: string;
    type: AssetType;
    category: AssetCategory;
    mimeType: string;
    path: string;
    url: string;
    thumbnailUrl?: string;
    metadata?: AssetMetadata;
    tags?: string[];
    relatedEntityId?: string;
    relatedEntityType?: string;
    userId?: string;
  }
): Asset {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    filename: options.filename,
    display_name: options.displayName || options.filename,
    type: options.type,
    category: options.category,
    mime_type: options.mimeType,
    status: 'complete',
    path: options.path,
    url: options.url,
    thumbnail_url: options.thumbnailUrl,
    metadata: options.metadata || {},
    tags: options.tags || [],
    related_entity_id: options.relatedEntityId,
    related_entity_type: options.relatedEntityType,
    created_at: now,
    updated_at: now,
    user_id: options.userId,
  };
}

/**
 * Create a placeholder asset for generation
 */
export function createPendingAsset(
  options: {
    filename: string;
    displayName?: string;
    type: AssetType;
    category: AssetCategory;
    mimeType?: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
    tags?: string[];
    userId?: string;
  }
): Asset {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    filename: options.filename,
    display_name: options.displayName || options.filename,
    type: options.type,
    category: options.category,
    mime_type: options.mimeType || 'application/octet-stream',
    status: 'pending',
    path: '',
    url: '',
    metadata: {},
    tags: options.tags || [],
    related_entity_id: options.relatedEntityId,
    related_entity_type: options.relatedEntityType,
    created_at: now,
    updated_at: now,
    user_id: options.userId,
  };
}

/**
 * Update asset status
 */
export function updateAssetStatus(
  asset: Asset,
  status: AssetStatus
): Asset {
  return {
    ...asset,
    status,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update asset file information
 */
export function updateAssetFile(
  asset: Asset,
  path: string,
  url: string,
  metadata?: Partial<AssetMetadata>,
  thumbnailUrl?: string
): Asset {
  return {
    ...asset,
    path,
    url,
    thumbnail_url: thumbnailUrl || asset.thumbnail_url,
    metadata: { ...asset.metadata, ...metadata },
    status: 'complete',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Mark asset as failed with an error message
 */
export function failAsset(
  asset: Asset,
  errorMessage: string
): Asset {
  return {
    ...asset,
    status: 'failed',
    metadata: {
      ...asset.metadata,
      error: errorMessage,
      failed_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
}