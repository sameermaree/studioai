import { BrowserEventEmitter } from '../../lib/BrowserEventEmitter';

export interface ModelInfo {
  name: string;
  type: 'checkpoint' | 'lora' | 'controlnet' | 'upscaler' | 'vae' | 'embedding' | 'other';
  path: string;
  size?: number; // In bytes
  hash?: string;
  status: 'available' | 'loading' | 'error';
  metadata?: any;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  created_at?: string;
  lastUsed?: Date;
}

export interface ModelSwitchResult {
  success: boolean;
  previousModel?: string;
  newModel?: string;
  error?: string;
}

/**
 * Service for managing ComfyUI models
 * 
 * This service provides functionality to list, switch,
 * and manage models in ComfyUI.
 */
export class ModelManager extends BrowserEventEmitter {
  private baseUrl: string;
  private models: Map<string, ModelInfo> = new Map();
  private modelsLoaded = false;
  private modelsByType: Map<string, ModelInfo[]> = new Map();
  private activeModels: Map<string, string> = new Map(); // type -> model name
  private compatibilityMatrix: Map<string, Set<string>> = new Map(); // workflow type -> compatible model types
  
  constructor(baseUrl: string = 'http://localhost:8188') {
    super();
    this.baseUrl = baseUrl;
    
    // Set up default compatibility matrix
    this.setupCompatibilityMatrix();
  }
  
  /**
   * Load available models from ComfyUI
   */
  public async loadModels(): Promise<ModelInfo[]> {
    if (this.modelsLoaded) {
      return this.getAllModels();
    }
    try {
      // Try to get model list from ComfyUI
      const response = await fetch(`${this.baseUrl}/model_list`);
      
      if (!response.ok) {
        throw new Error(`Failed to load models: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      this.processModelData(data);
      
      this.modelsLoaded = true;
      
      // Return the sorted list of models
      return this.getAllModels();
    } catch (error) {
      this.modelsLoaded = true; // cache empty result, stop retrying
      return [];
    }
  }
  
  /**
   * Get all available models
   */
  public getAllModels(): ModelInfo[] {
    return Array.from(this.models.values()).sort((a, b) => {
      // Sort by type first, then name
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
  }
  
  /**
   * Get models by type
   * 
   * @param type Model type (checkpoint, lora, etc.)
   */
  public getModelsByType(type: string): ModelInfo[] {
    return this.modelsByType.get(type) || [];
  }
  
  /**
   * Get a specific model by name
   * 
   * @param name Model name
   */
  public getModel(name: string): ModelInfo | undefined {
    return this.models.get(name);
  }
  
  /**
   * Get active models for each type
   */
  public getActiveModels(): Map<string, string> {
    return new Map(this.activeModels);
  }
  
  /**
   * Check if a model is compatible with a workflow type
   * 
   * @param modelType Model type
   * @param workflowType Workflow type
   */
  public isModelCompatible(modelType: string, workflowType: string): boolean {
    const compatibleTypes = this.compatibilityMatrix.get(workflowType);
    return !!compatibleTypes && compatibleTypes.has(modelType);
  }
  
  /**
   * Get compatible models for a workflow type
   * 
   * @param workflowType Workflow type
   */
  public getCompatibleModels(workflowType: string): ModelInfo[] {
    const compatibleTypes = this.compatibilityMatrix.get(workflowType);
    
    if (!compatibleTypes) {
      return [];
    }
    
    const result: ModelInfo[] = [];
    
    // Collect all models of compatible types
    for (const type of compatibleTypes) {
      const models = this.getModelsByType(type);
      result.push(...models);
    }
    
    return result;
  }
  
  /**
   * Switch to a different model for a specific type
   * 
   * @param type Model type
   * @param modelName New model name
   */
  public async switchModel(type: string, modelName: string): Promise<ModelSwitchResult> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }
    
    // Check if model exists
    const model = this.models.get(modelName);
    
    if (!model) {
      return {
        success: false,
        error: `Model ${modelName} not found`
      };
    }
    
    // Check if model type matches
    if (model.type !== type) {
      return {
        success: false,
        error: `Model ${modelName} is not of type ${type}`
      };
    }
    
    // Store previous model
    const previousModel = this.activeModels.get(type);
    
    try {
      // In a real implementation, this would switch the model in ComfyUI
      // For now, we'll just update our local state
      
      // Update active model
      this.activeModels.set(type, modelName);
      
      // Update last used time
      const modelInfo = this.models.get(modelName);
      if (modelInfo) {
        modelInfo.lastUsed = new Date();
      }
      
      // Emit model switched event
      this.emit('modelSwitched', {
        type,
        previousModel,
        newModel: modelName
      });
      
      return {
        success: true,
        previousModel,
        newModel: modelName
      };
    } catch (error) {
      console.error('Error switching model:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Process model data from ComfyUI API
   */
  private processModelData(data: any): void {
    this.models.clear();
    this.modelsByType.clear();
    
    // Process each model type
    for (const [type, models] of Object.entries<string[]>(data)) {
      const modelType = this.mapModelType(type);
      
      if (!this.modelsByType.has(modelType)) {
        this.modelsByType.set(modelType, []);
      }
      
      // Create model info for each model
      for (const modelName of models) {
        const modelInfo: ModelInfo = {
          name: modelName,
          type: modelType,
          path: `${type}/${modelName}`,
          status: 'available'
        };
        
        // Add to maps
        this.models.set(modelName, modelInfo);
        this.modelsByType.get(modelType)!.push(modelInfo);
        
        // If this is the first model of its type, set as active
        if (!this.activeModels.has(modelType)) {
          this.activeModels.set(modelType, modelName);
        }
      }
    }
    
    // Emit models loaded event
    this.emit('modelsLoaded', {
      count: this.models.size,
      types: Array.from(this.modelsByType.keys())
    });
  }
  
  /**
   * Map ComfyUI model type to our model type
   */
  private mapModelType(comfyType: string): ModelInfo['type'] {
    // Map ComfyUI model types to our types
    switch (comfyType) {
      case 'checkpoints':
        return 'checkpoint';
      case 'loras':
        return 'lora';
      case 'controlnets':
        return 'controlnet';
      case 'upscale_models':
        return 'upscaler';
      case 'vae':
        return 'vae';
      case 'embeddings':
        return 'embedding';
      default:
        return 'other';
    }
  }
  
  /**
   * Set up the default compatibility matrix
   */
  private setupCompatibilityMatrix(): void {
    // txt2img compatibility
    const txt2imgSet = new Set<string>(['checkpoint', 'lora', 'vae', 'embedding']);
    this.compatibilityMatrix.set('txt2img', txt2imgSet);
    
    // img2img compatibility
    const img2imgSet = new Set<string>(['checkpoint', 'lora', 'vae', 'embedding']);
    this.compatibilityMatrix.set('img2img', img2imgSet);
    
    // txt2vid compatibility
    const txt2vidSet = new Set<string>(['checkpoint', 'lora', 'vae', 'embedding']);
    this.compatibilityMatrix.set('txt2vid', txt2vidSet);
    
    // img2vid compatibility
    const img2vidSet = new Set<string>(['checkpoint', 'lora', 'vae', 'embedding']);
    this.compatibilityMatrix.set('img2vid', img2vidSet);
    
    // upscale compatibility
    const upscaleSet = new Set<string>(['upscaler', 'checkpoint']);
    this.compatibilityMatrix.set('upscale', upscaleSet);
  }
}