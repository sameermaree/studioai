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
        const devices = data?.devices || data?.system?.devices || [];
        const hasGpu = devices.some((d: any) => d.type === 'cuda' || d.type === 'mps');
        const gpuName = devices.length > 0 ? devices.map((d: any) => d.name).join(', ') : 'Unknown';
        
        return {
          available: true,
          message: `ComfyUI available | GPU: ${gpuName}`,
          latency,
          ...(devices.length > 0 && { gpuInfo: devices })
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

  // Base URL for ComfyUI  
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Build a proper ComfyUI API workflow.
   * ComfyUI expects nodes as a flat object with numeric keys.
   * Each node has class_type and inputs (with links to other nodes via [nodeId, outputIndex]).
   * 
   * Uses KSamplerAdvanced with noise_seed matching real ComfyUI API exports.
   */
  public buildPromptWorkflow(params: {
    prompt: string;
    negativePrompt?: string;
    model?: string;
    width?: number;
    height?: number;
    seed?: number;
    steps?: number;
    cfg?: number;
    samplerName?: string;
    scheduler?: string;
    filenamePrefix?: string;
  }): Record<string, any> {
    const modelName = params.model || this.detectAvailableModel();
    const seedVal = params.seed ?? Math.floor(Math.random() * 2147483647);
    const w = params.width || this.defaultImageWidth;
    const h = params.height || this.defaultImageHeight;
    const steps = params.steps || 30;
    const cfg = params.cfg || 7;
    const samplerName = params.samplerName || 'euler';
    const scheduler = params.scheduler || 'normal';
    const prefix = params.filenamePrefix || 'seri_ai';

    return {
      "3": {
        class_type: "KSampler",
        inputs: {
          seed: seedVal,
          steps,
          cfg,
          sampler_name: samplerName,
          scheduler: scheduler,
          denoise: 1,
          model: ["4", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          latent_image: ["5", 0]
        }
      },
      "4": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: modelName }
      },
      "5": {
        class_type: "EmptyLatentImage",
        inputs: { width: w, height: h, batch_size: 1 }
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: params.prompt, clip: ["4", 1] }
      },
      "7": {
        class_type: "CLIPTextEncode",
        inputs: { text: params.negativePrompt || '', clip: ["4", 1] }
      },
      "8": {
        class_type: "VAEDecode",
        inputs: { samples: ["3", 0], vae: ["4", 2] }
      },
      "9": {
        class_type: "SaveImage",
        inputs: { filename_prefix: prefix, images: ["8", 0] }
      }
    };
  }

    /**
   * Load a workflow JSON file in native ComfyUI API format.
   * The workflow file uses numeric node keys (e.g., "3", "4") with
   * class_type and inputs. This is the format exported by ComfyUI
   * via Workflow → Save (API Format).
   *
   * Only injects: prompt, negative prompt, seed, width, height.
   * All other node settings (sampler, scheduler, steps, cfg, etc.) are preserved
   * exactly as stored in the workflow JSON file.
   */
  public async loadWorkflowFromFile(
    workflowPath: string,
    params: {
      prompt: string;
      negativePrompt?: string;
      seed?: number;
      width?: number;
      height?: number;
    }
  ): Promise<Record<string, any>> {
        console.log('[WORKFLOW LOADER] Loading:', workflowPath);
    console.log('[WORKFLOW LOADER] Prompt to inject:', params.prompt);
    console.log('[WORKFLOW LOADER] Negative to inject:', params.negativePrompt);
    
    // Fetch the workflow JSON file
    const response = await fetch(`/api/workflows/${workflowPath.split('/').pop()}`);
    if (!response.ok) {
      // IPAdapter workflow MUST NOT fallback to dynamic build
      const isIPAdapterWorkflow = workflowPath.includes('ipadapter');
      const errorMsg = isIPAdapterWorkflow
        ? 'IPAdapter workflow file " + workflowPath + " not found (HTTP  + response.status + ).  +
          'This workflow requires LoRA, IPAdapter, CLIP Vision, and Load Image nodes.  +
          'Fallback to dynamic build is forbidden for IPAdapter workflows.'
        : 'Failed to load workflow file "' + workflowPath + '" - falling back to dynamic build';
      
      if (isIPAdapterWorkflow) {
        console.error('[WORKFLOW LOADER] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.warn('[WORKFLOW LOADER]', errorMsg);
      return this.buildPromptWorkflow({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        seed: params.seed,
      });
    }

    
    // Validate: must be an object with numeric keys and class_type on each node
    const isNativeFormat = typeof workflowData === 'object' && !Array.isArray(workflowData);
    if (!isNativeFormat) {
      // IPAdapter workflow MUST NOT fallback to dynamic build
      const isIPAdapterWorkflow = workflowPath.includes('ipadapter');
      const errorMsg = isIPAdapterWorkflow
        ? 'IPAdapter workflow file " + workflowPath + " has invalid format.  +
          'Expected native ComfyUI API format with numeric keys and class_type. ' +
          'Fallback to dynamic build is forbidden for IPAdapter workflows.'
        : 'Invalid workflow format for "' + workflowPath + '" - falling back to dynamic build';
      
      if (isIPAdapterWorkflow) {
        console.error('[WORKFLOW LOADER] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.warn('[WORKFLOW LOADER]', errorMsg);
      return this.buildPromptWorkflow({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        seed: params.seed,
      });
    }
    
    // Deep clone
    
    // Deep clone the workflow to avoid mutating the cached file data
    const numericWorkflow: Record<string, any> = JSON.parse(JSON.stringify(workflowData));
    
    // Now inject only the runtime parameters
    const seedVal = params.seed ?? Math.floor(Math.random() * 2147483647);
    const w = params.width || this.defaultImageWidth;
    const h = params.height || this.defaultImageHeight;
    
    // Find and inject into the KSampler node (seed)
    for (const [, node] of Object.entries<any>(numericWorkflow)) {
      if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
        node.inputs.seed = seedVal;
        console.log('[WORKFLOW LOADER] Injected seed:', seedVal);
      }
    }
    
    // Find and inject into EmptyLatentImage node (width, height)
    for (const [, node] of Object.entries<any>(numericWorkflow)) {
      if (node.class_type === 'EmptyLatentImage') {
        node.inputs.width = w;
        node.inputs.height = h;
        console.log('[WORKFLOW LOADER] Injected size:', w, 'x', h);
      }
    }
    
    // Find and inject into CLIPTextEncode nodes (prompt, negative)
    let promptInjected = false;
    let negativeInjected = false;
    for (const [, node] of Object.entries<any>(numericWorkflow)) {
      if (node.class_type === 'CLIPTextEncode') {
        if (!promptInjected) {
          node.inputs.text = params.prompt;
          promptInjected = true;
          console.log('[WORKFLOW LOADER] Injected positive prompt');
        } else if (!negativeInjected) {
          node.inputs.text = params.negativePrompt || '';
          negativeInjected = true;
          console.log('[WORKFLOW LOADER] Injected negative prompt');
        }
      }
    }
    
    // Log the loaded workflow settings (not overwritten)
    for (const [, node] of Object.entries<any>(numericWorkflow)) {
      if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
        console.log('[WORKFLOW LOADER] Sampler (from file):', node.inputs.sampler_name || 'default');
        console.log('[WORKFLOW LOADER] Scheduler (from file):', node.inputs.scheduler || 'default');
        console.log('[WORKFLOW LOADER] Steps (from file):', node.inputs.steps || 'default');
        console.log('[WORKFLOW LOADER] CFG (from file):', node.inputs.cfg || 'default');
        console.log('[WORKFLOW LOADER] Denoise (from file):', node.inputs.denoise || 'default');
      }
      if (node.class_type === 'CheckpointLoaderSimple') {
        console.log('[WORKFLOW LOADER] Checkpoint (from file):', node.inputs.ckpt_name || 'default');
      }
    }
    
    console.log('[WORKFLOW LOADER] Workflow loaded successfully from:', workflowPath);
    return numericWorkflow;
  }

  /**
   * Detect an available model from ComfyUI's object_info
   */
  private detectAvailableModel(): string {
    // Use a common default; this gets cached after first call
    return this._cachedModel || 'juggernautXL_v9Rundiffusionphoto2.safetensors';
  }

  private _cachedModel: string | null = null;

  /**
   * Fetch available models from ComfyUI
   */
  public async fetchAvailableModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/object_info/CheckpointLoaderSimple`);
      if (res.ok) {
        const data = await res.json();
        const ckptList = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
        if (Array.isArray(ckptList) && ckptList.length > 0) {
          this._cachedModel = ckptList[0];
          return ckptList;
        }
      }
    } catch {}
    return [this._cachedModel || 'juggernautXL_v9Rundiffusionphoto2.safetensors'];
  }

  /**
   * Queue a prompt to ComfyUI and return the prompt_id
   * Uses the backend proxy to avoid CORS issues from the browser
   */
  public async queuePrompt(workflow: Record<string, any>): Promise<string> {
    // Unique client_id per call — prevents ComfyUI from ignoring second WS connection
    const callClientId = `seri-ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const body = { prompt: workflow, client_id: callClientId };
    console.log('[OUTGOING FETCH BODY] prompt.callClientId:', callClientId);
    const response = await fetch('/api/comfyui/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Safe JSON parsing — always read text first
    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`ComfyUI proxy returned invalid JSON: ${rawText.slice(0, 300)}`);
    }

    if (!response.ok) {
      throw new Error(`ComfyUI queue failed (${response.status}): ${data?.error || data?.details || rawText.slice(0, 200)}`);
    }

    // Return JSON string containing both prompt_id and client_id
    return JSON.stringify({ prompt_id: data.prompt_id, client_id: callClientId });
  }

  /**
   * Wait for a workflow to complete using WebSocket + history polling fallback
   */
  public async waitForPrompt(promptIdJson: string, timeoutMs = 300000): Promise<{images: string[]; videos: string[]}> {
    let parsed: { prompt_id: string; client_id: string };
    try {
      parsed = JSON.parse(promptIdJson);
    } catch {
      // Fallback: promptIdJson is just the prompt_id string (backward compat)
      parsed = { prompt_id: promptIdJson, client_id: this.clientId };
    }
    const { prompt_id: promptId, client_id: callClientId } = parsed;

    const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    console.log('[WS] Connecting to:', `${wsUrl}/ws?clientId=${callClientId}`, 'for prompt', promptId);

    const wsPromise = new Promise<{images: string[]; videos: string[]}>((resolve, reject) => {
      let ws: WebSocket | null = null;
      let settled = false;
      const images: string[] = [];
      const videos: string[] = [];

      // Shorter timeout for quicker fallback to history
      const actualTimeout = Math.min(timeoutMs, 120000); // max 2 min
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.log('[WS] TIMEOUT after', actualTimeout, 'ms for prompt', promptId);
          if (ws) { try { ws.close(); } catch {} }
          checkHistoryAndResolve().then(r => resolve(r)).catch(() => {
            reject(new Error(`Prompt ${promptId} timed out after ${actualTimeout}ms`));
          });
        }
      }, actualTimeout);

      async function checkHistoryAndResolve(): Promise<{images: string[]; videos: string[]}> {
        console.log('[HISTORY] Polling /api/comfyui/history/', promptId);
        try {
          const res = await fetch(`/api/comfyui/history/${promptId}`);
          if (res.ok) {
            const historyData = await res.json();
            const outputs = historyData[promptId]?.outputs;
            if (outputs) {
              for (const nodeOutput of Object.values<any>(outputs)) {
                if (nodeOutput?.images) {
                  for (const img of nodeOutput.images) {
                    const subfolder = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
                    images.push(`/view?filename=${encodeURIComponent(img.filename)}${subfolder}&type=${img.type || 'output'}`);
                  }
                }
                if (nodeOutput?.videos) {
                  for (const vid of nodeOutput.videos) {
                    const subfolder = vid.subfolder ? `&subfolder=${encodeURIComponent(vid.subfolder)}` : '';
                    videos.push(`/view?filename=${encodeURIComponent(vid.filename)}${subfolder}&type=${vid.type || 'output'}`);
                  }
                }
              }
            }
            if (images.length > 0 || videos.length > 0) {
              console.log('[HISTORY] Found', images.length, 'images,', videos.length, 'videos');
              return { images, videos };
            }
          }
        } catch (e) {
          console.log('[HISTORY] Error:', e);
        }
        throw new Error(`Prompt ${promptId} not found in history`);
      }

      function safeResolve(result: {images: string[]; videos: string[]}) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          if (ws) { try { ws.close(); } catch {} }
          console.log('[WS] Resolving with', result.images.length, 'images,', result.videos.length, 'videos');
          resolve(result);
        }
      }

      function safeReject(err: Error) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          if (ws) { try { ws.close(); } catch {} }
          console.log('[WS] Rejecting:', err.message);
          reject(err);
        }
      }

      try {
        ws = new WebSocket(`${wsUrl}/ws?clientId=${callClientId}`);

        ws.onopen = () => {
          console.log('[WS] Connected for prompt', promptId);
        };

        ws.onmessage = (event) => {
          try {
            // Binary messages (preview images) are not JSON — skip
            if (typeof event.data !== 'string') return;
            const msg = JSON.parse(event.data);
            const dataStr = msg.data ? JSON.stringify(msg.data).slice(0, 200) : 'no data';
            console.log(`[WS] type=${msg.type} promptIdMatch=${msg.data?.prompt_id === promptId}`, dataStr);

            // Skip messages for other prompts
            if (msg.data?.prompt_id && msg.data.prompt_id !== promptId) return;

            // Collect images from executed nodes
            if (msg.type === 'executed' && msg.data?.output) {
              const output = msg.data.output;
              if (output?.images) {
                for (const img of output.images) {
                  const subfolder = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
                  images.push(`/view?filename=${encodeURIComponent(img.filename)}${subfolder}&type=${img.type || 'output'}`);
                }
              }
              if (output?.videos) {
                for (const vid of output.videos) {
                  const subfolder = vid.subfolder ? `&subfolder=${encodeURIComponent(vid.subfolder)}` : '';
                  videos.push(`/view?filename=${encodeURIComponent(vid.filename)}${subfolder}&type=${vid.type || 'output'}`);
                }
              }
            }

            // execution_success = final completion
            if (msg.type === 'execution_success' && msg.data?.prompt_id === promptId) {
              console.log('[WS] execution_success for', promptId, 'images:', images.length);
              safeResolve({ images, videos });
            }

            // executing with node=null means execution finished
            if (msg.type === 'executing' && msg.data?.node === null && msg.data?.prompt_id === promptId) {
              console.log('[WS] executing:null for', promptId);
              if (images.length > 0 || videos.length > 0) {
                console.log('[WS] Resolving from executing:null — images present');
                safeResolve({ images, videos });
                return;
              }
              // No images from WS yet — try history
              checkHistoryAndResolve().then(r => { if (!settled) safeResolve(r); }).catch(() => {});
            }

            // execution_error
            if (msg.type === 'execution_error' && msg.data?.prompt_id === promptId) {
              safeReject(new Error(msg.data.exception_message || 'ComfyUI execution error'));
            }

            // status — queue empty + images present = done
            if (msg.type === 'status') {
              const queueInfo = msg.data?.status?.queue_info || msg.data?.status;
              const queueRemaining = queueInfo?.queue_remaining;
              const running = queueInfo?.running;
              if ((queueRemaining === 0 || running === 0) && (images.length > 0 || videos.length > 0)) {
                console.log('[WS] Queue empty with images, resolving');
                safeResolve({ images, videos });
              }
            }
          } catch {
            // Binary message or parse error — skip
          }
      };

        ws.onerror = () => {
          console.log('[WS] onerror for', promptId);
          checkHistoryAndResolve().then(r => safeResolve(r)).catch(() => {
            safeReject(new Error('WebSocket connection error'));
          });
        };

        ws.onclose = (event) => {
          console.log('[WS] onclose for', promptId, 'code:', event.code);
          if (images.length > 0 || videos.length > 0) {
            safeResolve({ images, videos });
          } else {
            checkHistoryAndResolve().then(r => safeResolve(r)).catch(() => {});
          }
        };
      } catch (err) {
        console.log('[WS] Failed to create WebSocket, using history fallback');
        checkHistoryAndResolve().then(r => safeResolve(r)).catch(e => safeReject(e));
      }
    });

    return wsPromise;
  }

  // ============ AIProvider Interface ============

  async generateText(): Promise<never> {
    throw new Error('Text generation is not supported by ComfyUI');
  }

  async generateJSON(): Promise<never> {
    throw new Error('JSON generation is not supported by ComfyUI');
  }

  async generateImage(
    prompt: string,
    options?: GenerationOptions & {
      width?: number;
      height?: number;
      negativePrompt?: string;
      workflowPath?: string;
      workflowInputs?: Record<string, any>;
      outputNodeId?: string;
      model?: string;
      steps?: number;
      cfg?: number;
      seed?: number;
      samplerName?: string;
      scheduler?: string;
    }
  ): Promise<ImageGenerationResult> {
        const negativePrompt = options?.negativePrompt || '';
    const width = options?.width || this.defaultImageWidth;
    const height = options?.height || this.defaultImageHeight;

    // ========== DEBUG: Log exact prompts received ==========
    console.log('');
    console.log('========== COMFYUI PROVIDER generateImage ==========');
    console.log('[RECEIVED PROMPT]', prompt);
    console.log('[RECEIVED NEGATIVE]', negativePrompt);
    console.log('[RECEIVED WORKFLOW]', options?.workflowPath);
    console.log('[RECEIVED SEED]', options?.seed);
    console.log('[RECEIVED MODEL]', options?.model);
    console.log('===================================================');
    console.log('');

    // ========== WORKFLOW SOURCE SELECTION ==========
    // If a workflowPath is provided, load the workflow JSON file as the source of truth.
    // Only inject prompt, negative, seed, width, height.
    // All other settings (sampler, scheduler, steps, cfg, refiner) come from the file.
    let workflow: Record<string, any>;
    
        if (options?.workflowPath) {
      console.log('[WORKFLOW SOURCE] Loading from file:', options.workflowPath);
      workflow = await this.loadWorkflowFromFile(options.workflowPath, {
        prompt,
        negativePrompt,
        seed: options?.seed,
        width,
        height,
      });
      console.log('[WORKFLOW SOURCE] File-based workflow loaded - settings preserved from JSON');
    } else {
      console.log('[WORKFLOW PATH MISSING] No workflowPath provided - building dynamically');
      console.log('[WORKFLOW SOURCE] No workflow path - building dynamically');
      workflow = this.buildPromptWorkflow({
        prompt,
        negativePrompt,
        model: options?.model,
        width,
        height,
        seed: options?.seed,
        steps: typeof options?.steps === 'number' ? options.steps : undefined,
        cfg: typeof options?.cfg === 'number' ? options.cfg : undefined,
        samplerName: options?.samplerName,
        scheduler: options?.scheduler,
        filenamePrefix: 'seri_ai',
      });
    }

    if (options?.workflowInputs) {
      // Only merge workflowInputs that are actual node definitions, not parameter overrides
      for (const [key, val] of Object.entries(options.workflowInputs)) {
        if (val && typeof val === 'object' && val.class_type) {
          workflow[key] = val;
        }
      }
    }

        // ========== DEBUG: Log dimension diagnostics ==========
    console.log('');
    console.log('========== COMFYUI WORKFLOW DIMENSION DIAGNOSTIC ==========');
    console.log('[PROVIDER DIMENSIONS] defaultImageWidth:', this.defaultImageWidth, 'defaultImageHeight:', this.defaultImageHeight);
    console.log('[PROVIDER DIMENSIONS] Passed width:', width, 'height:', height);
    console.log('[PROVIDER DIMENSIONS] Model:', options?.model || 'not specified');
    const isSdxl = (options?.model || '').toLowerCase().includes('xl');
    console.log('[PROVIDER DIMENSIONS] Is SDXL model:', isSdxl);
    if (isSdxl && (width < 768 || height < 768)) {
      console.warn('[PROVIDER DIMENSIONS] WARNING: SDXL model with sub-768px resolution! Will produce corrupted images!');
    }
    console.log('==========================================================');
    console.log('');

    // ========== DEBUG: Log full workflow details ==========
    console.log('');
    console.log('========== COMFYUI WORKFLOW DEBUG ==========');
    // Find and log key nodes dynamically
    for (const [key, node] of Object.entries<any>(workflow)) {
      if (node.class_type === 'CheckpointLoaderSimple') {
        console.log('[WORKFLOW CHECKPOINT]', node.inputs?.ckpt_name || 'unknown');
      }
      if (node.class_type === 'CLIPTextEncode') {
        console.log('[WORKFLOW PROMPT]', (node.inputs?.text || 'unknown').slice(0, 100));
      }
      if (node.class_type === 'EmptyLatentImage') {
        console.log('[WORKFLOW WIDTH]', node.inputs?.width || 'unknown');
        console.log('[WORKFLOW HEIGHT]', node.inputs?.height || 'unknown');
      }
      if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
        console.log('[WORKFLOW SAMPLER]', node.inputs?.sampler_name || 'unknown');
        console.log('[WORKFLOW SCHEDULER]', node.inputs?.scheduler || 'unknown');
        console.log('[WORKFLOW STEPS]', node.inputs?.steps || 'unknown');
        console.log('[WORKFLOW CFG]', node.inputs?.cfg || 'unknown');
        console.log('[WORKFLOW SEED]', node.inputs?.seed || 'unknown');
        console.log('[WORKFLOW DENOISE]', node.inputs?.denoise || 'unknown');
      }
    }
    console.log('[REFINER USED]', workflow["10"] ? 'yes (node 10 present)' : 'no');
        console.log('[FULL WORKFLOW JSON]', JSON.stringify(workflow, null, 2));
    console.log('============================================');
    console.log('');

                // ========== ACTIVE WORKFLOW VERIFICATION (before queue) ==========
    const checkpointFromNode = workflow["4"]?.inputs?.ckpt_name || 
                               Object.values(workflow).find((n: any) => n.class_type === 'CheckpointLoaderSimple')?.inputs?.ckpt_name || 
                               'NOT FOUND';
    const emptyLatentNode = workflow["5"] || Object.values(workflow).find((n: any) => n.class_type === 'EmptyLatentImage');
    const activeWidth = emptyLatentNode?.inputs?.width || 'UNKNOWN';
    const activeHeight = emptyLatentNode?.inputs?.height || 'UNKNOWN';
    const workflowFileUsed = options?.workflowPath || 'DYNAMIC (no file)';
    const isSdxlModel = (checkpointFromNode as string).toLowerCase().includes('xl');
    const isIPAdapterWorkflow = workflowFileUsed.includes('ipadapter');
    
    // Detect IPAdapter and LoRA nodes dynamically
    const hasLoRANode = Object.values(workflow).some((n: any) => n.class_type === 'LoraLoader');
    const hasIPAdapterNode = Object.values(workflow).some((n: any) => n.class_type === 'IPAdapterAdvanced');
    const hasIPAdapterModelLoader = Object.values(workflow).some((n: any) => n.class_type === 'IPAdapterModelLoader');
    const hasCLIPVisionLoader = Object.values(workflow).some((n: any) => n.class_type === 'CLIPVisionLoader');
    const hasLoadImageNode = Object.values(workflow).some((n: any) => n.class_type === 'LoadImage');
    
    // Find reference image path from LoadImage node if present
    const loadImageNode = Object.values(workflow).find((n: any) => n.class_type === 'LoadImage');
    const referenceImagePath = loadImageNode?.inputs?.image || 'NONE';
    
    console.log('');
    console.log('========== PRE-QUEUE WORKFLOW VERIFICATION ==========');
    console.log('[ACTIVE WORKFLOW FILE]', workflowFileUsed);
    console.log('[ACTIVE CHECKPOINT]', options?.model || 'not passed');
    console.log('[WORKFLOW CHECKPOINT NODE VALUE]', checkpointFromNode);
    console.log('[HAS LORA NODE]', hasLoRANode ? 'YES' : 'NO');
    console.log('[HAS IPADAPTER NODE]', hasIPAdapterNode ? 'YES' : 'NO');
    console.log('[HAS IPADAPTER MODEL LOADER]', hasIPAdapterModelLoader ? 'YES' : 'NO');
    console.log('[HAS CLIP VISION LOADER]', hasCLIPVisionLoader ? 'YES' : 'NO');
    console.log('[LOAD IMAGE NODE REFERENCE]', referenceImagePath);
    console.log('[ACTIVE WIDTH HEIGHT]', activeWidth, 'x', activeHeight);
    console.log('[IS_SDXL_MODEL]', isSdxlModel);
    console.log('[IPADAPTER WORKFLOW]', isIPAdapterWorkflow ? 'YES' : 'NO');
    
    // HARD VALIDATION: IPAdapter workflow MUST have all required nodes
    if (isIPAdapterWorkflow) {
      const missingNodes: string[] = [];
      if (!hasIPAdapterNode) missingNodes.push('IPAdapterAdvanced');
      if (!hasIPAdapterModelLoader) missingNodes.push('IPAdapterModelLoader');
      if (!hasCLIPVisionLoader) missingNodes.push('CLIPVisionLoader');
      if (!hasLoadImageNode) missingNodes.push('LoadImage');
      
      if (missingNodes.length > 0) {
        const errorMsg = 'IPAdapter workflow "' + workflowFileUsed + '" is missing required nodes: ' +
          missingNodes.join(', ') + '. ' +
          'These nodes are essential for identity preservation. ' +
          'Cannot proceed with generation.';
        console.error('[WORKFLOW VALIDATION] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // HARD VALIDATION: IPAdapter workflow MUST have a reference image path
      if (!referenceImagePath || referenceImagePath === 'NONE' || referenceImagePath.trim().length === 0) {
        const errorMsg = 'IPAdapter workflow "' + workflowFileUsed + '" requires a reference image ' +
          'in the Load Image node, but none was provided. ' +
          'Inject the character reference image before queueing.';
        console.error('[WORKFLOW VALIDATION] FATAL:', errorMsg);
        throw new Error(errorMsg);
      }
    }
    
    // HARD VALIDATION: If the workflow is a fallback (dynamic build) when a file was expected, abort
    if (options?.workflowPath && 
        !options.workflowPath.includes('pixar_disney_stable') && 
        workflow["3"]?.class_type === 'KSampler' && 
        !Object.keys(workflow).some(k => parseInt(k) > 9)) {
      const isMissingFile = workflowFileUsed !== 'DYNAMIC (no file)' && 
        !workflowFileUsed.includes('pixar_disney_stable');
      if (isMissingFile) {
        console.error('[WORKFLOW ERROR] Expected file workflow but fallback was used! File may be missing:', workflowFileUsed);
        console.error('[WORKFLOW ERROR] The fallback buildPromptWorkflow() generates generic settings.');
        console.error('[WORKFLOW ERROR] Aborting generation to prevent corrupted/glitched image.');
        throw new Error(
          'Workflow file "' + workflowFileUsed + '" not found or invalid. ' +
          'Fallback dynamic build was used but is not allowed. ' +
          'Checkpoint node value: "' + checkpointFromNode + '".'
        );
      }
    }
    console.log('=====================================================');
    console.log('');

const promptId = await this.queuePrompt(workflow);
    const result = await this.waitForPrompt(promptId);
    const imageUrls = result.images.map(img => `${this.baseUrl}${img}`);
    const fullImageUrl = imageUrls[0] || '';

    return {
      url: fullImageUrl,
      metadata: { width, height, prompt, negative_prompt: negativePrompt, workflow: 'dynamic', all_images: imageUrls },
      raw: result,
    };
  }

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
    const workflow = this.buildPromptWorkflow({
      prompt,
      negativePrompt: options?.negativePrompt,
      width: options?.width || 512,
      height: options?.height || 512,
      seed: options?.seed,
      steps: 30,
      cfg: 7,
      filenamePrefix: 'seri_ai_video',
    });

    const promptId = await this.queuePrompt(workflow);
    const result = await this.waitForPrompt(promptId);

    const videoUrls = result.videos.map(v => `${this.baseUrl}${v}`);
    const imageUrls = result.images.map(v => `${this.baseUrl}${v}`);

    return {
      url: videoUrls[0] || imageUrls[0] || '',
      metadata: {
        width: options?.width || 512,
        height: options?.height || 512,
        duration: options?.durationSeconds,
        fps: options?.fps,
        workflow: 'dynamic-video',
        prompt,
      },
      raw: result,
    };
  }
}