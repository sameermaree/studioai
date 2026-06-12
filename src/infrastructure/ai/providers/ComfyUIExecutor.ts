/**
 * ComfyUIExecutor
 *
 * Ultra-thin deterministic provider for ComfyUI.
 *
 * Architecture rules:
 * 1. Workflows are IMMUTABLE JSON templates — never mutated or repaired
 * 2. No dynamic workflow generation — no buildPromptWorkflow()
 * 3. No automatic fallback — if a workflow file is missing, throw
 * 4. No node auto-repair — if nodes are missing, throw
 * 5. No smart rerouting — no workflowInputs merging into the workflow
 *
 * Provider responsibilities ONLY:
 *   - load workflow JSON from the API
 *   - inject prompt / negative / seed / width / height into predefined node IDs
 *   - send to ComfyUI API
 *   - return output image URLs
 *
 * Callers must copy reference images to ComfyUI's input directory
 * and pass only the filename (e.g. "character_ref.png") in LoadImage nodes.
 */

import type {
  AICapability,
  AIProvider,
  AIProviderConfig,
  GenerationOptions,
  ImageGenerationResult,
  VideoGenerationResult,
} from '../AIProviderInterface';

export interface ComfyUIExecutorConfig extends AIProviderConfig {
  baseUrl: string;
  clientId?: string;
  connectionTimeout?: number;
}

// Which node IDs to inject runtime values into.
// The workflow JSON template defines all other parameters (sampler, scheduler, steps, cfg, etc.).
interface InjectionTargets {
  kSampler: string;         // seed injection
  emptyLatent: string;      // width, height injection
  positivePrompt: string;   // prompt injection
  negativePrompt: string;   // negative prompt injection
}

const DEFAULT_TARGETS: InjectionTargets = {
  kSampler: '3',
  emptyLatent: '5',
  positivePrompt: '6',
  negativePrompt: '7',
};

export class ComfyUIExecutor implements AIProvider {
  readonly id = 'comfyui-executor';
  readonly name = 'ComfyUI Executor';
  readonly capabilities: AICapability[] = ['text-to-image', 'image-to-image'];

  private baseUrl: string;
  private clientId: string;
  private connectionTimeout: number;

  constructor(config: ComfyUIExecutorConfig) {
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:8188';
    this.clientId = config.clientId || `seri-ai-exec-${Date.now()}`;
    this.connectionTimeout = config.connectionTimeout || 30_000;
  }

  // -------- AIProvider interface (no-ops) --------

  async isAvailable(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), this.connectionTimeout);
      const res = await fetch(`${this.baseUrl}/system_stats`, { signal: ctrl.signal });
      clearTimeout(id);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<{ available: boolean; message?: string; latency?: number }> {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), this.connectionTimeout);
      const res = await fetch(`${this.baseUrl}/system_stats`, { signal: ctrl.signal });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json();
        const devices = data?.devices ?? [];
        const gpu = devices.length > 0 ? devices.map((d: any) => d.name).join(', ') : 'unknown';
        return { available: true, message: `ComfyUI | GPU: ${gpu}`, latency: Date.now() - start };
      }
      return { available: false, message: `ComfyUI HTTP ${res.status}`, latency: Date.now() - start };
    } catch (err) {
      return { available: false, message: String(err), latency: Date.now() - start };
    }
  }

  async generateText(): Promise<never> { throw new Error('Not supported'); }
  async generateJSON<T>(): Promise<T> { throw new Error('Not supported'); }

  // -------- Image generation (deterministic JSON-first) --------

  async generateImage(
    prompt: string,
    options?: GenerationOptions & {
      width?: number;
      height?: number;
      negativePrompt?: string;
      /** Path to the workflow JSON file (relative to project workflows/) */
      workflowPath?: string;
      /** Optional: raw node to inject into the workflow (e.g. LoadImage for IPAdapter) */
      workflowInputs?: Record<string, any>;
      outputNodeId?: string;
      model?: string;
      seed?: number;
      steps?: number;
      cfg?: number;
      samplerName?: string;
      scheduler?: string;
    },
  ): Promise<ImageGenerationResult> {
    const negativePrompt = options?.negativePrompt ?? '';
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1024;
    const seed = options?.seed ?? Math.floor(Math.random() * 2_147_483_647);
    const workflowPath = options?.workflowPath;

    // ============================================================
    // 1. LOAD workflow JSON (immutable — never mutated beyond injection)
    // ============================================================
    if (!workflowPath) {
      throw new Error(
        '[ComfyUIExecutor] No workflowPath provided. ' +
        'JSON-first architecture requires a workflow file. ' +
        'Dynamic workflow generation is forbidden.',
      );
    }

    console.log('');
    console.log('========== COMFYUI EXECUTOR ==========');
    console.log('[WORKFLOW]', workflowPath);

    const workflow = await this.loadWorkflowJson(workflowPath);

    // ============================================================
    // 2. INJECT runtime values into predefined node IDs
    // ============================================================
    const targets = this.detectTargets(workflow);

    // Seed
    const ksampler = workflow[targets.kSampler];
    if (ksampler?.class_type === 'KSampler' || ksampler?.class_type === 'KSamplerAdvanced') {
      ksampler.inputs.seed = seed;
    }

    // Dimensions
    const latent = workflow[targets.emptyLatent];
    if (latent?.class_type === 'EmptyLatentImage') {
      latent.inputs.width = width;
      latent.inputs.height = height;
    }

    // Prompts — inject into CLIPTextEncode nodes in order
    const clipNodes = Object.entries(workflow)
      .filter(([, n]: any) => n.class_type === 'CLIPTextEncode')
      .sort(([a], [b]) => Number(a) - Number(b));

    if (clipNodes.length >= 1) {
      clipNodes[0][1].inputs.text = prompt;
    }
    if (clipNodes.length >= 2) {
      clipNodes[1][1].inputs.text = negativePrompt;
    }

    // ============================================================
    // 3. INJECT workflowInputs (ONLY for pre-authored node definitions)
    // ============================================================
    // Callers may supply extra nodes to inject (e.g. a LoadImage for IPAdapter).
    // These MUST be complete node definitions (class_type + inputs).
    if (options?.workflowInputs) {
      for (const [key, val] of Object.entries(options.workflowInputs)) {
        if (val && typeof val === 'object' && (val as any).class_type) {
          // Validate: the caller MUST have already copied the reference image
          // to ComfyUI's input directory and set the filename.
          if ((val as any).class_type === 'LoadImage') {
            const imgPath = (val as any).inputs?.image;
            if (!imgPath || typeof imgPath !== 'string' || imgPath.trim().length === 0) {
              throw new Error(
                `[ComfyUIExecutor] LoadImage node (${key}) has no image path. ` +
                `Caller must copy the reference image to ComfyUI/input/ and set the filename.`,
              );
            }
            // Log the injection but do NOT modify the path
            console.log(`[LOAD IMAGE NODE REFERENCE] ${key}: ${imgPath}`);
          }
          workflow[key] = val;
        }
      }
    }

    // ============================================================
    // 4. LOG workflow state before queue
    // ============================================================
    this.logPreQueue(workflow, workflowPath);

    // ============================================================
    // 5. QUEUE to ComfyUI
    // ============================================================
    const promptId = await this.queuePrompt(workflow);

    // ============================================================
    // 6. WAIT for completion
    // ============================================================
    const result = await this.waitForPrompt(promptId);

    // ============================================================
    // 7. RETURN image URLs
    // ============================================================
    const imageUrls = result.images.map((img) => `${this.baseUrl}${img}`);
    const fullImageUrl = imageUrls[0] ?? '';

    console.log('[COMFYUI EXECUTOR] Done. Images:', imageUrls.length);
    console.log('==========================================');
    console.log('');

    return {
      url: fullImageUrl,
      metadata: { width, height, prompt, negative_prompt: negativePrompt, workflow: workflowPath, all_images: imageUrls },
      raw: result,
    };
  }

  // -------- Video generation (deterministic wrapper) --------

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
    },
  ): Promise<VideoGenerationResult> {
    const imgResult = await this.generateImage(prompt, { ...options, width: options?.width ?? 512, height: options?.height ?? 512 });
    return {
      url: imgResult.url,
      metadata: { ...imgResult.metadata, duration: options?.durationSeconds, fps: options?.fps },
      raw: imgResult.raw,
    };
  }

  // ==========================================
  // Private helpers
  // ==========================================

  /**
   * Fetch a workflow JSON file from the API and return a deep clone.
   * Throws if the file is not found or has invalid format.
   */
  private async loadWorkflowJson(workflowPath: string): Promise<Record<string, any>> {
    const fileName = workflowPath.split('/').pop() ?? workflowPath;
    console.log('[WORKFLOW LOADER] Loading:', fileName);

    const response = await fetch(`/api/workflows/${fileName}`);

    if (!response.ok) {
      throw new Error(
        `[ComfyUIExecutor] Workflow file "${workflowPath}" not found (HTTP ${response.status}). ` +
        `JSON-first architecture requires the file to exist. No fallback is available.`,
      );
    }

    const workflowData: unknown = await response.json();

    // Validate format: must be a flat object with numeric keys and class_type on each node
    if (typeof workflowData !== 'object' || workflowData === null || Array.isArray(workflowData)) {
      throw new Error(
        `[ComfyUIExecutor] Workflow file "${workflowPath}" has invalid format. ` +
        `Expected native ComfyUI API format (object with numeric keys, each having class_type).`,
      );
    }

    // Deep clone to prevent mutation of cached data
    const workflow: Record<string, any> = JSON.parse(JSON.stringify(workflowData));

    // Validate required nodes exist
    const hasKSampler = Object.values(workflow).some((n: any) =>
      n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced',
    );
    const hasCLIPText = Object.values(workflow).some((n: any) => n.class_type === 'CLIPTextEncode');
    // Accept either EmptyLatentImage (standard) or VAEEncode (strong-identity img2img)
    const hasEmptyLatent = Object.values(workflow).some((n: any) => n.class_type === 'EmptyLatentImage');
    const hasVAEEncode   = Object.values(workflow).some((n: any) => n.class_type === 'VAEEncode');
    const hasLatentSource = hasEmptyLatent || hasVAEEncode;

    if (!hasKSampler || !hasCLIPText || !hasLatentSource) {
      const missing: string[] = [];
      if (!hasKSampler) missing.push('KSampler/KSamplerAdvanced');
      if (!hasCLIPText) missing.push('CLIPTextEncode');
      if (!hasLatentSource) missing.push('EmptyLatentImage or VAEEncode');
      throw new Error(
        `[ComfyUIExecutor] Workflow "${workflowPath}" is missing required nodes: ${missing.join(', ')}.`,
      );
    }

    console.log('[WORKFLOW LOADER] Loaded successfully:', fileName);
    return workflow;
  }

  /**
   * Detect the node IDs for injection.
   * Uses defaults (3, 5, 6, 7) which match standard ComfyUI exports.
   */
  private detectTargets(workflow: Record<string, any>): InjectionTargets {
    // For standard workflows, the default targets work reliably.
    // If needed, this could be extended to auto-detect node IDs by class_type.
    return DEFAULT_TARGETS;
  }

  /**
   * Log the pre-queue state of the workflow.
   */
  private logPreQueue(workflow: Record<string, any>, workflowPath: string): void {
    const checkpoint = Object.values(workflow).find((n: any) => n.class_type === 'CheckpointLoaderSimple');
    // Support both EmptyLatentImage (standard) and VAEEncode (strong-identity) workflows
    const latent = Object.values(workflow).find((n: any) => n.class_type === 'EmptyLatentImage');
    const imageScale = Object.values(workflow).find((n: any) => n.class_type === 'ImageScale');
    const ksampler = Object.values(workflow).find((n: any) =>
      n.class_type === 'KSampler' || n.class_type === 'KSamplerAdvanced',
    );
    const hasLora = Object.values(workflow).some((n: any) => n.class_type === 'LoraLoader');
    const hasIpAdapter = Object.values(workflow).some((n: any) => n.class_type === 'IPAdapterAdvanced');

    console.log('');
    console.log('========== PRE-QUEUE WORKFLOW VERIFICATION ==========');
    console.log('[ACTIVE WORKFLOW FILE]', workflowPath);
    console.log('[ACTIVE CHECKPOINT]', checkpoint?.inputs?.ckpt_name ?? 'NOT FOUND');
    const displayW = latent?.inputs?.width ?? imageScale?.inputs?.width ?? '?';
    const displayH = latent?.inputs?.height ?? imageScale?.inputs?.height ?? '?';
    console.log('[ACTIVE WIDTH HEIGHT]', `${displayW} x ${displayH}`);
    console.log('[HAS LORA NODE]', hasLora ? 'YES' : 'NO');
    console.log('[HAS IPADAPTER NODE]', hasIpAdapter ? 'YES' : 'NO');
    console.log('[KSAMPLER SEED]', ksampler?.inputs?.seed ?? '?');
    console.log('[KSAMPLER STEPS]', ksampler?.inputs?.steps ?? '?');
    console.log('[KSAMPLER CFG]', ksampler?.inputs?.cfg ?? '?');
    console.log('[KSAMPLER SAMPLER]', ksampler?.inputs?.sampler_name ?? '?');
    console.log('[KSAMPLER SCHEDULER]', ksampler?.inputs?.scheduler ?? '?');
    console.log('=====================================================');
    console.log('');
  }

  /**
   * Queue a prompt to ComfyUI via the backend proxy.
   */
  private async queuePrompt(workflow: Record<string, any>): Promise<string> {
    const callClientId = `seri-ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const body = { prompt: workflow, client_id: callClientId };

    console.log('[QUEUE] Sending to ComfyUI...');
    const response = await fetch('/api/comfyui/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`[ComfyUIExecutor] Proxy returned invalid JSON: ${rawText.slice(0, 300)}`);
    }

    if (!response.ok) {
      throw new Error(
        `[ComfyUIExecutor] Queue failed (${response.status}): ${data?.error ?? data?.details ?? rawText.slice(0, 200)}`,
      );
    }

    const promptId: string = data.prompt_id;
    console.log('[QUEUE] Prompt queued:', promptId);
    return JSON.stringify({ prompt_id: promptId, client_id: callClientId });
  }

  /**
   * Wait for a prompt to finish using WebSocket + history fallback.
   */
  private async waitForPrompt(
    promptIdJson: string,
    timeoutMs = 300_000,
  ): Promise<{ images: string[]; videos: string[] }> {
    let parsed: { prompt_id: string; client_id: string };
    try {
      parsed = JSON.parse(promptIdJson);
    } catch {
      parsed = { prompt_id: promptIdJson, client_id: this.clientId };
    }
    const { prompt_id: promptId, client_id: callClientId } = parsed;

    const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    console.log('[WS] Connecting to:', `${wsUrl}/ws?clientId=${callClientId}`, 'for prompt', promptId);

    return new Promise<{ images: string[]; videos: string[] }>((resolve, reject) => {
      let ws: WebSocket | null = null;
      let settled = false;
      const images: string[] = [];
      const videos: string[] = [];
      const actualTimeout = Math.min(timeoutMs, 120_000);

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.log('[WS] TIMEOUT after', actualTimeout, 'ms');
          ws?.close();
          checkHistory().then(resolve).catch(() =>
            reject(new Error(`Prompt ${promptId} timed out after ${actualTimeout}ms`)),
          );
        }
      }, actualTimeout);

      async function checkHistory(): Promise<{ images: string[]; videos: string[] }> {
        console.log('[HISTORY] Polling', promptId);
        try {
          const res = await fetch(`/api/comfyui/history/${promptId}`);
          if (res.ok) {
            const hd = await res.json();
            const outputs = hd[promptId]?.outputs;
            if (outputs) {
              for (const no of Object.values<any>(outputs)) {
                if (no?.images) {
                  for (const img of no.images) {
                    const sub = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
                    images.push(`/view?filename=${encodeURIComponent(img.filename)}${sub}&type=${img.type || 'output'}`);
                  }
                }
                if (no?.videos) {
                  for (const vid of no.videos) {
                    const sub = vid.subfolder ? `&subfolder=${encodeURIComponent(vid.subfolder)}` : '';
                    videos.push(`/view?filename=${encodeURIComponent(vid.filename)}${sub}&type=${vid.type || 'output'}`);
                  }
                }
              }
            }
            if (images.length > 0 || videos.length > 0) return { images, videos };
          }
        } catch { /* retry below */ }
        throw new Error(`Prompt ${promptId} not found in history`);
      }

      function safeResolve(r: { images: string[]; videos: string[] }) {
        if (!settled) { settled = true; clearTimeout(timer); ws?.close(); resolve(r); }
      }
      function safeReject(e: Error) {
        if (!settled) { settled = true; clearTimeout(timer); ws?.close(); reject(e); }
      }

      try {
        ws = new WebSocket(`${wsUrl}/ws?clientId=${callClientId}`);
        ws.onopen = () => console.log('[WS] Connected');
        ws.onmessage = (ev) => {
          if (typeof ev.data !== 'string') return;
          try {
            const msg = JSON.parse(ev.data);
            if (msg.data?.prompt_id && msg.data.prompt_id !== promptId) return;

            if (msg.type === 'executed' && msg.data?.output) {
              const out = msg.data.output;
              if (out?.images) for (const img of out.images) {
                const sub = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
                images.push(`/view?filename=${encodeURIComponent(img.filename)}${sub}&type=${img.type || 'output'}`);
              }
              if (out?.videos) for (const vid of out.videos) {
                const sub = vid.subfolder ? `&subfolder=${encodeURIComponent(vid.subfolder)}` : '';
                videos.push(`/view?filename=${encodeURIComponent(vid.filename)}${sub}&type=${vid.type || 'output'}`);
              }
            }
            if (msg.type === 'execution_success' && msg.data?.prompt_id === promptId) {
              safeResolve({ images, videos });
            }
            if (msg.type === 'executing' && msg.data?.node === null && msg.data?.prompt_id === promptId) {
              if (images.length > 0 || videos.length > 0) safeResolve({ images, videos });
              else checkHistory().then(safeResolve).catch(() => {});
            }
            if (msg.type === 'execution_error' && msg.data?.prompt_id === promptId) {
              safeReject(new Error(msg.data.exception_message || 'ComfyUI execution error'));
            }
          } catch { /* skip binary */ }
        };
        ws.onerror = () => checkHistory().then(safeResolve).catch(() => safeReject(new Error('WebSocket error')));
        ws.onclose = () => {
          if (images.length > 0 || videos.length > 0) safeResolve({ images, videos });
          else checkHistory().then(safeResolve).catch(() => {});
        };
      } catch (err) {
        checkHistory().then(safeResolve).catch((e) => safeReject(e));
      }
    });
  }
}