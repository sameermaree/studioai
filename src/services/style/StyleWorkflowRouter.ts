/**
 * Style Workflow Router
 *
 * Maps style preset IDs to ComfyUI checkpoint names.
 * Each style ID maps to its specific installed checkpoint.
 *
 * Checkpoint mapping:
  *   style-pixar       => dreamshaperXL_alpha2Xl10.safetensors
 *   style-disney      => dreamshaperXL_alpha2Xl10.safetensors
 *   style-kids-edu    => dreamshaperXL_alpha2Xl10.safetensors
 *   style-anime       => cardosAnime_v20.safetensors
 *   style-realistic   => juggernautXL_v9Rundiffusionphoto2.safetensors
 *   style-3d-cinematic => juggernautXL_v9Rundiffusionphoto2.safetensors (when alone)
 */

import { classifyStyleIds, type StyleFamily } from './StyleFamilyRouter';

/**
 * Per-style-ID checkpoint mapping.
 * Each style preset ID maps to its specific installed .safetensors file.
 */
const STYLE_CHECKPOINT_MAP: Record<string, string> = {
    'style-pixar': 'dreamshaperXL_alpha2Xl10.safetensors',
  'style-disney': 'dreamshaperXL_alpha2Xl10.safetensors',
  'style-kids-edu': 'dreamshaperXL_alpha2Xl10.safetensors',
  'style-anime': 'cardosAnime_v20.safetensors',
  'style-realistic': 'juggernautXL_v9Rundiffusionphoto2.safetensors',
  'style-3d-cinematic': 'juggernautXL_v9Rundiffusionphoto2.safetensors',
};

/**
 * Fallback checkpoint if no style IDs match.
 */
const DEFAULT_CHECKPOINT = 'juggernautXL_v9Rundiffusionphoto2.safetensors';

/**
 * Get the primary style family from a list of style preset IDs.
 * Cinematic is secondary — it combines with the primary family.
 */
export function getPrimaryStyleFamily(styleIds: string[]): StyleFamily {
  const families = classifyStyleIds(styleIds);
  // Return the first non-cinematic, non-unknown family
  const primary = families.find(f => f !== 'cinematic' && f !== 'unknown');
  return primary || 'unknown';
}

/**
 * Select the appropriate checkpoint name based on style preset IDs.
 *
 * Logic:
 * - If any Pixar/Disney/Kids-Edu is selected => dreamshaperXL_alpha2Xl10.safetensors (even if cinematic also selected)
 * - If Anime is selected (and no Pixar/Disney/Kids-Edu) => cardosAnime_v20.safetensors
 * - If Realistic is selected (and no cartoon) => juggernautXL
 * - If only Cinematic is selected => juggernautXL
 * - Default => juggernautXL
 */
export function selectCheckpoint(styleIds: string[]): string {
  console.log('[STYLE CHECKPOINT ROUTER]');
  console.log('[STYLE IDS]', styleIds);
  
  // Priority 1: Pixar/Disney/Kids-Edu => dreamshaperXL_alpha2Xl10.safetensors
  for (const id of styleIds) {
    if (id === 'style-pixar' || id === 'style-disney' || id === 'style-kids-edu') {
      const checkpoint = STYLE_CHECKPOINT_MAP[id] || DEFAULT_CHECKPOINT;
      console.log('[CHECKPOINT SELECTED]', checkpoint);
      return checkpoint;
    }
  }
  
  // Priority 2: Anime => cardosAnime
  if (styleIds.includes('style-anime')) {
    const checkpoint = STYLE_CHECKPOINT_MAP['style-anime'];
    console.log('[CHECKPOINT SELECTED]', checkpoint);
    return checkpoint;
  }
  
  // Priority 3: Realistic => juggernautXL
  if (styleIds.includes('style-realistic')) {
    const checkpoint = STYLE_CHECKPOINT_MAP['style-realistic'];
    console.log('[CHECKPOINT SELECTED]', checkpoint);
    return checkpoint;
  }
  
  // Priority 4: Cinematic only => juggernautXL
  if (styleIds.includes('style-3d-cinematic')) {
    const checkpoint = STYLE_CHECKPOINT_MAP['style-3d-cinematic'];
    console.log('[CHECKPOINT SELECTED]', checkpoint);
    return checkpoint;
  }
  
  // Fallback
  console.log('[CHECKPOINT SELECTED]', DEFAULT_CHECKPOINT);
  return DEFAULT_CHECKPOINT;
}

/**
 * Select the appropriate workflow path based on style preset IDs.
 * Pixar/Disney/Kids-Edu => dedicated single-pass DreamShaper workflow
 * Anime => cartoon workflow
 * Realistic => default workflow
 */
export function selectWorkflow(styleIds: string[]): string {
  // Pixar/Disney/Kids-Edu => dedicated stable workflow (no refiner, single pass)
  const hasPixarDisney = styleIds.some(id => id === 'style-pixar' || id === 'style-disney' || id === 'style-kids-edu');
  if (hasPixarDisney) {
    console.log('[PIXAR WORKFLOW ACTIVE] workflows/pixar_disney_stable.json');
    console.log('[PIXAR CHECKPOINT LOADED] dreamshaperXL_alpha2Xl10.safetensors');
    console.log('[PIXAR SINGLE PASS ENABLED] true');
    return 'workflows/pixar_disney_stable.json';
  }

  const primaryFamily = getPrimaryStyleFamily(styleIds);
  
  if (primaryFamily === 'cartoon') {
    return 'workflows/cartoon_txt2img.json';
  } else if (primaryFamily === 'realistic') {
    return 'workflows/default_txt2img.json';
  }
  
  return 'workflows/default_txt2img.json';
}



/**
 * Select the identity workflow path based on whether a reference image exists.
 *
 * Character identity generation has two modes:
 *   A) Normal generation (no reference image):
 *      => workflows/pixar_disney_stable.json (DreamShaperXL only)
 *   B) Locked/reference identity generation (has reference image or identityLocked):
 *      => workflows/pixar_disney_ipadapter_v1.json (DreamShaperXL + LoRA + IPAdapter)
 *
 * @param hasReferenceImage - Whether a reference image path exists for this character
 * @returns The workflow file path to use
 */
export function selectIdentityWorkflow(hasReferenceImage: boolean): string {
  if (hasReferenceImage) {
    console.log('[IDENTITY WORKFLOW ACTIVE] workflows/pixar_disney_ipadapter_v1.json');
    console.log('[IDENTITY IPADAPTER ENABLED] true');
    console.log('[IDENTITY LORA ENABLED] true');
    console.log('[IDENTITY REFERENCE IMAGE MODE] active');
    return 'workflows/pixar_disney_ipadapter_v1.json';
  }
  console.log('[IDENTITY WORKFLOW ACTIVE] workflows/pixar_disney_stable.json (no reference image)');
  return 'workflows/pixar_disney_stable.json';
}

/**
 * Select the identity checkpoint. Always DreamShaperXL for character identity.
 */
export function selectIdentityCheckpoint(): string {
  return 'dreamshaperXL_alpha2Xl10.safetensors';
}
