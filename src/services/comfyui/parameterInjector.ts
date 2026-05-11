import { WorkflowTemplate } from "../../infrastructure/ai/services/ComfyUIOrchestrator";

export interface WorkflowParameters {
  prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  fps?: number;
  duration?: number;
  frame_count?: number;
  image_url?: string;
  [key: string]: any;
}

/**
 * Service for injecting parameters into ComfyUI workflows
 * 
 * This service handles the mapping and injection of user-defined
 * parameters into ComfyUI workflow JSON structures.
 */
export class ParameterInjector {
  /**
   * Prepare a workflow by injecting parameters
   */
  public static prepareWorkflow(
    workflow: Record<string, any>,
    parameters: WorkflowParameters,
    template: WorkflowTemplate
  ): Record<string, any> {
    // Create a deep clone of the workflow
    const preparedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    if (!preparedWorkflow.nodes) {
      return preparedWorkflow;
    }

    // Map parameters using template's parameter mapping
    const mappedParams = this.mapParameters(parameters, template.parameterMapping);
    
    // Find prompt nodes
    if (parameters.prompt && template.inputNodes.promptNode) {
      this.injectPrompt(preparedWorkflow, parameters.prompt, template.inputNodes.promptNode);
    }
    
    // Find negative prompt nodes
    if (parameters.negative_prompt && template.inputNodes.negativePromptNode) {
      this.injectPrompt(preparedWorkflow, parameters.negative_prompt, template.inputNodes.negativePromptNode);
    }
    
    // Inject size parameters
    if ((parameters.width || parameters.height) && template.inputNodes.sizeNode) {
      this.injectSize(preparedWorkflow, parameters.width, parameters.height, template.inputNodes.sizeNode);
    }
    
    // Inject seed if provided
    if (parameters.seed !== undefined && template.inputNodes.seedNode) {
      this.injectSeed(preparedWorkflow, parameters.seed, template.inputNodes.seedNode);
    }
    
    // Inject image if this is an img2img or img2vid workflow
    if (parameters.image_url && template.inputNodes.imageNode) {
      this.injectImage(preparedWorkflow, parameters.image_url, template.inputNodes.imageNode);
    }
    
    // Inject all other mapped parameters
    for (const nodeId in preparedWorkflow.nodes) {
      const node = preparedWorkflow.nodes[nodeId];
      if (!node.inputs) continue;
      
      // Check each input to see if we have a parameter for it
      for (const inputName in node.inputs) {
        if (mappedParams[inputName]) {
          node.inputs[inputName] = mappedParams[inputName];
        }
      }
    }
    
    return preparedWorkflow;
  }
  
  /**
   * Map parameters using the template's parameter mapping
   */
  private static mapParameters(
    parameters: WorkflowParameters,
    mapping: Record<string, string>
  ): Record<string, any> {
    const mappedParams: Record<string, any> = {};
    
    // Map each parameter to its workflow input name
    for (const [paramName, workflowInputName] of Object.entries(mapping)) {
      if (paramName in parameters) {
        mappedParams[workflowInputName] = parameters[paramName];
      }
    }
    
    // Video-specific parameters
    if (parameters.fps !== undefined) {
      mappedParams['fps'] = parameters.fps;
    }
    
    if (parameters.duration !== undefined) {
      mappedParams['motion_length'] = parameters.duration;
    }
    
    if (parameters.frame_count !== undefined) {
      mappedParams['frames'] = parameters.frame_count;
    }
    
    return mappedParams;
  }
  
  /**
   * Inject a prompt into a node
   */
  private static injectPrompt(
    workflow: Record<string, any>,
    prompt: string,
    nodeId: string
  ): void {
    const node = this.findNode(workflow, nodeId);
    if (!node) return;
    
    // Different node types handle prompts differently
    if (node.class_type === 'CLIPTextEncode') {
      node.inputs.text = prompt;
    } else if (node.inputs && 'prompt' in node.inputs) {
      node.inputs.prompt = prompt;
    } else if (node.inputs && 'text' in node.inputs) {
      node.inputs.text = prompt;
    }
  }
  
  /**
   * Inject size parameters into a node
   */
  private static injectSize(
    workflow: Record<string, any>,
    width?: number,
    height?: number,
    nodeId?: string
  ): void {
    if (!nodeId) return;
    
    const node = this.findNode(workflow, nodeId);
    if (!node) return;
    
    // EmptyLatentImage is the most common size node type
    if (node.class_type === 'EmptyLatentImage') {
      if (width !== undefined) node.inputs.width = width;
      if (height !== undefined) node.inputs.height = height;
    } else {
      // Try generic inputs
      if (width !== undefined && node.inputs && 'width' in node.inputs) {
        node.inputs.width = width;
      }
      
      if (height !== undefined && node.inputs && 'height' in node.inputs) {
        node.inputs.height = height;
      }
    }
  }
  
  /**
   * Inject seed into a node
   */
  private static injectSeed(
    workflow: Record<string, any>,
    seed: number,
    nodeId: string
  ): void {
    const node = this.findNode(workflow, nodeId);
    if (!node) return;
    
    // Different nodes handle seeds differently
    if (node.inputs && 'seed' in node.inputs) {
      node.inputs.seed = seed;
    }
  }
  
  /**
   * Inject an image into a node
   */
  private static injectImage(
    workflow: Record<string, any>,
    imageUrl: string,
    nodeId: string
  ): void {
    const node = this.findNode(workflow, nodeId);
    if (!node) return;
    
    // Different nodes handle images differently
    if (node.class_type === 'LoadImage') {
      node.inputs.image = imageUrl;
    } else if (node.inputs && 'image' in node.inputs) {
      node.inputs.image = imageUrl;
    }
  }
  
  /**
   * Find a node by ID or class_type
   */
  private static findNode(workflow: Record<string, any>, nodeIdOrType: string): any {
    // Try direct lookup by ID
    if (workflow.nodes && workflow.nodes[nodeIdOrType]) {
      return workflow.nodes[nodeIdOrType];
    }
    
    // If not found, try to match by node type
    for (const id in workflow.nodes) {
      const node = workflow.nodes[id];
      if (node.class_type === nodeIdOrType) {
        return node;
      }
    }
    
    // Not found
    return null;
  }
}