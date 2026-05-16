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
      
      console.log('Ollama raw response length:', text.length);
      console.log('Ollama raw response preview:', text.substring(0, 150));
      
      // Extract clean JSON using helper function
      const cleanJson = extractJsonFromText(text);
      console.log('Extracted JSON length:', cleanJson.length);
      console.log('Extracted JSON preview:', cleanJson.substring(0, 150));
      
      // Use safe JSON parse with sanitization and auto-repair
      const parsed = safeJsonParse<T>(cleanJson);
      
      // Validate it's not empty
      if (typeof parsed === 'object' && parsed !== null) {
        if ('scenes' in parsed && Array.isArray(parsed.scenes)) {
          if (parsed.scenes.length === 0) {
            throw new Error('Ollama returned empty scenes array');
          }
          console.log(`Ollama returned ${parsed.scenes.length} scenes`);
        }
      }
      
      return parsed;
    } catch (error) {
      console.error('Ollama generateJSON error:', error);
      throw error;
    }
  }
}

/**
 * Safe JSON parse with sanitization and auto-repair.
 * Handles:
 * - Raw line breaks inside JSON strings
 * - Invalid control characters
 * - Invisible unicode control chars
 * - Preserves Arabic text
 * Never crashes the workflow — always logs and attempts repair.
 */
function safeJsonParse<T>(raw: string): T {
  // Step 1: Sanitize control characters before parsing
  const sanitized = raw
    // Escape literal newlines inside JSON strings (they are only valid as \\n)
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    // Remove invalid control characters (U+0000-U+001F except \\t \\n \\r which are already escaped)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    // Remove Unicode control characters (zero-width space, BOM, etc.)
    .replace(/[\u200B-\u200F\u2028\u2029\uFEFF]/g, '')
    // Remove trailing commas (common LLM issue)
    .replace(/,(\s*[}\]])/g, '$1');

  console.log('[JSON SANITIZE] Original length:', raw.length, 'Sanitized length:', sanitized.length);

  try {
    const parsed = JSON.parse(sanitized) as T;
    console.log('[JSON PARSE SUCCESS] Type:', typeof parsed);
    return parsed;
  } catch (firstError) {
    console.log('[JSON REPAIR] First parse failed, attempting auto-repair...');

    // Try extracting robust JSON structure
    const repairs: string[] = [
      // Repair: Remove BOM/leading junk
      sanitized.replace(/^\uFEFF/, '').trim(),
      // Repair: Extract content between first { and last }
      (() => {
        const start = sanitized.indexOf('{');
        const end = sanitized.lastIndexOf('}');
        return start >= 0 && end > start ? sanitized.slice(start, end + 1) : sanitized;
      })(),
      // Repair: Extract content between first [ and last ]
      (() => {
        const start = sanitized.indexOf('[');
        const end = sanitized.lastIndexOf(']');
        return start >= 0 && end > start ? sanitized.slice(start, end + 1) : sanitized;
      })(),
    ];

    for (const attempt of repairs) {
      try {
        const parsed = JSON.parse(attempt) as T;
        console.log('[JSON REPAIR] Success after repair, length:', attempt.length);
        return parsed;
      } catch {
        continue;
      }
    }

    // Final fallback — regex extraction of any JSON structure
    console.log('[JSON PARSE FAILED] All repairs failed. Fallback: regex extraction');
    const jsonObjMatch = sanitized.match(/\{[\s\S]*\}/);
    const jsonArrMatch = sanitized.match(/\[[\s\S]*\]/);
    const fallbackStr = jsonObjMatch?.[0] || jsonArrMatch?.[0] || '';
    if (fallbackStr) {
      try {
        const parsed = JSON.parse(fallbackStr) as T;
        console.log('[JSON REPAIR] Fallback regex extraction succeeded');
        return parsed;
      } catch {
        // Last resort
      }
    }

    console.error('[JSON PARSE FAILED] Raw preview (first 500):', raw.substring(0, 500));
    throw new Error(`Ollama JSON parsing failed after all repair attempts: ${firstError instanceof Error ? firstError.message : String(firstError)}`);
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