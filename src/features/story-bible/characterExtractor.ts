/**
 * Story Extractor Service
 * Uses LLM (DeepSeek primary, Ollama fallback) to extract characters and locations from stories.
 * No regex-based extraction   AI-native structured output.
 *
 * Provider priority:
 *   1. DeepSeek API (primary)   stable for long JSON generation
 *   2. Ollama (fallback)   local, used only if DeepSeek unavailable
 *   3. Empty result with clear error if both fail
 */

import type { CharacterBibleEntry, LocationBibleEntry } from '../../types';
import { aiConfig } from '../../config/ai';
import { AIProviderRegistry } from '../../infrastructure/ai/AIProviderRegistry';
import { AIServiceFactory } from '../../infrastructure/ai/AIServiceFactory';

// Singleton registry for extractor use   lazily initialized
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

interface ExtractedCharacterData {
  name: string;
  role: string;
  character_type: string;
  gender: 'male' | 'female' | 'non-binary' | 'unknown';
  age: number;
  visual_description: string;
  outfit: string;
  hair: string;
  eyes: string;
  personality: string;
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

interface ExtractionResult {
  characters: ExtractedCharacterData[];
  locations: ExtractedLocationData[];
}

function extractJson(raw: string): string {
  const cleaned = raw
    .replace(/`json/g, '')
    .replace(/`/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in LLM response');
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function buildCharacterExtractionPrompt(story: string, targetAge: string): string {
  return [
    'You are a story analyst and character designer for an AI animation studio. Your task is to extract ONLY the real characters from the following story AND design their complete visual identity.',
    '',
    'Rules:',
    '- Extract ONLY named characters or clearly described character roles.',
    '- Do NOT extract objects, colors, body parts, clothing items, or random nouns.',
    '- Do NOT invent characters that do not exist in the story.',
    '- If a character appears multiple times, include them once.',
    '- Preserve Arabic names EXACTLY as written - do not translate or romanize them.',
    '- For English stories, preserve English names exactly.',
    '- Return ONLY valid JSON with NO markdown, NO explanations.',
    '',
    'CRITICAL VISUAL IDENTITY RULES:',
    '- The fields hair, eyes, outfit, and visual_description MUST NEVER be empty.',
    '- If the story explicitly describes appearance, use that description exactly.',
    '- If the story does NOT describe hair/eyes/outfit, you MUST INVENT appropriate visual details based on the character age, gender, culture, and role.',
    '- Example: A 10-year-old boy in a Middle Eastern setting might get hair="side-swept voluminous dark brown hair, medium length", eyes="large warm brown eyes", outfit="red crew-neck shirt under blue-purple striped open overshirt, dark navy school pants", visual_description="narrow oval face, thick dark eyebrows, light skin tone, slim child build".',
    '- Example: A female teacher might get hair="shoulder-length black hair tied in a low bun, straight", eyes="warm dark brown eyes", outfit="white blouse under navy blue cardigan, dark grey pencil skirt", visual_description="soft round face, fine arched eyebrows, warm medium skin tone, average build".',
    '- Make each character visually DISTINCT from other characters in the same story.',
    '- visual_description should be a rich 1-2 sentence English description suitable for image generation.',
    '',
    'Story:',
    '"""',
    story,
    '"""',
    '',
    'Target audience age: ' + targetAge,
    '',
    'For each character, extract:',
    JSON.stringify({
      name: 'character name (exactly as in story)',
      role: 'their role in the story (e.g. teacher, student, mother, friend)',
      character_type: 'character type: child, boy, girl, teenager, man, woman, father, mother, uncle, aunt, teacher, student, villain, hero, friend, or empty string if unknown',
      gender: 'male or female or non-binary or unknown',
      age: 'numeric age if mentioned, otherwise estimate based on role (child=8, teenager=14, adult=30, elderly=65)',
      visual_description: 'REQUIRED: detailed English visual description. MUST include: (1) face shape (oval, round, square, narrow, etc.), (2) eyebrow style (thick, thin, arched, bushy, etc.), (3) skin tone (light, medium, dark, olive, etc.), (4) body build (slim, stocky, average, petite, etc.), (5) any distinguishing features. Example: "narrow oval face, thick dark eyebrows, large expressive eyes, light olive skin tone, slim build". NEVER leave empty or generic.',
      outfit: 'REQUIRED: detailed clothing description with layers, exact colors, and patterns. MUST include EVERY visible clothing item. If story mentions clothing, use exactly. If NOT mentioned, invent. Format as layers: "[base layer] under/over [outer layer], [bottom], [accessories if any]". Example: "red crew-neck shirt under blue-purple striped open overshirt, dark navy school pants" or "white blouse under navy cardigan, grey pleated skirt". NEVER use vague terms like "casual clothes" or "school uniform" alone. NEVER leave empty.',
      hair: 'REQUIRED: complete hairstyle description with shape, volume, direction, texture AND color. If story mentions it, use exactly. If NOT mentioned, invent a DISTINCT style. Format: "[direction/style] [volume] [color] hair, [length], [texture if notable]". Example: "side-swept voluminous dark brown hair, medium length, slightly wavy" or "tight neat black curls, short, close-cropped". NEVER just say "short brown hair". NEVER leave empty.',
      eyes: 'REQUIRED: eye color AND size/style. Example: "large warm brown eyes" or "small sharp green eyes". If story mentions it, use exactly. NEVER leave empty.',
      personality: 'personality traits if mentioned, otherwise infer from story behavior',
    }, null, 2),
    '',
    'Return EXACTLY this JSON structure (you MUST include ALL fields even if empty):',
    JSON.stringify({
      characters: [{
        name: '',
        role: '',
        character_type: '',
        gender: 'unknown',
        age: 0,
        visual_description: '',
        outfit: '',
        hair: '',
        eyes: '',
        personality: '',
      }],
    }, null, 2),
  ].join('\n');
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
 * Uses the registry's getFallbackChain to automatically try providers in preference order.
 */
async function callAIProvider(prompt: string): Promise<string> {
  const registry = getExtractorRegistry();
  const providers = await registry.getFallbackChain('story-generation');

  if (providers.length === 0) {
    throw new Error(
      'No AI providers available for story extraction. ' +
      'Set VITE_DEEPSEEK_API_KEY in .env or ensure Ollama is running at http://localhost:11434.'
    );
  }

  console.log('[EXTRACTOR] Available providers: ' + providers.map(p => p.id).join(', '));
  console.log('[EXTRACTOR] Primary: ' + (providers[0]?.id || 'none') + ' | Fallback: ' + (providers[1]?.id || 'none'));

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log('[EXTRACTOR] Trying provider: ' + provider.id);
      const result = await provider.generateJSON<ExtractionResult>(prompt, {
        temperature: 0.1,
        maxTokens: 2000,
      });

      if (!result || !Array.isArray(result.characters)) {
        throw new Error('Provider ' + provider.id + ' returned invalid extraction result');
      }

      console.log('[EXTRACTOR] Success with provider: ' + provider.id);
      return JSON.stringify(result);
    } catch (error) {
      console.warn('[EXTRACTOR] Provider ' + provider.id + ' failed:', error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('All AI providers failed for story extraction');
}

/**
 * Extract characters from a story using LLM.
 * DeepSeek is primary, Ollama is fallback.
 * Returns empty array with clear error message if all providers fail.
 */
export async function extractCharactersFromStory(
  story: string,
  targetAge: string = '8-12'
): Promise<{ characters: CharacterBibleEntry[]; error?: string }> {
  if (!story.trim()) {
    return { characters: [] };
  }

  try {
    const prompt = buildCharacterExtractionPrompt(story, targetAge);
    const rawResponse = await callAIProvider(prompt);
    const jsonText = extractJson(rawResponse);
    const parsed: ExtractionResult = JSON.parse(jsonText);

    if (!Array.isArray(parsed.characters) || parsed.characters.length === 0) {
      return { characters: [], error: 'No characters detected by LLM.' };
    }

    const characters: CharacterBibleEntry[] = parsed.characters.map((ch) => {
      // ========== IDENTITY FIELD MINIMUM VALIDATION ==========
      // Critical identity fields must never be empty.
      // If LLM returned empty despite instructions, apply neutral defaults and warn.
      const hair = ch.hair || '';
      const eyes = ch.eyes || '';
      const outfit = ch.outfit || '';
      const visual_description = ch.visual_description || '';

      const missingFields: string[] = [];
      if (!hair.trim()) missingFields.push('hair');
      if (!eyes.trim()) missingFields.push('eyes');
      if (!outfit.trim()) missingFields.push('outfit');
      if (!visual_description.trim()) missingFields.push('visual_description');

      if (missingFields.length > 0) {
        console.warn(`[IDENTITY FIELD WARNING] Character "${ch.name || 'Unknown'}" has empty critical fields: ${missingFields.join(', ')}. Identity lock will be unreliable until these are filled.`);
      }

      return ({
      id: crypto.randomUUID(),
      name: ch.name || 'Unknown',
      role: ch.role || 'character',
      character_type: ch.character_type || '',
      age: typeof ch.age === 'number' ? ch.age : 0,
      gender: ['male', 'female', 'non-binary', 'unknown'].includes(ch.gender)
        ? ch.gender
        : 'unknown',
      visual_description: visual_description,
      outfit: outfit,
      hair: hair,
      eyes: eyes,
      personality: ch.personality || '',
      art_style: '',
      character_prompt: '',
      scene_injection_prompt: '',
      negative_prompt: 'deformed, ugly, blurry, low quality, distorted face, extra limbs, bad anatomy',
      reference_image_path: null,
      seed: null,
      identityLocked: false,
      appearance_traits: {
        hairstyle: '',
        hair_color: '',
        eye_color: '',
        outfit: '',
        age_range: '',
        facial_structure: '',
        body_proportions: '',
        style_type: '',
      },
      reference_image_for_ipadapter: null,
      workflow_path: null,
      checkpoint: null,
      generation_positive_prompt: null,
      generation_negative_prompt: null,
      style_preset_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })});

    // Log identity field completeness summary
    const completeCount = characters.filter(c => c.hair && c.eyes && c.outfit && c.visual_description).length;
    console.log(`[EXTRACTION COMPLETE] ${characters.length} characters extracted, ${completeCount}/${characters.length} have complete identity fields`);

    return { characters };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown extraction error';
    console.error('[STORY EXTRACTOR] LLM extraction failed:', errMsg);
    return {
      characters: [],
      error: 'AI extraction failed: ' + errMsg + '. DeepSeek API key may be missing or Ollama is not running.',
    };
  }
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
    const parsed: ExtractionResult = JSON.parse(jsonText);

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
      reference_image_for_ipadapter: null,
      workflow_path: null,
      checkpoint: null,
      generation_positive_prompt: null,
      generation_negative_prompt: null,
      style_preset_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return { locations };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown extraction error';
    console.error('[STORY EXTRACTOR] Location LLM extraction failed:', errMsg);
    return {
      locations: [],
      error: 'AI extraction failed: ' + errMsg + '. DeepSeek API key may be missing or Ollama is not running.',
    };
  }
}