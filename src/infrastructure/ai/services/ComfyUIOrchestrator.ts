import { ComfyUIProvider, ComfyUIWorkflowResult } from "../providers/ComfyUIProvider";
import { Asset, createPendingAsset, updateAssetFile, failAsset } from "../../../domain/assets/entities/Asset";
import { Job, createJob, completeJob, failJob, updateJobProgress, JobType } from "../../../domain/rendering/entities/Job";
import { ProjectFileManager } from "../../filesystem/ProjectFileManager";
import { AssetManager } from "../../../application/assets/services/AssetManager";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  path: string;
  type: 'txt2img' | 'img2img' | 'txt2vid' | 'img2vid' | 'custom';
  inputNodes: {
    promptNode?: string;
    negativePromptNode?: string;
    imageNode?: string;
    sizeNode?: string;
    seedNode?: string;
  };
  outputNodes: {
    imageNode?: string;
    videoNode?: string;
  };
  parameterMapping: Record<string, string>;
  previewUrl?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface WorkflowQueueItem {
  id: string;
  job: Job;
  asset?: Asset;
  template: WorkflowTemplate;
  parameters: Record<string, any>;
  callbacks?: {
    onProgress?: (progress: number) => void;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
  };
}

/**
 * ComfyUI Orchestrator for managing workflows and generation
 */
export class ComfyUIOrchestrator {
  private provider: ComfyUIProvider;
  private fileManager: ProjectFileManager;
  private assetManager: AssetManager;
  private workflowTemplates: Map<string, WorkflowTemplate> = new Map();
  private workflowQueue: WorkflowQueueItem[] = [];
  private isProcessing = false;
  private maxConcurrent = 1;
  private statusCheckInterval: any = null;
  private systemHealthy = false;
  private templates: WorkflowTemplate[] = [];

  constructor(
    provider: ComfyUIProvider,
    fileManager: ProjectFileManager,
    assetManager: AssetManager,
    options?: {
      maxConcurrent?: number;
      statusCheckIntervalMs?: number;
    }
  ) {
    this.provider = provider;
    this.fileManager = fileManager;
    this.assetManager = assetManager;
    this.maxConcurrent = options?.maxConcurrent || 1;
    
    // Start health checking
    if (options?.statusCheckIntervalMs) {
      this.startStatusChecking(options.statusCheckIntervalMs);
    } else {
      // Check status once at startup
      this.checkProviderStatus();
    }
    
    // Load default workflow templates
    this.loadDefaultWorkflowTemplates();
  }

  /**
   * Start regular status checking
   */
  public startStatusChecking(intervalMs: number = 30000): void {
    // Clear any existing interval
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    
    // Start new interval
    this.statusCheckInterval = setInterval(() => {
      this.checkProviderStatus();
    }, intervalMs);
    
    // Initial check
    this.checkProviderStatus();
  }

  /**
   * Stop status checking
   */
  public stopStatusChecking(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  /**
   * Check the status of the ComfyUI provider
   */
  private async checkProviderStatus(): Promise<void> {
    try {
      const status = await this.provider.getStatus();
      const wasHealthy = this.systemHealthy;
      this.systemHealthy = status.available;
      
      // Log status changes
      if (wasHealthy !== this.systemHealthy) {
        if (this.systemHealthy) {
          console.log('ComfyUI system is now online:', status.message);
          // Resume queue processing if it was suspended
          if (this.workflowQueue.length > 0 && !this.isProcessing) {
            this.processQueue();
          }
        } else {
          console.warn('ComfyUI system is now offline:', status.message);
        }
      }
    } catch (error) {
      console.error('Error checking ComfyUI status:', error);
      this.systemHealthy = false;
    }
  }

  /**
   * Register a workflow template
   */
  public registerWorkflowTemplate(template: WorkflowTemplate): void {
    this.workflowTemplates.set(template.id, template);
    
    // Update the templates array
    this.templates = Array.from(this.workflowTemplates.values());
  }

  /**
   * Get all registered workflow templates
   */
  public getWorkflowTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  /**
   * Get a workflow template by ID
   */
  public getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
    return this.workflowTemplates.get(id);
  }

  /**
   * Queue a text-to-image generation
   */
  public async queueTextToImage(
    prompt: string,
    options?: {
      negativePrompt?: string;
      width?: number;
      height?: number;
      seed?: number;
      templateId?: string;
      assetDisplayName?: string;
      assetCategory?: string;
      assetTags?: string[];
      relatedEntityId?: string;
      relatedEntityType?: string;
      parameters?: Record<string, any>;
      callbacks?: {
        onProgress?: (progress: number) => void;
        onSuccess?: (result: any) => void;
        onError?: (error: Error) => void;
      };
    }
  ): Promise<{job: Job, asset: Asset}> {
    // Use the specified template or find a suitable one
    const templateId = options?.templateId || this.findSuitableTemplate('txt2img');
    const template = this.workflowTemplates.get(templateId);
    
    if (!template) {
      throw new Error(`No suitable workflow template found for text-to-image generation`);
    }
    
    // Create a pending asset
    const filename = this.assetManager.generateImageFilename(
      'txt2img',
      options?.relatedEntityId
    );
    
    const asset = createPendingAsset({
      filename,
      displayName: options?.assetDisplayName || `Image from prompt: ${prompt.slice(0, 20)}...`,
      type: 'image',
      category: options?.assetCategory || 'scene',
      mimeType: 'image/png',
      relatedEntityId: options?.relatedEntityId,
      relatedEntityType: options?.relatedEntityType,
      tags: options?.assetTags || ['generated', 'comfyui', 'txt2img']
    });
    
    // Create a job for generation
    const job = createJob(
      'image-generation' as JobType,
      {
        prompt,
        negative_prompt: options?.negativePrompt || '',
        width: options?.width || 512,
        height: options?.height || 512,
        seed: options?.seed,
        template_id: templateId,
        ...options?.parameters
      },
      {
        priority: 'medium',
        maxRetries: 2
      }
    );
    
    // Add to queue
    this.workflowQueue.push({
      id: job.id,
      job,
      asset,
      template,
      parameters: {
        prompt,
        negative_prompt: options?.negativePrompt || '',
        width: options?.width || 512,
        height: options?.height || 512,
        seed: options?.seed,
        ...options?.parameters
      },
      callbacks: options?.callbacks
    });
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return { job, asset };
  }

  /**
   * Queue a text-to-video generation
   */
  public async queueTextToVideo(
    prompt: string,
    options?: {
      negativePrompt?: string;
      width?: number;
      height?: number;
      durationSeconds?: number;
      fps?: number;
      seed?: number;
      templateId?: string;
      assetDisplayName?: string;
      assetCategory?: string;
      assetTags?: string[];
      relatedEntityId?: string;
      relatedEntityType?: string;
      parameters?: Record<string, any>;
      callbacks?: {
        onProgress?: (progress: number) => void;
        onSuccess?: (result: any) => void;
        onError?: (error: Error) => void;
      };
    }
  ): Promise<{job: Job, asset: Asset}> {
    // Use the specified template or find a suitable one
    const templateId = options?.templateId || this.findSuitableTemplate('txt2vid');
    const template = this.workflowTemplates.get(templateId);
    
    if (!template) {
      throw new Error(`No suitable workflow template found for text-to-video generation`);
    }
    
    // Create a pending asset
    const filename = this.assetManager.generateVideoFilename(
      'txt2vid',
      options?.relatedEntityId
    );
    
    const asset = createPendingAsset({
      filename,
      displayName: options?.assetDisplayName || `Video from prompt: ${prompt.slice(0, 20)}...`,
      type: 'video',
      category: options?.assetCategory || 'scene',
      mimeType: 'video/mp4',
      relatedEntityId: options?.relatedEntityId,
      relatedEntityType: options?.relatedEntityType,
      tags: options?.assetTags || ['generated', 'comfyui', 'txt2vid']
    });
    
    // Create a job for generation
    const job = createJob(
      'video-generation' as JobType,
      {
        prompt,
        negative_prompt: options?.negativePrompt || '',
        width: options?.width || 512,
        height: options?.height || 512,
        duration_seconds: options?.durationSeconds || 5,
        fps: options?.fps || 24,
        seed: options?.seed,
        template_id: templateId,
        ...options?.parameters
      },
      {
        priority: 'high',
        maxRetries: 1
      }
    );
    
    // Add to queue
    this.workflowQueue.push({
      id: job.id,
      job,
      asset,
      template,
      parameters: {
        prompt,
        negative_prompt: options?.negativePrompt || '',
        width: options?.width || 512,
        height: options?.height || 512,
        duration: options?.durationSeconds || 5,
        fps: options?.fps || 24,
        seed: options?.seed,
        ...options?.parameters
      },
      callbacks: options?.callbacks
    });
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return { job, asset };
  }

  /**
   * Process the workflow queue
   */
  private async processQueue(): Promise<void> {
    // Skip if already processing or no items in queue
    if (this.isProcessing || this.workflowQueue.length === 0) {
      return;
    }
    
    // Check if ComfyUI is available
    if (!this.systemHealthy) {
      const isAvailable = await this.provider.isAvailable();
      if (!isAvailable) {
        console.warn('ComfyUI is not available, skipping queue processing');
        return;
      }
      this.systemHealthy = true;
    }
    
    this.isProcessing = true;
    
    try {
      // Get the next item from the queue
      const item = this.workflowQueue.shift();
      
      if (!item) {
        this.isProcessing = false;
        return;
      }
      
      // Process the workflow
      await this.processWorkflowItem(item);
      
      // Continue processing queue
      this.isProcessing = false;
      this.processQueue();
    } catch (error) {
      console.error('Error processing workflow queue:', error);
      this.isProcessing = false;
      
      // Continue with next item after a delay
      setTimeout(() => {
        this.processQueue();
      }, 5000);
    }
  }

  /**
   * Process a workflow queue item
   */
  private async processWorkflowItem(item: WorkflowQueueItem): Promise<void> {
    const { job, asset, template, parameters, callbacks } = item;
    
    try {
      // Report initial progress
      this.updateProgress(job, 10, callbacks?.onProgress);
      
      // Determine generation type
      if (template.type === 'txt2img') {
        // Text to image generation
        const result = await this.provider.generateImage(
          parameters.prompt,
          {
            negativePrompt: parameters.negative_prompt,
            width: parameters.width,
            height: parameters.height,
            seed: parameters.seed,
            workflowPath: template.path,
            outputNodeId: template.outputNodes.imageNode,
            workflowInputs: this.mapParametersToWorkflow(parameters, template.parameterMapping)
          }
        );
        
        this.updateProgress(job, 90, callbacks?.onProgress);
        
        // Save the result
        await this.saveImageResult(result, job, asset, callbacks);
      } else if (template.type === 'txt2vid') {
        // Text to video generation
        const result = await this.provider.generateVideo(
          parameters.prompt,
          {
            negativePrompt: parameters.negative_prompt,
            width: parameters.width,
            height: parameters.height,
            durationSeconds: parameters.duration,
            fps: parameters.fps,
            seed: parameters.seed,
            workflowPath: template.path,
            outputNodeId: template.outputNodes.videoNode,
            workflowInputs: this.mapParametersToWorkflow(parameters, template.parameterMapping)
          }
        );
        
        this.updateProgress(job, 90, callbacks?.onProgress);
        
        // Save the result
        await this.saveVideoResult(result, job, asset, callbacks);
      } else {
        throw new Error(`Unsupported workflow template type: ${template.type}`);
      }
    } catch (error) {
      console.error(`Error processing workflow ${template.id}:`, error);
      
      // Mark job as failed
      const failedJob = failJob(job, error instanceof Error ? error.message : String(error));
      
      // Mark asset as failed
      if (asset) {
        failAsset(asset, error instanceof Error ? error.message : String(error));
      }
      
      // Call error callback
      if (callbacks?.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Save an image generation result
   */
  private async saveImageResult(
    result: any, 
    job: Job, 
    asset?: Asset, 
    callbacks?: WorkflowQueueItem['callbacks']
  ): Promise<void> {
    // Update the job with the result
    const updatedJob = completeJob(job, {
      output_url: result.url,
      metadata: result.metadata
    });
    
    // Update the asset if provided
    let updatedAsset: Asset | undefined;
    if (asset) {
      // Download and save the image
      const imageFilename = asset.filename;
      
      // In a real implementation, download the image and save to the filesystem
      // For this implementation, we'll just update the asset with the URL
      updatedAsset = updateAssetFile(
        asset,
        imageFilename,
        result.url,
        result.metadata
      );
    }
    
    // Report final progress
    this.updateProgress(job, 100, callbacks?.onProgress);
    
    // Call success callback
    if (callbacks?.onSuccess) {
      callbacks.onSuccess({
        job: updatedJob,
        asset: updatedAsset,
        result
      });
    }
  }

  /**
   * Save a video generation result
   */
  private async saveVideoResult(
    result: any, 
    job: Job, 
    asset?: Asset, 
    callbacks?: WorkflowQueueItem['callbacks']
  ): Promise<void> {
    // Update the job with the result
    const updatedJob = completeJob(job, {
      output_url: result.url,
      metadata: result.metadata
    });
    
    // Update the asset if provided
    let updatedAsset: Asset | undefined;
    if (asset) {
      // Download and save the video
      const videoFilename = asset.filename;
      
      // In a real implementation, download the video and save to the filesystem
      // For this implementation, we'll just update the asset with the URL
      updatedAsset = updateAssetFile(
        asset,
        videoFilename,
        result.url,
        result.metadata
      );
    }
    
    // Report final progress
    this.updateProgress(job, 100, callbacks?.onProgress);
    
    // Call success callback
    if (callbacks?.onSuccess) {
      callbacks.onSuccess({
        job: updatedJob,
        asset: updatedAsset,
        result
      });
    }
  }

  /**
   * Update job progress and call progress callback
   */
  private updateProgress(
    job: Job, 
    progress: number, 
    callback?: (progress: number) => void
  ): void {
    updateJobProgress(job, progress);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * Find a suitable workflow template for a generation type
   */
  private findSuitableTemplate(type: string): string {
    // Find a template that matches the type
    for (const [id, template] of this.workflowTemplates.entries()) {
      if (template.type === type) {
        return id;
      }
    }
    
    throw new Error(`No suitable workflow template found for type: ${type}`);
  }

  /**
   * Map parameters to workflow inputs
   */
  private mapParametersToWorkflow(
    parameters: Record<string, any>,
    mapping: Record<string, string>
  ): Record<string, any> {
    const workflowInputs: Record<string, any> = {};
    
    // Map each parameter to its workflow input
    for (const [paramName, workflowParam] of Object.entries(mapping)) {
      if (paramName in parameters) {
        workflowInputs[workflowParam] = parameters[paramName];
      }
    }
    
    return workflowInputs;
  }

  /**
   * Load default workflow templates
   */
  private loadDefaultWorkflowTemplates(): void {
    const now = new Date().toISOString();
    
    // Default text to image template
    const txt2imgTemplate: WorkflowTemplate = {
      id: 'default-txt2img',
      name: 'Default Text to Image',
      description: 'Standard text to image workflow using SDXL',
      path: 'workflows/sdxl_txt2img.json',
      type: 'txt2img',
      inputNodes: {
        promptNode: 'positive_prompt',
        negativePromptNode: 'negative_prompt',
        sizeNode: 'empty_latent',
        seedNode: 'seed'
      },
      outputNodes: {
        imageNode: 'save_image'
      },
      parameterMapping: {
        'prompt': 'text',
        'negative_prompt': 'negative_text',
        'width': 'width',
        'height': 'height',
        'seed': 'seed',
      },
      metadata: {
        model: 'SDXL',
        samplers: ['Euler a', 'DPM++ 2M Karras'],
        steps: 30
      },
      created_at: now,
      updated_at: now
    };
    
    // Default text to video template
    const txt2vidTemplate: WorkflowTemplate = {
      id: 'default-txt2vid',
      name: 'Default Text to Video',
      description: 'Standard text to video workflow using AnimateDiff',
      path: 'workflows/animatediff_txt2vid.json',
      type: 'txt2vid',
      inputNodes: {
        promptNode: 'positive_prompt',
        negativePromptNode: 'negative_prompt',
        sizeNode: 'empty_latent',
        seedNode: 'seed'
      },
      outputNodes: {
        videoNode: 'save_video'
      },
      parameterMapping: {
        'prompt': 'text',
        'negative_prompt': 'negative_text',
        'width': 'width',
        'height': 'height',
        'seed': 'seed',
        'fps': 'fps',
        'duration': 'motion_length',
      },
      metadata: {
        model: 'AnimateDiff',
        fps: 24,
        default_duration: 5
      },
      created_at: now,
      updated_at: now
    };
    
    // Register the templates
    this.registerWorkflowTemplate(txt2imgTemplate);
    this.registerWorkflowTemplate(txt2vidTemplate);
  }
}