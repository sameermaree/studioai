import { BrowserEventEmitter } from '../../lib/BrowserEventEmitter';
import { Job, createJob } from '../../domain/rendering/entities/Job';
import { Asset } from '../../domain/assets/entities/Asset';
import { ComfyUIService } from './index';
import { ExecutionQueue, ExecutionQueueItem } from './executionQueue';

export interface BatchJobProgress {
  jobId: string;
  progress: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  index: number;
  total: number;
  result?: any;
  error?: string;
}

export interface BatchProgress {
  id: string;
  name: string;
  overallProgress: number;
  jobs: BatchJobProgress[];
  startTime?: Date;
  endTime?: Date;
  isComplete: boolean;
  isCancelled: boolean;
  error?: string;
}
export interface BatchGenerationConfig {
  name: string;
  description?: string;
  prompts: string[];
  type: 'image' | 'video' | 'upscale' | 'img2img' | 'img2vid';
  templateId?: string;
  common?: {
    negativePrompt?: string;
    width?: number;
    height?: number;
    seed?: number;
    steps?: number;
    cfgScale?: number;
    fps?: number; // For videos
    duration?: number; // For videos
  };
  variations?: Record<number, {
    prompt?: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    seed?: number;
    imageUrl?: string; // For img2img and img2vid
    [key: string]: any;
  }>;
  assetOptions?: {
    displayNamePrefix?: string;
    category?: string;
    tags?: string[];
    relatedEntityId?: string;
    relatedEntityType?: string;
  };
  dependencies?: string[]; // IDs of batches this depends on
}

export interface BatchJob {
  id: string;
  name: string;
  config: BatchGenerationConfig;
  progress: BatchProgress;
  jobs: Job[];
  assets: Asset[];
  created_at: string;
  created_by: string;
  dependencies: string[];
  dependents: string[];
  parentBatchId?: string;
}

/**
 * Service for batch generation of images and videos
 */
export class BatchGenerator extends BrowserEventEmitter {
  private comfyService: ComfyUIService;
  private batches: Map<string, BatchJob> = new Map();
  private activeBatchIds: Set<string> = new Set();
  private batchQueue: string[] = [];
  private isProcessingQueue = false;
  private maxConcurrentBatches: number;
  private listeners: Map<string, any> = new Map();
  
  constructor(
    comfyService: ComfyUIService,
    options?: {
      maxConcurrentBatches?: number;
    }
  ) {
    super();
    this.comfyService = comfyService;
    this.maxConcurrentBatches = options?.maxConcurrentBatches || 2;
  }
  
  /**
   * Create a new batch generation job
   */
  public createBatch(config: BatchGenerationConfig, createdBy: string = 'system'): BatchJob {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Initialize batch progress
    const progress: BatchProgress = {
      id,
      name: config.name,
      overallProgress: 0,
      jobs: [],
      isComplete: false,
      isCancelled: false
    };
    
    // Initialize each job's progress
    for (let i = 0; i < config.prompts.length; i++) {
      progress.jobs.push({
        jobId: `${id}_${i}`,
        progress: 0,
        status: 'queued',
        index: i,
        total: config.prompts.length
      });
    }
    
    // Create batch job
    const batchJob: BatchJob = {
      id,
      name: config.name,
      config,
      progress,
      jobs: [],
      assets: [],
      created_at: now,
      created_by: createdBy,
      dependencies: config.dependencies || [],
      dependents: []
    };
    
    // Store the batch
    this.batches.set(id, batchJob);
    
    // Update dependencies
    for (const depId of batchJob.dependencies) {
      const depBatch = this.batches.get(depId);
      if (depBatch) {
        depBatch.dependents.push(id);
      }
    }
    
    // Emit creation event
    this.emit('batchCreated', { id, config });
    
    return batchJob;
  }
  
  /**
   * Get a batch by ID
   */
  public getBatch(id: string): BatchJob | undefined {
    return this.batches.get(id);
  }
  
  /**
   * Get all batches
   */
  public getAllBatches(): BatchJob[] {
    return Array.from(this.batches.values());
  }
  
  /**
   * Start a batch generation
   */
  public async startBatch(id: string): Promise<void> {
    const batch = this.batches.get(id);
    
    if (!batch) {
      throw new Error(`Batch with ID ${id} not found`);
    }
    
    // Check if batch has dependencies
    const canStart = await this.checkDependencies(batch);
    
    if (!canStart) {
      // Add to queue to be processed when dependencies are met
      this.queueBatch(id);
      return;
    }
    
    // Check if we can start another batch
    if (this.activeBatchIds.size >= this.maxConcurrentBatches) {
      // Add to queue
      this.queueBatch(id);
      return;
    }
    
    // Mark batch as active
    this.activeBatchIds.add(id);
    
    // Set start time
    batch.progress.startTime = new Date();
    
    // Process the batch
    this.processBatch(batch)
      .catch(error => {
        console.error(`Error processing batch ${id}:`, error);
        
        // Mark batch as failed
        batch.progress.error = error instanceof Error ? error.message : String(error);
        batch.progress.isComplete = true;
        this.emit('batchFailed', { id, error });
        
        // Clean up
        this.activeBatchIds.delete(id);
        this.processQueue();
      });
  }
  
  /**
   * Queue a batch for processing
   */
  private queueBatch(id: string): void {
    if (!this.batchQueue.includes(id)) {
      this.batchQueue.push(id);
      
      // Sort queue based on dependencies
      this.sortQueue();
      
      this.emit('batchQueued', { id, position: this.batchQueue.indexOf(id) + 1 });
    }
  }
  
  /**
   * Process the batch queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.batchQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Check if we can start any batches
      while (this.batchQueue.length > 0 && this.activeBatchIds.size < this.maxConcurrentBatches) {
        const batchId = this.batchQueue[0];
        const batch = this.batches.get(batchId);
        
        if (!batch) {
          // Remove invalid batch from queue
          this.batchQueue.shift();
          continue;
        }
        
        // Check if batch can start (dependencies met)
        const canStart = await this.checkDependencies(batch);
        
        if (canStart) {
          // Remove from queue
          this.batchQueue.shift();
          
          // Start batch
          this.activeBatchIds.add(batchId);
          batch.progress.startTime = new Date();
          
          // Process the batch
          this.processBatch(batch)
            .catch(error => {
              console.error(`Error processing batch ${batchId}:`, error);
              
              // Mark batch as failed
              batch.progress.error = error instanceof Error ? error.message : String(error);
              batch.progress.isComplete = true;
              this.emit('batchFailed', { id: batchId, error });
              
              // Clean up
              this.activeBatchIds.delete(batchId);
              this.processQueue();
            });
        } else {
          // Can't start yet, leave it in queue and try next batch
          const nextBatchId = this.batchQueue[1];
          
          if (!nextBatchId) {
            // No more batches to try
            break;
          }
          
          // Move this batch later in the queue
          this.batchQueue.shift();
          this.batchQueue.push(batchId);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  /**
   * Check if a batch's dependencies are met
   */
  private async checkDependencies(batch: BatchJob): Promise<boolean> {
    if (!batch.dependencies || batch.dependencies.length === 0) {
      return true;
    }
    
    // Check each dependency
    for (const depId of batch.dependencies) {
      const depBatch = this.batches.get(depId);
      
      if (!depBatch) {
        console.warn(`Dependency batch ${depId} not found for batch ${batch.id}`);
        continue;
      }
      
      // If dependency is not complete, we can't start
      if (!depBatch.progress.isComplete || depBatch.progress.isCancelled) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Process a batch generation
   */
  private async processBatch(batch: BatchJob): Promise<void> {
    // Emit started event
    this.emit('batchStarted', { id: batch.id, name: batch.name });
    
    // Set up change tracking
    let totalProgress = 0;
    let completedCount = 0;
    let failedCount = 0;
    
    const { config, progress } = batch;
    const generationType = this.getGenerationType(config.type);
    
    // Process each prompt in sequence
    for (let i = 0; i < config.prompts.length; i++) {
      // If batch was cancelled, stop processing
      if (progress.isCancelled) {
        break;
      }
      
      const jobProgress = progress.jobs[i];
      jobProgress.status = 'processing';
      
      // Get prompt and parameters
      const prompt = config.variations?.[i]?.prompt || config.prompts[i];
      const params = this.buildParameters(config, i);
      
      try {
        // Generate based on type
        let result;
        
        if (generationType === 'image') {
          result = await this.comfyService.generateImage(prompt, params);
        } else if (generationType === 'video') {
          result = await this.comfyService.generateVideo(prompt, params);
        } else {
          throw new Error(`Unsupported generation type: ${generationType}`);
        }
        
        // Store the result
        batch.jobs.push(result.job);
        batch.assets.push(result.asset);
        
        // Update progress
        jobProgress.status = 'completed';
        jobProgress.progress = 100;
        jobProgress.result = result;
        completedCount++;
        
        // Emit job completion event
        this.emit('batchItemCompleted', { 
          batchId: batch.id, 
          jobIndex: i, 
          result 
        });
      } catch (error) {
        console.error(`Error processing batch item ${i} in batch ${batch.id}:`, error);
        
        // Update progress
        jobProgress.status = 'failed';
        jobProgress.progress = 0;
        jobProgress.error = error instanceof Error ? error.message : String(error);
        failedCount++;
        
        // Emit job failure event
        this.emit('batchItemFailed', {
          batchId: batch.id,
          jobIndex: i,
          error
        });
      }
      
      // Recalculate overall progress
      totalProgress = Math.round(
        (completedCount * 100 + failedCount * 100) / config.prompts.length
      );
      progress.overallProgress = totalProgress;
      
      // Emit progress event
      this.emit('batchProgress', { 
        id: batch.id, 
        progress: totalProgress,
        completedCount,
        failedCount,
        totalCount: config.prompts.length
      });
    }
    
    // Mark batch as complete
    progress.isComplete = true;
    progress.endTime = new Date();
    
    // Emit completion event
    this.emit('batchCompleted', { 
      id: batch.id,
      completedCount,
      failedCount,
      totalCount: config.prompts.length
    });
    
    // Clean up
    this.activeBatchIds.delete(batch.id);
    
    // Check if this batch has dependents to start
    this.processDependents(batch.id);
    
    // Process next batch in queue
    this.processQueue();
  }
  
  /**
   * Process any batches that depend on the completed batch
   */
  private processDependents(batchId: string): void {
    const batch = this.batches.get(batchId);
    
    if (!batch || !batch.dependents.length) {
      return;
    }
    
    // For each dependent, check if it's in the queue and can be started
    for (const depId of batch.dependents) {
      if (this.batchQueue.includes(depId)) {
        const position = this.batchQueue.indexOf(depId);
        if (position > 0) {
          // Move to front of queue if possible
          this.batchQueue.splice(position, 1);
          this.batchQueue.unshift(depId);
        }
      }
    }
    
    // Process queue to start any ready batches
    this.processQueue();
  }
  
  /**
   * Cancel a batch generation
   */
  public cancelBatch(id: string): boolean {
    const batch = this.batches.get(id);
    
    if (!batch) {
      return false;
    }
    
    // Mark as cancelled
    batch.progress.isCancelled = true;
    batch.progress.endTime = new Date();
    
    // Remove from queue if present
    const queueIndex = this.batchQueue.indexOf(id);
    if (queueIndex >= 0) {
      this.batchQueue.splice(queueIndex, 1);
    }
    
    // If active, it will stop after the current job completes
    
    // Emit cancelled event
    this.emit('batchCancelled', { id });
    
    return true;
  }
  
  /**
   * Delete a batch
   */
  public deleteBatch(id: string): boolean {
    // Can't delete active batches
    if (this.activeBatchIds.has(id)) {
      return false;
    }
    
    const batch = this.batches.get(id);
    
    if (!batch) {
      return false;
    }
    
    // Remove from queue if present
    const queueIndex = this.batchQueue.indexOf(id);
    if (queueIndex >= 0) {
      this.batchQueue.splice(queueIndex, 1);
    }
    
    // Remove from dependents lists
    for (const depId of batch.dependencies) {
      const depBatch = this.batches.get(depId);
      if (depBatch) {
        const index = depBatch.dependents.indexOf(id);
        if (index >= 0) {
          depBatch.dependents.splice(index, 1);
        }
      }
    }
    
    // Remove batch
    this.batches.delete(id);
    
    // Emit deleted event
    this.emit('batchDeleted', { id });
    
    return true;
  }
  
  /**
   * Sort the queue based on dependencies
   */
  private sortQueue(): void {
    // Simple topological sort
    const visited = new Set<string>();
    const sorted: string[] = [];
    
    // For each batch in the queue
    for (const batchId of this.batchQueue) {
      if (!visited.has(batchId)) {
        this.visitBatch(batchId, visited, sorted);
      }
    }
    
    // Update the queue
    this.batchQueue = sorted;
  }
  
  /**
   * Visit a batch for topological sorting
   */
  private visitBatch(batchId: string, visited: Set<string>, sorted: string[]): void {
    visited.add(batchId);
    
    const batch = this.batches.get(batchId);
    
    if (batch && batch.dependencies) {
      // Visit dependencies first
      for (const depId of batch.dependencies) {
        if (this.batchQueue.includes(depId) && !visited.has(depId)) {
          this.visitBatch(depId, visited, sorted);
        }
      }
    }
    
    sorted.push(batchId);
  }
  
  /**
   * Build parameters for a specific batch item
   */
  private buildParameters(config: BatchGenerationConfig, index: number): any {
    const common = config.common || {};
    const variation = config.variations?.[index] || {};
    const generationType = this.getGenerationType(config.type);
    
    // Base parameters
    const baseParams: any = {
      negativePrompt: variation.negativePrompt || common.negativePrompt || '',
      width: variation.width || common.width || 512,
      height: variation.height || common.height || 512,
      seed: variation.seed || common.seed,
      templateId: config.templateId,
      assetDisplayName: `${config.assetOptions?.displayNamePrefix || config.name} ${index + 1}`,
      assetCategory: config.assetOptions?.category || 'scene',
      assetTags: [...(config.assetOptions?.tags || []), config.type],
      relatedEntityId: config.assetOptions?.relatedEntityId,
      relatedEntityType: config.assetOptions?.relatedEntityType,
      parameters: {}
    };
    
    // Add type-specific parameters
    if (generationType === 'video') {
      baseParams.durationSeconds = variation.duration || common.duration || 5;
      baseParams.fps = variation.fps || common.fps || 24;
    }
    
    // For img2img and img2vid, add image URL
    if (config.type === 'img2img' || config.type === 'img2vid' || config.type === 'upscale') {
      baseParams.parameters.image_url = variation.imageUrl;
      
      if (!baseParams.parameters.image_url) {
        throw new Error(`Image URL is required for ${config.type} batch item ${index}`);
      }
    }
    
    // Add other parameters
    for (const [key, value] of Object.entries(variation)) {
      if (!['prompt', 'negativePrompt', 'width', 'height', 'seed', 'fps', 'duration', 'imageUrl'].includes(key)) {
        baseParams.parameters[key] = value;
      }
    }
    
    // Add callbacks for progress tracking
    baseParams.callbacks = {
      onProgress: (progress: number) => {
        const jobProgress = config.progress?.jobs?.[index];
        if (jobProgress) {
          jobProgress.progress = progress;
          
          // Emit progress event
          this.emit('batchItemProgress', {
            batchId: config.id,
            jobIndex: index,
            progress
          });
        }
      },
      onSuccess: (result: any) => {
        // Success is handled in the processBatch method
      },
      onError: (error: any) => {
        // Error is handled in the processBatch method
      }
    };
    
    return baseParams;
  }
  
  /**
   * Map configuration type to generation type
   */
  private getGenerationType(type: string): 'image' | 'video' {
    if (type === 'image' || type === 'txt2img' || type === 'img2img' || type === 'upscale') {
      return 'image';
    } else if (type === 'video' || type === 'txt2vid' || type === 'img2vid') {
      return 'video';
    }
    
    throw new Error(`Unsupported batch type: ${type}`);
  }
}