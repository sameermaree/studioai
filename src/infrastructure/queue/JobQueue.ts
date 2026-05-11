import { Job, JobStatus, updateJobStatus } from "../../domain/rendering/entities/Job";

export interface JobProcessor<T extends Job = Job> {
  processJob(job: T): Promise<T>;
}

export interface JobRepository<T extends Job = Job> {
  getById(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  getByStatus(status: JobStatus): Promise<T[]>;
  save(job: T): Promise<T>;
  update(job: T): Promise<T>;
  delete(id: string): Promise<void>;
}

export class JobQueue<T extends Job = Job> {
  private isProcessing = false;
  private maxConcurrent: number;
  private processors: Map<string, JobProcessor<T>> = new Map();
  
  constructor(
    private repository: JobRepository<T>,
    maxConcurrent = 2
  ) {
    this.maxConcurrent = maxConcurrent;
  }
  
  /**
   * Register a job processor for a specific job type
   */
  registerProcessor(jobType: string, processor: JobProcessor<T>): void {
    this.processors.set(jobType, processor);
  }
  
  /**
   * Add a job to the queue
   */
  async enqueue(job: T): Promise<T> {
    // Save job to repository
    const savedJob = await this.repository.save(job);
    
    // Start processing the queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return savedJob;
  }
  
  /**
   * Process the next jobs in the queue
   */
  async processQueue(): Promise<void> {
    // Prevent concurrent queue processing
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Get active jobs count
      const runningJobs = await this.repository.getByStatus('running');
      
      // If we're at max capacity, return
      if (runningJobs.length >= this.maxConcurrent) {
        this.isProcessing = false;
        return;
      }
      
      // Get pending jobs
      const pendingJobs = await this.repository.getByStatus('pending');
      
      // Sort by priority and creation date
      const sortedJobs = pendingJobs.sort((a, b) => {
        // First sort by priority
        const priorityMap: Record<string, number> = {
          'critical': 0,
          'high': 1,
          'medium': 2,
          'low': 3
        };
        
        const priorityDiff = 
          (priorityMap[a.priority] || 999) - 
          (priorityMap[b.priority] || 999);
          
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        // Then sort by creation date
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      
      // Calculate how many jobs we can start
      const availableSlots = Math.max(0, this.maxConcurrent - runningJobs.length);
      const jobsToProcess = sortedJobs.slice(0, availableSlots);
      
      // Start processing jobs
      for (const job of jobsToProcess) {
        this.processJob(job);
      }
      
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process a specific job
   */
  private async processJob(job: T): Promise<void> {
    // Check if there's a processor for this job type
    const processor = this.processors.get(job.type);
    
    if (!processor) {
      console.warn(`No processor found for job type: ${job.type}`);
      
      // Mark as failed
      const updatedJob = updateJobStatus(job, 'failed', `No processor found for job type: ${job.type}`);
      await this.repository.update(updatedJob as T);
      return;
    }
    
    try {
      // Mark as running
      let updatedJob = updateJobStatus(job, 'running');
      updatedJob = await this.repository.update(updatedJob as T);
      
      // Process the job
      const result = await processor.processJob(updatedJob);
      
      // Save result
      await this.repository.update(result);
      
    } catch (error) {
      console.error(`Job processing error for job ${job.id}:`, error);
      
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      const updatedJob = updateJobStatus(job, 'failed', errorMessage);
      
      await this.repository.update(updatedJob as T);
    }
    
    // Continue processing the queue
    this.processQueue();
  }
  
  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<T | null> {
    // Get the job
    const job = await this.repository.getById(jobId);
    
    if (!job || job.status !== 'failed' || job.retry_count >= job.max_retries) {
      return null;
    }
    
    // Reset job for retry
    const retryJob: T = {
      ...job,
      status: 'pending',
      progress: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
      retry_count: job.retry_count + 1,
    };
    
    // Save and enqueue
    await this.repository.update(retryJob);
    
    // Start processing the queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return retryJob;
  }
  
  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<T | null> {
    // Get the job
    const job = await this.repository.getById(jobId);
    
    if (!job || job.status !== 'pending') {
      return null;
    }
    
    // Mark as cancelled
    const cancelledJob = updateJobStatus(job, 'cancelled');
    
    // Save
    await this.repository.update(cancelledJob as T);
    
    return cancelledJob as T;
  }
  
  /**
   * Get all jobs
   */
  async getJobs(): Promise<T[]> {
    return await this.repository.getAll();
  }
  
  /**
   * Get a job by ID
   */
  async getJob(id: string): Promise<T | null> {
    return await this.repository.getById(id);
  }
  
  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus): Promise<T[]> {
    return await this.repository.getByStatus(status);
  }
}