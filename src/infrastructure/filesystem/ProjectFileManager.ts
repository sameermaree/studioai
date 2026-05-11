import { Asset, AssetType, AssetCategory, createAsset } from "../../domain/assets/entities/Asset";

/**
 * Manages the project's file system for assets
 * 
 * This provides an abstraction layer for file operations specific to the project
 * and handles the organization of files based on their types and categories.
 */
export class ProjectFileManager {
  private basePath: string;
  
  constructor(basePath: string = './assets') {
    this.basePath = this.normalizePath(basePath);
    this.ensureBaseDirectories();
  }
  
  /**
   * Get the base path for assets
   */
  getBasePath(): string {
    return this.basePath;
  }
  
  /**
   * Set the base path for assets
   */
  setBasePath(path: string): void {
    this.basePath = this.normalizePath(path);
    this.ensureBaseDirectories();
  }
  
  /**
   * Get the full path for an asset based on its type and category
   */
  getAssetPath(type: AssetType, category: AssetCategory, filename: string): string {
    const typeDir = this.getTypeDirectory(type);
    const categoryDir = this.getCategoryDirectory(category);
    
    return `${this.basePath}/${typeDir}/${categoryDir}/${filename}`;
  }
  
  /**
   * Get the URL for an asset based on its path
   */
  getAssetUrl(path: string): string {
    // For local file system, use file:// protocol
    return `file://${path}`;
  }
  
  /**
   * Create an asset entry for a file
   */
  createAssetEntry(
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
    const path = this.getAssetPath(options.type, options.category, filename);
    const url = this.getAssetUrl(path);
    
    // For images, create a thumbnail path
    let thumbnailUrl: string | undefined;
    if (options.type === 'image') {
      const thumbnailFilename = `thumb_${filename}`;
      const thumbnailPath = this.getAssetPath(options.type, options.category, thumbnailFilename);
      thumbnailUrl = this.getAssetUrl(thumbnailPath);
    }
    
    return createAsset({
      filename,
      displayName: options.displayName,
      type: options.type,
      category: options.category,
      mimeType: options.mimeType,
      path,
      url,
      thumbnailUrl,
      metadata: options.metadata,
      tags: options.tags,
      relatedEntityId: options.relatedEntityId,
      relatedEntityType: options.relatedEntityType,
    });
  }
  
  /**
   * Ensure the base directory structure exists
   */
  private ensureBaseDirectories(): void {
    // This is just a stub - in a real app, this would create directories if they don't exist
    // Since browser JS cannot create directories, this would be delegated to a backend service
    
    console.log(`Ensuring base directories in ${this.basePath}`);
    
    // In a real implementation with Node.js or Electron, this would:
    // - Check if the base directory exists
    // - Create it if it doesn't
    // - Create subdirectories for each asset type and category
    
    // For now, we'll just assume the directories exist
  }
  
  /**
   * Normalize a file path
   */
  private normalizePath(path: string): string {
    // Remove trailing slash if present
    return path.endsWith('/') ? path.slice(0, -1) : path;
  }
  
  /**
   * Get the directory name for an asset type
   */
  private getTypeDirectory(type: AssetType): string {
    switch (type) {
      case 'image': return 'images';
      case 'video': return 'videos';
      case 'audio': return 'audio';
      case 'subtitle': return 'subtitles';
      case 'document': return 'documents';
      case 'project': return 'projects';
      case 'other': return 'other';
      default: return 'other';
    }
  }
  
  /**
   * Get the directory name for an asset category
   */
  private getCategoryDirectory(category: AssetCategory): string {
    switch (category) {
      case 'character': return 'characters';
      case 'background': return 'backgrounds';
      case 'scene': return 'scenes';
      case 'episode': return 'episodes';
      case 'voice': return 'voices';
      case 'music': return 'music';
      case 'sound_effect': return 'sound_effects';
      case 'export': return 'exports';
      case 'other': return 'other';
      default: return 'other';
    }
  }
}