/**
 * CharacterImageGenerator
 *
 * Generates character reference images ONLY from Character Library entries
 * (CharacterBibleEntry). Uses the locked identity pipeline:
 * CharacterBibleEntry.character_prompt → ComfyUI → CharacterBibleEntry.reference_image_path
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
import {selectCheckpoint, selectWorkflow, getPrimaryStyleFamily, selectIdentityWorkflow, selectIdentityCheckpoint} from "../style/StyleWorkflowRouter";
import type { ProgressState } from './GenerationProgressTracker';
import { makeProgress, makeError, DONE_PROGRESS, globalProgressTracker, makeGenerationKey } from './GenerationProgressTracker';
import { ComfyUIExecutor, ComfyUIExecutorConfig } from '../../infrastructure/ai/providers/ComfyUIExecutor';
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

  // Remove key:value patterns (malformed object-like text).
  // Fix 3: protect hyphenated style/identity terms like Pixar-style, crew-neck, side-swept.
  // Only match bare word:word with optional spaces, not hyphenated compounds.
  cleaned = cleaned.replace(/\b(?<![\w-])\w+\s{1,3}:\s{1,3}\w+/g, "");

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

  // Build rich facial_structure from visual_description (not a placeholder)
  const visualDesc = (entry.visual_description || '').trim();
  // Extract face shape: look for known shapes in visual_description
  const faceShapes = ['oval', 'round', 'square', 'narrow', 'heart', 'diamond', 'long', 'angular', 'soft'];
  let faceShape = '';
  const visualLower = visualDesc.toLowerCase();
  for (const s of faceShapes) {
    if (visualLower.includes(s)) { faceShape = s + ' face'; break; }
  }
  // Extract eyebrow description
  const eyebrowTerms = ['thick', 'thin', 'arched', 'bushy', 'fine', 'dark', 'sharp', 'straight', 'curved'];
  let eyebrowDesc = '';
  const browMatch = visualDesc.match(/([a-z\s]+eyebrow[s]?)/i);
  if (browMatch) eyebrowDesc = browMatch[0].trim();
  else for (const t of eyebrowTerms) {
    if (visualLower.includes(t + ' eyebrow') || visualLower.includes('eyebrow')) {
      eyebrowDesc = t + ' eyebrows'; break;
    }
  }
  // Build facial_structure from actual visual_description
  const facialParts: string[] = [];
  if (faceShape) facialParts.push(faceShape);
  if (eyebrowDesc) facialParts.push(eyebrowDesc);
  // Add skin tone if present
  const skinMatch = visualDesc.match(/(light|medium|dark|olive|warm|fair|pale|tan|brown)[\s-]*(skin|complexion|tone)/i);
  if (skinMatch) facialParts.push(skinMatch[0]);
  // Add build if present
  const buildMatch = visualDesc.match(/(slim|stocky|average|petite|athletic|chubby|lean|slender)[\s]*(build|frame|body)?/i);
  if (buildMatch) facialParts.push(buildMatch[0].trim());
  const facialStructure = facialParts.length > 0
    ? facialParts.join(', ')
    : (visualDesc.slice(0, 80) || 'stylized face consistent with reference image');

  console.log('[IDENTITY EXTRACTED] hair:', hairstyle);
  console.log('[IDENTITY EXTRACTED] outfit:', entry.outfit);
  console.log('[IDENTITY EXTRACTED] face_shape:', faceShape || 'not detected');
  console.log('[IDENTITY EXTRACTED] eyebrows:', eyebrowDesc || 'not detected');
  console.log('[IDENTITY EXTRACTED] visual_description:', visualDesc.slice(0, 120));

  return {
        hairstyle: entry.hair || hairstyle,   // full hair description, not reduced
        hair_color: hairColor || hairstyle,
        eye_color: eyeColor || (entry.eyes || ''),
        outfit: entry.outfit,                  // full outfit with layers
        age_range: ageRange,
        facial_structure: facialStructure,     // built from visual_description
        body_proportions: ageRange || 'stylized proportions consistent with reference image',
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

        // ========== IDENTITY FIELD MINIMUM VALIDATION ==========
        // Warn if critical identity fields are empty — identity lock will be blocked at save time.
        const identityFieldsMissing: string[] = [];
        if (!entry.hair || !entry.hair.trim()) identityFieldsMissing.push('hair');
        if (!entry.eyes || !entry.eyes.trim()) identityFieldsMissing.push('eyes');
        if (!entry.outfit || !entry.outfit.trim()) identityFieldsMissing.push('outfit');
        if (!entry.visual_description || !entry.visual_description.trim()) identityFieldsMissing.push('visual_description');
        if (identityFieldsMissing.length > 0) {
          console.warn(`[IDENTITY FIELD GATE] Character "${entry.name}" is missing critical fields: ${identityFieldsMissing.join(', ')}`);
          console.warn('[IDENTITY FIELD GATE] Identity lock will be BLOCKED after generation until these fields are filled.');
        } else {
          console.log(`[IDENTITY FIELD GATE] Character "${entry.name}" has all critical identity fields — lock eligible.`);
        }

        // ========== BUILD PROMPTS ==========
        // Use locked prompts if available, otherwise build fresh
        let finalPositivePrompt: string;
        let finalNegativePrompt: string;

        // ===== STRICT MANUAL PROMPT BYPASS =====
        // If the user has typed a manual prompt, send it EXACTLY as-is
        console.log('[CHARACTER FORM DATA] name:', entry.name);
        console.log('[CHARACTER FORM DATA] age:', entry.age, '| gender:', entry.gender);
        console.log('[CHARACTER FORM DATA] hair:', entry.hair);
        console.log('[CHARACTER FORM DATA] eyes:', entry.eyes);
        console.log('[CHARACTER FORM DATA] outfit:', entry.outfit);
        console.log('[CHARACTER FORM DATA] visual_description:', entry.visual_description);
        console.log('[CHARACTER FORM DATA] appearance_traits:', JSON.stringify(entry.appearance_traits));
        console.log('[CHARACTER FORM DATA] character_prompt:', entry.character_prompt?.slice(0,120) ?? 'none');
        console.log('[CHARACTER FORM DATA] identityLocked:', entry.identityLocked, '| seed:', entry.seed);

        if (entry.character_prompt_manual && entry.character_prompt && entry.character_prompt.trim().length > 0) {
          console.log('[MANUAL PROMPT MODE] Using manual prompt directly');
          finalPositivePrompt = entry.character_prompt;
          finalNegativePrompt = entry.negative_prompt || '';
        } else if (isIdentityLocked && entry.generation_positive_prompt) {
          // Reuse the exact same prompts that produced the reference image
          finalPositivePrompt = entry.generation_positive_prompt;
          finalNegativePrompt = entry.generation_negative_prompt || '';
          console.log('[CONSISTENCY] Reusing locked prompts from previous generation');
        } else {
          // Build fresh prompts using the character's data
          const styleFamily = (stylePresetIds && stylePresetIds.length > 0)
            ? classifyStyleIds(stylePresetIds).find(f => f !== 'cinematic' && f !== 'unknown') || 'unknown'
            : 'unknown';
          console.log('[BASE CHARACTER PROMPT] styleFamily:', styleFamily);

          // Build base prompts
          let positivePrompt: string;
          let negativePrompt: string;

          if (entry.character_prompt && entry.character_prompt.trim().length > 5) {
            // Use user-written character_prompt
            positivePrompt = entry.character_prompt;
            negativePrompt = entry.negative_prompt || buildCharacterPortraitNegative(entry, styleFamily);
          } else if (styleFamily === 'cartoon') {
            // Fix 1: identity FIRST, then Pixar style wrapper appended.
            // buildCharacterPortraitPrompt includes all locked traits: age, hair, beard, outfit, face.
            const identityBase = buildCharacterPortraitPrompt(entry, styleFamily);
            const cartoonStyleWrapper = [
              'Pixar-style 3D animated character',
              'Disney-inspired stylized face',
              'stylized 3D render',
              'volumetric lighting',
              'soft cinematic lighting',
              'subsurface scattering',
              'high-end animated film',
              'smooth 3D shading',
              'colorful family animation movie style',
              'toy-like materials',
              'clean simple background',
            ].join(', ');
            positivePrompt = identityBase + ', ' + cartoonStyleWrapper;
            negativePrompt = buildCharacterPortraitNegative(entry, styleFamily);
            console.log('[CHARACTER PROMPT BUILDER OUTPUT] cartoon identity base (first 300):', identityBase.slice(0,300));
          } else {
            positivePrompt = buildCharacterPortraitPrompt(entry, styleFamily);
            negativePrompt = buildCharacterPortraitNegative(entry, styleFamily);
          }
          console.log('[CHARACTER PROMPT BUILDER OUTPUT] positive (first 300):', positivePrompt.slice(0,300));
          console.log('[CHARACTER PROMPT BUILDER OUTPUT] negative (first 200):', negativePrompt.slice(0,200));

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
            }
            if (styleNegativeAdditions) {
              finalNegativePrompt = (negativePrompt ? negativePrompt + ', ' : '') + styleNegativeAdditions;
            }
          }

          // Apply prompt sanitization
          const preSanitizePositive = finalPositivePrompt;
          const preSanitizeNegative = finalNegativePrompt;
          finalPositivePrompt = sanitizeFinalPromptForComfyUI(finalPositivePrompt);
          finalNegativePrompt = sanitizeFinalPromptForComfyUI(finalNegativePrompt);
          console.log('[CHARACTER PROMPT FINAL] pre-sanitize positive (first 400):', preSanitizePositive.slice(0,400));
          console.log('[CHARACTER PROMPT FINAL] post-sanitize positive (first 400):', finalPositivePrompt.slice(0,400));
          console.log('[CHARACTER PROMPT FINAL] identity tokens present:',
            ['bald','beard','suit','adult','age','old'].filter(t => finalPositivePrompt.toLowerCase().includes(t)));
          console.log('[PROMPT] Final positive:', finalPositivePrompt);
        }


        // ========== IDENTITY WORKFLOW ROUTING (EXECUTOR) ==========
        // Two modes:
        //   A) Normal character generation (no reference image):
        //      -> workflows/pixar_disney_stable.json (DreamShaperXL only)
        //   B) Locked/reference identity generation (has reference_image_path or identityLocked):
        //      -> workflows/pixar_disney_ipadapter_v1.json (DreamShaperXL + LoRA + IPAdapter)

        // Determine if we have a reference image to use for IPAdapter
        const hasReferenceImage = !!(entry.reference_image_path && entry.reference_image_path.trim().length > 0);
        const shouldUseIPAdapter = hasReferenceImage || !!isIdentityLocked;

        console.log('[IDENTITY ROUTER] Character:', entry.name);
        console.log('[IDENTITY ROUTER] identityLocked:', isIdentityLocked);
        console.log('[IDENTITY ROUTER] hasReferenceImage:', hasReferenceImage);
        console.log('[IDENTITY ROUTER] shouldUseIPAdapter:', shouldUseIPAdapter);

        // Select workflow based on reference image availability
        // EXECUTOR: use pixar_disney_*.json files directly (no dynamic generation)
        const resolvedWorkflow = shouldUseIPAdapter
          ? 'workflows/pixar_disney_ipadapter_v1.json'
          : 'workflows/pixar_disney_stable.json';
        const selectedCheckpoint = selectIdentityCheckpoint();
        const workflowFamily = 'pixar-disney';
        const activeStyleIds = isIdentityLocked ? entry.style_preset_ids : (stylePresetIds || []);

        // ========== SEED REUSE ENFORCEMENT ==========
        // Determinism rule: reuse saved seed when identity exists.
        // Only generate a new seed for truly new characters (no saved seed, no reference image).
        let debugSeed: number;
        if (isIdentityLocked && entry.seed !== null) {
          // Fully locked: reuse exact seed
          debugSeed = entry.seed;
          console.log('[IDENTITY SEED USED] Reusing locked seed:', debugSeed, '| Character:', entry.name);
        } else if (entry.seed !== null && entry.seed !== undefined) {
          // Has a saved seed (from previous generation) but not fully locked — still reuse
          debugSeed = entry.seed;
          console.log('[IDENTITY SEED USED] Reusing saved seed:', debugSeed, '| Character:', entry.name);
        } else {
          // Truly new character: generate fresh seed
          debugSeed = Math.floor(Math.random() * 2147483647);
          console.log('[NEW SEED GENERATED]', debugSeed, '| Character:', entry.name);
        }

        console.log('[CONSISTENCY] seed:', debugSeed);
        console.log('[CONSISTENCY] workflow (resolved):', resolvedWorkflow);
        console.log('[CONSISTENCY] checkpoint:', selectedCheckpoint);
        console.log('[CONSISTENCY] stylePresetIds:', activeStyleIds);

        // HARD VALIDATION: If IPAdapter workflow is selected, reference image path MUST exist
        if (resolvedWorkflow.includes('ipadapter') && !hasReferenceImage) {
          const errMsg = 'IPAdapter identity workflow requires a reference image path. ' +
            'Character "' + entry.name + '" has no reference image. ' +
            'Generate a normal image first, then use identity mode.';
          console.error('[IDENTITY ERROR]', errMsg);
          throw new Error(errMsg);
        }

        // HARD VALIDATION: If no reference image, we MUST NOT use IPAdapter workflow
        if (!hasReferenceImage && resolvedWorkflow.includes('ipadapter')) {
          const errMsg = 'Internal error: IPAdapter workflow selected without reference image. ' +
            'Falling back to stable workflow is not allowed. Aborting.';
          console.error('[IDENTITY ERROR]', errMsg);
          throw new Error(errMsg);
        }

        // Calculate appropriate dimensions based on checkpoint type
        const isSdxlModel = selectedCheckpoint && selectedCheckpoint.toLowerCase().includes('xl');
        const genWidth = isSdxlModel ? 1024 : 512;
        const genHeight = isSdxlModel ? 1024 : 512;
        console.log('[WORKFLOW DIMENSIONS] Generators will use:', genWidth, 'x', genHeight);

        // Create ComfyUI executor for deterministic JSON-first execution
        const executor = new ComfyUIExecutor({
          baseUrl: 'http://127.0.0.1:8188',
          clientId: 'seri-ai-char-' + Date.now() + '',
          connectionTimeout: 10000,
        });

        // Build workflowInputs for IPAdapter.
        // Before injecting LoadImage node 13, ensure the reference file
        // exists in ComfyUI input/ (LoadImage reads from input/ only, not output/).
        // Flow: check input/ -> if missing, fetch from output/ and POST to /upload/image.
        const workflowInputs: Record<string, any> = {};
        // Patch: prefer reference_image_for_ipadapter (stable base identity) over
        // reference_image_path (latest output, changes every generation).
        // This prevents IPAdapter outputs from drifting the identity reference.
        const baseIdentityRef = entry.reference_image_for_ipadapter || entry.reference_image_path;
        if (shouldUseIPAdapter && hasReferenceImage && baseIdentityRef) {
          const refFilename = baseIdentityRef.split('/').pop()?.split('\\').pop() || 'reference.png';
          const comfyBase = 'http://127.0.0.1:8188';

          // Step 1: check ComfyUI input/ folder
          let refReadyInInput = false;
          try {
            const inputCheckRes = await fetch(
              `${comfyBase}/view?filename=${encodeURIComponent(refFilename)}&type=input`,
              { method: 'HEAD' }
            );
            if (inputCheckRes.ok) {
              refReadyInInput = true;
              console.log('[IPADAPTER REF INPUT EXISTS]', refFilename);
            }
          } catch {
            // HEAD not supported or network error — proceed to output fallback
          }

          // Step 2: not in input — fetch from output/ and upload to input/
          if (!refReadyInInput) {
            try {
              const outputRes = await fetch(
                `${comfyBase}/view?filename=${encodeURIComponent(refFilename)}&type=output`
              );
              if (!outputRes.ok) {
                throw new Error(`File not found in output/: ${refFilename} (HTTP ${outputRes.status})`);
              }
              console.log('[IPADAPTER REF OUTPUT EXISTS]', refFilename);

              // Step 3: POST to ComfyUI /upload/image -> places file in input/
              const blob = await outputRes.blob();
              const formData = new FormData();
              formData.append('image', blob, refFilename);
              formData.append('overwrite', 'true');

              const uploadRes = await fetch(`${comfyBase}/upload/image`, {
                method: 'POST',
                body: formData,
              });

              if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Upload to input/ failed (HTTP ${uploadRes.status}): ${errText}`);
              }

              console.log('[IPADAPTER REF COPY OK]', refFilename, '-> ComfyUI input/');
              refReadyInInput = true;
            } catch (copyErr) {
              const msg = copyErr instanceof Error ? copyErr.message : String(copyErr);
              console.error('[IPADAPTER REF COPY FAILED]', msg);
              console.error('[IPADAPTER REF] input/ path checked:', `${comfyBase}/view?filename=${refFilename}&type=input`);
              console.error('[IPADAPTER REF] output/ path checked:', `${comfyBase}/view?filename=${refFilename}&type=output`);
              throw new Error(`IPAdapter reference image could not be prepared: ${refFilename}. ${msg}`);
            }
          }

          // Step 4: inject LoadImage node only after confirming input/ has the file
          if (refReadyInInput) {
            workflowInputs['13'] = {
              class_type: 'LoadImage',
              inputs: {
                image: refFilename,
              },
            };
            console.log('[EXECUTOR IPADAPTER] LoadImage node 13 injected with input/ file:', refFilename);
          }
        }

        // ========== FINAL PROMPT DEBUG ==========
        console.log('');
        console.log('========== CONSISTENCY PIPELINE DEBUG ==========');
        console.log('[FINAL POSITIVE PROMPT]', finalPositivePrompt);
        console.log('[FINAL NEGATIVE PROMPT]', finalNegativePrompt);
        console.log('[FINAL STYLE IDS]', JSON.stringify(activeStyleIds));
        console.log('[FINAL WORKFLOW PATH]', resolvedWorkflow);
        console.log('[FINAL CHECKPOINT]', selectedCheckpoint);
        console.log('[FINAL SEED]', debugSeed);
        console.log('============================================');
        console.log('');

        console.log('');
        console.log('========== CALLING COMFYUI EXECUTOR ==========');
        console.log('[MODE]', entry.character_prompt_manual ? 'MANUAL (zero transformations)' : 'AUTO');
        console.log('[PROMPT TO COMFYUI]', finalPositivePrompt);
        console.log('[NEGATIVE TO COMFYUI]', finalNegativePrompt);
        console.log('[COMFYUI POSITIVE PROMPT]', finalPositivePrompt);
        console.log('[COMFYUI NEGATIVE PROMPT]', finalNegativePrompt);
        console.log('[SEED TO COMFYUI]', debugSeed);
        console.log('[WORKFLOW TO COMFYUI]', resolvedWorkflow);
        console.log('[MODEL (from workflow)]', selectedCheckpoint);
        console.log('===============================================');
        console.log('');

        const imageResult = await executor.generateImage(finalPositivePrompt, {
          negativePrompt: finalNegativePrompt,
          seed: debugSeed,
          workflowPath: resolvedWorkflow,
          width: genWidth,
          height: genHeight,
          workflowInputs: Object.keys(workflowInputs).length > 0 ? workflowInputs : undefined,
        });

        // result.url = http://127.0.0.1:8188/view?filename=seri_ai_XXXXX.png&type=output
        const imageUrl = imageResult.url || '';
        console.log('[CHAR IMAGE] raw url:', imageUrl);

        // ========== NORMALIZE REFERENCE PATH ==========
        // Extract plain filename for deterministic LoadImage on next generation.
        // ComfyUI LoadImage requires just "filename.png", not a full URL.
        let normalizedImageFilename = imageUrl;
        if (imageUrl.includes('filename=')) {
          // URL format: http://127.0.0.1:8188/view?filename=seri_ai_pixar_00062_.png&type=output
          normalizedImageFilename = decodeURIComponent(imageUrl.split('filename=')[1]?.split('&')[0] || imageUrl);
        } else if (imageUrl.includes('/') || imageUrl.includes('\\')) {
          // Path format: extract basename
          normalizedImageFilename = imageUrl.split('/').pop()?.split('\\').pop() || imageUrl;
        }
        console.log('[CHAR IMAGE] normalized filename:', normalizedImageFilename);

        // ===== VALIDATED APPEARANCE TRAITS EXTRACTION =====
        // CRITICAL: Never overwrite valid identity with defaults or corrupted data.
        // Three outcomes:
        //   1. Image URL is invalid/corrupted → abort ALL identity updates (image + traits + lock)
        //   2. Extracted traits are null (empty fields) → abort trait update only, save new image
        //   3. Both valid → safe to save everything

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
        // IDENTITY LOCK GUARD: Only lock when BOTH image AND traits are valid.
        // Prevents locking identity with empty traits (which causes drift on regeneration).
        let identityLockedToSave = imageIsValid && traitsAreValid;
        let refImageToSave = normalizedImageFilename; // Use normalized filename, not full URL

        if (!imageIsValid) {
          console.warn('[CONSISTENCY EXTRACTION FAILED] Image URL is invalid/corrupted - identity not updated');
          console.warn('[CONSISTENCY] imageUrl:', imageUrl);
          appearanceTraitsToSave = entry.appearance_traits; // Keep existing
          identityLockedToSave = entry.identityLocked ?? false; // Keep existing
          refImageToSave = entry.reference_image_path || ''; // Keep existing reference image
        } else if (!traitsAreValid) {
          console.warn('[CONSISTENCY EXTRACTION FAILED] Extracted traits are null/empty - identity NOT locked');
          console.warn('[CONSISTENCY] Identity lock blocked: traits extraction returned null. Fill in hair/eyes/outfit to enable identity lock.');
          appearanceTraitsToSave = entry.appearance_traits; // Keep existing traits
          identityLockedToSave = false; // DO NOT lock without valid traits
          // Image IS valid, so save the new image but do not claim identity lock
          console.log('[CONSISTENCY] New image saved but identity NOT locked (missing traits)');
        } else {
          console.log('[CONSISTENCY VALIDATION PASSED] Image + traits valid, identity LOCKED');
          console.log('[IDENTITY LOCKED] Character:', entry.name, '| Seed:', debugSeed, '| Traits:', JSON.stringify(rawAppearanceTraits));
          console.log('[LOCKED IDENTITY SAVED] face:', appearanceTraitsToSave?.facial_structure ?? 'none');
          console.log('[LOCKED IDENTITY SAVED] hair:', appearanceTraitsToSave?.hairstyle ?? 'none');
          console.log('[LOCKED IDENTITY SAVED] outfit:', appearanceTraitsToSave?.outfit ?? 'none');
          console.log('[LOCKED IDENTITY SAVED] eyes:', appearanceTraitsToSave?.eye_color ?? 'none');
        }

        // reference_image_for_ipadapter policy:
        // - Set ONLY if missing (first generation builds the base identity reference).
        // - NOT overwritten by IPAdapter outputs on subsequent generations.
        // - Only an explicit user action (Lock This Image) should update it.
        const baseRefToSave = entry.reference_image_for_ipadapter || refImageToSave;
        console.log('[IPADAPTER BASE REF] Using:', baseRefToSave, '| Latest output:', refImageToSave);

        // Update the entry with all generation metadata
        const updatedEntry: CharacterBibleEntry = {
          ...entry,
          identityLocked: identityLockedToSave,
          reference_image_path: refImageToSave,    // Latest output — display / preview
          reference_image_for_ipadapter: baseRefToSave, // Stable base identity — LoadImage node 13
          seed: debugSeed,
          workflow_path: resolvedWorkflow,
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

/**
 * Generate reference images for a batch of characters.
 * Processes sequentially to avoid ComfyUI queue contention.
 *
 * @param characters - Array of CharacterBibleEntry to generate images for
 * @param onProgress - Optional progress callback
 * @returns Array of generation results
 */
export async function generateCharacterImagesBatch(
  characters: CharacterBibleEntry[],
  onProgress?: CharacterProgressCallback
): Promise<CharacterGenerationResult[]> {
  if (characters.length === 0) {
    onProgress?.(DONE_PROGRESS);
    return [];
  }

  const results: CharacterGenerationResult[] = [];

  for (let i = 0; i < characters.length; i++) {
    const entry = characters[i];

    onProgress?.(
      makeProgress({
        phase: 'Generating character images',
        currentItem: i + 1,
        totalItems: characters.length,
        label: `Character ${i + 1}/${characters.length}: ${entry.name}`,
        estimatedRemaining: `~${(characters.length - i - 1) * 15}s remaining`,
      })
    );

    const result = await generateCharacterImage(entry, onProgress);
    results.push(result);
  }

  onProgress?.(DONE_PROGRESS);
  return results;
}