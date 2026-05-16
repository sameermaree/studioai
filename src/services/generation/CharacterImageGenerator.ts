/**
 * CharacterImageGenerator
 *
 * Generates character reference images ONLY from Character Library entries
 * (CharacterBibleEntry). Uses the locked identity pipeline:
 * CharacterBibleEntry.character_prompt â†’ ComfyUI â†’ CharacterBibleEntry.reference_image_path
 *
 * Architecture rules:
 * - Character generation happens ONLY from Character Library entries
 * - Stable identity pipeline is mandatory
 * - No character identity regeneration during scene generation
 */

import type { CharacterBibleEntry } from '../../types';
import { buildCharacterPortraitPrompt, buildCharacterPortraitNegative } from '../character/CharacterPromptBuilder';
import { getStyleKeywords } from "../character/CharacterPromptBuilder";
import { buildStylePrefix, buildStyleNegative, getStyleFamilyLabel, classifyStyleIds } from "../style/StyleFamilyRouter";
import { selectCheckpoint, selectWorkflow, getPrimaryStyleFamily } from "../style/StyleWorkflowRouter";
import type { ProgressState } from './GenerationProgressTracker';
import { makeProgress, makeError, DONE_PROGRESS, globalProgressTracker, makeGenerationKey } from './GenerationProgressTracker';
import { ComfyUIProvider } from '../../infrastructure/ai/providers/ComfyUIProvider';

export interface CharacterGenerationResult {
  entry: CharacterBibleEntry;
  /** The path to the generated reference image */
  referenceImagePath: string | null;
  success: boolean;
  error?: string;
}

export type CharacterProgressCallback = (progress: ProgressState) => void;

/**
 * Generate a single character reference image from a CharacterBibleEntry.
 * Uses the character_prompt / buildCharacterPortraitPrompt to create a stable identity image.
 *
 * @param entry - The CharacterBibleEntry to generate an image for
 * @param onProgress - Optional progress callback
 * @returns The updated entry with reference_image_path set
 */
/**
 * Strictly sanitize a prompt for ComfyUI.
 * Removes:
 * - JSON fragments, braces {}, brackets [], quotes ""
 * - debug labels, malformed key/value text
 * - repeated commas, empty attributes
 * - duplicated words like "to, to, to"
 * - non-prompt garbage
 * Keeps only clean natural-language comma-separated prompt phrases.
 */
function sanitizeFinalPromptForComfyUI(raw: string): string {
  if (!raw) return "";

  let cleaned = raw;

  // Remove JSON-like objects: {...} and [...]
  cleaned = cleaned.replace(/\{[^}]*\}/g, "");
  cleaned = cleaned.replace(/\[[^\]]*\]/g, "");

  // Remove quotes (single and double)
  cleaned = cleaned.replace(/["']/g, "");

  // Remove debug labels like [LABEL] or [LABEL text]
  cleaned = cleaned.replace(/\[[\w\s-]+\]/g, "");

  // Remove repeated "to, to, to" patterns
  cleaned = cleaned.replace(/(\bto\b\s*,?\s*){2,}/gi, "");

  // Remove repeated "at, at, at" patterns
  cleaned = cleaned.replace(/(\bat\b\s*,?\s*){2,}/gi, "");

  // Remove repeated "or, or, or" patterns
  cleaned = cleaned.replace(/(\bor\b\s*,?\s*){2,}/gi, "");

  // Remove key:value patterns (malformed object-like text)
  cleaned = cleaned.replace(/\b\w+\s*:\s*\w+/g, "");

  // Collapse repeated commas
  cleaned = cleaned.replace(/,{2,}/g, ",");

  // Remove comma-space-comma patterns
  cleaned = cleaned.replace(/,\s*,/g, ",");

  // Remove empty parentheses
  cleaned = cleaned.replace(/\(\s*\)/g, "");

  // Remove leading/trailing commas and spaces
  cleaned = cleaned.replace(/^[,\s]+/, "");
  cleaned = cleaned.replace(/[,\s]+$/, "");

  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove any remaining non-printable characters
  cleaned = cleaned.replace(/[^\x20-\x7E,.\s]/g, "");

  // Final trim
  cleaned = cleaned.trim();

  // If after cleaning the prompt is empty or too short, return a safe default
  if (!cleaned || cleaned.length < 10) {
    return 'Pixar-style 3D animated character, Disney-inspired stylized face, large expressive eyes, rounded facial features, stylized anatomy, toy-like materials, smooth 3D shading, non-photorealistic, animated movie character, family animation style, cute proportions, slightly oversized head, soft cinematic cartoon lighting, highly stylized, colorful animated film aesthetic';
  }

  return cleaned;
}

/**
 * Extract locked appearance traits from a CharacterBibleEntry.
 * These traits are saved and reused for future scene generation.
 *
 * IMPORTANT: Returns null if key fields (hairstyle, outfit) are empty.
 * Callers MUST check for null and preserve existing identity when extraction fails.
 */
function extractAppearanceTraits(entry: CharacterBibleEntry, positivePrompt: string): {
  hairstyle: string;
  hair_color: string;
  eye_color: string;
  outfit: string;
  age_range: string;
  facial_structure: string;
  body_proportions: string;
  style_type: string;
} | null {
  // CRITICAL: Never return default/placeholder values.
  // If extraction fails, return null so caller can preserve existing identity.

  // Extract hairstyle from the hair field
  const hairLower = (entry.hair || '').toLowerCase();
  let hairstyle = entry.hair || '';
  // Try to detect hair color from hair string
  const hairColors = ['blonde', 'blond', 'brown', 'black', 'red', 'ginger', 'auburn', 'white', 'gray', 'grey', 'golden', 'chestnut', 'dark', 'light'];
  let hairColor = '';
  for (const c of hairColors) {
        if (hairLower.includes(c)) {
          hairColor = c;
          break;
        }
  }

  // Eye color from the eyes field
  const eyesLower = (entry.eyes || '').toLowerCase();
  const eyeColors = ['blue', 'brown', 'green', 'hazel', 'gray', 'grey', 'black', 'amber', 'violet'];
  let eyeColor = '';
  for (const c of eyeColors) {
        if (eyesLower.includes(c)) {
          eyeColor = c;
          break;
        }
  }

  // Age range
  const age = entry.age;
  let ageRange = '';
  if (age <= 0) ageRange = '';
  else if (age <= 3) ageRange = 'toddler';
  else if (age <= 6) ageRange = 'young child';
  else if (age <= 10) ageRange = 'child';
  else if (age <= 13) ageRange = 'preteen';
  else if (age <= 17) ageRange = 'teenager';
  else if (age <= 30) ageRange = 'young adult';
  else if (age <= 45) ageRange = 'adult';
  else ageRange = 'older adult';

  // Detect style type from prompt
  const promptLower = positivePrompt.toLowerCase();
  let styleType = '3D animated'; // default
  if (promptLower.includes('pixar')) styleType = 'Pixar-style 3D';
  else if (promptLower.includes('disney')) styleType = 'Disney-style 3D';
  else if (promptLower.includes('anime') || promptLower.includes('manga')) styleType = 'anime';
  else if (promptLower.includes('realistic') || promptLower.includes('photorealistic')) styleType = 'realistic';
  else if (promptLower.includes('cinematic')) styleType = 'cinematic 3D';
  else if (promptLower.includes('cartoon') || promptLower.includes('toon')) styleType = 'cartoon 3D';

  // Validate: if key fields are empty/unset, return null (don't overwrite identity with defaults)
  if (!hairstyle || hairstyle.trim().length === 0) {
    console.warn('[EXTRACT] hairstyle is empty - returning null');
    return null;
  }
  if (!entry.outfit || entry.outfit.trim().length === 0) {
    console.warn('[EXTRACT] outfit is empty - returning null');
    return null;
  }

  return {
        hairstyle: hairstyle,
        hair_color: hairColor || hairstyle, // fallback to hairstyle string itself
        eye_color: eyeColor || (entry.eyes || ''),
        outfit: entry.outfit,
        age_range: ageRange,
        facial_structure: 'stylized facial features consistent with reference image',
        body_proportions: 'stylized proportions consistent with reference image',
        style_type: styleType,
  };
}

export async function generateCharacterImage(
  entry: CharacterBibleEntry,
  onProgress?: CharacterProgressCallback,
  stylePresetIds?: string[]
): Promise<CharacterGenerationResult> {
  const genKey = makeGenerationKey('character-image', entry.id);

  if (!globalProgressTracker.tryClaim(genKey)) {
        return {
          entry,
          referenceImagePath: null,
          success: false,
          error: `Character "${entry.name}" image generation is already in progress.`,
        };
  }

  try {
        onProgress?.(
          makeProgress({
            phase: 'Generating character image',
            currentItem: 1,
            totalItems: 1,
            label: `Generating character: ${entry.name}`,
          })
        );

                // ========== CHECK FOR LOCKED PARAMETERS ==========
        // If identity is locked, reuse the same seed, workflow, and checkpoint
        // to ensure consistent identity.
        const isIdentityLocked = entry.identityLocked && entry.seed !== null && entry.workflow_path !== null && entry.checkpoint !== null;
        console.log('[CONSISTENCY] identityLocked:', isIdentityLocked, '| Character:', entry.name);

        // ========== STYLE WORKFLOW ROUTING ==========
        // ========== CHARACTER IMAGE PIPELINE: FORCE DREAMSHAPER DISNEY/PIXAR ==========
        // Character reference images MUST use the Disney/Pixar DreamShaper pipeline.
        // No JuggernautXL, no SDXL fallback, no generic pipeline.
        // stylePresetIds MUST contain a Pixar/Disney style, or the call will be rejected.
        const hasPixarDisneyStyle = stylePresetIds && (stylePresetIds.includes('style-pixar') || stylePresetIds.includes('style-disney') || stylePresetIds.includes('style-kids-edu'));
        if (!isIdentityLocked && !hasPixarDisneyStyle) {
          const errMsg = 'Character image generation requires a Disney/Pixar style preset. ' +
            'Received stylePresetIds: ' + JSON.stringify(stylePresetIds) + '. ' +
            'Please select Pixar, Disney, or Kids Educational style before generating character images.';
          console.error('[WORKFLOW ERROR]', errMsg);
          throw new Error(errMsg);
        }

        const selectedCheckpoint = isIdentityLocked
          ? entry.checkpoint!
          : selectCheckpoint(stylePresetIds || []);
        const selectedWorkflow = isIdentityLocked
          ? entry.workflow_path!
          : selectWorkflow(stylePresetIds || []);
        const workflowFamily = (stylePresetIds && stylePresetIds.length > 0)
          ? getPrimaryStyleFamily(stylePresetIds)
          : 'pixar-disney';
                const activeStyleIds = isIdentityLocked ? entry.style_preset_ids : (stylePresetIds || []);
        const debugSeed = isIdentityLocked ? entry.seed! : (entry.seed ?? Math.floor(Math.random() * 2147483647));

        console.log('[CONSISTENCY] seed:', debugSeed);
        console.log('[CONSISTENCY] workflow:', selectedWorkflow);
        console.log('[CONSISTENCY] checkpoint:', selectedCheckpoint);
        console.log('[CONSISTENCY] stylePresetIds:', activeStyleIds);
        
        // Verify the selected workflow is the Pixar/Disney one
        if (!selectedWorkflow.includes('pixar_disney_stable')) {
          console.warn('[WORKFLOW WARNING] Expected pixar_disney_stable.json but got:', selectedWorkflow);
        }
        if (!selectedCheckpoint.includes('dreamshaperXL')) {
          console.warn('[WORKFLOW WARNING] Expected dreamshaperXL checkpoint but got:', selectedCheckpoint);
        }

        // ========== BUILD PROMPTS ==========
        // Use locked prompts if available, otherwise build fresh
        let finalPositivePrompt: string;
        let finalNegativePrompt: string;

        // ===== STRICT MANUAL PROMPT BYPASS =====
        // If the user has typed a manual prompt (character_prompt_manual === true),
        // send it EXACTLY as-is to ComfyUI. NO modifications, NO sanitization, NO injection.
        // This is the #1 requirement: user's textarea text must reach ComfyUI unchanged.
        if (entry.character_prompt_manual && entry.character_prompt && entry.character_prompt.trim().length > 0) {
          console.log('');
          console.log('========== MANUAL PROMPT MODE ACTIVE ==========');
          console.log('[MANUAL PROMPT RAW]', entry.character_prompt);
          finalPositivePrompt = entry.character_prompt;
          finalNegativePrompt = entry.negative_prompt || '';
          console.log('[FINAL PROMPT SENT TO COMFYUI]', finalPositivePrompt);
          console.log('[MANUAL NEGATIVE RAW]', finalNegativePrompt);
          console.log('[BYPASS] All auto-transformations DISABLED for manual prompt');
          console.log('============================================');
          console.log('');

          // STRICT ENFORCEMENT: Throw if prompt was modified after assignment
          if (finalPositivePrompt !== entry.character_prompt) {
            throw new Error("Manual prompt was modified before ComfyUI. This is forbidden. Expected: '" + entry.character_prompt + "' Got: '" + finalPositivePrompt + "'");
          }
        } else if (isIdentityLocked && entry.generation_positive_prompt) {
          // Reuse the exact same prompts that produced the reference image
          finalPositivePrompt = entry.generation_positive_prompt;
          finalNegativePrompt = entry.generation_negative_prompt || '';
          console.log('[CONSISTENCY] Reusing locked prompts from previous generation');
          console.log('[LOCKED PROMPT]', finalPositivePrompt);
        } else {
          // Build fresh prompts using the character's data
          const styleFamily = (stylePresetIds && stylePresetIds.length > 0)
            ? classifyStyleIds(stylePresetIds).find(f => f !== 'cinematic' && f !== 'unknown') || 'unknown'
            : 'unknown';
          console.log('[BASE CHARACTER PROMPT] styleFamily:', styleFamily);

          // Build base prompts
          let positivePrompt: string;
          let negativePrompt: string;

          if (entry.character_prompt && entry.character_prompt.trim().length > 10) {
            console.log('[PROMPT SOURCE] Using user-written character_prompt directly');
            positivePrompt = entry.character_prompt;
            negativePrompt = entry.negative_prompt || buildCharacterPortraitNegative(entry, styleFamily);
          } else if (styleFamily === 'cartoon') {
            console.log('[PROMPT SOURCE] No user prompt found, using cartoon fallback');
            positivePrompt = (
              '(Pixar-style 3D animated character:1.5), ' +
              '(Disney cinematic animated film:1.4), ' +
              '(stylized 3D render:1.4), ' +
              '(high-end animated movie frame:1.3), ' +
              '(subsurface scattering:1.2), ' +
              '(global illumination:1.2), ' +
              '(soft cinematic volumetric lighting:1.2), ' +
              'large expressive eyes, ' +
              'rounded facial features, ' +
              'stylized anatomy, ' +
              'toy-like materials, ' +
              'smooth 3D shading, ' +
              'cute proportions, ' +
              'slightly oversized head, ' +
              'colorful animated film aesthetic'
            );
            negativePrompt = (
              '(photorealistic:1.5), ' +
              '(real human skin:1.5), ' +
              '(fashion photography:1.4), ' +
              '(stock photo:1.4), ' +
              '(realistic anatomy:1.3), ' +
              '(live action:1.3), ' +
              'studio portrait, ' +
              'skin pores, ' +
              'realistic skin texture, ' +
              'documentary, ' +
              'adult proportions, ' +
              'anime, manga, 2D, illustration, comic, sketch, line art, ' +
              'flat shading, cel shading, black outline, monochrome, drawing'
            );
          } else {
            console.log('[PROMPT SOURCE] No user prompt, building from builder');
            positivePrompt = entry.character_prompt || buildCharacterPortraitPrompt(entry, styleFamily);
            negativePrompt = buildCharacterPortraitNegative(entry, styleFamily);
          }
          console.log('[BUILT/PASSED] positivePrompt:', positivePrompt);
          console.log('[BUILT/PASSED] negativePrompt:', negativePrompt);

          // Merge style keywords if style presets are active
          finalPositivePrompt = positivePrompt;
          finalNegativePrompt = negativePrompt;

          if (stylePresetIds && stylePresetIds.length > 0) {
            const combinedStyle = stylePresetIds
              .map(id => getStyleKeywords(id))
              .filter(Boolean)
              .join('. ');
            const stylePrefix = buildStylePrefix(stylePresetIds);
            const styleNegativeAdditions = buildStyleNegative(stylePresetIds);
            const prefixParts = [combinedStyle, stylePrefix].filter(Boolean);
            const fullPrefix = prefixParts.join(', ');
            if (fullPrefix) {
              finalPositivePrompt = fullPrefix + ', ' + positivePrompt;
              console.log('[STYLE INJECTION] Prepended style prefix');
            }
            if (styleNegativeAdditions) {
              finalNegativePrompt = (negativePrompt ? negativePrompt + ', ' : '') + styleNegativeAdditions;
            }
          }

          console.log('[BEFORE SANITIZE] finalPositivePrompt:', finalPositivePrompt);

          // Apply prompt sanitization
          finalPositivePrompt = sanitizeFinalPromptForComfyUI(finalPositivePrompt);
          finalNegativePrompt = sanitizeFinalPromptForComfyUI(finalNegativePrompt);
          console.log('[AFTER SANITIZE] finalPositivePrompt:', finalPositivePrompt);
        }

        console.log('[STYLE WORKFLOW ROUTER] workflowFamily:', workflowFamily);
        console.log('[CHECKPOINT SELECTED]', selectedCheckpoint);
        console.log('[SELECTED WORKFLOW PATH]', selectedWorkflow);

        // ========== WORKFLOW DIMENSION DIAGNOSTIC ==========
        // DETECT SDXL models that need 1024x1024 instead of 512x512
        const IS_SDXL_MODEL = selectedCheckpoint.toLowerCase().includes('xl');
        const RECOMMENDED_WIDTH = IS_SDXL_MODEL ? 1024 : 512;
        const RECOMMENDED_HEIGHT = IS_SDXL_MODEL ? 1024 : 512;
        console.log('[WORKFLOW DIAGNOSTIC]');
        console.log('[WORKFLOW DIAGNOSTIC] Model:', selectedCheckpoint);
        console.log('[WORKFLOW DIAGNOSTIC] Is SDXL:', IS_SDXL_MODEL);
        console.log('[WORKFLOW DIAGNOSTIC] Recommended size:', RECOMMENDED_WIDTH, 'x', RECOMMENDED_HEIGHT);
        console.log('[WORKFLOW DIAGNOSTIC] Current fallback size: 512 x 512');
        if (IS_SDXL_MODEL) {
          console.warn('[WORKFLOW DIAGNOSTIC] WARNING: SDXL model with 512x512 will produce corrupted/glitched images!');
          console.warn('[WORKFLOW DIAGNOSTIC] The file workflows/default_txt2img.json does NOT exist - falling back to buildPromptWorkflow()');
          console.warn('[WORKFLOW DIAGNOSTIC] buildPromptWorkflow() uses 512x512 by default, which breaks SDXL models.');
          console.warn('[WORKFLOW DIAGNOSTIC] REQUESTED FIX: Either create workflows/default_txt2img.json with 1024x1024,');
          console.warn('[WORKFLOW DIAGNOSTIC]   or update CharacterImageGenerator to pass width/height based on model type.');
        }

        // ========== WORKFLOW FILE AS SOURCE OF TRUTH ==========
        const isFileWorkflow = selectedWorkflow !== 'workflows/default_txt2img.json' && selectedWorkflow !== 'workflows/cartoon_txt2img.json';
        console.log('[USING FILE WORKFLOW]', isFileWorkflow ? 'TRUE' : 'FALSE');
        console.log('[WORKFLOW SOURCE] Using file-based workflow:', selectedWorkflow);

        // Calculate appropriate dimensions based on checkpoint type
        const genWidth = IS_SDXL_MODEL ? 1024 : 512;
        const genHeight = IS_SDXL_MODEL ? 1024 : 512;
        console.log('[WORKFLOW DIMENSIONS] Generators will use:', genWidth, 'x', genHeight);

        // Create a direct ComfyUI provider connection
        const provider = new ComfyUIProvider({
          baseUrl: 'http://127.0.0.1:8188',
          clientId: 'seri-ai-char-' + Date.now() + '',
          defaultImageWidth: genWidth,
          defaultImageHeight: genHeight,
          connectionTimeout: 10000,
        });
        // ========== FINAL PROMPT DEBUG ==========
        console.log('');
        console.log('========== CONSISTENCY PIPELINE DEBUG ==========');
        console.log('[FINAL POSITIVE PROMPT]', finalPositivePrompt);
        console.log('[FINAL NEGATIVE PROMPT]', finalNegativePrompt);
        console.log('[FINAL STYLE IDS]', JSON.stringify(activeStyleIds));
        console.log('[FINAL WORKFLOW PATH]', selectedWorkflow);
        console.log('[FINAL CHECKPOINT]', selectedCheckpoint);
        console.log('[FINAL SEED]', debugSeed);
        console.log('============================================');
        console.log('');

        console.log('');
        console.log('========== CALLING COMFYUI ==========');
        console.log('[MODE]', entry.character_prompt_manual ? 'MANUAL (zero transformations)' : 'AUTO');
        console.log('[PROMPT TO COMFYUI]', finalPositivePrompt);
        console.log('[NEGATIVE TO COMFYUI]', finalNegativePrompt);
        console.log('[SEED TO COMFYUI]', debugSeed);
        console.log('[MODEL TO COMFYUI]', selectedCheckpoint);
        console.log('[WORKFLOW TO COMFYUI]', selectedWorkflow);
        console.log('======================================');
        console.log('');

        // Call provider.generateImage directly
        const imageResult = await provider.generateImage(finalPositivePrompt, {
          negativePrompt: finalNegativePrompt,
          seed: debugSeed,
          model: selectedCheckpoint,
          workflowPath: selectedWorkflow,
          width: genWidth,
          height: genHeight,
        });
        // result.url = http://127.0.0.1:8188/view?filename=seri_ai_XXXXX.png&type=output
        const imageUrl = imageResult.url || '';
        console.log('[CHAR IMAGE] filename:', imageUrl.split('filename=')[1]?.split('&')[0] || 'unknown');
        console.log('[CHAR IMAGE] url:', imageUrl);

        // ===== VALIDATED APPEARANCE TRAITS EXTRACTION =====
        // CRITICAL: Never overwrite valid identity with defaults or corrupted data.
        // Three outcomes:
        //   1. Image URL is invalid/corrupted â†’ abort ALL identity updates (image + traits + lock)
        //   2. Extracted traits are null (empty fields) â†’ abort trait update only, save new image
        //   3. Both valid â†’ safe to save everything

        // Extract appearance traits from character data for locking
        const rawAppearanceTraits = extractAppearanceTraits(entry, finalPositivePrompt);
        console.log('[CONSISTENCY] Raw extracted appearance traits:', JSON.stringify(rawAppearanceTraits));

        // Validate image URL: must exist, be long enough (>20 chars), not contain error patterns
        const IMAGE_ERROR_PATTERNS = ['error', 'failed', 'corrupt', 'null', 'undefined'];
        const imageIsValid = imageUrl &&
          imageUrl.trim().length > 20 &&
          !IMAGE_ERROR_PATTERNS.some(p => imageUrl.toLowerCase().includes(p));

        // Traits are valid if extractor returned an object (not null)
        const traitsAreValid = rawAppearanceTraits !== null;

        let appearanceTraitsToSave = rawAppearanceTraits;
        let identityLockedToSave = true;
        let refImageToSave = imageUrl;

        if (!imageIsValid) {
          console.warn('[CONSISTENCY EXTRACTION FAILED] Image URL is invalid/corrupted - identity not updated');
          console.warn('[CONSISTENCY] imageUrl:', imageUrl);
          appearanceTraitsToSave = entry.appearance_traits; // Keep existing
          identityLockedToSave = entry.identityLocked ?? false; // Keep existing
          refImageToSave = entry.reference_image_path || ''; // Keep existing reference image
        } else if (!traitsAreValid) {
          console.warn('[CONSISTENCY EXTRACTION FAILED] Extracted traits are null/empty - identity not updated');
          appearanceTraitsToSave = entry.appearance_traits; // Keep existing traits
          // Image IS valid, so save the new image URL but preserve old traits
          console.log('[CONSISTENCY] New image URL saved but appearance traits preserved from previous identity');
        } else {
          console.log('[CONSISTENCY VALIDATION PASSED] Extracted traits are valid, saving full identity');
        }

        // Update the entry with all generation metadata
        const updatedEntry: CharacterBibleEntry = {
          ...entry,
          identityLocked: identityLockedToSave,
          reference_image_path: refImageToSave,
          reference_image_for_ipadapter: refImageToSave,
          seed: debugSeed,
          workflow_path: selectedWorkflow,
          checkpoint: selectedCheckpoint,
          generation_positive_prompt: finalPositivePrompt,
          generation_negative_prompt: finalNegativePrompt,
          style_preset_ids: activeStyleIds,
          appearance_traits: appearanceTraitsToSave,
          updated_at: new Date().toISOString(),
        };

    onProgress?.(DONE_PROGRESS);

    return {
      entry: updatedEntry,
      referenceImagePath: imageUrl,
      success: true,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error generating character image';
    console.error('[CHARACTER IMAGE GEN] Failed:', errMsg);
    onProgress?.(makeError('character-image', errMsg));

    return {
      entry,
      referenceImagePath: null,
      success: false,
      error: errMsg,
    };
  } finally {
    globalProgressTracker.release(genKey);
  }
}

