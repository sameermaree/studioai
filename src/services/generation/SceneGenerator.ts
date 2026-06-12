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
import { ComfyUIExecutor } from '../../infrastructure/ai/providers/ComfyUIExecutor';

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

    // Patch 1: filter characters to scene-relevant only, hard cap at 2.
    // Injecting all episode characters (e.g. 13) causes prompt overflow and unstable images.
    // Priority: characters whose IDs are in scene.characters[] first.
    // Fallback: first 2 of all characters if scene.characters is empty.
    const sceneCharacterIds: string[] = input.scene.characters ?? [];
    const sceneRelevantChars = sceneCharacterIds.length > 0
      ? input.characters.filter((c) => sceneCharacterIds.includes(c.id))
      : [];
    const charsForPrompt = (sceneRelevantChars.length > 0
      ? sceneRelevantChars
      : input.characters
    ).slice(0, 2);

    console.log(`[SCENE GEN] characters: ${input.characters.length} total → ${charsForPrompt.length} injected (scene IDs: ${sceneCharacterIds.length})`);
    for (const ch of charsForPrompt) {
      console.log(`[SCENE GEN] [CHARACTER LOCK] "${ch.name}": outfit="${ch.outfit}", identityLocked=${ch.identityLocked}, ref_img=${ch.reference_image_path ? 'yes' : 'no'}`);
    }

    // Build the scene prompt with locked references (identity-preserving)
    const { prompt, negativePrompt, referenceImages } = buildScenePromptWithReferences(
      input.scene,
      charsForPrompt,
      input.locations
    );

    // Get locked character/location reference paths
    const characterReferences: string[] = charsForPrompt
      .map((c) => c.reference_image_path)
      .filter((p): p is string => p !== null);

    const locationReferences: string[] = input.locations
      .map((l) => l.reference_image_path)
      .filter((p): p is string => p !== null);

    console.log('[SCENE GEN] prompt built:', prompt.slice(0, 120) + (prompt.length > 120 ? '...' : ''));
    console.log('[SCENE GEN] negative:', negativePrompt.slice(0, 80) + (negativePrompt.length > 80 ? '...' : ''));

    // Phase 1: use pixar_disney_stable.json — text-prompt identity injection only.
    // Scene IPAdapter / dedicated scene workflow added in a future phase.
    const SCENE_WORKFLOW = 'workflows/pixar_disney_stable.json';
    console.log('[SCENE GEN] workflow selected:', SCENE_WORKFLOW);

    const executor = new ComfyUIExecutor({
      baseUrl: 'http://127.0.0.1:8188',
      clientId: `seri-ai-scene-${input.scene.id.slice(0, 8)}-${Date.now()}`,
      connectionTimeout: 30_000,
    });

    const imageResult = await executor.generateImage(prompt, {
      negativePrompt,
      seed: input.scene.seed ?? undefined,
      workflowPath: SCENE_WORKFLOW,
    });

    console.log('[SCENE GEN] ComfyUI result:', imageResult.url ? 'OK' : 'EMPTY', '| url:', imageResult.url?.slice(0, 80));

    // Normalize the returned URL to a plain filename for storage
    const rawUrl = imageResult.url || '';
    let imagePath: string | null = null;
    if (rawUrl) {
      if (rawUrl.includes('filename=')) {
        imagePath = decodeURIComponent(rawUrl.split('filename=')[1]?.split('&')[0] || rawUrl);
      } else {
        imagePath = rawUrl.split('/').pop() || rawUrl;
      }
    }

    console.log('[SCENE GEN] saved image path:', imagePath);

    if (!imagePath) {
      throw new Error('ComfyUI returned empty image URL for scene: ' + input.scene.title);
    }

    // Update the scene with the real generated image reference
    const updatedScene: Scene = {
      ...input.scene,
      render_url: imagePath,
      render_status: 'completed',
      image_references: [...referenceImages, imagePath],
      updated_at: new Date().toISOString(),
    };

    onProgress?.(DONE_PROGRESS);

    return {
      scene: updatedScene,
      imagePath,
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