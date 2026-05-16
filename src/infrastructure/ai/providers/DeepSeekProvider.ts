import { AICapability, AIProvider, AIProviderConfig, GenerationOptions, TextGenerationResult } from "../AIProviderInterface";

export interface DeepSeekConfig extends AIProviderConfig {
  apiKey: string;
  model?: string;
}

/**
 * DeepSeek API provider for narrative/story generation.
 *
 * Uses the DeepSeek Chat API (compatible with OpenAI's API format).
 * Primary provider for: story-generation, narrative-structure, scene-generation.
 * Fallback: OllamaProvider (local).
 *
 * API: POST https://api.deepseek.com/chat/completions
 * Docs: https://platform.deepseek.com/docs
 */
export class DeepSeekProvider implements AIProvider {
  readonly id = 'deepseek';
  readonly name = 'DeepSeek';
  readonly capabilities: AICapability[] = [
    'text-generation',
    'narrative-structure',
    'prompt-enhancement',
    'story-generation',
    'scene-generation',
  ];

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxRetries: number;
  private additionalParams: Record<string, any>;

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com';
    this.model = config.model || 'deepseek-chat';
    this.maxRetries = config.additionalParams?.maxRetries ?? 2;
    this.additionalParams = config.additionalParams || {};
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('DeepSeek availability check failed:', error);
      return false;
    }
  }

  async getStatus(): Promise<{ available: boolean; message?: string; latency?: number }> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });
      const latency = Date.now() - startTime;
      if (response.ok) {
        return { available: true, message: 'DeepSeek API is available', latency };
      } else {
        return { available: false, message: `DeepSeek API returned status ${response.status}`, latency };
      }
    } catch (error) {
      return {
        available: false,
        message: `Failed to connect to DeepSeek API: ${error instanceof Error ? error.message : String(error)}`,
        latency: Date.now() - startTime,
      };
    }
  }

  async generateText(prompt: string, options?: GenerationOptions): Promise<TextGenerationResult> {
    const endpoint = `${this.baseUrl}/v1/chat/completions`;

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a precise JSON generator. Always return valid, parseable JSON without markdown wrapping.' },
        { role: 'user', content: prompt },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4000,
      stream: false,
      ...this.additionalParams,
      ...options?.additionalParams,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[DEEPSEEK] Retry attempt ${attempt}/${this.maxRetries}...`);
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const data = await response.json();

        if (!data?.choices?.[0]?.message?.content) {
          throw new Error('Invalid response from DeepSeek: missing choices[0].message.content');
        }

        return {
          text: data.choices[0].message.content,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
          raw: data,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[DEEPSEEK] Attempt ${attempt + 1} failed:`, lastError.message);
        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('DeepSeek API failed after all retries');
  }

  async generateJSON<T>(prompt: string, options?: GenerationOptions): Promise<T> {
    // For DeepSeek, request JSON mode explicitly
    const jsonPrompt = `${prompt}

Return ONLY valid, parseable JSON. No markdown, no explanations, no code blocks. Just raw JSON.`;

    const jsonOptions: GenerationOptions = {
      ...options,
      temperature: 0.1, // Low temperature for reliable JSON
      additionalParams: {
        ...options?.additionalParams,
        response_format: { type: 'json_object' },
      },
    };

    try {
      const result = await this.generateText(jsonPrompt, jsonOptions);
      const text = result.text.trim();

      console.log('[DEEPSEEK] Raw response length:', text.length);
      console.log('[DEEPSEEK] Token usage:', result.usage ? `${result.usage.promptTokens}p + ${result.usage.completionTokens}c = ${result.usage.totalTokens}t` : 'N/A');

      // Attempt direct JSON parse first
      try {
        return JSON.parse(text) as T;
      } catch {
        // Fallback: extract JSON from response
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        const jsonStr = start >= 0 && end > start ? text.slice(start, end + 1) : text;
        return JSON.parse(jsonStr) as T;
      }
    } catch (error) {
      console.error('[DEEPSEEK] generateJSON error:', error);
      throw error;
    }
  }
}
