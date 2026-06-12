import type { Episode, Character, CharacterBibleEntry } from '../types';

export interface EffectiveCharacter {
  id: string;
  name: string;
  image_url: string | null;
  source: 'bible' | 'legacy';
}

/**
 * Returns the effective character list for an episode.
 *
 * Rules:
 *   - If episode.story_characters has entries → use CharacterBibleEntry IDs (canonical)
 *   - Otherwise → fall back to store.characters (legacy Character IDs)
 *
 * This is the ONLY place in the codebase that decides which ID space
 * is active for an episode. All UI consumers (CreateSceneModal, SceneCard,
 * ScenePromptInspector) must go through this function.
 *
 * When story_characters exist, scene.characters[] will store CharacterBibleEntry.id
 * values, which makes Phase 4 (ScenePromptComposer migration) safe.
 */
export function getEpisodeCharacterOptions(
  episode: Episode,
  storeCharacters: Character[]
): EffectiveCharacter[] {
  const bibleChars: CharacterBibleEntry[] = episode.story_characters ?? [];

  if (bibleChars.length > 0) {
    return bibleChars.map((entry) => ({
      id: entry.id,
      name: entry.name,
      image_url: entry.reference_image_path ?? null,
      source: 'bible' as const,
    }));
  }

  // Legacy fallback — episodes without story_characters (created before bible extraction)
  return storeCharacters.map((c) => ({
    id: c.id,
    name: c.name,
    image_url: c.image_url,
    source: 'legacy' as const,
  }));
}
