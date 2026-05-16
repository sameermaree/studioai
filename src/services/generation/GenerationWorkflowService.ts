/**
 * GenerationWorkflowService
 *
 * Top-level orchestrator for the generation workflow pipeline.
 * Sequences: Extract → Character Images → Location Images → Scene Images
 *
 * Pipeline:
 * 1. Character extraction (LLM → CharacterBibleEntry[])
 * 2. Location extraction (LLM → LocationBibleEntry[])
 * 3. Character image generation (CharacterBibleEntry → reference_image_path)
 * 4. Location image generation (LocationBibleEntry → reference_image_path)
 * 5. Scene generation (locked refs → scene images)
 *
 * Critical architecture rules enforced:
 * - Character generation ONLY from Character Library entries
 * - Location generation ONLY from Location Library entries
 * - Scene generation references locked character/location images
 * - Scenes NEVER regenerate character identity
 * - Stable identity pipeline is mandatory
 */

import type { Episode, CharacterBibleEntry, LocationBibleEntry, Scene } from '../../types';
import { extractCharactersFromStory } from '../../features/story-bible/characterExtractor';
import { extractLocationsFromStory } from '../../features/story-bible/locationExtractor';
import { generateCharacterImagesBatch } from './CharacterImageGenerator';
import { generateLocationImagesBatch } from './LocationImageGenerator';
import { generateAllSceneImages } from './SceneGenerator';
import type { ProgressState } from './GenerationProgressTracker';
import {
  makeProgress,
  makeError,
  DONE_PROGRESS,
  globalProgressTracker,
  makeGenerationKey,
} from './GenerationProgressTracker';

export type WorkflowPhase =
  | 'idle'
  | 'extracting-characters'
  | 'extracting-locations'
  | 'generating-character-images'
  | 'generating-location-images'
  | 'generating-scenes'
  | 'complete'
  | 'failed';

export interface WorkflowState {
  phase: WorkflowPhase;
  progress: ProgressState;
}

export type WorkflowProgressCallback = (state: WorkflowState) => void;

export interface WorkflowResult {
  success: boolean;
  episode: Episode;
  characterImagesGenerated: number;
  locationImagesGenerated: number;
  sceneImagesGenerated: number;
  error?: string;
}

/**
 * Run the full generation workflow for an episode.
 *
 * Steps:
 *  1. Extract characters from story → populate episode.story_characters
 *  2. Extract locations from story → populate episode.story_locations
 *  3. Generate character reference images from CharacterBibleEntries
 *  4. Generate location reference images from LocationBibleEntries
 *  5. Generate scene images using locked character/location references
 *
 * @param episode - The episode to generate for (must have story and scenes)
 * @param onProgress - Progress callback for UI updates
 * @returns Workflow result summary
 */
export async function generateFullWorkflow(
  episode: Episode,
  onProgress?: WorkflowProgressCallback
): Promise<WorkflowResult> {
  const workflowKey = makeGenerationKey('full-workflow', episode.id);

  if (!globalProgressTracker.tryClaim(workflowKey)) {
    return {
      success: false,
      episode,
      characterImagesGenerated: 0,
      locationImagesGenerated: 0,
      sceneImagesGenerated: 0,
      error: `Workflow for episode "${episode.title}" is already running.`,
    };
  }

  try {
    const storyText = episode.workflow_config?.story || episode.description || '';
    let currentCharacters: CharacterBibleEntry[] = [...(episode.story_characters || [])];
    let currentLocations: LocationBibleEntry[] = [...(episode.story_locations || [])];
    let currentScenes: Scene[] = [...(episode.scenes || [])];

    // =========================================================
    // STEP 1: Extract characters from story (if not already done)
    // =========================================================
    if (currentCharacters.length === 0 && storyText) {
      emitProgress(onProgress, 'extracting-characters', 0, 5, 'Extracting characters from story...');

      const { characters, error: charExtractError } = await extractCharactersFromStory(
        storyText,
        episode.workflow_config?.target_audience_age || '8-12'
      );

      if (charExtractError) {
        console.warn('[WORKFLOW] Character extraction warning:', charExtractError);
      }

      if (characters.length > 0) {
        currentCharacters = characters;
      }
    }

    emitProgress(onProgress, 'extracting-characters', 1, 5, `Extracted ${currentCharacters.length} characters`);

    // =========================================================
    // STEP 2: Extract locations from story (if not already done)
    // =========================================================
    if (currentLocations.length === 0 && storyText) {
      emitProgress(onProgress, 'extracting-locations', 1, 5, 'Extracting locations from story...');

      const { locations, error: locExtractError } = await extractLocationsFromStory(storyText);

      if (locExtractError) {
        console.warn('[WORKFLOW] Location extraction warning:', locExtractError);
      }

      if (locations.length > 0) {
        currentLocations = locations;
      }
    }

    emitProgress(onProgress, 'extracting-locations', 2, 5, `Extracted ${currentLocations.length} locations`);

    // =========================================================
    // STEP 3: Generate character reference images
    // (ONLY from Character Library entries)
    // =========================================================
    if (currentCharacters.length > 0) {
      const charResults = await generateCharacterImagesBatch(currentCharacters, (charProgress) => {
        emitProgressFromState(onProgress, 'generating-character-images', charProgress, 3, 5);
      });

      // Update characters with generated reference paths
      currentCharacters = charResults.map((r) => r.entry);
    }

    emitProgress(onProgress, 'generating-character-images', 3, 5, `Generated ${currentCharacters.length} character images`);

    // =========================================================
    // STEP 4: Generate location reference images
    // (ONLY from Location Library entries)
    // =========================================================
    if (currentLocations.length > 0) {
      const locResults = await generateLocationImagesBatch(currentLocations, (locProgress) => {
        emitProgressFromState(onProgress, 'generating-location-images', locProgress, 4, 5);
      });

      // Update locations with generated reference paths
      currentLocations = locResults.map((r) => r.entry);
    }

    emitProgress(onProgress, 'generating-location-images', 4, 5, `Generated ${currentLocations.length} location images`);

    // =========================================================
    // STEP 5: Generate scene images
    // Uses locked character/location images — NEVER regenerates identity
    // =========================================================
    if (currentScenes.length > 0 && currentCharacters.length > 0) {
      const sceneResults = await generateAllSceneImages(
        currentScenes,
        currentCharacters,
        currentLocations,
        (sceneProgress) => {
          emitProgressFromState(onProgress, 'generating-scenes', sceneProgress, 5, 5);
        }
      );

      currentScenes = sceneResults.map((r) => r.scene);
    }

    emitProgress(onProgress, 'generating-scenes', 5, 5, `Generated ${currentScenes.length} scene images`);

    // Build updated episode
    const updatedEpisode: Episode = {
      ...episode,
      story_characters: currentCharacters,
      story_locations: currentLocations,
      scenes: currentScenes,
      updated_at: new Date().toISOString(),
    };

    onProgress?.({
      phase: 'complete',
      progress: DONE_PROGRESS,
    });

    return {
      success: true,
      episode: updatedEpisode,
      characterImagesGenerated: currentCharacters.filter((c) => c.reference_image_path !== null).length,
      locationImagesGenerated: currentLocations.filter((l) => l.reference_image_path !== null).length,
      sceneImagesGenerated: currentScenes.filter((s) => s.image_references.length > 0).length,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown workflow error';
    console.error('[WORKFLOW] Failed:', errMsg);

    onProgress?.({
      phase: 'failed',
      progress: makeError('workflow', errMsg),
    });

    return {
      success: false,
      episode,
      characterImagesGenerated: 0,
      locationImagesGenerated: 0,
      sceneImagesGenerated: 0,
      error: errMsg,
    };
  } finally {
    globalProgressTracker.release(workflowKey);
  }
}

/**
 * Run individual workflow steps independently.
 * Useful for step-by-step UI workflows.
 */

/** Step 1: Extract characters */
export async function stepExtractCharacters(
  episode: Episode
): Promise<{ characters: CharacterBibleEntry[]; episode: Episode; error?: string }> {
  const storyText = episode.workflow_config?.story || episode.description || '';
  const { characters, error } = await extractCharactersFromStory(
    storyText,
    episode.workflow_config?.target_audience_age || '8-12'
  );

  return {
    characters,
    episode: {
      ...episode,
      story_characters: characters,
      updated_at: new Date().toISOString(),
    },
    error,
  };
}

/** Step 2: Extract locations */
export async function stepExtractLocations(
  episode: Episode
): Promise<{ locations: LocationBibleEntry[]; episode: Episode; error?: string }> {
  const storyText = episode.workflow_config?.story || episode.description || '';
  const { locations, error } = await extractLocationsFromStory(storyText);

  return {
    locations,
    episode: {
      ...episode,
      story_locations: locations,
      updated_at: new Date().toISOString(),
    },
    error,
  };
}

/** Step 3: Generate character images (ONLY from Character Library entries) */
export async function stepGenerateCharacterImages(
  characters: CharacterBibleEntry[],
  onProgress?: (progress: ProgressState) => void
): Promise<{ characters: CharacterBibleEntry[]; generated: number }> {
  const results = await generateCharacterImagesBatch(characters, onProgress);
  return {
    characters: results.map((r) => r.entry),
    generated: results.filter((r) => r.success).length,
  };
}

/** Step 4: Generate location images (ONLY from Location Library entries) */
export async function stepGenerateLocationImages(
  locations: LocationBibleEntry[],
  onProgress?: (progress: ProgressState) => void
): Promise<{ locations: LocationBibleEntry[]; generated: number }> {
  const results = await generateLocationImagesBatch(locations, onProgress);
  return {
    locations: results.map((r) => r.entry),
    generated: results.filter((r) => r.success).length,
  };
}

/** Step 5: Generate scene images (locked references only) */
export async function stepGenerateSceneImages(
  scenes: Scene[],
  characters: CharacterBibleEntry[],
  locations: LocationBibleEntry[],
  onProgress?: (progress: ProgressState) => void
): Promise<{ scenes: Scene[]; generated: number }> {
  const results = await generateAllSceneImages(scenes, characters, locations, onProgress);
  return {
    scenes: results.map((r) => r.scene),
    generated: results.filter((r) => r.success).length,
  };
}

// =========================================================
// Helpers
// =========================================================

function emitProgress(
  cb: WorkflowProgressCallback | undefined,
  phase: WorkflowPhase,
  stepIndex: number,
  totalSteps: number,
  label: string
): void {
  cb?.({
    phase,
    progress: makeProgress({
      phase,
      currentItem: stepIndex,
      totalItems: totalSteps,
      label,
    }),
  });
}

function emitProgressFromState(
  cb: WorkflowProgressCallback | undefined,
  phase: WorkflowPhase,
  subProgress: ProgressState,
  stepIndex: number,
  totalSteps: number
): void {
  // Don't emit sub-progress zeros/idle — let the phase handler manage it
  if (subProgress.isDone || subProgress.error) {
    cb?.({
      phase,
      progress: subProgress,
    });
    return;
  }

  cb?.({
    phase,
    progress: subProgress,
  });
}
