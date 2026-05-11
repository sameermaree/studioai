import type { Character, Language } from '../../types';

export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
}

export function buildCharacterPrompt(character: Character, emotion?: string, outfit?: string): string {
  let desc = character.description;
  if (emotion) desc += `, expression: ${emotion}`;
  if (outfit) {
    const outfitData = character.outfits.find((o) => o.id === outfit);
    if (outfitData) desc += `, wearing: ${outfitData.description}`;
  }
  return desc;
}

export function translatePromptHint(_prompt: string, _targetLang: Language): string {
  return _prompt;
}
