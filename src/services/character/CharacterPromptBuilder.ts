import type { Character } from '../../types';

/**
 * Character Consistency Prompt Builder
 */

export interface CharacterConsistencyPrompt {
  positive: string;
  negative: string;
  seed?: number;
}

/**
 * Build consistency prompt for character
 */
export function buildCharacterConsistencyPrompt(character: Character): CharacterConsistencyPrompt {
  const positive = [
    character.description,
    'same face',
    'same clothes',
    'same hairstyle',
    'same eye color',
    'same proportions',
    'same age',
    'same identity',
    'maintain character consistency',
    'consistent character design'
  ].join(', ');

  const negative = [
    character.negative_prompt || 'blurry, low quality',
    'different clothes',
    'different hairstyle',
    'different face',
    'mutated anatomy',
    'extra fingers',
    'extra limbs',
    'duplicate body',
    'inconsistent character',
    'character mutation',
    'wrong identity'
  ].join(', ');

  return {
    positive,
    negative,
    seed: character.consistency_settings?.seed
  };
}

/**
 * Build compact character prompt (no repetition)
 */
export function buildCompactCharacterPrompt(character: Character): string {
  return [
    character.description,
    'consistent identity',
    'same character'
  ].join(', ');
}

/**
 * Inject character consistency into scene prompt
 */
export function injectCharacterConsistency(
  scenePrompt: string,
  characters: Character[]
): { prompt: string; negative: string; seeds: number[] } {
  if (characters.length === 0) {
    return { prompt: scenePrompt, negative: '', seeds: [] };
  }

  const characterPrompts = characters.map(char => buildCompactCharacterPrompt(char));
  const characterNegatives = characters.map(char => 
    buildCharacterConsistencyPrompt(char).negative
  );
  const seeds = characters
    .map(char => char.consistency_settings?.seed)
    .filter((seed): seed is number => seed !== undefined);

  const enhancedPrompt = [
    scenePrompt,
    '',
    'Characters:',
    ...characterPrompts
  ].join('\n');

  const combinedNegative = [...new Set(characterNegatives.flatMap(n => n.split(', ')))].join(', ');

  console.log('[SCENE PROMPT ENHANCED] Added consistency for', characters.length, 'character(s)');

  return {
    prompt: enhancedPrompt,
    negative: combinedNegative,
    seeds
  };
}

/**
 * Validate character has required consistency fields
 */
export function validateCharacterConsistency(character: Character): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!character.description) missingFields.push('description');
  if (!character.consistency_settings?.seed) missingFields.push('consistency_seed');
  if (!character.image_url) missingFields.push('reference_image');

  const isValid = missingFields.length === 0;

  if (isValid) {
    console.log('[CHARACTER CONSISTENCY READY]', character.name);
  } else {
    console.warn('[CHARACTER INCOMPLETE]', character.name, 'Missing:', missingFields.join(', '));
  }

  return { isValid, missingFields };
}

/**
 * Link reference image to character
 */
export function linkCharacterReference(
  character: Character,
  imagePath: string
): Character {
  console.log('[REFERENCE LINKED]', character.name, '→', imagePath);
  
  return {
    ...character,
    image_url: imagePath,
    updated_at: new Date().toISOString()
  };
}

/**
 * Generate character asset filename
 */
export function generateCharacterAssetFilename(characterName: string, extension: string = 'png'): string {
  const sanitized = sanitizeFilename(characterName);
  const timestamp = Date.now();
  return `char-${sanitized}-${timestamp}.${extension}`;
}

/**
 * Get character asset path
 */
export function getCharacterAssetPath(filename: string): string {
  return `data/projects/default-project/assets/characters/${filename}`;
}
