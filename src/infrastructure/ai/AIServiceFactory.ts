import { AIProvider, AIProviderConfig } from "./AIProviderInterface";
import { OllamaProvider } from "./providers/OllamaProvider";
import { DeepSeekProvider } from "./providers/DeepSeekProvider";
import { AIProviderRegistry } from "./AIProviderRegistry";

// Add more provider imports as they are implemented

export class AIServiceFactory {
  /**
   * Create an AI provider based on configuration
   */
  static createProvider(type: string, config: AIProviderConfig): AIProvider {
    switch (type) {
      case 'deepseek':
        return new DeepSeekProvider({
          ...config,
          apiKey: config.apiKey || '',
          model: config.model || 'deepseek-chat',
        });

      case 'ollama':
        return new OllamaProvider({
          ...config,
          baseUrl: config.baseUrl || 'http://localhost:11434/api',
          model: config.model || 'qwen2.5-coder:14b',
        });
      
      // Add cases for other providers as they are implemented
      
      default:
        throw new Error(`Unknown AI provider type: ${type}`);
    }
  }
  
  /**
   * Initialize the AI provider registry with available providers
   */
  static initializeRegistry(
    registry: AIProviderRegistry, 
    providerConfigs: Record<string, AIProviderConfig> = {}
  ): void {
    // Initialize DeepSeek provider (primary for narrative/story)
    const deepseekConfig = providerConfigs.deepseek || {};
    const deepseekApiKey = deepseekConfig.apiKey || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_DEEPSEEK_API_KEY : '') || '';
    
    if (deepseekApiKey) {
      const deepseekProvider = new DeepSeekProvider({
        apiKey: deepseekApiKey,
        model: deepseekConfig.model || 'deepseek-chat',
        ...deepseekConfig,
      });
      registry.registerProvider(deepseekProvider);
      console.log('[AI REGISTRY] DeepSeek provider registered (primary for narrative generation)');
    } else {
      console.warn('[AI REGISTRY] No DeepSeek API key found. VITE_DEEPSEEK_API_KEY not set. Ollama will be used as primary.');
    }

    // Initialize Ollama provider (fallback)
    const ollamaConfig = providerConfigs.ollama || {};
    const ollamaProvider = new OllamaProvider({
      baseUrl: ollamaConfig.baseUrl || 'http://localhost:11434/api',
      model: ollamaConfig.model || 'qwen2.5-coder:14b',
      ...ollamaConfig,
    });
    registry.registerProvider(ollamaProvider);
    console.log('[AI REGISTRY] Ollama provider registered (fallback for narrative generation)');
    
    // Initialize other providers as they are implemented
  }
}