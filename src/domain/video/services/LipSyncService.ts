import { Asset } from '../../assets/entities/Asset';
import { LipSyncParams, createLipSyncJob, VideoGenerationJob } from '../entities/VideoGenerationJob';

/**
 * Interface for lip sync providers
 */
export interface LipSyncProvider {
  getName(): string;
  isAvailable(): Promise<boolean>;
  syncLips(
    videoPath: string,
    audioPath: string,
    options?: {
      faceRect?: [number, number, number, number]; // [x, y, width, height]
      outputWidth?: number;
      outputHeight?: number;
    }
  ): Promise<{
    outputPath: string;
    thumbnailUrl?: string;
  }>;
}

/**
 * Service to handle lip synchronization of video with audio
 */
export class LipSyncService {
  private providers: Map<string, LipSyncProvider> = new Map();
  private defaultProvider?: string;
  private jobCallback?: (job: VideoGenerationJob) => Promise<VideoGenerationJob>;
  
  /**
   * Register a lip sync provider
   */
  public registerProvider(id: string, provider: LipSyncProvider): void {
    this.providers.set(id, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = id;
    }
  }
  
  /**
   * Set the default provider
   */
  public setDefaultProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider '${id}' not registered`);
    }
    this.defaultProvider = id;
  }
  
  /**
   * Set job submission callback
   * This allows the service to integrate with a job system
   */
  public setJobCallback(
    callback: (job: VideoGenerationJob) => Promise<VideoGenerationJob>
  ): void {
    this.jobCallback = callback;
  }
  
  /**
   * Check if a provider is available
   */
  public async isProviderAvailable(id?: string): Promise<boolean> {
    const providerId = id || this.defaultProvider;
    if (!providerId) return false;
    
    const provider = this.providers.get(providerId);
    if (!provider) return false;
    
    return provider.isAvailable();
  }
  
  /**
   * Get a list of available providers
   */
  public async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [id, provider] of this.providers.entries()) {
      if (await provider.isAvailable()) {
        available.push(id);
      }
    }
    
    return available;
  }
  
  /**
   * Sync lips between a video asset (containing a face) and audio asset
   */
  public async syncLipsForAssets(
    videoAsset: Asset,
    audioAsset: Asset,
    options?: {
      providerId?: string;
      faceRect?: [number, number, number, number];
      sceneId?: string;
      characterId?: string;
    }
  ): Promise<VideoGenerationJob | undefined> {
    // Validate assets
    if (videoAsset.type !== 'video' || audioAsset.type !== 'audio') {
      throw new Error('Invalid assets: must be video and audio');
    }
    
    if (videoAsset.status !== 'complete' || audioAsset.status !== 'complete') {
      throw new Error('Assets must be in complete status');
    }
    
    // Check if we have a job callback
    if (!this.jobCallback) {
      throw new Error('No job callback set');
    }
    
    // Create job parameters
    const params: LipSyncParams = {
      videoUrl: videoAsset.url,
      audioUrl: audioAsset.url,
      characterFaceArea: options?.faceRect,
      outputWidth: videoAsset.metadata.width,
      outputHeight: videoAsset.metadata.height
    };
    
    // Create the job
    const job = createLipSyncJob(params, {
      sceneId: options?.sceneId,
      priority: 5
    });
    
    // Submit the job
    return this.jobCallback(job);
  }
  
  /**
   * Direct lip sync using provider
   * This is used for direct calls without the job system
   */
  public async syncLips(
    videoPath: string,
    audioPath: string,
    options?: {
      providerId?: string;
      faceRect?: [number, number, number, number];
      outputWidth?: number;
      outputHeight?: number;
    }
  ): Promise<{ outputPath: string; thumbnailUrl?: string }> {
    const providerId = options?.providerId || this.defaultProvider;
    if (!providerId) {
      throw new Error('No provider specified or default set');
    }
    
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`);
    }
    
    // Check if provider is available
    if (!(await provider.isAvailable())) {
      throw new Error(`Provider '${providerId}' is not available`);
    }
    
    // Perform lip sync
    return provider.syncLips(videoPath, audioPath, {
      faceRect: options?.faceRect,
      outputWidth: options?.outputWidth,
      outputHeight: options?.outputHeight
    });
  }
}