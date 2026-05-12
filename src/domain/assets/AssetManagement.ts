/**
 * Local Asset Management System
 */

export type AssetType = 
  | 'character-image'
  | 'background'
  | 'audio-music'
  | 'audio-voice'
  | 'audio-sfx'
  | 'render-output'
  | 'thumbnail'
  | 'subtitle';

export interface AssetMetadata {
  id: string;
  type: AssetType;
  filename: string;
  original_name: string;
  path: string;
  size?: number;
  mime_type?: string;
  duration?: number; // for audio/video
  width?: number; // for images/video
  height?: number;
  created_at: string;
  updated_at: string;
}

export interface AssetCreateOptions {
  type: AssetType;
  originalName: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Sanitize filename for safe filesystem storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9._-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Generate unique asset ID
 */
export function generateAssetId(type: AssetType): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${type}-${timestamp}-${random}`;
}

/**
 * Get asset folder path based on type
 */
export function getAssetFolder(type: AssetType): string {
  const base = 'data/projects/default-project/assets';
  
  switch (type) {
    case 'character-image':
      return `${base}/characters`;
    case 'background':
      return `${base}/backgrounds`;
    case 'audio-music':
      return `${base}/audio/music`;
    case 'audio-voice':
      return `${base}/audio/voice`;
    case 'audio-sfx':
      return `${base}/audio/sfx`;
    case 'render-output':
      return `${base}/renders`;
    case 'thumbnail':
      return `${base}/thumbnails`;
    case 'subtitle':
      return `${base}/subtitles`;
    default:
      return `${base}/temp`;
  }
}

/**
 * Get full asset path
 */
export function getAssetPath(assetId: string, type: AssetType, extension: string): string {
  const folder = getAssetFolder(type);
  const sanitizedId = sanitizeFilename(assetId);
  return `${folder}/${sanitizedId}.${extension}`;
}

/**
 * Create asset metadata
 */
export function createAssetMetadata(
  type: AssetType,
  originalName: string,
  extension: string
): AssetMetadata {
  const id = generateAssetId(type);
  const filename = `${sanitizeFilename(id)}.${extension}`;
  const folder = getAssetFolder(type);
  
  return {
    id,
    type,
    filename,
    original_name: originalName,
    path: `${folder}/${filename}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Get relative path for asset storage
 */
export function getRelativeAssetPath(assetPath: string): string {
  return assetPath.replace(/^data\/projects\/default-project\//, '');
}

/**
 * Parse extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Validate asset type matches file extension
 */
export function validateAssetType(type: AssetType, extension: string): boolean {
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
  const videoExts = ['mp4', 'mov', 'webm', 'avi'];
  const subtitleExts = ['srt', 'vtt', 'ass'];
  
  switch (type) {
    case 'character-image':
    case 'background':
    case 'thumbnail':
      return imageExts.includes(extension);
    case 'audio-music':
    case 'audio-voice':
    case 'audio-sfx':
      return audioExts.includes(extension);
    case 'render-output':
      return videoExts.includes(extension);
    case 'subtitle':
      return subtitleExts.includes(extension);
    default:
      return true;
  }
}
