/**
 * Types of video generation jobs
 */
export type VideoGenerationJobType = 
  | 'image-to-video'   // Convert static image to video with motion
  | 'scene-generation' // Generate a complete scene from prompts
  | 'shot-generation'  // Generate a specific shot
  | 'character-animation' // Animate a character
  | 'transition'      // Generate a transition between clips
  | 'lipsync'         // Apply lip sync to a video
  | 'upscale'         // Improve video quality
  | 'style-transfer'; // Apply a visual style to video

/**
 * Status of a video generation job
 */
export type VideoGenerationStatus = 
  | 'pending'    // Job created but not started
  | 'queued'     // Job is in the queue
  | 'processing' // Job is being processed
  | 'succeeded'  // Job completed successfully
  | 'failed'     // Job failed
  | 'cancelled'; // Job was cancelled

/**
 * Parameters for image-to-video generation
 */
export interface ImageToVideoParams {
  imageUrl: string;
  duration: number;
  fps: number;
  motionType?: 'zoom' | 'pan' | 'ken-burns' | 'none';
  motionParams?: {
    zoomDirection?: 'in' | 'out';
    zoomAmount?: number;
    panDirection?: 'left' | 'right' | 'up' | 'down';
    panSpeed?: number;
  };
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * Parameters for scene generation
 */
export interface SceneGenerationParams {
  sceneId: string;
  description: string;
  characters?: Array<{
    characterId: string;
    name: string;
    description: string;
    referenceImageUrl?: string;
  }>;
  location?: string;
  style?: string;
  duration: number;
  resolution: string; // e.g., "1920x1080"
  shotsCount?: number;
  storyboard?: Array<{
    shotType: string;
    description: string;
    duration: number;
  }>;
}

/**
 * Parameters for shot generation
 */
export interface ShotGenerationParams {
  shotType: 'closeup' | 'medium' | 'wide' | 'establishing' | 'pov';
  description: string;
  characters?: string[];
  location?: string;
  style?: string;
  duration: number;
  cameraMovement?: 'static' | 'pan' | 'tilt' | 'zoom' | 'track' | 'dolly';
}

/**
 * Parameters for character animation
 */
export interface CharacterAnimationParams {
  characterId: string;
  imageUrl: string;
  action: string;
  duration: number;
  background?: string;
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * Parameters for transition generation
 */
export interface TransitionGenerationParams {
  fromShotUrl: string;
  toShotUrl: string;
  transitionType: 'crossfade' | 'fade' | 'wipe' | 'zoom' | 'push' | 'slide';
  duration: number;
}

/**
 * Parameters for lip sync
 */
export interface LipSyncParams {
  videoUrl: string;
  audioUrl: string;
  characterFaceArea?: [number, number, number, number]; // [x, y, width, height]
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * Union of all possible job parameters
 */
export type VideoGenerationParams =
  | ImageToVideoParams
  | SceneGenerationParams
  | ShotGenerationParams
  | CharacterAnimationParams
  | TransitionGenerationParams
  | LipSyncParams;

/**
 * Video Generation Job
 */
export interface VideoGenerationJob {
  id: string;
  type: VideoGenerationJobType;
  status: VideoGenerationStatus;
  params: VideoGenerationParams;
  created: string;
  started?: string;
  completed?: string;
  progress: number;
  outputUrl?: string;
  outputThumbnailUrl?: string;
  outputMetadata?: {
    duration: number;
    fps: number;
    width: number;
    height: number;
    format: string;
    bitrate?: number;
    frameCount?: number;
  };
  error?: string;
  assetId?: string;
  sceneId?: string;
  shotId?: string;
  workflowId?: string;
  priority: number;
  userId?: string;
}

/**
 * Create an image-to-video generation job
 */
export function createImageToVideoJob(
  params: ImageToVideoParams,
  options?: { 
    priority?: number;
    userId?: string;
    sceneId?: string;
  }
): VideoGenerationJob {
  return {
    id: crypto.randomUUID(),
    type: 'image-to-video',
    status: 'pending',
    params,
    created: new Date().toISOString(),
    progress: 0,
    priority: options?.priority || 5,
    userId: options?.userId,
    sceneId: options?.sceneId
  };
}

/**
 * Create a scene generation job
 */
export function createSceneGenerationJob(
  params: SceneGenerationParams,
  options?: { 
    priority?: number;
    userId?: string;
  }
): VideoGenerationJob {
  return {
    id: crypto.randomUUID(),
    type: 'scene-generation',
    status: 'pending',
    params,
    created: new Date().toISOString(),
    progress: 0,
    priority: options?.priority || 10,
    userId: options?.userId,
    sceneId: params.sceneId
  };
}

/**
 * Create a shot generation job
 */
export function createShotGenerationJob(
  params: ShotGenerationParams,
  options?: { 
    priority?: number;
    userId?: string;
    sceneId?: string;
    shotId?: string;
  }
): VideoGenerationJob {
  return {
    id: crypto.randomUUID(),
    type: 'shot-generation',
    status: 'pending',
    params,
    created: new Date().toISOString(),
    progress: 0,
    priority: options?.priority || 5,
    userId: options?.userId,
    sceneId: options?.sceneId,
    shotId: options?.shotId
  };
}

/**
 * Create a character animation job
 */
export function createCharacterAnimationJob(
  params: CharacterAnimationParams,
  options?: { 
    priority?: number;
    userId?: string;
    sceneId?: string;
  }
): VideoGenerationJob {
  return {
    id: crypto.randomUUID(),
    type: 'character-animation',
    status: 'pending',
    params,
    created: new Date().toISOString(),
    progress: 0,
    priority: options?.priority || 5,
    userId: options?.userId,
    sceneId: options?.sceneId
  };
}

/**
 * Create a lip sync job
 */
export function createLipSyncJob(
  params: LipSyncParams,
  options?: { 
    priority?: number;
    userId?: string;
    sceneId?: string;
    shotId?: string;
  }
): VideoGenerationJob {
  return {
    id: crypto.randomUUID(),
    type: 'lipsync',
    status: 'pending',
    params,
    created: new Date().toISOString(),
    progress: 0,
    priority: options?.priority || 3,
    userId: options?.userId,
    sceneId: options?.sceneId,
    shotId: options?.shotId
  };
}

/**
 * Update a video generation job
 */
export function updateVideoGenerationJob(
  job: VideoGenerationJob,
  updates: Partial<Omit<VideoGenerationJob, 'id' | 'created'>>
): VideoGenerationJob {
  return {
    ...job,
    ...updates
  };
}