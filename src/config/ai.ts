/**
 * AI provider configuration
 *
 * narrativeProvider: "deepseek" | "ollama"
 * - "deepseek": Use DeepSeek API as primary for narrative/story/scene generation (recommended)
 * - "ollama": Use local Ollama as primary (fallback if DeepSeek unavailable)
 */
export const aiConfig = {
  // Preferred provider for narrative/story/scene generation (not image generation)
  narrativeProvider: (import.meta.env.VITE_NARRATIVE_PROVIDER as string) || 'deepseek',

  deepseek: {
    apiKey: (import.meta.env.VITE_DEEPSEEK_API_KEY as string) || '',
    model: 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 4000,
    capabilities: [
      'text-generation',
      'narrative-structure',
      'prompt-enhancement',
      'story-generation',
      'scene-generation',
    ],
  },

  ollama: {
    // Base URL for Ollama API
    baseUrl: 'http://localhost:11434/api',
    
    // Default model to use
    model: 'qwen2.5-coder:14b',
    
    // Generation parameters
    temperature: 0.7,
    maxTokens: 4000,
    
    // Capabilities enabled
    capabilities: [
      'text-generation',
      'narrative-structure',
      'prompt-enhancement',
      'story-generation',
      'scene-generation',
    ],
  },
  
  // Provider preferences — DeepSeek is primary, Ollama is fallback
  preferences: {
    'text-generation': ['deepseek', 'ollama'],
    'narrative-structure': ['deepseek', 'ollama'],
    'story-generation': ['deepseek', 'ollama'],
    'scene-generation': ['deepseek', 'ollama'],
  },
};