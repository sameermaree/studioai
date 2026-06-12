import type { Scene, Character, StylePreset, CharacterBibleEntry } from '../../types';
import { injectCharacterConsistency, cleanPromptForSDXL, getStyleKeywords, validateGenderConsistency } from '../character/CharacterPromptBuilder';

/**
 * Scene Prompt Composer Engine v3
 * Core principle: Environment first, identity last and camera-aware.
 */

export interface ComposedScenePrompt {
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt: string;
  cameraPrompt: string;
  lightingPrompt: string;
  motionPrompt: string;
  environmentPrompt: string;
  stylePrompt: string;
  finalPrompt: string;
  seed?: number;
  aspectRatio: string;
  duration: number;
  referenceImages: string[];
  debugPositivePrompt?: string;
  debugNegativePrompt?: string;
  debugValidationWarnings?: string[];
  storyText?: string;
  narrationText?: string;
  subtitleText?: string;
}

export interface SceneComposerSettings {
  stylePreset?: StylePreset;
  quality?: 'draft' | 'standard' | 'high' | 'cinematic';
  includeCharacters?: boolean;
  includeCinematic?: boolean;
}

// ── Camera Presets (video prompt — may have motion language) ──────────────────
const CAMERA_PRESETS: Record<string, string> = {
  'close-up': 'close-up shot, shallow depth of field, focused on subject',
  'medium shot': 'medium shot, waist up, balanced composition',
  'wide shot': 'wide establishing shot, full scene visible',
  'extreme wide shot': 'extreme wide shot, panoramic view, vast environment, character tiny in frame',
  'aerial shot': "aerial drone shot, bird's eye view, cinematic overhead",
  'tracking shot': 'smooth tracking shot, following subject, dynamic movement',
  'cinematic dolly': 'cinematic dolly shot, slow forward movement, professional',
  'over-the-shoulder': 'over-the-shoulder angle, conversational framing',
  'environment focused': 'environment-focused wide shot, landscape dominant, minimal character',
};

// ── Still Camera Positions (image prompt — NO motion verbs) ───────────────────
const STILL_CAMERA_POSITIONS: Record<string, string> = {
  'close-up': 'close-up shot, shallow depth of field, face detail',
  'medium shot': 'medium shot, waist up, character centered',
  'wide shot': 'wide shot, full environment visible, character full body',
  'extreme wide shot': 'extreme wide shot, vast landscape, character very small, panoramic composition',
  'aerial shot': 'aerial view, bird eye view, overhead perspective',
  'tracking shot': 'medium shot, subject centered',
  'cinematic dolly': 'cinematic framing, centered composition',
  'over-the-shoulder': 'over-the-shoulder angle',
  'environment focused': 'wide establishing shot, environment dominant, character secondary',
};

// ── Camera depth: how much identity to include ────────────────────────────────
type IdentityDepth = 'full' | 'medium' | 'minimal' | 'none';

// ── Identity Depth Strategy ───────────────────────────────────────
// Controls how much character description goes into the prompt.
// Single char: camera determines depth (full → medium → minimal → none)
// Multi char:  minimum 'medium' always — each char needs enough description
//              Future LoRA: multi-char depth can drop to 'minimal' since
//              LoRA trigger word carries the identity.
function getCameraIdentityDepth(
  cameraAngle: string,
  charCount: number = 1
): IdentityDepth {
  const ca = (cameraAngle || '').toLowerCase();

  // Multi-character scenes: minimum 'medium' depth so each character
  // gets hair + outfit description — never drop to minimal/none
  if (charCount > 1) {
    if (ca.includes('close-up') || ca.includes('portrait') || ca.includes('bust')) {
      return 'full';
    }
    return 'medium'; // wide/extreme wide still get medium for multi-char
  }

  // Single character — camera-aware depth
  if (ca.includes('close-up') || ca.includes('portrait') || ca.includes('bust') || ca.includes('headshot')) {
    return 'full';
  }
  if (ca.includes('medium') || ca.includes('over-the-shoulder')) {
    return 'medium';
  }
  if (ca.includes('wide') || ca.includes('aerial') || ca.includes('environment')) {
    return 'minimal';
  }
  if (ca.includes('extreme wide') || ca.includes('panoramic')) {
    return 'none';
  }
  return 'medium'; // default
}

// ── Anti-portrait negatives for wide/medium shots ────────────────────────────
function getAntiPortraitNegatives(cameraAngle: string): string {
  const depth = getCameraIdentityDepth(cameraAngle);
  if (depth === 'none' || depth === 'minimal') {
    return 'portrait, close-up, face close-up, plain background, studio portrait, isolated character, headshot, bust shot, character centered, character filling frame';
  }
  if (depth === 'medium') {
    return 'portrait, extreme close-up, face filling frame, plain background, studio shot';
  }
  return ''; // close-up — no anti-portrait needed
}

// ── Build identity string based on camera depth ───────────────────────────────
// Non-human types — never inject human descriptors into their prompts
const _NON_HUMAN_SC = new Set(['animal','bird','crow','cat','dog','rabbit','duck',
  'fox','wolf','horse','owl','eagle','creature','dragon','magical creature',
  'monster','fairy','spirit']);
const isNonHumanType = (t: string) => _NON_HUMAN_SC.has(t.toLowerCase());

function isNonHuman(bibleChar: CharacterBibleEntry): boolean {
  return isNonHumanType((bibleChar as any).character_type || '');
}

function buildIdentityForCamera(
  bibleChar: CharacterBibleEntry,
  depth: IdentityDepth
): string {
  if (depth === 'none') return '';
  const name = bibleChar.name || '';
  const t = bibleChar.appearance_traits;
  const nonHuman = isNonHuman(bibleChar);

  if (depth === 'full') {
    const parts = [name];
    if (nonHuman) {
      // Animals/creatures: describe physical appearance, never human anchors
      if (t?.hairstyle) parts.push(t.hairstyle);   // feathers, fur, scales
      if (t?.eye_color) parts.push(t.eye_color + ' eyes');
      if (t?.facial_structure) parts.push(t.facial_structure);
      parts.push('consistent creature design');
    } else {
      if (t?.hairstyle) parts.push(t.hairstyle);
      if (t?.hair_color) parts.push(t.hair_color + ' hair');
      if (t?.eye_color) parts.push(t.eye_color + ' eyes');
      if (t?.outfit) parts.push('wearing ' + t.outfit);
      if (t?.facial_structure) parts.push(t.facial_structure);
      parts.push('same face, consistent character');
    }
    return parts.filter(Boolean).join(', ');
  }

  if (depth === 'medium') {
    const parts = [name];
    if (nonHuman) {
      if (t?.hairstyle) parts.push(t.hairstyle);
    } else {
      if (t?.hair_color) parts.push(t.hair_color + ' hair');
      if (t?.outfit) parts.push('wearing ' + t.outfit);
    }
    return parts.filter(Boolean).join(', ');
  }

  // minimal: name only — IPAdapter carries visual identity
  return name;
}


// ── Extract environment and objects from scene prompt_text ────────────────────
// Preserves concrete nouns: locations, objects, creatures, props
function extractEnvironmentCore(promptText: string): string {
  if (!promptText?.trim()) return '';
  // Clean and return the scene prompt as-is — it IS the environment description
  // Do not strip or summarize; just clean for SDXL
  return cleanPromptForSDXL(promptText);
}

// ── Lighting presets ──────────────────────────────────────────────────────────
const LIGHTING_PRESETS: Record<string, string> = {
  'golden hour': 'golden hour lighting, warm sunset glow, soft shadows',
  'cinematic night': 'cinematic night lighting, moonlight, atmospheric',
  'soft studio': 'soft studio lighting, even illumination, professional',
  'dramatic shadows': 'dramatic chiaroscuro lighting, strong shadows, high contrast',
  'sunset': 'sunset lighting, orange and purple sky, warm tones',
  'volumetric light': 'volumetric god rays, atmospheric lighting, cinematic beams',
};

// ── Motion presets ────────────────────────────────────────────────────────────
const MOTION_PRESETS: Record<string, string> = {
  'walking': 'character walking naturally, smooth gait',
  'running': 'character running, dynamic action',
  'emotional talking': 'character talking emotionally, expressive gestures',
  'slow cinematic movement': 'slow dramatic movement, cinematic pacing',
  'action movement': 'fast action sequence, dynamic choreography',
};

const DEFAULT_ENVIRONMENT = { location: '', time: '', mood: '' };

const QUALITY_ENHANCERS: Record<string, string> = {
  draft: 'simple scene',
  standard: 'good quality, clear',
  high: 'high quality, detailed, sharp focus, beautiful composition',
  cinematic: 'cinematic quality, 8k, highly detailed, professional lighting, dramatic composition, masterpiece, award winning photography',
};

// ── Main composer ─────────────────────────────────────────────────────────────
export function composeScenePrompt(
  scene: Scene,
  characters: Character[],
  settings?: SceneComposerSettings,
  bibleCharacters?: CharacterBibleEntry[]
): ComposedScenePrompt {
  console.log('[SCENE COMPOSER] Composing prompt for scene:', scene.title);

  const basePrompt = scene.prompt_text || scene.narration || '';
  const storyText = scene.prompt_text || '';
  const narrationText = scene.narration || '';
  const subtitleText = scene.subtitle_text || '';

  // ── Camera ───────────────────────────────────────────────────────────────────
  const cameraPrompt = CAMERA_PRESETS[scene.camera_angle]
    || (typeof scene.camera_angle === 'string' ? scene.camera_angle : '')
    || 'medium shot, waist up, balanced composition';

  const stillCameraPrompt = STILL_CAMERA_POSITIONS[scene.camera_angle]
    || (typeof scene.camera_angle === 'string'
      ? scene.camera_angle.replace(/tracking|crane|dolly|whip|pan|tilt|handheld|movement|motion/gi, '').trim()
      : '')
    || 'medium shot';

  // ── Identity depth from camera ────────────────────────────────────────────
  const sceneCharCount = (bibleCharacters && bibleCharacters.length > 0)
    ? bibleCharacters.length
    : (scene.characters?.length ?? 0);
  const identityDepth = getCameraIdentityDepth(scene.camera_angle || '', sceneCharCount);
  console.log('[SCENE COMPOSER] camera:', scene.camera_angle,
    '| charCount:', sceneCharCount,
    '| identity depth:', identityDepth);

  // ── Lighting ─────────────────────────────────────────────────────────────────
  const env = (scene as any).environment || DEFAULT_ENVIRONMENT;
  const cinematography = (scene as any).cinematography || {};
  const lightingPrompt = cinematography.lighting
    ? (LIGHTING_PRESETS[cinematography.lighting] || String(cinematography.lighting))
    : 'natural lighting, soft shadows, well lit';

  // ── Motion ───────────────────────────────────────────────────────────────────
  const motionPrompt = scene.motion_instructions
    ? (MOTION_PRESETS[scene.motion_instructions] || scene.motion_instructions)
    : 'slow cinematic movement, gentle camera pan';

  // ── Style ────────────────────────────────────────────────────────────────────
  const stylePreset = settings?.stylePreset;
  const styleKeywords = stylePreset
    ? getStyleKeywords(stylePreset.id || stylePreset.category)
    : (scene.style_preset_id ? getStyleKeywords(scene.style_preset_id) : '');
  const stylePrompt = styleKeywords || 'cinematic quality, professional production';

  // ── Quality ──────────────────────────────────────────────────────────────────
  const qualityPrompt = QUALITY_ENHANCERS[settings?.quality || 'cinematic'];

  // ── Environment: extract from scene prompt_text (FIRST priority) ─────────────
  // This is what the user wrote — it contains objects, location, action.
  // It must appear FIRST so SDXL weights it highest.
  const environmentCore = extractEnvironmentCore(basePrompt);
  const environmentMeta = env.location
    ? `${env.location}${env.time ? ', ' + env.time : ''}${env.mood ? ', ' + env.mood + ' atmosphere' : ''}`
    : '';
  // Combine: scene description + structured environment metadata
  const fullEnvironmentBlock = [environmentCore, environmentMeta].filter(Boolean).join(', ');

  // ── Characters ───────────────────────────────────────────────────────────────
  const debugWarnings: string[] = [];
  let referenceImages: string[] = [];

  const sceneCharIds = scene.characters ?? [];

  // Validate gender consistency
  if (settings?.includeCharacters !== false && characters.length > 0) {
    const sceneChars = characters.filter(c => sceneCharIds.includes(c.id));
    for (const ch of sceneChars) {
      const check = validateGenderConsistency(ch);
      if (!check.valid && check.warning) {
        debugWarnings.push(check.warning);
        console.warn('[CHARACTER WARNING]', check.warning);
      }
    }
    // Collect reference images
    for (const ch of sceneChars) {
      if (ch.image_url && !referenceImages.includes(ch.image_url)) {
        referenceImages.push(ch.image_url);
      }
    }
  }

  // ── Build identity block (camera-aware, from bibleCharacters) ─────────────
  // Identity comes AFTER environment and camera in the prompt.
  // Depth controlled by camera angle.
  let identityBlock = '';
  let identityNegativeBlock = '';
  // Hoisted: used in BREAK assembly outside the if-block
  let identityParts: string[] = [];
  let sceneMatched: CharacterBibleEntry[] = [];

  // Build identity block per character.
  // Multi-char: each character labeled explicitly so SDXL can distinguish them.
  // Future LoRA: replace identityBlock with trigger words only.
  if (bibleCharacters && bibleCharacters.length > 0 && identityDepth !== 'none') {
    sceneMatched = sceneCharIds.length > 0
      ? bibleCharacters.filter(b => sceneCharIds.includes(b.id))
      : bibleCharacters.slice(0, 3);

    const negParts: string[] = [];

    for (const b of sceneMatched.slice(0, 3)) { // max 3 characters
      const idStr = buildIdentityForCamera(b, identityDepth);
      if (idStr) {
        // For multi-char: wrap each character description clearly
        if (sceneMatched.length > 1) {
          identityParts.push(`character ${b.name}: ${idStr}`);
        } else {
          identityParts.push(idStr);
        }
      }

      // Identity negatives only for medium/full shots
      if (identityDepth === 'full' || identityDepth === 'medium') {
        if (b.appearance_traits?.hair_color) {
          negParts.push(`wrong hair color`);
        }
        if (b.appearance_traits?.outfit && identityDepth === 'full') {
          negParts.push('wrong outfit, different clothes');
        }
        negParts.push('different character');
      }
    }

    identityBlock = identityParts.join(', ');
    identityNegativeBlock = [...new Set(negParts)].join(', ');

    if (identityBlock) {
      console.log('[IDENTITY BLOCK]', `depth=${identityDepth}`, identityBlock.slice(0, 100));
    }
  }

  // ── Anti-portrait negatives ───────────────────────────────────────────────
  const antiPortraitNegatives = getAntiPortraitNegatives(scene.camera_angle || '');
  if (antiPortraitNegatives) {
    console.log('[ANTI-PORTRAIT]', antiPortraitNegatives);
  }

  // ── IMAGE PROMPT ASSEMBLY ─────────────────────────────────────────────────
  // Single character: flat prompt
  // Multi character:  BREAK-separated sections — each gets own attention space
  // Future LoRA:      trigger words replace character sections (no BREAK needed)

  let imagePrompt: string;

  if (sceneCharCount > 1 && identityParts.length > 0) {
    // ── BREAK MODE — multi-character ─────────────────────────────────
    // Each section processed with separate attention → no character dominance

    const environmentSection = [
      fullEnvironmentBlock,
      stillCameraPrompt,
      stylePrompt,
      qualityPrompt,
    ].filter(Boolean).join(', ');

    // Each character is its own BREAK section
    const characterSections = identityParts.map(p => p.trim()).filter(Boolean);

    // Composition anchor: forces both characters visible
    const charNames = sceneMatched.slice(0, 3).map(b => b.name).join(' and ');
    const compositionAnchor =
      `${charNames} both visible in the same scene, standing together`;

    const allSections = [
      environmentSection,
      ...characterSections,
      compositionAnchor,
    ].filter(Boolean);

    imagePrompt = allSections.join(' BREAK ');

    console.log('[BREAK PROMPT MODE] character count =', sceneCharCount);
    console.log('[BREAK PROMPT MODE] sections =', allSections.length,
      '(1 env + ' + characterSections.length + ' chars + 1 anchor)');
    console.log('[BREAK PROMPT MODE] characters =',
      sceneMatched.map(b => b.name).join(', '));
    console.log('[BREAK PROMPT MODE] env section:', environmentSection.slice(0, 80));
    characterSections.forEach((s, i) =>
      console.log(`[BREAK PROMPT MODE] char[${i}]:`, s.slice(0, 80))
    );
    console.log('[BREAK PROMPT MODE] anchor:', compositionAnchor);
    console.log('[BREAK PROMPT MODE] full prompt length:', imagePrompt.length, 'chars');

  } else {
    // ── FLAT MODE — single character or no characters ─────────────────
    const imageParts = [
      fullEnvironmentBlock,
      stillCameraPrompt,
      identityBlock,
      stylePrompt,
      qualityPrompt,
    ].filter(Boolean);

    console.log('[FLAT PROMPT MODE] imageParts:',
      imageParts.map((p, i) => `[${i}] ${p.slice(0, 40)}`));

    const rawImagePrompt = imageParts.join(', ');
    const rawWordCount = rawImagePrompt.split(/\s+/).filter(Boolean).length;

    imagePrompt = rawWordCount > 150
      ? rawImagePrompt.split(/\s+/).filter(Boolean).slice(0, 150).join(' ')
      : rawImagePrompt;

    if (rawWordCount > 150) {
      console.warn(`[FLAT PROMPT MODE] capped: ${rawWordCount} → 150 words`);
    } else {
      console.log(`[FLAT PROMPT MODE] word count: ${rawWordCount}`);
    }
  }

  // ── VIDEO PROMPT (environment first too) ─────────────────────────────────
  const videoParts = [
    fullEnvironmentBlock,
    cameraPrompt,
    identityBlock,
    lightingPrompt,
    motionPrompt,
    stylePrompt,
    qualityPrompt,
  ].filter(Boolean);
  const videoPrompt = videoParts.join(', ');

  // ── NEGATIVE PROMPT ───────────────────────────────────────────────────────
  const STYLIZED_CATEGORIES = [
    'pixar', 'disney', 'kids_educational', 'arabic_kids', 'french_kids',
    'youtube_kids', 'clay', 'stop_motion', 'anime',
  ];
  const detectedCategory = (stylePreset?.category ?? '').toLowerCase();
  const isStylized = STYLIZED_CATEGORIES.includes(detectedCategory);
  console.log(`[STYLIZED DETECTION] category="${detectedCategory}" [STYLIZED MODE] ${isStylized}`);

  const anatomyNegative = isStylized
    ? 'blurry, low quality, deformed, ugly, photorealistic, realistic skin, real human, live action'
    : 'blurry, low quality, deformed, ugly, bad anatomy, extra limbs, missing limbs';

  const negativeParts = [
    anatomyNegative,
    antiPortraitNegatives,         // camera-based anti-portrait
    identityNegativeBlock,         // character identity negatives
    stylePreset?.negative_prompts || '',
    'camera movement, motion blur, multiple panels, comic strip, sequential frames',
  ].filter(Boolean);

  const negativePrompt = negativeParts.join(', ');

  // ── FINAL ────────────────────────────────────────────────────────────────
  const seed = scene.seed || undefined;

  const finalPrompt = videoPrompt;

  const aspectRatio = '16:9';
  const duration = scene.duration || 5;

  console.log('[PROMPT COMPOSED]', {
    scene: scene.title,
    identityDepth,
    imagePromptLength: imagePrompt.length,
    finalPrompt: imagePrompt.slice(0, 80) + '...',
    negativePrompt: negativePrompt.slice(0, 60) + '...',
  });

  return {
    imagePrompt,
    videoPrompt,
    negativePrompt,
    cameraPrompt,
    lightingPrompt,
    motionPrompt,
    environmentPrompt: fullEnvironmentBlock,
    stylePrompt,
    finalPrompt,
    seed,
    aspectRatio,
    duration,
    referenceImages,
    debugPositivePrompt: imagePrompt,
    debugNegativePrompt: negativePrompt,
    debugValidationWarnings: debugWarnings,
    storyText,
    narrationText,
    subtitleText,
  };
}

/**
 * Get camera preset by name
 */
export function getCameraPreset(name: string): string {
  return CAMERA_PRESETS[name] || name;
}

/**
 * Available camera angles
 */
export const CAMERA_ANGLES = Object.keys(CAMERA_PRESETS);

console.log('[SCENE COMPOSER READY] v3 — environment-first architecture');
