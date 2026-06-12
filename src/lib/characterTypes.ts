/**
 * characterTypes.ts
 * Single source of truth for character type categories.
 * Used by: Characters page, ManualEpisodeModal, ScenePromptComposer, CharacterPromptBuilder.
 */

export const CHARACTER_CATEGORIES = {
  Human: [
    'child', 'boy', 'girl', 'teenager',
    'man', 'woman', 'father', 'mother',
    'teacher', 'student', 'hero', 'villain',
    'friend', 'elder',
  ],
  Animal: [
    'animal', 'bird', 'crow', 'cat',
    'dog', 'rabbit', 'duck', 'fox',
    'wolf', 'horse', 'owl', 'eagle',
  ],
  Creature: [
    'creature', 'dragon', 'magical creature',
    'monster', 'fairy', 'spirit',
  ],
} as const;

/** Flat list of all types — for simple selects */
export const ALL_CHARACTER_TYPES = Object.values(CHARACTER_CATEGORIES).flat();

/** Set of non-human types — used by prompt builders to block human descriptor injection */
export const NON_HUMAN_TYPES = new Set<string>([
  ...CHARACTER_CATEGORIES.Animal,
  ...CHARACTER_CATEGORIES.Creature,
]);

/** Returns true if character_type is animal or creature */
export function isNonHumanType(characterType: string): boolean {
  return NON_HUMAN_TYPES.has(characterType.toLowerCase());
}
