import { Asset, AssetType, AssetCategory, createAsset, createPendingAsset, updateAssetFile, updateAssetStatus, failAsset } from "../../../domain/assets/entities/Asset";
import { ProjectFileManager } from "../../../infrastructure/filesystem/ProjectFileManager";

/**
 * Manages assets in the application
 * 
 * This service provides methods to create, update, and delete assets,
 * as well as to manage asset metadata and file operations.
 */
export class AssetManager {
  constructor(private fileManager: ProjectFileManager) {}
  
  /**
   * Register an existing file as an asset
   */
  registerAsset(
    filename: string,
    options: {
      displayName?: string;
      type: AssetType;
      category: AssetCategory;
      mimeType: string;
      metadata?: any;
      tags?: string[];
      relatedEntityId?: string;
      relatedEntityType?: string;
    }
  ): Asset {
    return this.fileManager.createAssetEntry(filename, options);
  }
  
  /**
   * Create a pending asset for generation
   */
  createPendingAsset(
    options: {
      filename: string;
      displayName?: string;
      type: AssetType;
      category: AssetCategory;
      mimeType?: string;
      relatedEntityId?: string;
      relatedEntityType?: string;
      tags?: string[];
    }
  ): Asset {
    return createPendingAsset({
      filename: options.filename,
      displayName: options.displayName,
      type: options.type,
      category: options.category,
      mimeType: options.mimeType,
      relatedEntityId: options.relatedEntityId,
      relatedEntityType: options.relatedEntityType,
      tags: options.tags,
    });
  }
  
  /**
   * Update asset when file is generated/received
   */
  updateAssetWithFile(
    asset: Asset,
    filename: string,
    metadata?: any
  ): Asset {
    // Calculate full path based on asset type and category
    const path = this.fileManager.getAssetPath(
      asset.type,
      asset.category,
      filename
    );
    
    // Get URL for the asset
    const url = this.fileManager.getAssetUrl(path);
    
    // For images, handle thumbnail
    let thumbnailUrl: string | undefined;
    if (asset.type === 'image') {
      const thumbFilename = `thumb_${filename}`;
      const thumbPath = this.fileManager.getAssetPath(
        asset.type,
        asset.category,
        thumbFilename
      );
      thumbnailUrl = this.fileManager.getAssetUrl(thumbPath);
    }
    
    // Update the asset with file information
    return updateAssetFile(
      asset,
      path,
      url,
      metadata,
      thumbnailUrl
    );
  }
  
  /**
   * Mark an asset as generating
   */
  markAssetAsGenerating(asset: Asset): Asset {
    return updateAssetStatus(asset, 'generating');
  }
  
  /**
   * Mark an asset as complete
   */
  markAssetAsComplete(asset: Asset): Asset {
    return updateAssetStatus(asset, 'complete');
  }
  
  /**
   * Mark an asset as failed
   */
  markAssetAsFailed(asset: Asset, errorMessage: string): Asset {
    return failAsset(asset, errorMessage);
  }
  
  /**
   * Generate a filename for a new asset
   */
  generateFilename(
    prefix: string,
    extension: string,
    relatedId?: string
  ): string {
    // Create a filename based on prefix, timestamp, and optional related ID
    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Include related ID if provided
    const relatedPart = relatedId ? `_${relatedId.substring(0, 6)}` : '';
    
    return `${prefix}${relatedPart}_${timestamp}_${randomId}.${extension}`;
  }
  
  /**
   * Generate an image asset filename
   */
  generateImageFilename(
    prefix: string = 'img',
    relatedId?: string
  ): string {
    return this.generateFilename(prefix, 'png', relatedId);
  }
  
  /**
   * Generate a video asset filename
   */
  generateVideoFilename(
    prefix: string = 'vid',
    relatedId?: string
  ): string {
    return this.generateFilename(prefix, 'mp4', relatedId);
  }
  
  /**
   * Generate an audio asset filename
   */
  generateAudioFilename(
    prefix: string = 'aud',
    relatedId?: string
  ): string {
    return this.generateFilename(prefix, 'mp3', relatedId);
  }
}