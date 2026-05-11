import { AICapability, AIProvider, AIProviderConfig, GenerationOptions, ImageGenerationResult, VideoGenerationResult } from "../AIProviderInterface";

export interface ComfyUIConfig extends AIProviderConfig {
  baseUrl: string;
  clientId?: string;
  defaultWorkflowPath?: string;
  defaultImageWidth?: number;
  defaultImageHeight?: number;
  connectionTimeout?: number;
}

export interface ComfyUIWorkflowResult {
  outputs: Record<string, string[]>;
  workflow: Record<string, any>;
  nodeOutputs: Record<string, any>;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Provider for ComfyUI integration
 * Handles image generation through ComfyUI's API
 */
export class ComfyUIProvider implements AIProvider {
  readonly id = 'comfyui';
  readonly name = 'ComfyUI';
  readonly capabilities: AICapability[] = [
    'text-to-image',
    'image-to-image',
    'text-to-video'
  ];

  private baseUrl: string;
  private clientId: string;
  private defaultWorkflowPath: string;
  private defaultImageWidth: number;
  private defaultImageHeight: number;
  private connectionTimeout: number;

  constructor(config: ComfyUIConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:8188';
    this.clientId = config.clientId || `seri-ai-studio-${Date.now()}`;
    this.defaultWorkflowPath = config.defaultWorkflowPath || 'workflows/default_txt2img.json';
    this.defaultImageWidth = config.defaultImageWidth || 512;
    this.defaultImageHeight = config.defaultImageHeight || 512;
    this.connectionTimeout = config.connectionTimeout || 10000; // 10 seconds
  }

  /**
   * Check if ComfyUI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.connectionTimeout);
      
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('ComfyUI availability check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed status of ComfyUI service
   */
  async getStatus(): Promise<{ available: boolean; message?: string; latency?: number }> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.connectionTimeout);
      
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        
        // Check for GPU information as sign of healthy instance
        const hasGpu = data?.system?.devices?.some((d: any) => d.type === 'cuda' || d.type === 'mps');
        
        return {
          available: true,
          message: `ComfyUI is available. GPU: ${hasGpu ? 'Yes' : 'No'}`,
          latency
        };
      } else {
        return {
          available: false,
          message: `ComfyUI returned status ${response.status}`,
          latency
        };
      }
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      return {
        available: false,
        message: isTimeout 
          ? `Connection to ComfyUI timed out after ${this.connectionTimeout}ms`
          : `Failed to connect to ComfyUI: ${error instanceof Error ? error.message : String(error)}`,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Required for AIProvider interface but not supported by ComfyUI
   * Will throw an error if used
   */
  async generateText(): Promise<never> {
    throw new Error('Text generation is not supported by ComfyUI');
  }

  /**
   * Required for AIProvider interface but not supported by ComfyUI
   * Will throw an error if used
   */
  async generateJSON(): Promise<never> {
    throw new Error('JSON generation is not supported by ComfyUI');
  }

  /**
   * Generate an image using ComfyUI
   */
  async generateImage(
    prompt: string,
    options?: GenerationOptions & {
      width?: number;
      height?: number;
      negativePrompt?: string;
      workflowPath?: string;
      workflowInputs?: Record<string, any>;
      outputNodeId?: string;
    }
  ): Promise<ImageGenerationResult> {
    // Load workflow
    const workflowPath = options?.workflowPath || this.defaultWorkflowPath;
    const workflow = await this.loadWorkflow(workflowPath);
    
    // Prepare workflow with prompt
    const width = options?.width || this.defaultImageWidth;
    const height = options?.height || this.defaultImageHeight;
    const negativePrompt = options?.negativePrompt || '';
    
    // Inject inputs into workflow
    const preparedWorkflow = this.prepareWorkflow(
      workflow,
      {
        prompt,
        negative_prompt: negativePrompt,
        width,
        height,
        ...options?.workflowInputs
      }
    );
    
    // Execute the workflow
    const result = await this.executeWorkflow(preparedWorkflow);
    
    // Extract image URL
    const outputNodeId = options?.outputNodeId || this.findOutputNode(workflow);
    if (!outputNodeId || !result.outputs[outputNodeId] || result.outputs[outputNodeId].length === 0) {
      throw new Error('No output image generated');
    }
    
    // Get the image URL
    const imageUrl = result.outputs[outputNodeId][0];
    const fullImageUrl = `${this.baseUrl}${imageUrl}`;
    
    // Return the result
    return {
      url: fullImageUrl,
      metadata: {
        width,
        height,
        workflow: workflowPath,
        prompt,
        negative_prompt: negativePrompt
      },
      raw: result
    };
  }

  /**
   * Generate a video using ComfyUI
   * Note: Requires a video generation workflow in ComfyUI
   */
  async generateVideo(
    prompt: string,
    options?: GenerationOptions & {
      durationSeconds?: number;
      width?: number;
      height?: number;
      negativePrompt?: string;
      fps?: number;
      workflowPath?: string;
      workflowInputs?: Record<string, any>;
      outputNodeId?: string;
    }
  ): Promise<VideoGenerationResult> {
    // Ensure video-capable workflow path
    const workflowPath = options?.workflowPath || 'workflows/default_txt2vid.json';
    
    // Load workflow
    const workflow = await this.loadWorkflow(workflowPath);
    
    // Prepare workflow with prompt
    const width = options?.width || 512;
    const height = options?.height || 512;
    const fps = options?.fps || 24;
    const durationSeconds = options?.durationSeconds || 5;
    const negativePrompt = options?.negativePrompt || '';
    
    // Number of frames based on duration and FPS
    const frameCount = Math.max(1, Math.round(durationSeconds * fps));
    
    // Inject inputs into workflow
    const preparedWorkflow = this.prepareWorkflow(
      workflow,
      {
        prompt,
        negative_prompt: negativePrompt,
        width,
        height,
        fps,
        frame_count: frameCount,
        duration: durationSeconds,
        ...options?.workflowInputs
      }
    );
    
    // Execute the workflow
    const result = await this.executeWorkflow(preparedWorkflow);
    
    // Extract video URL
    const outputNodeId = options?.outputNodeId || this.findVideoOutputNode(workflow);
    if (!outputNodeId || !result.outputs[outputNodeId] || result.outputs[outputNodeId].length === 0) {
      throw new Error('No output video generated');
    }
    
    // Get the video URL
    const videoUrl = result.outputs[outputNodeId][0];
    const fullVideoUrl = `${this.baseUrl}${videoUrl}`;
    
    // Return the result
    return {
      url: fullVideoUrl,
      metadata: {
        width,
        height,
        fps,
        duration: durationSeconds,
        frame_count: frameCount,
        workflow: workflowPath,
        prompt,
        negative_prompt: negativePrompt
      },
      raw: result
    };
  }

  /**
   * Load a workflow from a file path
   */
  private async loadWorkflow(path: string): Promise<Record<string, any>> {
    try {
      // Try to load from server
      const response = await fetch(`${this.baseUrl}/workflow/${encodeURIComponent(path)}`);
      
      if (response.ok) {
        return await response.json();
      }
      
      // If not found, try as a local path
      try {
        // In a browser environment, we'd need to handle this differently
        // This is a simplified version assuming we're in a Node.js environment
        if (typeof window === 'undefined') {
          // Node.js environment
          const fs = require('fs');
          const workflowData = fs.readFileSync(path, 'utf-8');
          return JSON.parse(workflowData);
        } else {
          // Browser environment - use fetch to a local path
          const localResponse = await fetch(path);
          if (localResponse.ok) {
            return await localResponse.json();
          }
          throw new Error(`Workflow not found: ${path}`);
        }
      } catch (err) {
        console.error('Error loading local workflow:', err);
        throw new Error(`Failed to load workflow from ${path}`);
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
      throw error;
    }
  }

  /**
   * Find the output node ID in a workflow
   */
  private findOutputNode(workflow: Record<string, any>): string | null {
    // Look for nodes with class_type related to output
    const outputNodeTypes = [
      'SaveImage', 
      'PreviewImage', 
      'VHS_VideoCombine', 
      'SaveVideo'
    ];
    
    if (!workflow.nodes) {
      return null;
    }
    
    // Find nodes that might be output nodes
    for (const nodeId in workflow.nodes) {
      const node = workflow.nodes[nodeId];
      if (outputNodeTypes.includes(node.class_type)) {
        return nodeId;
      }
    }
    
    return null;
  }

  /**
   * Find the video output node ID in a workflow
   */
  private findVideoOutputNode(workflow: Record<string, any>): string | null {
    // Look for nodes with class_type related to video output
    const videoOutputNodeTypes = [
      'VHS_VideoCombine', 
      'SaveVideo'
    ];
    
    if (!workflow.nodes) {
      return null;
    }
    
    // Find nodes that might be video output nodes
    for (const nodeId in workflow.nodes) {
      const node = workflow.nodes[nodeId];
      if (videoOutputNodeTypes.includes(node.class_type)) {
        return nodeId;
      }
    }
    
    // If no video-specific nodes found, try general output nodes
    return this.findOutputNode(workflow);
  }

  /**
   * Prepare a workflow by injecting inputs
   */
  private prepareWorkflow(
    workflow: Record<string, any>,
    inputs: Record<string, any>
  ): Record<string, any> {
    // Create a deep clone of the workflow
    const preparedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    if (!preparedWorkflow.nodes) {
      return preparedWorkflow;
    }
    
    // Find nodes that accept inputs
    for (const nodeId in preparedWorkflow.nodes) {
      const node = preparedWorkflow.nodes[nodeId];
      
      // Handle text input nodes
      if (node.class_type === 'CLIPTextEncode') {
        if (inputs.prompt && node.inputs?.text?.includes('positive')) {
          node.inputs.text = inputs.prompt;
        } else if (inputs.negative_prompt && node.inputs?.text?.includes('negative')) {
          node.inputs.text = inputs.negative_prompt;
        }
      }
      
      // Handle image size nodes
      if (node.class_type === 'EmptyLatentImage' && inputs.width && inputs.height) {
        node.inputs.width = inputs.width;
        node.inputs.height = inputs.height;
      }
      
      // Handle video-related parameters
      if (node.class_type === 'VHS_VideoCombine' && inputs.fps) {
        if (node.inputs.fps) {
          node.inputs.fps = inputs.fps;
        }
      }
      
      // Handle other inputs
      // Attempt to match input names to node inputs directly
      for (const inputName in inputs) {
        if (node.inputs && inputName in node.inputs) {
          node.inputs[inputName] = inputs[inputName];
        }
      }
    }
    
    return preparedWorkflow;
  }

  /**
   * Execute a workflow and get the result
   */
  private async executeWorkflow(workflow: Record<string, any>): Promise<ComfyUIWorkflowResult> {
    try {
      // 1. Queue prompt
      const promptResponse = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: this.clientId,
        }),
      });
      
      if (!promptResponse.ok) {
        throw new Error(`Failed to queue prompt: ${promptResponse.status} ${promptResponse.statusText}`);
      }
      
      const { prompt_id } = await promptResponse.json();
      
      // 2. Wait for workflow completion
      const result = await this.waitForWorkflowCompletion(prompt_id);
      return result;
    } catch (error) {
      console.error('Error executing ComfyUI workflow:', error);
      throw error;
    }
  }

  /**
   * Wait for a workflow to complete and get the result
   */
  private async waitForWorkflowCompletion(promptId: string, timeoutMs = 300000): Promise<ComfyUIWorkflowResult> {
    return new Promise((resolve, reject) => {
      // Set up WebSocket connection
      const ws = new WebSocket(`${this.baseUrl.replace('http://', 'ws://')}/ws?clientId=${this.clientId}`);
      
      // Set timeout
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Workflow execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Output collection
      const outputs: Record<string, string[]> = {};
      const nodeOutputs: Record<string, any> = {};
      
      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'execution_start' && message.data.prompt_id === promptId) {
            console.log('Workflow execution started');
          }
          
          if (message.type === 'execution_cached' && message.data.prompt_id === promptId) {
            console.log('Using cached workflow execution');
          }
          
          if (message.type === 'executing' && message.data.prompt_id === promptId) {
            console.log(`Executing node: ${message.data.node}`);
          }
          
          // Handle image output
          if (message.type === 'executed' && message.data.prompt_id === promptId) {
            const { node, output } = message.data;
            nodeOutputs[node] = output;
            
            // Check for image outputs
            if (output.images) {
              outputs[node] = output.images.map((img: any) => img.filename ? `/view?filename=${encodeURIComponent(img.filename)}` : '');
            }
            
            // Check for video outputs
            if (output.videos) {
              outputs[node] = output.videos.map((vid: any) => vid.filename ? `/view?filename=${encodeURIComponent(vid.filename)}` : '');
            }
          }
          
          // Handle execution complete
          if (message.type === 'execution_complete' && message.data.prompt_id === promptId) {
            clearTimeout(timeout);
            ws.close();
            
            resolve({
              outputs,
              workflow: message.data.workflow || {},
              nodeOutputs,
              status: 'success'
            });
          }
          
          // Handle errors
          if (message.type === 'execution_error' && message.data.prompt_id === promptId) {
            clearTimeout(timeout);
            ws.close();
            
            resolve({
              outputs,
              workflow: {},
              nodeOutputs,
              status: 'error',
              error: message.data.exception_message || 'Unknown error'
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      ws.addEventListener('error', (error) => {
        clearTimeout(timeout);
        ws.close();
        reject(error);
      });
      
      ws.addEventListener('close', () => {
        clearTimeout(timeout);
        // Only reject if we haven't resolved yet and have no outputs
        if (Object.keys(outputs).length === 0) {
          reject(new Error('WebSocket connection closed before completion'));
        }
      });
    });
  }
}