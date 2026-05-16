/**
 * LocationImageGenerator
 *
 * Generates location reference images ONLY from Location Library entries
 * (LocationBibleEntry). Uses the locked identity pipeline:
 * LocationBibleEntry.location_prompt → ComfyUI → LocationBibleEntry.reference_image_path
 *
 * Architecture rules:
 * - Location generation happens ONLY from Location Library entries
 * - Stable identity pipeline is mandatory
 * - Location images are locked references for scene generation
 */

import type { LocationBibleEntry } from '../../types';
import type { ProgressState } from './GenerationProgressTracker';
import { makeProgress, makeError, DONE_PROGRESS, globalProgressTracker, makeGenerationKey } from './GenerationProgressTracker';
import { ComfyUIProvider } from '../../infrastructure/ai/providers/ComfyUIProvider';

export interface LocationGenerationResult {
  entry: LocationBibleEntry;
  /** The path to the generated reference image */
  referenceImagePath: string | null;
  success: boolean;
  error?: string;
}

export type LocationProgressCallback = (progress: ProgressState) => void;

/**
 * Build a location portrait prompt from a LocationBibleEntry.
 * This generates a clean reference image for the location.
 */
function buildLocationPortraitPrompt(entry: LocationBibleEntry): string {
  const parts: string[] = [
    entry.visual_description,
    entry.layout_description,
    entry.lighting ? `lighting: ${entry.lighting}` : '',
    entry.fixed_objects ? `objects: ${entry.fixed_objects}` : '',
    entry.mood ? `mood: ${entry.mood}` : '',
    entry.color_palette ? `color palette: ${entry.color_palette}` : '',
    entry.location_prompt,
    // Location reference constraints
    'wide establishing shot, clear view of the entire location',
    'clean reference image, well lit, detailed environment',
    'empty location, no characters present',
    'high quality, detailed, sharp focus',
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Build a negative prompt for location image generation.
 */
function buildLocationPortraitNegative(entry: LocationBibleEntry): string {
  const negs = [
    entry.negative_prompt,
    'people, characters, animals, living beings',
    'cluttered, messy, chaotic',
    'blurry, low quality, deformed, distorted',
    'nsfw, explicit content',
  ].filter(Boolean);
  return negs.join(', ');
}

/**
 * Generate a single location reference image from a LocationBibleEntry.
 *
 * @param entry - The LocationBibleEntry to generate an image for
 * @param onProgress - Optional progress callback
 * @returns The updated entry with reference_image_path set
 */
export async function generateLocationImage(
  entry: LocationBibleEntry,
  onProgress?: LocationProgressCallback
): Promise<LocationGenerationResult> {
  const genKey = makeGenerationKey('location-image', entry.id);

  if (!globalProgressTracker.tryClaim(genKey)) {
    return {
      entry,
      referenceImagePath: null,
      success: false,
      error: `Location "${entry.name}" image generation is already in progress.`,
    };
  }

  try {
    onProgress?.(
      makeProgress({
        phase: 'Generating location image',
        currentItem: 1,
        totalItems: 1,
        label: `Generating location: ${entry.name}`,
      })
    );

    // Build the portrait prompt from the Bible entry
    const positivePrompt = entry.location_prompt || buildLocationPortraitPrompt(entry);
    const negativePrompt = buildLocationPortraitNegative(entry);

    // Create a direct ComfyUI provider connection (bypasses orchestrator to get actual URL)
    const provider = new ComfyUIProvider({
      baseUrl: 'http://127.0.0.1:8188',
      clientId: `seri-ai-loc-${Date.now()}`,
      defaultImageWidth: 1024,
      defaultImageHeight: 768,
      connectionTimeout: 10000,
    });

    // Call provider.generateImage directly — returns real ComfyUI view URL
    const imageResult = await provider.generateImage(positivePrompt, {
      negativePrompt,
      seed: entry.seed ?? undefined,
    });

    // result.url = http://127.0.0.1:8188/view?filename=seri_ai_XXXXX.png&type=output
    const imageUrl = imageResult.url || '';
    console.log('[LOC IMAGE] filename:', imageUrl.split('filename=')[1]?.split('&')[0] || 'unknown');
    console.log('[LOC IMAGE] url:', imageUrl);
    console.log('[LOC IMAGE] saved path:', imageUrl);

    // Update the entry with the reference image URL
    const updatedEntry: LocationBibleEntry = {
      ...entry,
      reference_image_path: imageUrl,
      updated_at: new Date().toISOString(),
    };

    onProgress?.(DONE_PROGRESS);

    return {
      entry: updatedEntry,
      referenceImagePath: imageUrl,
      success: true,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error generating location image';
    console.error('[LOCATION IMAGE GEN] Failed:', errMsg);
    onProgress?.(makeError('location-image', errMsg));

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
 * Generate location images for MULTIPLE LocationBibleEntry items.
 *
 * @param entries - Array of LocationBibleEntry items to generate images for
 * @param onProgress - Progress callback (called after each location)
 * @returns Array of generation results
 */
export async function generateLocationImagesBatch(
  entries: LocationBibleEntry[],
  onProgress?: LocationProgressCallback
): Promise<LocationGenerationResult[]> {
  if (entries.length === 0) {
    onProgress?.(DONE_PROGRESS);
    return [];
  }

  const results: LocationGenerationResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    onProgress?.(
      makeProgress({
        phase: 'Generating location images',
        currentItem: i + 1,
        totalItems: entries.length,
        label: `Generating ${entry.name} (${i + 1}/${entries.length})`,
        estimatedRemaining: `~${(entries.length - i - 1) * 10}s remaining`,
      })
    );

    const result = await generateLocationImage(entry, onProgress);
    results.push(result);
  }

  onProgress?.(DONE_PROGRESS);
  return results;
}
