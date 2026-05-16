/**
 * Generation Workflow Architecture
 *
 * Pipeline: Extract → Character Images → Location Images → Scene Images
 *
 * Architecture rules:
 * - Character generation ONLY from Character Library entries (CharacterBibleEntry)
 * - Location generation ONLY from Location Library entries (LocationBibleEntry)
 * - Scene generation references locked character/location images
 * - Scenes NEVER regenerate character identity
 * - Stable identity pipeline is mandatory
 * - Progress tracking: percentage, current/total, estimated remaining, disabled-while-generating
 * - Queue-safe generation state via globalProgressTracker
 * - No duplicate loading systems
 */

export { generateFullWorkflow, generateCharacterImage, generateCharacterImagesBatch } from './CharacterImageGenerator';
export { generateLocationImage, generateLocationImagesBatch } from './LocationImageGenerator';
export { generateSceneImage, generateAllSceneImages } from './SceneGenerator';
export {
  globalProgressTracker,
  ProgressTracker,
  makeGenerationKey,
  makeProgress,
  makeError,
  DONE_PROGRESS,
  IDLE_PROGRESS,
} from './GenerationProgressTracker';

export type {
  CharacterGenerationResult,
  CharacterProgressCallback,
} from './CharacterImageGenerator';

export type {
  LocationGenerationResult,
  LocationProgressCallback,
} from './LocationImageGenerator';

export type {
  SceneGenerationResult,
  SceneProgressCallback,
  SceneGenerationInput,
} from './SceneGenerator';

export type {
  ProgressState,
} from './GenerationProgressTracker';

export type {
  WorkflowPhase,
  WorkflowState,
  WorkflowProgressCallback,
  WorkflowResult,
} from './GenerationWorkflowService';
