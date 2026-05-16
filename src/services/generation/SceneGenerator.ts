/**
 * SceneGenerator
 *
 * Generates scene images using locked character/location reference images.
 * Scenes MUST reference already-generated character and location images.
 * Scenes NEVER regenerate character identity.
 *
 * Identity pipeline (locked, read-only during scene gen):
 * - Characters: CharacterBibleEntry.reference_image_path (must exist)
 * - Locations: LocationBibleEntry.reference_image_path (must exist)
 * - Scene: uses reference images + scene prompt → generates scene image
 *
 * Critical rule: Scene generation must reference locked character/location images.
 */

import type { Scene, CharacterBibleEntry, LocationBibleEntry } from '../../types';
import { injectBibleCharactersIntoScene } from '../character/CharacterPromptBuilder';
import type { ProgressState } from './GenerationProgressTracker';
import { makeProgress, makeError, DONE_PROGRESS, globalProgressTracker, makeGenerationKey } from './GenerationProgressTracker';

export interface SceneGenerationResult {
  scene: Scene;
  /** The generated scene image path */
  imagePath: string | null;
  success: boolean;
  error?: string;
  /** Character reference images used (locked, never regenerated) */
  characterReferences: string[];
  /** Location reference images used (locked, never regenerated) */
  locationReferences: string[];
}

export type SceneProgressCallback = (progress: ProgressState) => void;

export interface SceneGenerationInput {
  scene: Scene;
  /** Locked character entries — MUST have reference_image_path set */
  characters: CharacterBibleEntry[];
  /** Locked location entries — MUST have reference_image_path set */
  locations: LocationBibleEntry[];
}

/**
 * Validate that character images are locked and available.
 * Scenes must NEVER regenerate character identity.
 */
function validateCharacterIdentityLock(characters: CharacterBibleEntry[]): string[] {
  const errors: string[] = [];
  for (const ch of characters) {
    if (!ch.reference_image_path) {
      errors.push(`Character "${ch.name}" has no reference image. Generate character image first.`);
    }
  }
  return errors;
}

/**
 * Validate that location images are locked and available.
 */
function validateLocationIdentityLock(locations: LocationBibleEntry[]): string[] {
  const errors: string[] = [];
  for (const loc of locations) {
    if (!loc.reference_image_path) {
      errors.push(`Location "${loc.name}" has no reference image. Generate location image first.`);
    }
  }
  return errors;
}

/**
 * Build a scene prompt that references locked character/location images.
 * This NEVER changes character identity — only composes the scene.
 */
function buildScenePromptWithReferences(
  scene: Scene,
  characters: CharacterBibleEntry[],
  locations: LocationBibleEntry[]
): { prompt: string; negativePrompt: string; referenceImages: string[] } {
  // Get character reference images (locked, read-only)
  const characterRefs: string[] = characters
    .map((c) => c.reference_image_path)
    .filter((p): p is string => p !== null);

  // Get location reference images (locked, read-only)
  const locationRefs: string[] = locations
    .map((l) => l.reference_image_path)
    .filter((p): p is string => p !== null);

  // Inject character identity into scene prompt (identity-preserving)
  const { prompt: charAugmentedPrompt, negative: charNegative, referenceImages: charRefImages, characters: characterIdentityPayload } =
    injectBibleCharactersIntoScene(scene.prompt_text, characters);

  // Log the character identity payload being sent to scene generation
  if (characterIdentityPayload && characterIdentityPayload.length > 0) {
    console.log('[SCENE GEN] Character identity payload:', JSON.stringify(characterIdentityPayload.map(c => ({
      id: c.id,
      hasRefImage: !!c.reference_image_path,
      hasIPAdapterRef: !!c.reference_image_for_ipadapter,
      identityLocked: c.identityLocked,
      traits: c.appearance_traits,
    })), null, 2));
  }

  // Add location context to the prompt
  const locationParts = locations.map((loc) => {
    const parts = [loc.visual_description, loc.lighting, loc.mood].filter(Boolean);
    return parts.join(', ');
  });
  const locationContext = locationParts.length > 0 ? `Setting: ${locationParts.join('; ')}` : '';

  // Compose the final scene prompt
  const finalPrompt = [charAugmentedPrompt, locationContext].filter(Boolean).join('. ');

  // Combine all reference images (character + location)
  const allReferenceImages = [...new Set([...charRefImages, ...characterRefs, ...locationRefs])];

  return {
    prompt: finalPrompt,
    negativePrompt: charNegative || scene.negative_prompt,
    referenceImages: allReferenceImages,
  };
}

/**
 * Generate a single scene image.
 * Uses locked character/location reference images — NEVER regenerates character identity.
 *
 * @param input - Scene generation input with locked references
 * @param onProgress - Optional progress callback
 * @returns Generation result with scene image path
 */
export async function generateSceneImage(
  input: SceneGenerationInput,
  onProgress?: SceneProgressCallback
): Promise<SceneGenerationResult> {
  const genKey = makeGenerationKey('scene-image', input.scene.id);

  if (!globalProgressTracker.tryClaim(genKey)) {
    return {
      scene: input.scene,
      imagePath: null,
      success: false,
      error: `Scene "${input.scene.title}" generation is already in progress.`,
      characterReferences: [],
      locationReferences: [],
    };
  }

  try {
    onProgress?.(
      makeProgress({
        phase: 'Generating scene image',
        currentItem: 1,
        totalItems: 1,
        label: `Generating scene: ${input.scene.title}`,
      })
    );

    // Validate identity lock BEFORE generation
    const charErrors = validateCharacterIdentityLock(input.characters);
    const locErrors = validateLocationIdentityLock(input.locations);
    const allErrors = [...charErrors, ...locErrors];

    if (allErrors.length > 0) {
      const errorMsg = allErrors.join(' ');
      onProgress?.(makeError('scene-image', errorMsg));
      return {
        scene: input.scene,
        imagePath: null,
        success: false,
        error: errorMsg,
        characterReferences: [],
        locationReferences: [],
      };
    }

    // Build the scene prompt with locked references (identity-preserving)
    const { prompt, negativePrompt, referenceImages } = buildScenePromptWithReferences(
      input.scene,
      input.characters,
      input.locations
    );

    // Get locked character/location reference paths
    const characterReferences: string[] = input.characters
      .map((c) => c.reference_image_path)
      .filter((p): p is string => p !== null);

    const locationReferences: string[] = input.locations
      .map((l) => l.reference_image_path)
      .filter((p): p is string => p !== null);

    // ISSUE 2: Log text-only consistency mode for visibility
    if (characterReferences.length > 0) {
      console.log('[TEXT ONLY CONSISTENCY MODE] Character reference images exist but NOT passed to ComfyUI conditioning.');
      console.log('[TEXT ONLY CONSISTENCY MODE] Character identity preserved via TEXT prompt injection.');
      for (const ch of input.characters) {
        console.log(`[CHARACTER LOCK] "${ch.name}": seed=${ch.seed}, outfit="${ch.outfit}", hair="${ch.hair}", eyes="${ch.eyes}", age=${ch.age}, ref_img=${ch.reference_image_path ? 'yes' : 'no'}`);
      }
    }
    if (locationReferences.length > 0) {
      console.log('[LOCATION LOCK] Text-only consistency mode for locations.');
    }

    // TODO: Replace with actual ComfyUIService call when available
    // Uses referenceImages as controlnet/ip-adapter inputs for identity preservation
    // const comfyUI = ComfyUIService.getInstance();
    // const result = await comfyUI.generateImage(prompt, {
    //   negativePrompt,
    //   seed: input.scene.seed ?? undefined,
    //   referenceImages, // IP-Adapter / ControlNet inputs for identity lock
    //   assetDisplayName: `scene-${input.scene.order}`,
    //   assetCategory: 'scene',
    //   relatedEntityId: input.scene.id,
    //   relatedEntityType: 'scene',
    // });

    // Simulated generation for now — placeholder until ComfyUI integration
    const simulatedImagePath = `data/projects/default-project/assets/scenes/scene_${input.scene.order}_${input.scene.id.slice(0, 8)}.png`;

    // Update the scene with the generated image reference
    const updatedScene: Scene = {
      ...input.scene,
      image_references: [...referenceImages, simulatedImagePath],
      updated_at: new Date().toISOString(),
    };

    onProgress?.(DONE_PROGRESS);

    return {
      scene: updatedScene,
      imagePath: simulatedImagePath,
      success: true,
      characterReferences,
      locationReferences,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error generating scene image';
    console.error('[SCENE GEN] Failed:', errMsg);
    onProgress?.(makeError('scene-image', errMsg));

    return {
      scene: input.scene,
      imagePath: null,
      success: false,
      error: errMsg,
      characterReferences: [],
      locationReferences: [],
    };
  } finally {
    globalProgressTracker.release(genKey);
  }
}

/**
 * Generate scene images for ALL scenes in an episode.
 * All characters and locations MUST have reference images already generated.
 *
 * @param scenes - All scenes to generate
 * @param characters - Locked character entries (must have reference_image_path)
 * @param locations - Locked location entries (must have reference_image_path)
 * @param onProgress - Progress callback (called after each scene)
 * @returns Array of scene generation results
 */
export async function generateAllSceneImages(
  scenes: Scene[],
  characters: CharacterBibleEntry[],
  locations: LocationBibleEntry[],
  onProgress?: SceneProgressCallback
): Promise<SceneGenerationResult[]> {
  if (scenes.length === 0) {
    onProgress?.(DONE_PROGRESS);
    return [];
  }

  // Validate all character identities are locked before starting batch
  const charErrors = validateCharacterIdentityLock(characters);
  const locErrors = validateLocationIdentityLock(locations);
  const allErrors = [...charErrors, ...locErrors];

  if (allErrors.length > 0) {
    const errorMsg = allErrors.join(' ');
    onProgress?.(makeError('scene-batch', errorMsg));
    return scenes.map((scene) => ({
      scene,
      imagePath: null,
      success: false,
      error: errorMsg,
      characterReferences: [],
      locationReferences: [],
    }));
  }

  const results: SceneGenerationResult[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    onProgress?.(
      makeProgress({
        phase: 'Generating scene images',
        currentItem: i + 1,
        totalItems: scenes.length,
        label: `Scene ${scene.order}: ${scene.title} (${i + 1}/${scenes.length})`,
        estimatedRemaining: `~${(scenes.length - i - 1) * 15}s remaining`,
      })
    );

    const result = await generateSceneImage(
      {
        scene,
        characters,
        locations,
      },
      onProgress
    );

    results.push(result);
  }

  onProgress?.(DONE_PROGRESS);
  return results;
}
