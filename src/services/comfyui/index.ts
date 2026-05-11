import { ComfyUIProvider, ComfyUIConfig } from "../../infrastructure/ai/providers/ComfyUIProvider";
import { ComfyUIOrchestrator, WorkflowTemplate } from "../../infrastructure/ai/services/ComfyUIOrchestrator";
import { ProjectFileManager } from "../../infrastructure/filesystem/ProjectFileManager";
import { AssetManager } from "../../application/assets/services/AssetManager";
import { Asset } from "../../domain/assets/entities/Asset";
import { Job } from "../../domain/rendering/entities/Job";
import { WorkflowLoader } from "./workflowLoader";
import { ComfyUIHealthCheck } from "./healthCheck";
import { ComfyUIStabilityLayer, StabilityStatus } from "./stabilityLayer";
import { BatchGenerator, BatchGenerationConfig } from "./batchGenerator";
import { ModelManager } from "./modelManager";

// Default ComfyUI configuration
const DEFAULT_CONFIG: ComfyUIConfig = {
  baseUrl: 'http://localhost:8188',
  clientId: `seri-ai-studio-${Date.now()}`,
  defaultWorkflowPath: 'workflows/default_txt2img.json',
  defaultImageWidth: 512,
  defaultImageHeight: 512,
  connectionTimeout: 10000,
};

/**
 * Service for ComfyUI orchestration
 * 
 * This service provides a high-level API for interacting with ComfyUI
 * and manages workflows, job queues, and asset generation.
 */
export class ComfyUIService {
  private static instance: ComfyUIService;
  private provider: ComfyUIProvider;
  private orchestrator: ComfyUIOrchestrator;
  private isInitialized = false;
  private workflowLoader: WorkflowLoader | null = null;
  private healthCheck: ComfyUIHealthCheck | null = null;
  private stabilityLayer: ComfyUIStabilityLayer | null = null;
  private batchGenerator: BatchGenerator | null = null;
  private modelManager: ModelManager | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the ComfyUIService instance
   */
  public static getInstance(): ComfyUIService {
    if (!ComfyUIService.instance) {
      ComfyUIService.instance = new ComfyUIService();
    }
    return ComfyUIService.instance;
  }

  /**
   * Initialize the ComfyUI service
   */
  public async initialize(
    config: Partial<ComfyUIConfig> = {},
    projectFileManager?: ProjectFileManager,
    assetManager?: AssetManager,
    options?: {
      maxConcurrent?: number;
      statusCheckIntervalMs?: number;
      workflowTemplatesPath?: string;
    }
  ): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Create the provider
      const providerConfig: ComfyUIConfig = {
        ...DEFAULT_CONFIG,
        ...config
      };
      this.provider = new ComfyUIProvider(providerConfig);

      // Check if ComfyUI is available
      const isAvailable = await this.provider.isAvailable();
      if (!isAvailable) {
        console.warn('ComfyUI is not available. Service will be initialized but may not work correctly.');
      }

      // Create or use the provided ProjectFileManager
      const fileManager = projectFileManager || new ProjectFileManager('./assets');

      // Create or use the provided AssetManager
      const assetMgr = assetManager || new AssetManager(fileManager);

      // Create the orchestrator
      // Create health check service
      this.healthCheck = new ComfyUIHealthCheck(
        providerConfig.baseUrl,
        {
          connectionTimeout: providerConfig.connectionTimeout,
          checkInterval: options?.statusCheckIntervalMs || 30000
        }
      );
      
      // Create stability layer
      this.stabilityLayer = new ComfyUIStabilityLayer(
        this.healthCheck,
        providerConfig.baseUrl,
        {
          maxReconnectAttempts: 10,
          reconnectDelay: 2000,
          reconnectDelayMax: 30000
        }
      );
      
      // Initialize stability layer
      await this.stabilityLayer.initialize();
      
      // Create workflow loader
      this.workflowLoader = new WorkflowLoader(
        options?.workflowTemplatesPath || './workflows'
      );
      
      // Create model manager
      this.modelManager = new ModelManager(providerConfig.baseUrl);
      
      // Create the orchestrator
      this.orchestrator = new ComfyUIOrchestrator(
        this.provider,
        fileManager,
        assetMgr,
        {
          maxConcurrent: options?.maxConcurrent || 1,
          statusCheckIntervalMs: options?.statusCheckIntervalMs || 30000
        }
      );

      // Create batch generator
      this.batchGenerator = new BatchGenerator(
        this,
        {
          maxConcurrentBatches: 2
        }
      );
      
      // Load workflow templates
      if (options?.workflowTemplatesPath) {
        await this.loadWorkflowTemplates(options.workflowTemplatesPath);
      }
      
      // Start health monitoring
      this.healthCheck.startMonitoring();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing ComfyUI service:', error);
      return false;
    }
  }

  /**
   * Get the status of the ComfyUI service
   */
  public async getStatus(): Promise<{ available: boolean; message?: string; latency?: number }> {
    this.checkInitialized();
    
    // If stability layer is available, use its diagnostic info
    if (this.stabilityLayer) {
      const diagnostics = this.stabilityLayer.getDiagnostics();
      return {
        available: diagnostics.status === StabilityStatus.ONLINE || 
                  diagnostics.status === StabilityStatus.DEGRADED,
        message: diagnostics.status === StabilityStatus.DEGRADED ? 
                 `ComfyUI is running in degraded mode: ${diagnostics.degraded_reason}` :
                 diagnostics.last_error,
        latency: diagnostics.latency
      };
    }
    
    // Fall back to provider status
    return await this.provider.getStatus();
  }

  /**
   * Generate an image from a text prompt
   */
  public async generateImage(
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
  ): Promise<{ job: Job; asset: Asset }> {
    this.checkInitialized();
    return await this.orchestrator.queueTextToImage(prompt, options);
  }

  /**
   * Generate a video from a text prompt
   */
  public async generateVideo(
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
  ): Promise<{ job: Job; asset: Asset }> {
    this.checkInitialized();
    return await this.orchestrator.queueTextToVideo(prompt, options);
  }

  /**
   * Get all available workflow templates
   */
  public getWorkflowTemplates(): WorkflowTemplate[] {
    this.checkInitialized();
    return this.orchestrator.getWorkflowTemplates();
  }

  /**
   * Get a workflow template by ID
   */
  public getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
    this.checkInitialized();
    return this.orchestrator.getWorkflowTemplate(id);
  }

  /**
   * Register a custom workflow template
   */
  public registerWorkflowTemplate(template: WorkflowTemplate): void {
    this.checkInitialized();
    this.orchestrator.registerWorkflowTemplate(template);
  }

  /**
   * Load workflow templates from a directory
   */
  private async loadWorkflowTemplates(path: string): Promise<void> {
    try {
      // Use the workflow loader to get templates
      if (!this.workflowLoader) {
        this.workflowLoader = new WorkflowLoader(path);
      }
      
      const templates = await this.workflowLoader.getAllTemplates();
      
      // Register each template
      for (const template of templates) {
        this.orchestrator.registerWorkflowTemplate(template);
      }
      
      console.log(`Loaded ${templates.length} workflow templates`);
    } catch (error) {
      console.error('Failed to load workflow templates:', error);
    }
  }

  /**
   * Check if the service is initialized
   */
  private checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ComfyUI service is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Get the workflow loader
   */
  public getWorkflowLoader(): WorkflowLoader {
    this.checkInitialized();
    if (!this.workflowLoader) {
      throw new Error('Workflow loader is not initialized');
    }
    return this.workflowLoader;
  }
  
  /**
   * Get the stability layer
   */
  public getStabilityLayer(): ComfyUIStabilityLayer {
    this.checkInitialized();
    if (!this.stabilityLayer) {
      throw new Error('Stability layer is not initialized');
    }
    return this.stabilityLayer;
  }
  
  /**
   * Get the health check service
   */
  public getHealthCheck(): ComfyUIHealthCheck {
    this.checkInitialized();
    if (!this.healthCheck) {
      throw new Error('Health check service is not initialized');
    }
    return this.healthCheck;
  }
  
  /**
   * Get the batch generator
   */
  public getBatchGenerator(): BatchGenerator {
    this.checkInitialized();
    if (!this.batchGenerator) {
      throw new Error('Batch generator is not initialized');
    }
    return this.batchGenerator;
  }
  
  /**
   * Get the model manager
   */
  public getModelManager(): ModelManager {
    this.checkInitialized();
    if (!this.modelManager) {
      throw new Error('Model manager is not initialized');
    }
    return this.modelManager;
  }
  
  /**
   * Create a new batch generation job
   */
  public createBatch(config: BatchGenerationConfig, createdBy: string = 'system') {
    this.checkInitialized();
    if (!this.batchGenerator) {
      throw new Error('Batch generator is not initialized');
    }
    return this.batchGenerator.createBatch(config, createdBy);
  }
  
  /**
   * Start a batch generation job
   */
  public async startBatch(batchId: string): Promise<void> {
    this.checkInitialized();
    if (!this.batchGenerator) {
      throw new Error('Batch generator is not initialized');
    }
    await this.batchGenerator.startBatch(batchId);
  }
  
  /**
   * Validate a workflow for execution
   */
  public async validateWorkflow(workflow: Record<string, any>): Promise<any> {
    this.checkInitialized();
    if (!this.stabilityLayer) {
      throw new Error('Stability layer is not initialized');
    }
    return await this.stabilityLayer.validateWorkflowNodes(workflow);
  }
}