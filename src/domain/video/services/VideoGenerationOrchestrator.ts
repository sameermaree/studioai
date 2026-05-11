import { 
  VideoGenerationJob, 
  VideoGenerationStatus,
  ImageToVideoParams,
  SceneGenerationParams,
  ShotGenerationParams,
  CharacterAnimationParams,
  LipSyncParams
} from '../entities/VideoGenerationJob';

import { Asset, createPendingAsset, updateAssetFile } from '../../assets/entities/Asset';

/**
 * Interface for video generation providers
 */
export interface VideoGenerationProvider {
  getName(): string;
  isAvailable(): Promise<boolean>;
  getCapabilities(): string[];
  generateImageToVideo(params: ImageToVideoParams): Promise<{
    outputUrl: string;
    thumbnailUrl?: string;
    metadata: {
      duration: number;
      fps: number;
      width: number;
      height: number;
    };
  }>;
}

/**
 * Video Generation Orchestrator
 * 
 * This service orchestrates the video generation process by:
 * 1. Managing the job queue
 * 2. Delegating to appropriate providers
 * 3. Handling job status updates
 * 4. Creating assets from generated videos
 */
export class VideoGenerationOrchestrator {
  private jobs: Map<string, VideoGenerationJob> = new Map();
  private queue: string[] = [];
  private providers: Map<string, VideoGenerationProvider> = new Map();
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs: number = 2;
  private assetCreationCallback?: (asset: Asset) => Promise<void>;
  
  /**
   * Register a video generation provider
   */
  public registerProvider(name: string, provider: VideoGenerationProvider): void {
    this.providers.set(name, provider);
  }
  
  /**
   * Set asset creation callback
   * This is called when a video asset is created
   */
  public setAssetCreationCallback(callback: (asset: Asset) => Promise<void>): void {
    this.assetCreationCallback = callback;
  }
  
  /**
   * Add a job to the queue
   */
  public addJob(job: VideoGenerationJob): VideoGenerationJob {
    // Store the job
    this.jobs.set(job.id, {
      ...job,
      status: 'queued',
    });
    
    // Add to queue based on priority
    // We'll use a simple approach for now - can be optimized later
    this.queue.push(job.id);
    this.queue.sort((a, b) => {
      const jobA = this.jobs.get(a);
      const jobB = this.jobs.get(b);
      return (jobB?.priority || 0) - (jobA?.priority || 0);
    });
    
    // Start processing if not already running
    this.processQueue();
    
    return job;
  }
  
  /**
   * Get a job by ID
   */
  public getJob(jobId: string): VideoGenerationJob | undefined {
    return this.jobs.get(jobId);
  }
  
  /**
   * Get all jobs
   */
  public getAllJobs(): VideoGenerationJob[] {
    return Array.from(this.jobs.values());
  }
  
  /**
   * Get jobs by status
   */
  public getJobsByStatus(status: VideoGenerationStatus): VideoGenerationJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }
  
  /**
   * Update a job's status
   */
  public updateJobStatus(
    jobId: string, 
    status: VideoGenerationStatus, 
    updates?: Partial<Omit<VideoGenerationJob, 'id' | 'status' | 'created'>>
  ): VideoGenerationJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    
    // Update the job
    const updatedJob: VideoGenerationJob = {
      ...job,
      status,
      ...updates,
    };
    
    // If job is completed or failed, set completed timestamp
    if (status === 'succeeded' || status === 'failed') {
      updatedJob.completed = new Date().toISOString();
      this.activeJobs.delete(jobId);
    }
    
    // If job is starting, set started timestamp
    if (status === 'processing' && !job.started) {
      updatedJob.started = new Date().toISOString();
    }
    
    // Store the updated job
    this.jobs.set(jobId, updatedJob);
    
    // If job is no longer in progress, process next job
    if (status !== 'processing' && this.activeJobs.has(jobId)) {
      this.activeJobs.delete(jobId);
      this.processQueue();
    }
    
    return updatedJob;
  }
  
  /**
   * Cancel a job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    
    // If the job is already completed or cancelled, do nothing
    if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
      return false;
    }
    
    // If the job is in the queue, remove it
    const queueIndex = this.queue.indexOf(jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }
    
    // Update the job status
    this.updateJobStatus(jobId, 'cancelled');
    this.activeJobs.delete(jobId);
    
    return true;
  }
  
  /**
   * Process the job queue
   * This starts processing jobs if slots are available
   */
  private processQueue(): void {
    // If there are no jobs in the queue, do nothing
    if (this.queue.length === 0) {
      return;
    }
    
    // If we're already at max capacity, do nothing
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return;
    }
    
    // Get the next job from the queue
    const nextJobId = this.queue.shift();
    if (!nextJobId) return;
    
    const job = this.jobs.get(nextJobId);
    if (!job) return;
    
    // Mark job as active
    this.activeJobs.add(nextJobId);
    
    // Update status to processing
    this.updateJobStatus(nextJobId, 'processing', {
      started: new Date().toISOString(),
    });
    
    // Process the job based on its type
    this.processJob(job).catch(error => {
      console.error(`Error processing job ${job.id}:`, error);
      this.updateJobStatus(job.id, 'failed', {
        error: error instanceof Error ? error.message : String(error),
        progress: 0
      });
      this.activeJobs.delete(job.id);
      this.processQueue(); // Process next job
    });
    
    // Check if we can process more jobs
    if (this.activeJobs.size < this.maxConcurrentJobs) {
      this.processQueue();
    }
  }
  
  /**
   * Process a specific job
   */
  private async processJob(job: VideoGenerationJob): Promise<void> {
    // For mock/demo purposes
    if (this.providers.size === 0) {
      await this.mockProcessJob(job);
      return;
    }
    
    // Choose a provider based on job type
    // In a real implementation, this would be more sophisticated
    const provider = this.getProviderForJob(job);
    if (!provider) {
      throw new Error(`No provider available for job type: ${job.type}`);
    }
    
    let result: any;
    
    // Process the job based on its type
    try {
      switch (job.type) {
        case 'image-to-video':
          result = await provider.generateImageToVideo(job.params as ImageToVideoParams);
          break;
          
        // Other job types would be implemented here
        
        default:
          throw new Error(`Unsupported job type: ${job.type}`);
      }
      
      // Create an asset from the generated video
      if (result && result.outputUrl) {
        const asset = await this.createVideoAsset(job, result);
        
        // Call the asset creation callback if set
        if (this.assetCreationCallback && asset) {
          await this.assetCreationCallback(asset);
        }
        
        // Update the job with the asset ID and output info
        this.updateJobStatus(job.id, 'succeeded', {
          outputUrl: result.outputUrl,
          outputThumbnailUrl: result.thumbnailUrl,
          outputMetadata: {
            duration: result.metadata.duration,
            fps: result.metadata.fps,
            width: result.metadata.width,
            height: result.metadata.height,
            format: 'mp4', // Assuming MP4 for now
          },
          progress: 100,
          assetId: asset?.id
        });
      } else {
        throw new Error('Provider did not return a valid result');
      }
    } catch (error) {
      // Handle job failure
      this.updateJobStatus(job.id, 'failed', {
        error: error instanceof Error ? error.message : String(error),
        progress: 0
      });
      throw error; // Re-throw to trigger queue processing
    }
  }
  
  /**
   * Get a suitable provider for a job
   */
  private getProviderForJob(job: VideoGenerationJob): VideoGenerationProvider | undefined {
    // For now, just return the first provider
    // In a real implementation, we would match based on capabilities, load, etc.
    return this.providers.values().next().value;
  }
  
  /**
   * Create a video asset from a generated video
   */
  private async createVideoAsset(
    job: VideoGenerationJob, 
    result: { 
      outputUrl: string;
      thumbnailUrl?: string;
      metadata: any;
    }
  ): Promise<Asset | undefined> {
    try {
      // Determine asset type and category
      let assetType: 'video' = 'video';
      let assetCategory: 'scene' | 'character' | 'export' = 'scene';
      
      if (job.type === 'character-animation') {
        assetCategory = 'character';
      }
      
      // Create a filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${job.type}_${job.id.substring(0, 8)}_${timestamp}.mp4`;
      
      // Create display name based on job type
      let displayName = `Generated ${job.type.replace(/-/g, ' ')}`;
      if (job.sceneId) {
        displayName += ` (Scene ${job.sceneId.substring(0, 8)})`;
      }
      
      // Create asset
      const asset = createPendingAsset({
        filename,
        displayName,
        type: assetType,
        category: assetCategory,
        mimeType: 'video/mp4',
        relatedEntityId: job.sceneId,
        relatedEntityType: job.sceneId ? 'scene' : undefined,
        tags: [job.type],
      });
      
      // Update with file info
      const updatedAsset = updateAssetFile(
        asset,
        `/videos/${assetCategory}/${filename}`,
        result.outputUrl,
        {
          width: result.metadata.width,
          height: result.metadata.height,
          duration: result.metadata.duration,
          framerate: result.metadata.fps,
          format: 'mp4',
          generated_by: job.type,
          generation_params: job.params
        },
        result.thumbnailUrl
      );
      
      return updatedAsset;
    } catch (error) {
      console.error('Failed to create video asset:', error);
      return undefined;
    }
  }
  
  /**
   * Mock process a job (for development/testing)
   */
  private async mockProcessJob(job: VideoGenerationJob): Promise<void> {
    // Simulate progress updates
    const updateInterval = setInterval(() => {
      const currentJob = this.jobs.get(job.id);
      if (!currentJob || currentJob.status !== 'processing') {
        clearInterval(updateInterval);
        return;
      }
      
      const newProgress = Math.min(95, (currentJob.progress || 0) + 10);
      this.updateJobStatus(job.id, 'processing', { progress: newProgress });
    }, 1000);
    
    // Simulate completion after some time
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    clearInterval(updateInterval);
    
    // Create a mock output URL
    const outputUrl = `mock://video/${job.id}.mp4`;
    const thumbnailUrl = `mock://thumbnail/${job.id}.jpg`;
    
    // Get dimensions based on params
    let width = 1920;
    let height = 1080;
    let duration = 5;
    
    if (job.type === 'image-to-video') {
      const params = job.params as ImageToVideoParams;
      width = params.outputWidth || 1920;
      height = params.outputHeight || 1080;
      duration = params.duration || 5;
    } else if (job.type === 'shot-generation') {
      const params = job.params as ShotGenerationParams;
      duration = params.duration || 5;
      
      // Parse resolution if available
      if (params.duration) {
        duration = params.duration;
      }
    }
    
    // Create an asset from the mock video
    const asset = await this.createVideoAsset(job, {
      outputUrl,
      thumbnailUrl,
      metadata: {
        duration,
        fps: 30,
        width,
        height,
      }
    });
    
    // Call the asset creation callback if set
    if (this.assetCreationCallback && asset) {
      await this.assetCreationCallback(asset);
    }
    
    // Update the job with the asset ID and output info
    this.updateJobStatus(job.id, 'succeeded', {
      outputUrl,
      outputThumbnailUrl: thumbnailUrl,
      outputMetadata: {
        duration,
        fps: 30,
        width,
        height,
        format: 'mp4'
      },
      progress: 100,
      assetId: asset?.id
    });
  }
}