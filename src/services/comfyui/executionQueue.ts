import { Job, updateJobProgress, completeJob, failJob } from "../../domain/rendering/entities/Job";
import { Asset, updateAssetFile, failAsset } from "../../domain/assets/entities/Asset";
import { ComfyUIHealthCheck } from "./healthCheck";
import { ComfyUIProvider } from "../../infrastructure/ai/providers/ComfyUIProvider";

export interface ExecutionQueueItem {
  id: string;
  priority: number;
  jobId?: string;
  assetId?: string;
  job?: Job;
  asset?: Asset;
  parameters: Record<string, any>;
  workflowPath: string;
  outputNodeId?: string;
  callbacks?: {
    onProgress?: (progress: number) => void;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
  };
  executionStartTime?: number;
  attempts: number;
  maxAttempts: number;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
}

/**
 * Service for managing ComfyUI execution queue
 * 
 * This service handles the queueing, execution, and
 * error handling for ComfyUI workflow executions.
 */
export class ExecutionQueue {
  private queue: ExecutionQueueItem[] = [];
  private runningItems: Map<string, ExecutionQueueItem> = new Map();
  private completedItems: ExecutionQueueItem[] = [];
  private failedItems: ExecutionQueueItem[] = [];
  private isProcessing = false;
  private maxConcurrent: number;
  private provider: ComfyUIProvider;
  private healthCheck: ComfyUIHealthCheck;
  private processingTimes: number[] = [];
  private autoRetry: boolean;
  private paused: boolean = false;
  private statusListeners: ((stats: QueueStats) => void)[] = [];

  constructor(
    provider: ComfyUIProvider,
    healthCheck: ComfyUIHealthCheck,
    options?: {
      maxConcurrent?: number;
      autoRetry?: boolean;
    }
  ) {
    this.provider = provider;
    this.healthCheck = healthCheck;
    this.maxConcurrent = options?.maxConcurrent || 1;
    this.autoRetry = options?.autoRetry !== false;
    
    // Set up health check listener to resume queue when ComfyUI comes back online
    this.healthCheck.addStatusListener((status) => {
      if (status.available && this.paused) {
        this.resumeProcessing();
      }
    });
  }

  /**
   * Add an item to the queue
   */
  public enqueue(
    item: Omit<ExecutionQueueItem, 'id' | 'attempts' | 'maxAttempts'> & 
    { attempts?: number; maxAttempts?: number; }
  ): string {
    const id = crypto.randomUUID();
    
    const queueItem: ExecutionQueueItem = {
      id,
      priority: item.priority || 0,
      jobId: item.jobId,
      assetId: item.assetId,
      job: item.job,
      asset: item.asset,
      parameters: item.parameters || {},
      workflowPath: item.workflowPath,
      outputNodeId: item.outputNodeId,
      callbacks: item.callbacks,
      attempts: item.attempts || 0,
      maxAttempts: item.maxAttempts || 3
    };
    
    // Add to queue and sort by priority (highest first)
    this.queue.push(queueItem);
    this.sortQueue();
    
    // Start processing if not already running
    if (!this.isProcessing && !this.paused) {
      this.processQueue();
    }
    
    // Notify listeners of queue update
    this.notifyQueueUpdate();
    
    return id;
  }

  /**
   * Pause queue processing
   */
  public pauseProcessing(): void {
    this.paused = true;
  }

  /**
   * Resume queue processing
   */
  public resumeProcessing(): void {
    if (!this.paused) {
      return;
    }
    
    this.paused = false;
    
    // Start processing if there are items in the queue
    if (this.queue.length > 0 && !this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Cancel an item in the queue
   */
  public cancelItem(id: string): boolean {
    // Find in pending queue
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.queue[index];
      this.queue.splice(index, 1);
      
      // Call error callback if present
      if (item.callbacks?.onError) {
        item.callbacks.onError(new Error('Execution cancelled'));
      }
      
      // Fail the job if present
      if (item.job) {
        failJob(item.job, 'Execution cancelled by user');
      }
      
      // Fail the asset if present
      if (item.asset) {
        failAsset(item.asset, 'Execution cancelled by user');
      }
      
      // Notify listeners of queue update
      this.notifyQueueUpdate();
      
      return true;
    }
    
    // Can't cancel running items with current ComfyUI implementation
    if (this.runningItems.has(id)) {
      console.warn('Cannot cancel running ComfyUI executions');
      return false;
    }
    
    return false;
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): QueueStats {
    // Calculate average processing time
    const avgTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;
    
    return {
      pending: this.queue.length,
      running: this.runningItems.size,
      completed: this.completedItems.length,
      failed: this.failedItems.length,
      totalProcessed: this.completedItems.length + this.failedItems.length,
      averageProcessingTime: avgTime
    };
  }

  /**
   * Get all items in the queue
   */
  public getQueueItems(): ExecutionQueueItem[] {
    return [...this.queue];
  }

  /**
   * Get currently running items
   */
  public getRunningItems(): ExecutionQueueItem[] {
    return Array.from(this.runningItems.values());
  }

  /**
   * Add a queue status listener
   */
  public addStatusListener(listener: (stats: QueueStats) => void): void {
    this.statusListeners.push(listener);
    
    // Call immediately with current status
    listener(this.getQueueStats());
  }

  /**
   * Remove a queue status listener
   */
  public removeStatusListener(listener: (stats: QueueStats) => void): void {
    const index = this.statusListeners.indexOf(listener);
    if (index !== -1) {
      this.statusListeners.splice(index, 1);
    }
  }

  /**
   * Clear completed and failed items
   */
  public clearHistory(): void {
    this.completedItems = [];
    this.failedItems = [];
    this.notifyQueueUpdate();
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    // Skip if paused, already processing, or no items in queue
    if (this.paused || this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    // Skip if max concurrent items already running
    if (this.runningItems.size >= this.maxConcurrent) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Check if ComfyUI is available
      if (!this.healthCheck.isAvailable()) {
        await this.healthCheck.checkHealth();
        
        if (!this.healthCheck.isAvailable()) {
          console.warn('ComfyUI is not available, pausing queue:', this.healthCheck.getUnavailabilityReason());
          this.pauseProcessing();
          this.isProcessing = false;
          return;
        }
      }
      
      // Get the next item from the queue
      const item = this.queue.shift();
      
      if (!item) {
        this.isProcessing = false;
        return;
      }
      
      // Update job progress if present
      if (item.job) {
        updateJobProgress(item.job, 10);
        
        if (item.callbacks?.onProgress) {
          item.callbacks.onProgress(10);
        }
      }
      
      // Add to running items
      item.executionStartTime = Date.now();
      item.attempts += 1;
      this.runningItems.set(item.id, item);
      
      // Notify listeners of queue update
      this.notifyQueueUpdate();
      
      // Process the item
      this.executeItem(item)
        .then(() => {
          // Calculate processing time and record it
          if (item.executionStartTime) {
            const processingTime = Date.now() - item.executionStartTime;
            this.processingTimes.push(processingTime);
            
            // Keep only the last 50 processing times to avoid memory bloat
            if (this.processingTimes.length > 50) {
              this.processingTimes.shift();
            }
          }
          
          // Remove from running items and add to completed
          this.runningItems.delete(item.id);
          this.completedItems.push(item);
          
          // Notify listeners of queue update
          this.notifyQueueUpdate();
        })
        .catch(error => {
          console.error(`Error executing item ${item.id}:`, error);
          
          // Remove from running items
          this.runningItems.delete(item.id);
          
          // Check if we should retry
          if (this.autoRetry && item.attempts < item.maxAttempts) {
            console.log(`Retrying item ${item.id} (attempt ${item.attempts + 1} of ${item.maxAttempts})`);
            
            // Add back to queue with increased attempts
            this.queue.unshift(item);
          } else {
            // Add to failed items
            this.failedItems.push(item);
            
            // Call error callback if present
            if (item.callbacks?.onError) {
              item.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
            }
            
            // Fail the job if present
            if (item.job) {
              failJob(item.job, error instanceof Error ? error.message : String(error));
            }
            
            // Fail the asset if present
            if (item.asset) {
              failAsset(item.asset, error instanceof Error ? error.message : String(error));
            }
          }
          
          // Notify listeners of queue update
          this.notifyQueueUpdate();
        })
        .finally(() => {
          // Continue processing queue
          this.isProcessing = false;
          
          // Check if we can process more items
          if (this.runningItems.size < this.maxConcurrent && this.queue.length > 0 && !this.paused) {
            this.processQueue();
          }
        });
      
      // Continue processing if we can run more concurrent items
      if (this.runningItems.size < this.maxConcurrent && this.queue.length > 0) {
        this.isProcessing = false;
        this.processQueue();
      } else {
        this.isProcessing = false;
      }
    } catch (error) {
      console.error('Error processing queue:', error);
      this.isProcessing = false;
      
      // Pause processing on critical errors
      if (error instanceof Error && error.message.includes('connection')) {
        console.warn('Connection error in queue processing, pausing queue');
        this.pauseProcessing();
      }
    }
  }

  /**
   * Execute a queue item
   */
  private async executeItem(item: ExecutionQueueItem): Promise<void> {
    // Update progress
    if (item.job) {
      updateJobProgress(item.job, 20);
      
      if (item.callbacks?.onProgress) {
        item.callbacks.onProgress(20);
      }
    }
    
    try {
      // Determine if this is an image or video generation
      const isVideoGeneration = item.parameters.fps !== undefined || 
        item.parameters.duration !== undefined ||
        item.workflowPath.includes('vid');
      
      let result;
      
      if (isVideoGeneration) {
        // Execute video generation
        result = await this.provider.generateVideo(
          item.parameters.prompt || '',
          {
            negativePrompt: item.parameters.negative_prompt,
            width: item.parameters.width,
            height: item.parameters.height,
            durationSeconds: item.parameters.duration || 5,
            fps: item.parameters.fps || 24,
            seed: item.parameters.seed,
            workflowPath: item.workflowPath,
            outputNodeId: item.outputNodeId,
            workflowInputs: item.parameters
          }
        );
      } else {
        // Execute image generation
        result = await this.provider.generateImage(
          item.parameters.prompt || '',
          {
            negativePrompt: item.parameters.negative_prompt,
            width: item.parameters.width,
            height: item.parameters.height,
            seed: item.parameters.seed,
            workflowPath: item.workflowPath,
            outputNodeId: item.outputNodeId,
            workflowInputs: item.parameters
          }
        );
      }
      
      // Update progress
      if (item.job) {
        updateJobProgress(item.job, 80);
        
        if (item.callbacks?.onProgress) {
          item.callbacks.onProgress(80);
        }
      }
      
      // Update job with result
      if (item.job) {
        completeJob(item.job, {
          output_url: result.url,
          metadata: result.metadata
        });
      }
      
      // Update asset if present
      if (item.asset) {
        updateAssetFile(
          item.asset,
          item.asset.path || '',
          result.url,
          result.metadata
        );
      }
      
      // Final progress update
      if (item.callbacks?.onProgress) {
        item.callbacks.onProgress(100);
      }
      
      // Call success callback if present
      if (item.callbacks?.onSuccess) {
        item.callbacks.onSuccess(result);
      }
    } catch (error) {
      console.error(`Error executing workflow for item ${item.id}:`, error);
      throw error;
    }
  }

  /**
   * Sort the queue by priority
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Notify listeners of queue updates
   */
  private notifyQueueUpdate(): void {
    const stats = this.getQueueStats();
    for (const listener of this.statusListeners) {
      try {
        listener(stats);
      } catch (error) {
        console.error('Error in queue status listener:', error);
      }
    }
  }
}