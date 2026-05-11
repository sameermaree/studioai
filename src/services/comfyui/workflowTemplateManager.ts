import { WorkflowTemplate } from "../../infrastructure/ai/services/ComfyUIOrchestrator";

/**
 * Service for managing ComfyUI workflow templates
 * 
 * This service handles loading, validating, and organizing
 * workflow templates for the ComfyUI orchestration system.
 */
export class WorkflowTemplateManager {
  private templates: Map<string, WorkflowTemplate> = new Map();
  private categorizedTemplates: Map<string, WorkflowTemplate[]> = new Map();

  /**
   * Load templates from a directory
   */
  public async loadFromDirectory(path: string): Promise<WorkflowTemplate[]> {
    try {
      // In a browser environment, this would need to be handled differently
      // Here we're assuming access to either fetch or the filesystem
      const response = await fetch(`${path}/index.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load template index: ${response.status} ${response.statusText}`);
      }
      
      const templateIndex = await response.json();
      const loadedTemplates: WorkflowTemplate[] = [];
      
      // Load each template
      for (const templateInfo of templateIndex.templates) {
        try {
          const templateResponse = await fetch(`${path}/${templateInfo.file}`);
          if (templateResponse.ok) {
            const template = await templateResponse.json();
            this.registerTemplate(template);
            loadedTemplates.push(template);
          } else {
            console.error(`Failed to load template ${templateInfo.file}: ${templateResponse.status}`);
          }
        } catch (error) {
          console.error(`Error loading template ${templateInfo.file}:`, error);
        }
      }
      
      return loadedTemplates;
    } catch (error) {
      console.error('Error loading workflow templates:', error);
      return [];
    }
  }

  /**
   * Register a workflow template
   */
  public registerTemplate(template: WorkflowTemplate): void {
    // Validate template
    this.validateTemplate(template);
    
    // Store the template
    this.templates.set(template.id, template);
    
    // Add to categorized templates
    if (!this.categorizedTemplates.has(template.type)) {
      this.categorizedTemplates.set(template.type, []);
    }
    this.categorizedTemplates.get(template.type)!.push(template);
  }

  /**
   * Get all registered templates
   */
  public getAllTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a template by ID
   */
  public getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by type
   */
  public getTemplatesByType(type: string): WorkflowTemplate[] {
    return this.categorizedTemplates.get(type) || [];
  }

  /**
   * Find a suitable template for a generation type
   */
  public findSuitableTemplate(type: string): WorkflowTemplate | undefined {
    const templates = this.getTemplatesByType(type);
    
    // Return first template of the requested type
    if (templates.length > 0) {
      return templates[0];
    }
    
    return undefined;
  }

  /**
   * Validate a template
   */
  private validateTemplate(template: WorkflowTemplate): void {
    // Check required fields
    const requiredFields = [
      'id', 'name', 'path', 'type', 
      'inputNodes', 'outputNodes', 'parameterMapping'
    ];
    
    for (const field of requiredFields) {
      if (!template[field as keyof WorkflowTemplate]) {
        throw new Error(`Template is missing required field: ${field}`);
      }
    }
    
    // Type-specific validations
    if (template.type === 'txt2img' || template.type === 'img2img') {
      if (!template.outputNodes.imageNode) {
        throw new Error(`Template of type ${template.type} requires an imageNode output`);
      }
    } else if (template.type === 'txt2vid' || template.type === 'img2vid') {
      if (!template.outputNodes.videoNode) {
        throw new Error(`Template of type ${template.type} requires a videoNode output`);
      }
    }
  }

  /**
   * Create a default template
   */
  public static createDefaultTemplate(
    type: 'txt2img' | 'img2img' | 'txt2vid' | 'img2vid' | 'custom',
    options: {
      id?: string;
      name?: string;
      path?: string;
      description?: string;
    } = {}
  ): WorkflowTemplate {
    const now = new Date().toISOString();
    const id = options.id || `default-${type}`;
    const name = options.name || `Default ${type.replace(/2/g, ' to ').toUpperCase()} Template`;
    
    // Set default path based on type
    let path = options.path;
    if (!path) {
      if (type === 'txt2img') {
        path = 'workflows/sdxl_txt2img.json';
      } else if (type === 'img2img') {
        path = 'workflows/sdxl_img2img.json';
      } else if (type === 'txt2vid') {
        path = 'workflows/animatediff_txt2vid.json';
      } else if (type === 'img2vid') {
        path = 'workflows/animatediff_img2vid.json';
      } else {
        path = 'workflows/custom.json';
      }
    }
    
    // Create template structure based on type
    const template: WorkflowTemplate = {
      id,
      name,
      description: options.description || `Default template for ${type}`,
      path,
      type,
      inputNodes: {
        promptNode: 'positive_prompt',
        negativePromptNode: 'negative_prompt',
        sizeNode: 'empty_latent',
        seedNode: 'seed'
      },
      outputNodes: {
        imageNode: type.includes('img') ? 'save_image' : undefined,
        videoNode: type.includes('vid') ? 'save_video' : undefined
      },
      parameterMapping: {
        'prompt': 'text',
        'negative_prompt': 'negative_text',
        'width': 'width',
        'height': 'height',
        'seed': 'seed',
      },
      metadata: {},
      created_at: now,
      updated_at: now
    };
    
    // Add video-specific mappings
    if (type.includes('vid')) {
      template.parameterMapping['fps'] = 'fps';
      template.parameterMapping['duration'] = 'motion_length';
      template.metadata = {
        ...template.metadata,
        fps: 24,
        default_duration: 5
      };
    }
    
    return template;
  }
}