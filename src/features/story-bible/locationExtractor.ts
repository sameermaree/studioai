/**
 * Location Extractor
 * Uses LLM (DeepSeek primary, Ollama fallback) to extract locations from stories.
 *
 * Provider priority:
 *   1. DeepSeek API (primary) — stable for long JSON generation
 *   2. Ollama (fallback) — local, used only if DeepSeek unavailable
 *   3. Empty result with clear error if both fail
 */

import type { LocationBibleEntry } from '../../types';
import { aiConfig } from '../../config/ai';
import { AIProviderRegistry } from '../../infrastructure/ai/AIProviderRegistry';
import { AIServiceFactory } from '../../infrastructure/ai/AIServiceFactory';

// Singleton registry for extractor use — lazily initialized
let _extractorRegistry: AIProviderRegistry | null = null;

function getExtractorRegistry(): AIProviderRegistry {
  if (!_extractorRegistry) {
    _extractorRegistry = new AIProviderRegistry();
    AIServiceFactory.initializeRegistry(_extractorRegistry, {
      deepseek: {
        apiKey: aiConfig.deepseek.apiKey,
        model: aiConfig.deepseek.model,
      },
      ollama: {
        baseUrl: aiConfig.ollama.baseUrl,
        model: aiConfig.ollama.model,
      },
    });
    // Set narrative provider preference: DeepSeek primary, Ollama fallback
    try {
      _extractorRegistry.setPreferredProviders('story-generation', ['deepseek', 'ollama']);
    } catch {
      // Fallback providers may not all support this capability
    }
  }
  return _extractorRegistry;
}

interface ExtractedLocationData {
  name: string;
  location_type: string;
  visual_description: string;
  environment_details: string;
  lighting: string;
  mood: string;
  props: string;
}

function extractJson(raw: string): string {
  const cleaned = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in LLM response');
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function buildLocationExtractionPrompt(story: string): string {
  return [
    'You are a story analyst for an AI animation studio. Your task is to extract ONLY the real locations/settings from the following story.',
    '',
    'Rules:',
    '- Extract ONLY named locations or clearly described settings where action takes place.',
    '- Do NOT extract abstract concepts, body parts, or objects that are not settings.',
    '- Do NOT invent locations that don\'t exist in the story.',
    '- Preserve Arabic names EXACTLY as written.',
    '- For English stories, preserve English names exactly.',
    '- Return ONLY valid JSON with NO markdown, NO explanations.',
    '',
    'Story:',
    '"""',
    story,
    '"""',
    '',
    'For each location, extract:',
    JSON.stringify({
      name: 'location name (exactly as in story)',
      location_type: 'type: school, classroom, park, home, house, street, market, hospital, library, garden, playground, forest, river, sea, mountain, city, village, room, or empty string if unknown',
      visual_description: 'what the location looks like according to the story',
      environment_details: 'specific details about the environment (layout, objects, etc.)',
      lighting: 'lighting conditions if mentioned, otherwise empty string',
      mood: 'atmosphere or mood if mentioned, otherwise empty string',
      props: 'notable props or objects in the location if mentioned, otherwise empty string',
    }, null, 2),
    '',
    'Return EXACTLY this JSON structure:',
    JSON.stringify({
      locations: [{
        name: '',
        location_type: '',
        visual_description: '',
        environment_details: '',
        lighting: '',
        mood: '',
        props: '',
      }],
    }, null, 2),
  ].join('\n');
}

/**
 * Call AI provider chain for extraction (DeepSeek primary, Ollama fallback).
 */
async function callAIProvider(prompt: string): Promise<string> {
  const registry = getExtractorRegistry();
  const providers = await registry.getFallbackChain('story-generation');

  if (providers.length === 0) {
    throw new Error(
      'No AI providers available for location extraction. ' +
      'Set VITE_DEEPSEEK_API_KEY in .env or ensure Ollama is running at http://localhost:11434.'
    );
  }

  console.log(`[LOCATION EXTRACTOR] Available providers: ${providers.map(p => p.id).join(', ')}`);
  console.log(`[LOCATION EXTRACTOR] Primary: ${providers[0]?.id} | Fallback: ${providers[1]?.id || 'none'}`);

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`[LOCATION EXTRACTOR] Trying provider: ${provider.id}`);
      const result = await provider.generateJSON<{ locations: ExtractedLocationData[] }>(prompt, {
        temperature: 0.1,
        maxTokens: 2000,
      });

      if (!result || !Array.isArray(result.locations)) {
        throw new Error(`Provider ${provider.id} returned invalid extraction result`);
      }

      console.log(`[LOCATION EXTRACTOR] Success with provider: ${provider.id}`);
      return JSON.stringify(result);
    } catch (error) {
      console.warn(`[LOCATION EXTRACTOR] Provider ${provider.id} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('All AI providers failed for location extraction');
}

/**
 * Extract locations from a story using LLM.
 * DeepSeek is primary, Ollama is fallback.
 * Returns empty array with clear error message if all providers fail.
 */
export async function extractLocationsFromStory(
  story: string
): Promise<{ locations: LocationBibleEntry[]; error?: string }> {
  if (!story.trim()) {
    return { locations: [] };
  }

  try {
    const prompt = buildLocationExtractionPrompt(story);
    const rawResponse = await callAIProvider(prompt);
    const jsonText = extractJson(rawResponse);
    const parsed: { locations: ExtractedLocationData[] } = JSON.parse(jsonText);

    if (!Array.isArray(parsed.locations) || parsed.locations.length === 0) {
      return { locations: [], error: 'No locations detected by LLM.' };
    }

    const locations: LocationBibleEntry[] = parsed.locations.map((loc) => ({
      id: crypto.randomUUID(),
      name: loc.name || 'Unknown',
      type: loc.location_type || 'location',
      visual_description: loc.visual_description || '',
      layout_description: loc.environment_details || '',
      fixed_objects: loc.props || '',
      lighting: loc.lighting || '',
      color_palette: '',
      mood: loc.mood || '',
      location_prompt: '',
      scene_injection_prompt: '',
      negative_prompt: 'deformed, ugly, blurry, low quality, distorted',
      reference_image_path: null,
      seed: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return { locations };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown extraction error';
    console.error('[LOCATION EXTRACTOR] LLM extraction failed:', errMsg);
    return {
      locations: [],
      error: `AI extraction failed: ${errMsg}. DeepSeek API key may be missing or Ollama is not running.`,
    };
  }
}
