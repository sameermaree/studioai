/**
 * Style Family Router
 *
 * Routes style preset IDs into logical families and returns
 * appropriate prompt prefixes and negative additions.
 *
 * Families:
 *   A) CARTOON — pixar, disney, anime, kids-edu
 *   B) REALISTIC — realistic
 *   C) CINEMATIC — 3d-cinematic (combines with other families)
 */

export type StyleFamily = 'cartoon' | 'realistic' | 'cinematic' | 'unknown';

const CARTOON_IDS = ['style-pixar', 'style-disney', 'style-anime', 'style-kids-edu'];
const REALISTIC_IDS = ['style-realistic'];
const CINEMATIC_IDS = ['style-3d-cinematic'];

/** Cartoon style prefix keywords */
const CARTOON_PREFIX = 'Pixar-style 3D animated character, Disney-inspired stylized face, large expressive eyes, rounded facial features, stylized anatomy, toy-like materials, smooth 3D shading, non-photorealistic, animated movie character, family animation style, cute proportions, slightly oversized head, soft cinematic cartoon lighting, highly stylized, colorful animated film aesthetic';

/** Cartoon negative additions */
const CARTOON_NEGATIVE = 'photorealistic, real human, live action, fashion photography, studio portrait, skin pores, realistic skin texture, documentary, realistic anatomy, adult proportions';

/** Realistic style prefix keywords */
const ANIME_PREFIX = 'anime style, anime character design, cel shaded, toon shaded, japanese animation style, clean lineart, vibrant anime colors, manga aesthetic, studio ghibli inspired, 2D animation, hand-drawn style';

const ANIME_NEGATIVE = '3D render, photorealistic, Pixar style, Disney style, realistic proportions, subsurface scattering, ray tracing, unreal engine, CGI, live action, real human';

const REALISTIC_PREFIX = 'cinematic realism, realistic lighting, natural anatomy, film still, detailed skin';

/** Cinematic style prefix keywords (combines with other families) */
const CINEMATIC_PREFIX = 'cinematic lighting, dramatic composition, depth of field, movie framing, cinematic atmosphere';

/**
 * Classify a single style preset ID into a family.
 */
export function classifyStyleId(styleId: string): StyleFamily {
  const id = styleId.toLowerCase();
  if (CARTOON_IDS.some(c => id.includes(c.replace('style-', '')) || id === c)) return 'cartoon';
  if (REALISTIC_IDS.some(r => id.includes(r.replace('style-', '')) || id === r)) return 'realistic';
  if (CINEMATIC_IDS.some(c => id.includes(c.replace('style-', '')) || id === c)) return 'cinematic';
  return 'unknown';
}

/**
 * Classify multiple style preset IDs into their families.
 */
export function classifyStyleIds(styleIds: string[]): StyleFamily[] {
  const families = new Set<StyleFamily>();
  for (const id of styleIds) {
    families.add(classifyStyleId(id));
  }
  return Array.from(families);
}

/**
 * Build the final style prefix from selected style preset IDs.
 * Handles family combination rules:
 * - Cartoon + Cinematic = cartoon prefix + cinematic prefix
 * - Realistic + Cinematic = realistic prefix + cinematic prefix
 * - Cartoon only = cartoon prefix
 * - Realistic only = realistic prefix
 * - Cinematic only = cinematic prefix
 */
export function buildStylePrefix(styleIds: string[]): string {
  const families = classifyStyleIds(styleIds);
  const parts: string[] = [];

  const hasCartoon = families.includes('cartoon');
  const hasRealistic = families.includes('realistic');
  const hasCinematic = families.includes('cinematic');

  if (hasCartoon) {
    // Check if anime is the ONLY cartoon style selected (no pixar/disney/kids)
    const hasPixarDisney = styleIds.some(id => id === 'style-pixar' || id === 'style-disney' || id === 'style-kids-edu');
    if (hasPixarDisney) {
      parts.push(CARTOON_PREFIX);
      console.log('[PIXAR PROFILE ACTIVE]');
    } else if (styleIds.includes('style-anime')) {
      parts.push(ANIME_PREFIX);
      console.log('[ANIME PROFILE ACTIVE]');
    } else {
      parts.push(CARTOON_PREFIX);
    }
  } else if (hasRealistic) {
    parts.push(REALISTIC_PREFIX);
  }

  if (hasCinematic) {
    parts.push(CINEMATIC_PREFIX);
  }

  console.log('[FINAL STYLE KEYWORDS]', parts.join(', '));
  return parts.join(', ');
}

/**
 * Build the final negative prompt additions from selected style preset IDs.
 * Only cartoon family adds anti-realistic negatives.
 * Realistic and cinematic families do NOT add cartoon negatives.
 */
export function buildStyleNegative(styleIds: string[]): string {
  const families = classifyStyleIds(styleIds);
  const parts: string[] = [];

  if (families.includes('cartoon')) {
    // Check if anime is the ONLY cartoon style selected
    const hasPixarDisney = styleIds.some(id => id === 'style-pixar' || id === 'style-disney' || id === 'style-kids-edu');
    if (hasPixarDisney) {
      parts.push(CARTOON_NEGATIVE);
    } else if (styleIds.includes('style-anime')) {
      parts.push(ANIME_NEGATIVE);
    } else {
      parts.push(CARTOON_NEGATIVE);
    }
  }

  return parts.join(', ');
}

/**
 * Get the style family label for logging.
 */
export function getStyleFamilyLabel(styleIds: string[]): string {
  const families = classifyStyleIds(styleIds);
  if (families.length === 0) return 'none';
  return families.join(' + ');
}
