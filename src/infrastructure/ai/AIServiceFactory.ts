import { AIProvider, AIProviderConfig } from "./AIProviderInterface";
import { OllamaProvider } from "./providers/OllamaProvider";
import { AIProviderRegistry } from "./AIProviderRegistry";

// Add more provider imports as they are implemented

export class AIServiceFactory {
  /**
   * Create an AI provider based on configuration
   */
  static createProvider(type: string, config: AIProviderConfig): AIProvider {
    switch (type) {
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
    // Initialize Ollama provider
    const ollamaConfig = providerConfigs.ollama || {};
    const ollamaProvider = new OllamaProvider({
      baseUrl: ollamaConfig.baseUrl || 'http://localhost:11434/api',
      model: ollamaConfig.model || 'qwen2.5-coder:14b',
      ...ollamaConfig,
    });
    
    registry.registerProvider(ollamaProvider);
    
    // Initialize other providers as they are implemented
  }
}