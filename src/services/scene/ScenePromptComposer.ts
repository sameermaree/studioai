import type { Scene, Character, StylePreset } from '../../types';
import { injectCharacterConsistency, cleanPromptForSDXL, getStyleKeywords, validateGenderConsistency } from '../character/CharacterPromptBuilder';

/**
 * Scene Prompt Composer Engine
 * Separates: story text, narration, image prompt, motion prompt, subtitle text
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
  /** Debug info: the raw positive prompt before cleaning */
  debugPositivePrompt?: string;
  /** Debug info: the raw negative prompt before cleaning */
  debugNegativePrompt?: string;
  /** Debug info: identified character issues */
  debugValidationWarnings?: string[];
  /** Original story text (separate from image prompt) */
  storyText?: string;
  /** Narration text (separate from image prompt) */
  narrationText?: string;
  /** Subtitle text (separate from image prompt) */
  subtitleText?: string;
}

export interface SceneComposerSettings {
  stylePreset?: StylePreset;
  quality?: 'draft' | 'standard' | 'high' | 'cinematic';
  includeCharacters?: boolean;
  includeCinematic?: boolean;
}

// Camera presets (English only)
const CAMERA_PRESETS: Record<string, string> = {
  'close-up': 'close-up shot, shallow depth of field, focused on subject',
  'medium shot': 'medium shot, waist up, balanced composition',
  'wide shot': 'wide establishing shot, full scene visible',
  'aerial shot': 'aerial drone shot, bird\'s eye view, cinematic overhead',
  'tracking shot': 'smooth tracking shot, following subject, dynamic movement',
  'cinematic dolly': 'cinematic dolly shot, slow forward movement, professional',
  'over-the-shoulder': 'over-the-shoulder angle, conversational framing'
};

// Lighting presets (English only)
const LIGHTING_PRESETS: Record<string, string> = {
  'golden hour': 'golden hour lighting, warm sunset glow, soft shadows',
  'cinematic night': 'cinematic night lighting, moonlight, atmospheric',
  'soft studio': 'soft studio lighting, even illumination, professional',
  'dramatic shadows': 'dramatic chiaroscuro lighting, strong shadows, high contrast',
  'sunset': 'sunset lighting, orange and purple sky, warm tones',
  'volumetric light': 'volumetric god rays, atmospheric lighting, cinematic beams'
};

// Motion presets (English only)
const MOTION_PRESETS: Record<string, string> = {
  'walking': 'character walking naturally, smooth gait, realistic movement',
  'running': 'character running, dynamic action, motion blur',
  'emotional talking': 'character talking emotionally, expressive gestures, lip sync',
  'slow cinematic movement': 'slow dramatic movement, cinematic pacing',
  'action movement': 'fast action sequence, dynamic choreography'
};

const DEFAULT_ENVIRONMENT = { location: '', time: '', mood: '' };

// Quality enhancers
const QUALITY_ENHANCERS: Record<string, string> = {
  draft: 'simple scene',
  standard: 'good quality, clear',
  high: 'high quality, detailed, sharp focus, beautiful composition',
  cinematic: 'cinematic quality, 8k, highly detailed, professional lighting, dramatic composition, masterpiece, award winning photography',
};

/**
 * Compose complete scene prompt.
 * Story/narration/subtitle are kept separate from the image prompt.
 * The image prompt sent to SDXL is clean English.
 */
export function composeScenePrompt(
  scene: Scene,
  characters: Character[],
  settings?: SceneComposerSettings
): ComposedScenePrompt {
  console.log('[SCENE COMPOSER] Composing prompt for scene:', scene.title);

  // ========== SEPARATE TEXT STREAMS ==========
  const basePrompt = scene.prompt_text || scene.narration || '';
  const storyText = scene.prompt_text || '';
  const narrationText = scene.narration || '';
  const subtitleText = scene.subtitle_text || '';

  // ========== CAMERA ==========
  const cameraPrompt = CAMERA_PRESETS[scene.camera_angle] 
    || (typeof scene.camera_angle === 'string' ? scene.camera_angle : '')
    || 'medium shot, waist up, balanced composition';

  // ========== LIGHTING ==========
  const env = (scene as any).environment || DEFAULT_ENVIRONMENT;
  const cinematography = (scene as any).cinematography || {};
  const lightingPrompt = cinematography.lighting
    ? (LIGHTING_PRESETS[cinematography.lighting] || String(cinematography.lighting))
    : 'natural lighting, soft shadows, well lit';

  // ========== MOTION ==========
  const motionPrompt = scene.motion_instructions
    ? (MOTION_PRESETS[scene.motion_instructions] 
      || (typeof scene.motion_instructions === 'string' ? scene.motion_instructions : '')
      || 'slow cinematic movement')
    : 'slow cinematic movement, gentle camera pan';

  // ========== ENVIRONMENT ==========
  const environmentPrompt = env.location
    ? `setting: ${env.location}, time: ${env.time || 'day'}, mood: ${env.mood || 'neutral'}`
    : '';

  // ========== STYLE ==========
  const stylePreset = settings?.stylePreset;
  const styleKeywords = stylePreset
    ? getStyleKeywords(stylePreset.id || stylePreset.category)
    : (scene.style_preset_id ? getStyleKeywords(scene.style_preset_id) : '');
  const stylePrompt = styleKeywords || 'cinematic quality, professional production';

  // ========== QUALITY ==========
  const qualityPrompt = QUALITY_ENHANCERS[settings?.quality || 'standard'] || 'good quality, clear';

  // ========== CHARACTER INJECTION ==========
  let characterPrompt = '';
  let characterNegative = '';
  let referenceImages: string[] = [];
  const debugWarnings: string[] = [];

  if (settings?.includeCharacters !== false && characters.length > 0) {
    const sceneCharacters = characters.filter(char => 
      scene.characters?.includes(char.id)
    );
    
    // Validate gender consistency
    for (const ch of sceneCharacters) {
      const check = validateGenderConsistency(ch);
      if (!check.valid && check.warning) {
        debugWarnings.push(check.warning);
        console.warn('[CHARACTER WARNING]', check.warning);
      }
    }

    if (sceneCharacters.length > 0) {
      const { prompt, negative, referenceImages: refs } = injectCharacterConsistency(
        basePrompt, 
        sceneCharacters,
        scene.character_outfits
      );
      characterPrompt = prompt;
      characterNegative = negative;
      referenceImages = refs;
      console.log('[CHARACTER PROMPT]', characterPrompt);
      console.log('[CHARACTER NEGATIVE]', characterNegative);
    }
  }

  // ========== IMAGE PROMPT (for SDXL) ==========
  // Combine: visual description + characters + environment + camera + lighting + style + quality
  // Only English, no story/narration/subtitle text
  const imageParts = [
    characterPrompt || cleanPromptForSDXL(basePrompt),
    environmentPrompt,
    cameraPrompt,
    lightingPrompt,
    stylePrompt,
    qualityPrompt,
  ].filter(Boolean);
  const imagePrompt = imageParts.join(', ');

  // ========== VIDEO PROMPT (for motion generation) ==========
  const videoParts = [
    characterPrompt || cleanPromptForSDXL(basePrompt),
    environmentPrompt,
    cameraPrompt,
    lightingPrompt,
    motionPrompt,
    stylePrompt,
    qualityPrompt,
  ].filter(Boolean);
  const videoPrompt = videoParts.join(', ');

  // ========== NEGATIVE PROMPT ==========
  const negativeParts = [
    characterNegative,
    'blurry, low quality, deformed, ugly, bad anatomy',
    stylePreset?.negative_prompts || '',
  ].filter(Boolean);
  const negativePrompt = negativeParts.join(', ');

  // ========== FINAL PROMPT ==========
  const finalPrompt = videoPrompt;

  // Seed
  const seed = scene.seed || undefined;
  
  // Aspect ratio
  const aspectRatio = scene.style_preset_id 
    ? (settings?.stylePreset?.metadata?.aspect_ratio as string || '16:9')
    : '16:9';
  
  console.log('[PROMPT COMPOSED]', {
    scene: scene.title,
    characters: characters.length,
    imagePromptLength: imagePrompt.length,
    finalPrompt,
    negativePrompt,
    warnings: debugWarnings,
  });
  
  return {
    imagePrompt,
    videoPrompt,
    negativePrompt,
    cameraPrompt,
    lightingPrompt,
    motionPrompt,
    environmentPrompt,
    stylePrompt,
    finalPrompt,
    seed,
    aspectRatio,
    duration: scene.duration,
    referenceImages,
    debugValidationWarnings: debugWarnings,
    storyText,
    narrationText,
    subtitleText,
  };
}

/**
 * Generate final prompt string for external tools
 */
export function generateFinalPrompt(composed: ComposedScenePrompt): string {
  console.log('[CINEMATIC PROMPT GENERATED]');
  return composed.finalPrompt;
}

/**
 * Get camera preset by name
 */
export function getCameraPreset(name: string): string {
  return CAMERA_PRESETS[name.toLowerCase()] || name;
}

/**
 * Get lighting preset by name
 */
export function getLightingPreset(name: string): string {
  return LIGHTING_PRESETS[name.toLowerCase()] || name;
}

/**
 * Get motion preset by name
 */
export function getMotionPreset(name: string): string {
  return MOTION_PRESETS[name.toLowerCase()] || name;
}

console.log('[SCENE COMPOSER READY] Cinematic presets loaded');
