import type { AIProviderType } from '../../types';

export interface AIProviderConfig {
  type: AIProviderType;
  name: string;
  enabled: boolean;
  capabilities: AICapability[];
}

export type AICapability = 'image_generation' | 'video_generation' | 'text_generation' | 'image_to_video' | 'inpainting' | 'upscaling';

export interface AIGenerationRequest {
  provider: AIProviderType;
  prompt: string;
  negative_prompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
  model?: string;
  settings?: Record<string, unknown>;
}

export interface AIGenerationResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output_url?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const providerRegistry: AIProviderConfig[] = [
  { type: 'comfyui', name: 'ComfyUI', enabled: false, capabilities: ['image_generation', 'inpainting', 'upscaling'] },
  { type: 'stable_diffusion', name: 'Stable Diffusion', enabled: false, capabilities: ['image_generation', 'inpainting'] },
  { type: 'wan', name: 'WAN', enabled: false, capabilities: ['video_generation', 'image_to_video'] },
  { type: 'kling', name: 'Kling', enabled: false, capabilities: ['video_generation', 'image_to_video'] },
  { type: 'runway', name: 'Runway', enabled: false, capabilities: ['video_generation', 'image_to_video'] },
  { type: 'openai', name: 'OpenAI', enabled: false, capabilities: ['image_generation', 'text_generation'] },
  { type: 'ollama', name: 'Ollama', enabled: false, capabilities: ['text_generation'] },
];

export function getProviders(): AIProviderConfig[] {
  return providerRegistry;
}

export function getProvidersByCapability(capability: AICapability): AIProviderConfig[] {
  return providerRegistry.filter((p) => p.capabilities.includes(capability));
}

export async function generateImage(request: AIGenerationRequest): Promise<AIGenerationResponse> {
  const provider = providerRegistry.find((p) => p.type === request.provider);
  if (!provider) {
    return { id: '', status: 'failed', error: `Provider ${request.provider} not found` };
  }
  return { id: crypto.randomUUID(), status: 'pending' };
}

export async function generateVideo(request: AIGenerationRequest): Promise<AIGenerationResponse> {
  const provider = providerRegistry.find((p) => p.type === request.provider);
  if (!provider) {
    return { id: '', status: 'failed', error: `Provider ${request.provider} not found` };
  }
  return { id: crypto.randomUUID(), status: 'pending' };
}

export async function generateText(request: AIGenerationRequest): Promise<AIGenerationResponse> {
  const provider = providerRegistry.find((p) => p.type === request.provider);
  if (!provider) {
    return { id: '', status: 'failed', error: `Provider ${request.provider} not found` };
  }
  return { id: crypto.randomUUID(), status: 'pending' };
}
