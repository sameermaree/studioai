import type { Scene, Character, StylePreset } from '../../types';
import { buildCharacterConsistencyPrompt, injectCharacterConsistency } from '../character/CharacterPromptBuilder';

/**
 * Scene Prompt Composer Engine
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
}

export interface SceneComposerSettings {
  stylePreset?: StylePreset;
  quality?: 'draft' | 'standard' | 'high' | 'cinematic';
  includeCharacters?: boolean;
  includeCinematic?: boolean;
}

// Camera presets
const CAMERA_PRESETS: Record<string, string> = {
  'close-up': 'close-up shot, shallow depth of field, focused on subject',
  'medium shot': 'medium shot, waist up, balanced composition',
  'wide shot': 'wide establishing shot, full scene visible',
  'aerial shot': 'aerial drone shot, bird\'s eye view, cinematic overhead',
  'tracking shot': 'smooth tracking shot, following subject, dynamic movement',
  'cinematic dolly': 'cinematic dolly shot, slow forward movement, professional',
  'over-the-shoulder': 'over-the-shoulder angle, conversational framing'
};

// Lighting presets
const LIGHTING_PRESETS: Record<string, string> = {
  'golden hour': 'golden hour lighting, warm sunset glow, soft shadows',
  'cinematic night': 'cinematic night lighting, moonlight, atmospheric',
  'soft studio': 'soft studio lighting, even illumination, professional',
  'dramatic shadows': 'dramatic chiaroscuro lighting, strong shadows, high contrast',
  'sunset': 'sunset lighting, orange and purple sky, warm tones',
  'volumetric light': 'volumetric god rays, atmospheric lighting, cinematic beams'
};

// Motion presets
const MOTION_PRESETS: Record<string, string> = {
  'walking': 'character walking naturally, smooth gait, realistic movement',
  'running': 'character running, dynamic action, motion blur',
  'emotional talking': 'character talking emotionally, expressive gestures, lip sync',
  'slow cinematic movement': 'slow dramatic movement, cinematic pacing',
  'action movement': 'fast action sequence, dynamic choreography'
};

/**
 * Compose complete scene prompt
 */
export function composeScenePrompt(
  scene: Scene,
  characters: Character[],
  settings?: SceneComposerSettings
): ComposedScenePrompt {
  console.log('[SCENE COMPOSER] Composing prompt for scene:', scene.title);

  // Base prompts
  const basePrompt = scene.prompt_text || scene.narration || '';
  
  // Camera prompt
  const cameraPrompt = CAMERA_PRESETS[scene.camera_angle] || scene.camera_angle || 'medium shot';
  
  // Lighting prompt
  const lightingPrompt = scene.cinematography?.lighting 
    ? (LIGHTING_PRESETS[scene.cinematography.lighting] || scene.cinematography.lighting)
    : 'natural lighting, soft shadows';
  
  // Motion prompt
  const motionPrompt = scene.motion_instructions
    ? (MOTION_PRESETS[scene.motion_instructions] || scene.motion_instructions)
    : 'slow cinematic movement';
  
  // Environment prompt
  const environmentPrompt = scene.environment
    ? `${scene.environment.location}, ${scene.environment.time}, ${scene.environment.mood} mood`
    : '';
  
  // Style prompt
  const stylePrompt = settings?.stylePreset
    ? `${settings.stylePreset.rendering_style}, ${settings.stylePreset.cinematic_mood} atmosphere`
    : 'cinematic quality, professional production';
  
  // Quality enhancement
  const qualityPrompt = settings?.quality === 'cinematic'
    ? 'cinematic masterpiece, 8k, highly detailed, professional lighting'
    : settings?.quality === 'high'
    ? 'high quality, detailed, sharp focus'
    : 'good quality, clear';
  
  // Character consistency injection
  let characterPrompt = '';
  let characterNegative = '';
  let characterSeeds: number[] = [];
  
  if (settings?.includeCharacters !== false && characters.length > 0) {
    const sceneCharacters = characters.filter(char => 
      scene.characters?.includes(char.id)
    );
    
    if (sceneCharacters.length > 0) {
      const { prompt, negative, seeds } = injectCharacterConsistency(basePrompt, sceneCharacters);
      characterPrompt = prompt;
      characterNegative = negative;
      characterSeeds = seeds;
    }
  }
  
  // Image prompt (for still frames)
  const imagePrompt = [
    characterPrompt || basePrompt,
    environmentPrompt,
    cameraPrompt,
    lightingPrompt,
    stylePrompt,
    qualityPrompt
  ].filter(Boolean).join(', ');
  
  // Video prompt (for motion)
  const videoPrompt = [
    characterPrompt || basePrompt,
    environmentPrompt,
    cameraPrompt,
    lightingPrompt,
    motionPrompt,
    stylePrompt,
    qualityPrompt
  ].filter(Boolean).join(', ');
  
  // Negative prompt
  const negativePrompt = [
    scene.negative_prompt || '',
    characterNegative,
    'blurry, low quality, deformed, ugly, bad anatomy',
    settings?.stylePreset?.negative_prompts || ''
  ].filter(Boolean).join(', ');
  
  // Final prompt (comprehensive)
  const finalPrompt = videoPrompt;
  
  // Seed (use first character seed or scene seed)
  const seed = characterSeeds[0] || scene.seed || undefined;
  
  // Aspect ratio
  const aspectRatio = scene.style_preset_id 
    ? (settings?.stylePreset?.metadata?.aspect_ratio as string || '16:9')
    : '16:9';
  
  console.log('[PROMPT COMPOSED]', {
    scene: scene.title,
    characters: characters.length,
    length: finalPrompt.length
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
    duration: scene.duration
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
