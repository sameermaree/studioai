/**
 * AI provider configuration
 */
export const aiConfig = {
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
      'scene-generation'
    ]
  },
  
  // Add more providers as they're implemented
  // openai: {
  //   apiKey: process.env.OPENAI_API_KEY,
  //   model: 'gpt-4',
  //   capabilities: ['text-generation', 'story-generation']
  // },
  
  // Provider preferences
  preferences: {
    'text-generation': ['ollama'],
    'narrative-structure': ['ollama'],
    'story-generation': ['ollama'],
    'scene-generation': ['ollama']
  }
};