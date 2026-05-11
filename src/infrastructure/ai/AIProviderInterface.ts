export type AICapability = 
  | 'text-generation'
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'text-to-speech'
  | 'text-to-music'
  | 'character-generation'
  | 'scene-generation'
  | 'story-generation'
  | 'narrative-structure'
  | 'prompt-enhancement';

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  additionalParams?: Record<string, any>;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  format?: 'json' | 'text' | 'markdown';
  additionalParams?: Record<string, any>;
}

export interface TextGenerationResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: any;
}

export interface ImageGenerationResult {
  url: string;
  metadata?: Record<string, any>;
  raw?: any;
}

export interface VideoGenerationResult {
  url: string;
  metadata?: Record<string, any>;
  raw?: any;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AICapability[];

  // Provider status
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<{
    available: boolean;
    message?: string;
    latency?: number;
  }>;
  
  // Text generation
  generateText(
    prompt: string,
    options?: GenerationOptions
  ): Promise<TextGenerationResult>;
  
  // Structured generation
  generateJSON<T>(
    prompt: string,
    options?: GenerationOptions
  ): Promise<T>;
  
  // Image generation
  generateImage?(
    prompt: string,
    options?: GenerationOptions & {
      width?: number;
      height?: number;
      negativePrompt?: string;
    }
  ): Promise<ImageGenerationResult>;
  
  // Video generation
  generateVideo?(
    prompt: string,
    options?: GenerationOptions & {
      durationSeconds?: number;
      width?: number;
      height?: number;
      negativePrompt?: string;
      fps?: number;
    }
  ): Promise<VideoGenerationResult>;
  
  // Other capabilities can be added as needed
}