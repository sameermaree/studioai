import { ExecutionQueueItem } from '../executionQueue';
import { BatchJob } from '../batchGenerator';

/**
 * Service for persisting queue data to local storage
 * 
 * This service allows saving and loading queue state across browser sessions
 */
export class QueuePersistenceService {
  private storagePrefix = 'comfyui_queue_';
  private batchPrefix = 'comfyui_batch_';
  private queueStateKey = 'comfyui_queue_state';
  private batchStateKey = 'comfyui_batch_state';
  
  /**
   * Save an execution queue item to local storage
   */
  public saveQueueItem(item: ExecutionQueueItem): void {
    try {
      const key = `${this.storagePrefix}${item.id}`;
      const serialized = JSON.stringify(this.sanitizeQueueItem(item));
      localStorage.setItem(key, serialized);
      
      // Update queue state index
      this.updateQueueState(item.id, 'add');
    } catch (error) {
      console.error('Failed to save queue item to local storage:', error);
    }
  }
  
  /**
   * Load an execution queue item from local storage
   */
  public loadQueueItem(id: string): ExecutionQueueItem | null {
    try {
      const key = `${this.storagePrefix}${id}`;
      const serialized = localStorage.getItem(key);
      
      if (!serialized) {
        return null;
      }
      
      return JSON.parse(serialized) as ExecutionQueueItem;
    } catch (error) {
      console.error(`Failed to load queue item ${id} from local storage:`, error);
      return null;
    }
  }
  
  /**
   * Remove an execution queue item from local storage
   */
  public removeQueueItem(id: string): void {
    try {
      const key = `${this.storagePrefix}${id}`;
      localStorage.removeItem(key);
      
      // Update queue state index
      this.updateQueueState(id, 'remove');
    } catch (error) {
      console.error(`Failed to remove queue item ${id} from local storage:`, error);
    }
  }
  
  /**
   * Save a batch job to local storage
   */
  public saveBatchJob(batch: BatchJob): void {
    try {
      const key = `${this.batchPrefix}${batch.id}`;
      const serialized = JSON.stringify(this.sanitizeBatchJob(batch));
      localStorage.setItem(key, serialized);
      
      // Update batch state index
      this.updateBatchState(batch.id, 'add');
    } catch (error) {
      console.error('Failed to save batch job to local storage:', error);
    }
  }
  
  /**
   * Load a batch job from local storage
   */
  public loadBatchJob(id: string): BatchJob | null {
    try {
      const key = `${this.batchPrefix}${id}`;
      const serialized = localStorage.getItem(key);
      
      if (!serialized) {
        return null;
      }
      
      return JSON.parse(serialized) as BatchJob;
    } catch (error) {
      console.error(`Failed to load batch job ${id} from local storage:`, error);
      return null;
    }
  }
  
  /**
   * Remove a batch job from local storage
   */
  public removeBatchJob(id: string): void {
    try {
      const key = `${this.batchPrefix}${id}`;
      localStorage.removeItem(key);
      
      // Update batch state index
      this.updateBatchState(id, 'remove');
    } catch (error) {
      console.error(`Failed to remove batch job ${id} from local storage:`, error);
    }
  }
  
  /**
   * Get all queue item IDs from local storage
   */
  public getAllQueueItemIds(): string[] {
    try {
      const state = localStorage.getItem(this.queueStateKey);
      
      if (!state) {
        return [];
      }
      
      return JSON.parse(state) as string[];
    } catch (error) {
      console.error('Failed to get queue state from local storage:', error);
      return [];
    }
  }
  
  /**
   * Get all batch job IDs from local storage
   */
  public getAllBatchJobIds(): string[] {
    try {
      const state = localStorage.getItem(this.batchStateKey);
      
      if (!state) {
        return [];
      }
      
      return JSON.parse(state) as string[];
    } catch (error) {
      console.error('Failed to get batch state from local storage:', error);
      return [];
    }
  }
  
  /**
   * Load all queue items from local storage
   */
  public loadAllQueueItems(): ExecutionQueueItem[] {
    const ids = this.getAllQueueItemIds();
    const items: ExecutionQueueItem[] = [];
    
    for (const id of ids) {
      const item = this.loadQueueItem(id);
      if (item) {
        items.push(item);
      }
    }
    
    return items;
  }
  
  /**
   * Load all batch jobs from local storage
   */
  public loadAllBatchJobs(): BatchJob[] {
    const ids = this.getAllBatchJobIds();
    const batches: BatchJob[] = [];
    
    for (const id of ids) {
      const batch = this.loadBatchJob(id);
      if (batch) {
        batches.push(batch);
      }
    }
    
    return batches;
  }
  
  /**
   * Clear all queue items from local storage
   */
  public clearAllQueueItems(): void {
    const ids = this.getAllQueueItemIds();
    
    for (const id of ids) {
      this.removeQueueItem(id);
    }
    
    localStorage.removeItem(this.queueStateKey);
  }
  
  /**
   * Clear all batch jobs from local storage
   */
  public clearAllBatchJobs(): void {
    const ids = this.getAllBatchJobIds();
    
    for (const id of ids) {
      this.removeBatchJob(id);
    }
    
    localStorage.removeItem(this.batchStateKey);
  }
  
  /**
   * Update the queue state index
   */
  private updateQueueState(id: string, action: 'add' | 'remove'): void {
    try {
      const state = localStorage.getItem(this.queueStateKey);
      let ids: string[] = state ? JSON.parse(state) : [];
      
      if (action === 'add' && !ids.includes(id)) {
        ids.push(id);
      } else if (action === 'remove') {
        ids = ids.filter(itemId => itemId !== id);
      }
      
      localStorage.setItem(this.queueStateKey, JSON.stringify(ids));
    } catch (error) {
      console.error('Failed to update queue state:', error);
    }
  }
  
  /**
   * Update the batch state index
   */
  private updateBatchState(id: string, action: 'add' | 'remove'): void {
    try {
      const state = localStorage.getItem(this.batchStateKey);
      let ids: string[] = state ? JSON.parse(state) : [];
      
      if (action === 'add' && !ids.includes(id)) {
        ids.push(id);
      } else if (action === 'remove') {
        ids = ids.filter(batchId => batchId !== id);
      }
      
      localStorage.setItem(this.batchStateKey, JSON.stringify(ids));
    } catch (error) {
      console.error('Failed to update batch state:', error);
    }
  }
  
  /**
   * Sanitize a queue item for storage
   * Removes circular references and non-serializable fields
   */
  private sanitizeQueueItem(item: ExecutionQueueItem): any {
    // Create a sanitized copy
    const sanitized = { ...item };
    
    // Remove non-serializable properties
    delete sanitized.callbacks;
    
    // Keep only essential job and asset info
    if (sanitized.job) {
      sanitized.job = {
        id: sanitized.job.id,
        type: sanitized.job.type,
        status: sanitized.job.status,
        progress: sanitized.job.progress,
        created_at: sanitized.job.created_at
      };
    }
    
    if (sanitized.asset) {
      sanitized.asset = {
        id: sanitized.asset.id,
        filename: sanitized.asset.filename,
        display_name: sanitized.asset.display_name,
        type: sanitized.asset.type,
        status: sanitized.asset.status,
        url: sanitized.asset.url
      };
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize a batch job for storage
   * Removes circular references and non-serializable fields
   */
  private sanitizeBatchJob(batch: BatchJob): any {
    // Create a sanitized copy
    const sanitized = { ...batch };
    
    // Sanitize jobs array
    if (sanitized.jobs && sanitized.jobs.length) {
      sanitized.jobs = sanitized.jobs.map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        created_at: job.created_at
      }));
    }
    
    // Sanitize assets array
    if (sanitized.assets && sanitized.assets.length) {
      sanitized.assets = sanitized.assets.map(asset => ({
        id: asset.id,
        filename: asset.filename,
        display_name: asset.display_name,
        type: asset.type,
        status: asset.status,
        url: asset.url
      }));
    }
    
    return sanitized;
  }
}