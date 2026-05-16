/**
 * Story Extractor Service
 * Delegates to feature-bible extractors which use DeepSeek primary / Ollama fallback.
 * Maintained for backward compatibility — prefer importing from
 * 'features/story-bible/characterExtractor' directly.
 */

import type { CharacterBibleEntry, LocationBibleEntry } from '../../types';
import { extractCharactersFromStory as extractChars, extractLocationsFromStory as extractLocs } from '../../features/story-bible/characterExtractor';

/**
 * Extract characters from a story using LLM.
 * DeepSeek primary, Ollama fallback.
 */
export async function extractCharactersFromStory(
  story: string,
  targetAge: string = '8-12'
): Promise<{ characters: CharacterBibleEntry[]; error?: string }> {
  return extractChars(story, targetAge);
}

/**
 * Extract locations from a story using LLM.
 * DeepSeek primary, Ollama fallback.
 */
export async function extractLocationsFromStory(
  story: string
): Promise<{ locations: LocationBibleEntry[]; error?: string }> {
  return extractLocs(story);
}
