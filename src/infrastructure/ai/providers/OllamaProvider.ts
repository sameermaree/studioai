import { AICapability, AIProvider, AIProviderConfig, GenerationOptions, TextGenerationResult } from "../AIProviderInterface";

export interface OllamaConfig extends AIProviderConfig {
  baseUrl: string;
  model: string;
}

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  readonly capabilities: AICapability[] = [
    'text-generation',
    'narrative-structure',
    'prompt-enhancement',
    'story-generation',
    'scene-generation'
  ];
  
  private baseUrl: string;
  private model: string;
  private additionalParams: Record<string, any>;
  
  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434/api';
    this.model = config.model || 'qwen2.5-coder:14b';
    this.additionalParams = config.additionalParams || {};
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tags`);
      return response.ok;
    } catch (error) {
      console.error('Ollama availability check failed:', error);
      return false;
    }
  }
  
  async getStatus(): Promise<{ available: boolean; message?: string; latency?: number }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/tags`);
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        return {
          available: true,
          message: 'Ollama is available',
          latency
        };
      } else {
        return {
          available: false,
          message: `Ollama returned status ${response.status}`,
          latency
        };
      }
    } catch (error) {
      return {
        available: false,
        message: `Failed to connect to Ollama: ${error instanceof Error ? error.message : String(error)}`,
        latency: Date.now() - startTime
      };
    }
  }
  
  async generateText(prompt: string, options?: GenerationOptions): Promise<TextGenerationResult> {
    const endpoint = `${this.baseUrl}/generate`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            top_p: 0.9,
            top_k: 40,
            max_tokens: options?.maxTokens,
            seed: options?.seed,
            ...this.additionalParams,
            ...options?.additionalParams,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data?.response) {
        throw new Error('Invalid response from Ollama');
      }
      
      return {
        text: data.response,
        raw: data
      };
    } catch (error) {
      console.error('Ollama text generation error:', error);
      throw error;
    }
  }
  
  async generateJSON<T>(prompt: string, options?: GenerationOptions): Promise<T> {
    // For Ollama, we need to parse the response text as JSON
    const jsonPrompt = `
${prompt}

Important: Your response must be a valid JSON object with no explanations or markdown formatting around it.
Do not include any text before or after the JSON.
Do not use triple backticks.
Just output raw, valid, parseable JSON.
`;

    try {
      const result = await this.generateText(jsonPrompt, options);
      const text = result.text.trim();
      
      // Extract clean JSON using helper function
      const cleanJson = extractJsonFromText(text);
      
      // Try to parse JSON
      try {
        return JSON.parse(cleanJson) as T;
      } catch (parseError) {
        console.error('JSON.parse failed:', parseError);
        console.error('Raw text:', text.substring(0, 200));
        console.error('Extracted JSON:', cleanJson.substring(0, 200));
        throw new Error(`Invalid JSON structure: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    } catch (error) {
      console.error('Ollama generateJSON error:', error);
      throw error;
    }
  }
}

// Helper function to extract clean JSON from text that might have markdown or other content
export function extractJsonFromText(text: string): string {
  // Try to find content between ```json and ```
  const jsonCodeBlockPattern = /```json\s*([\s\S]*?)\s*```/;
  const jsonCodeBlockMatch = text.match(jsonCodeBlockPattern);
  
  if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
    return jsonCodeBlockMatch[1].trim();
  }
  
  // Try to find content between ``` and ```
  const codeBlockPattern = /```\s*([\s\S]*?)\s*```/;
  const codeBlockMatch = text.match(codeBlockPattern);
  
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }
  
  // Try to find JSON array (starts with [ and ends with ])
  const jsonArrayPattern = /(\[[\s\S]*\])/;
  const jsonArrayMatch = text.match(jsonArrayPattern);
  
  if (jsonArrayMatch && jsonArrayMatch[1]) {
    // Validate it's valid JSON
    try {
      JSON.parse(jsonArrayMatch[1]);
      return jsonArrayMatch[1].trim();
    } catch (e) {
      // Not valid JSON, continue
    }
  }
  
  // Try to find JSON object (starts with { and ends with })
  const jsonObjectPattern = /(\{[\s\S]*\})/;
  const jsonObjectMatch = text.match(jsonObjectPattern);
  
  if (jsonObjectMatch && jsonObjectMatch[1]) {
    return jsonObjectMatch[1].trim();
  }
  
  // If we can't find JSON, return the original text
  return text.trim();
}