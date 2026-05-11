import { WorkflowTemplate } from "../../infrastructure/ai/services/ComfyUIOrchestrator";
import semver from 'semver';

export interface WorkflowIndex {
  version: string;
  updated_at: string;
  templates: WorkflowIndexEntry[];
}

export interface WorkflowIndexEntry {
  id: string;
  name: string;
  description: string;
  type: string;
  file: string;
  model: string;
  thumbnail?: string;
  default: boolean;
  version?: string;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Service for loading, validating and managing workflow templates
 */
export class WorkflowLoader {
  private basePath: string;
  private indexCache: WorkflowIndex | null = null;
  private templateCache: Map<string, WorkflowTemplate> = new Map();
  private versionCache: Map<string, Map<string, WorkflowTemplate>> = new Map();
  private typeIndex: Map<string, string[]> = new Map();
  
  /**
   * Initialize a new workflow loader
   * 
   * @param basePath Base path for workflow templates
   */
  constructor(basePath: string = '/workflows') {
    this.basePath = this.normalizePath(basePath);
  }
  
  /**
   * Set the base path for workflow templates
   * 
   * @param path New base path
   */
  public setBasePath(path: string): void {
    this.basePath = this.normalizePath(path);
    this.clearCache();
  }
  
  /**
   * Get the workflow index
   */
  public async getIndex(): Promise<WorkflowIndex> {
    if (this.indexCache) {
      return this.indexCache;
    }
    
    try {
      const response = await fetch(`${this.basePath}/index.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load workflow index: ${response.status} ${response.statusText}`);
      }
      
      const index = await response.json() as WorkflowIndex;
      this.indexCache = index;
      
      // Build the type index
      this.buildTypeIndex(index);
      
      return index;
    } catch (error) {
      console.error('Error loading workflow index:', error);
      throw error;
    }
  }
  
  /**
   * Get all workflow templates
   */
  public async getAllTemplates(): Promise<WorkflowTemplate[]> {
    const index = await this.getIndex();
    const templates: WorkflowTemplate[] = [];
    
    for (const entry of index.templates) {
      try {
        const template = await this.getTemplate(entry.id);
        if (template) {
          templates.push(template);
        }
      } catch (error) {
        console.error(`Error loading template ${entry.id}:`, error);
      }
    }
    
    return templates;
  }
  
  /**
   * Get workflow templates by type
   * 
   * @param type Template type (txt2img, img2img, etc.)
   */
  public async getTemplatesByType(type: string): Promise<WorkflowTemplate[]> {
    await this.getIndex(); // Ensure index is loaded
    
    const templateIds = this.typeIndex.get(type) || [];
    const templates: WorkflowTemplate[] = [];
    
    for (const id of templateIds) {
      try {
        const template = await this.getTemplate(id);
        if (template) {
          templates.push(template);
        }
      } catch (error) {
        console.error(`Error loading template ${id}:`, error);
      }
    }
    
    return templates;
  }
  
  /**
   * Get the default template for a type
   * 
   * @param type Template type (txt2img, img2img, etc.)
   */
  public async getDefaultTemplateForType(type: string): Promise<WorkflowTemplate | null> {
    const index = await this.getIndex();
    
    // Find the default template for this type
    const defaultEntry = index.templates.find(t => t.type === type && t.default);
    
    if (defaultEntry) {
      return await this.getTemplate(defaultEntry.id);
    }
    
    // If no default is marked, use the first template of this type
    const firstOfType = index.templates.find(t => t.type === type);
    
    if (firstOfType) {
      return await this.getTemplate(firstOfType.id);
    }
    
    return null;
  }
  
  /**
   * Get a specific workflow template
   * 
   * @param id Template ID
   * @param version Specific version (optional)
   */
  public async getTemplate(id: string, version?: string): Promise<WorkflowTemplate | null> {
    // Check cache first
    if (version) {
      // Check version-specific cache
      const versionMap = this.versionCache.get(id);
      if (versionMap && versionMap.has(version)) {
        return versionMap.get(version) || null;
      }
    } else {
      // Check regular cache for latest version
      if (this.templateCache.has(id)) {
        return this.templateCache.get(id) || null;
      }
    }
    
    // Get the index to find the file
    const index = await this.getIndex();
    const entry = index.templates.find(t => t.id === id);
    
    if (!entry) {
      console.error(`Template with ID ${id} not found in index`);
      return null;
    }
    
    try {
      // Load the template
      const response = await fetch(`${this.basePath}/${entry.file}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load template ${id}: ${response.status} ${response.statusText}`);
      }
      
      const template = await response.json() as WorkflowTemplate;
      
      // Validate the template
      const validation = this.validateTemplate(template);
      if (!validation.isValid) {
        console.error(`Template ${id} validation failed:`, validation.errors);
        throw new Error(`Template ${id} validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Cache the template
      this.templateCache.set(id, template);
      
      // Cache by version if available
      if (template.version) {
        let versionMap = this.versionCache.get(id);
        if (!versionMap) {
          versionMap = new Map();
          this.versionCache.set(id, versionMap);
        }
        versionMap.set(template.version, template);
      }
      
      return template;
    } catch (error) {
      console.error(`Error loading template ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Get all versions of a template
   * 
   * @param id Template ID
   */
  public async getTemplateVersions(id: string): Promise<string[]> {
    // Check if we have versions cached
    const versionMap = this.versionCache.get(id);
    if (versionMap) {
      return Array.from(versionMap.keys()).sort((a, b) => {
        return semver.compare(b, a); // Sort in descending order
      });
    }
    
    // Try to load the template to populate the cache
    await this.getTemplate(id);
    
    // Check cache again
    const updatedVersionMap = this.versionCache.get(id);
    if (updatedVersionMap) {
      return Array.from(updatedVersionMap.keys()).sort((a, b) => {
        return semver.compare(b, a);
      });
    }
    
    return [];
  }
  
  /**
   * Validate a workflow template
   * 
   * @param template The template to validate
   */
  public validateTemplate(template: any): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    const requiredFields = [
      'id', 'name', 'type', 'nodes', 
      'inputNodes', 'outputNodes', 'parameterMapping'
    ];
    
    for (const field of requiredFields) {
      if (!template[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Check nodes structure
    if (template.nodes) {
      // Check that referenced input nodes exist
      if (template.inputNodes) {
        for (const [key, nodeId] of Object.entries(template.inputNodes)) {
          if (nodeId && typeof nodeId === 'string' && !template.nodes[nodeId]) {
            errors.push(`Input node '${nodeId}' referenced in inputNodes.${key} does not exist in nodes`);
          }
        }
      }
      
      // Check that referenced output nodes exist
      if (template.outputNodes) {
        for (const [key, nodeId] of Object.entries(template.outputNodes)) {
          if (nodeId && typeof nodeId === 'string' && !template.nodes[nodeId]) {
            errors.push(`Output node '${nodeId}' referenced in outputNodes.${key} does not exist in nodes`);
          }
        }
      }
    } else {
      errors.push('Template has no nodes defined');
    }
    
    // Type-specific validations
    if (template.type) {
      if ((template.type === 'txt2img' || template.type === 'img2img') && 
          (!template.outputNodes.imageNode || !template.nodes[template.outputNodes.imageNode])) {
        errors.push(`Template of type ${template.type} requires an imageNode output`);
      }
      
      if ((template.type === 'txt2vid' || template.type === 'img2vid') && 
          (!template.outputNodes.videoNode || !template.nodes[template.outputNodes.videoNode])) {
        errors.push(`Template of type ${template.type} requires a videoNode output`);
      }
      
      if ((template.type === 'img2img' || template.type === 'img2vid' || template.type === 'upscale') && 
          (!template.inputNodes.imageNode || !template.nodes[template.inputNodes.imageNode])) {
        errors.push(`Template of type ${template.type} requires an imageNode input`);
      }
    }
    
    // Version validation
    if (template.version && !semver.valid(template.version)) {
      warnings.push(`Version '${template.version}' is not a valid semantic version`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Clear the template cache
   */
  public clearCache(): void {
    this.indexCache = null;
    this.templateCache.clear();
    this.versionCache.clear();
    this.typeIndex.clear();
  }
  
  /**
   * Normalize a path
   */
  private normalizePath(path: string): string {
    // Remove trailing slash if present
    return path.endsWith('/') ? path.slice(0, -1) : path;
  }
  
  /**
   * Build the type index from the template index
   */
  private buildTypeIndex(index: WorkflowIndex): void {
    this.typeIndex.clear();
    
    for (const template of index.templates) {
      let typeTemplates = this.typeIndex.get(template.type);
      
      if (!typeTemplates) {
        typeTemplates = [];
        this.typeIndex.set(template.type, typeTemplates);
      }
      
      typeTemplates.push(template.id);
    }
  }
}