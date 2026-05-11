export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobType = 
  | 'text-generation' 
  | 'image-generation' 
  | 'video-generation' 
  | 'voice-generation' 
  | 'render-scene'
  | 'render-episode';

export type JobPriority = 'low' | 'medium' | 'high' | 'critical';

export interface JobResult {
  output_url?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  progress: number;
  dependencies: string[];
  params: Record<string, any>;
  result: JobResult | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_by: string;
  retry_count: number;
  max_retries: number;
}

// Factory function to create a new job
export function createJob(
  type: JobType,
  params: Record<string, any>,
  options: {
    priority?: JobPriority;
    dependencies?: string[];
    maxRetries?: number;
    createdBy?: string;
  } = {}
): Job {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    type,
    status: 'pending',
    priority: options.priority || 'medium',
    progress: 0,
    dependencies: options.dependencies || [],
    params,
    result: null,
    error_message: null,
    created_at: now,
    started_at: null,
    completed_at: null,
    updated_at: now,
    created_by: options.createdBy || 'system',
    retry_count: 0,
    max_retries: options.maxRetries ?? 3,
  };
}

// Update job status
export function updateJobStatus(
  job: Job,
  status: JobStatus,
  errorMessage?: string
): Job {
  const now = new Date().toISOString();
  
  let startedAt = job.started_at;
  let completedAt = job.completed_at;
  
  // Update timestamps based on status
  if (status === 'running' && !job.started_at) {
    startedAt = now;
  }
  
  if ((status === 'completed' || status === 'failed' || status === 'cancelled') && !job.completed_at) {
    completedAt = now;
  }
  
  return {
    ...job,
    status,
    error_message: status === 'failed' ? (errorMessage || job.error_message) : job.error_message,
    started_at: startedAt,
    completed_at: completedAt,
    updated_at: now,
  };
}

// Update job progress
export function updateJobProgress(
  job: Job,
  progress: number
): Job {
  return {
    ...job,
    progress: Math.min(100, Math.max(0, progress)),
    updated_at: new Date().toISOString(),
  };
}

// Complete job with result
export function completeJob(
  job: Job,
  result: JobResult
): Job {
  const now = new Date().toISOString();
  
  return {
    ...job,
    status: 'completed',
    progress: 100,
    result,
    completed_at: now,
    updated_at: now,
  };
}

// Fail job with error
export function failJob(
  job: Job,
  errorMessage: string
): Job {
  const now = new Date().toISOString();
  
  return {
    ...job,
    status: 'failed',
    error_message: errorMessage,
    completed_at: now,
    updated_at: now,
  };
}

// Retry a failed job
export function retryJob(
  job: Job
): Job {
  // Only retry jobs that are failed and haven't exceeded max retries
  if (job.status !== 'failed' || job.retry_count >= job.max_retries) {
    return job;
  }
  
  return {
    ...job,
    status: 'pending',
    progress: 0,
    error_message: null,
    started_at: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
    retry_count: job.retry_count + 1,
  };
}