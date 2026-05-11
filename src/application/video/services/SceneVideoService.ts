import { Asset } from '../../../domain/assets/entities/Asset';
import { 
  VideoGenerationOrchestrator,
  VideoGenerationProvider
} from '../../../domain/video/services/VideoGenerationOrchestrator';
import { 
  VideoGenerationJob,
  ShotGenerationParams, 
  ImageToVideoParams,
  createImageToVideoJob,
  createShotGenerationJob,
  createLipSyncJob
} from '../../../domain/video/entities/VideoGenerationJob';
import { WANVideoProvider } from '../../../domain/video/services/WANVideoProvider';
import { AssetIndexer } from '../../../services/comfyui/assets/assetIndexer';
import { CinematicTimeline, TimelineClip } from '../../../services/video/TimelineEngine';

// Simple Scene type - would be imported from domain in real implementation
interface Scene {
  id: string;
  title: string;
  shots: Array<{
    id: string;
    type: 'closeup' | 'medium' | 'wide' | 'establishing' | 'pov';
    description: string;
    duration: number;
    camera_movement?: 'static' | 'pan' | 'tilt' | 'zoom';
    characters?: string[];
    location?: string;
  }>;
  location?: string;
  style?: string;
}

/**
 * Service to manage video generation for scenes and shots
 */
export class SceneVideoService {
  private orchestrator: VideoGenerationOrchestrator;
  private assetIndexer: AssetIndexer;
  
  constructor(assetIndexer: AssetIndexer) {
    // Create and configure orchestrator
    this.orchestrator = new VideoGenerationOrchestrator();
    this.assetIndexer = assetIndexer;
    
    // Register video providers
    this.orchestrator.registerProvider('wan', new WANVideoProvider());
    
    // Set asset creation callback
    this.orchestrator.setAssetCreationCallback(async (asset: Asset) => {
      // Index the asset
      assetIndexer.indexAsset(asset);
    });
  }
  
  /**
   * Generate video for a static image using motion effects
   */
  public async generateVideoFromImage(
    imageUrl: string,
    options: {
      duration: number;
      fps?: number;
      motionType?: 'zoom' | 'pan' | 'ken-burns' | 'none';
      width?: number;
      height?: number;
      sceneId?: string;
      shotId?: string;
    }
  ): Promise<VideoGenerationJob> {
    // Create job parameters
    const params: ImageToVideoParams = {
      imageUrl,
      duration: options.duration,
      fps: options.fps || 30,
      motionType: options.motionType,
      outputWidth: options.width,
      outputHeight: options.height
    };
    
    // Create and add the job
    const job = createImageToVideoJob(params, {
      sceneId: options.sceneId
    });
    
    return this.orchestrator.addJob(job);
  }
  
  /**
   * Generate video for a shot in a scene
   */
  public async generateShotVideo(
    scene: Scene,
    shotIndex: number
  ): Promise<VideoGenerationJob | undefined> {
    if (!scene.shots || !scene.shots[shotIndex]) {
      throw new Error(`Shot index ${shotIndex} not found in scene ${scene.id}`);
    }
    
    const shot = scene.shots[shotIndex];
    
    // Create job parameters
    const params: ShotGenerationParams = {
      shotType: shot.type,
      description: shot.description,
      duration: shot.duration,
      characters: shot.characters,
      location: shot.location || scene.location,
      style: scene.style,
      cameraMovement: shot.camera_movement
    };
    
    // Create and add the job
    const job = createShotGenerationJob(params, {
      sceneId: scene.id,
      shotId: shot.id
    });
    
    return this.orchestrator.addJob(job);
  }
  
  /**
   * Generate videos for all shots in a scene
   */
  public async generateAllShotsForScene(scene: Scene): Promise<VideoGenerationJob[]> {
    if (!scene.shots || scene.shots.length === 0) {
      throw new Error(`No shots found in scene ${scene.id}`);
    }
    
    const jobs: VideoGenerationJob[] = [];
    
    // Create jobs for each shot
    for (let i = 0; i < scene.shots.length; i++) {
      const job = await this.generateShotVideo(scene, i);
      if (job) jobs.push(job);
    }
    
    return jobs;
  }
  
  /**
   * Find video assets for a scene
   */
  public findSceneVideoAssets(sceneId: string): Asset[] {
    const results = this.assetIndexer.search({
      type: 'video',
      category: 'scene'
    });
    
    // Filter for this scene
    return results.assets.filter(asset => 
      asset.related_entity_id === sceneId && 
      asset.status === 'complete'
    );
  }
  
  /**
   * Create a timeline for a scene using generated video assets
   */
  public createTimelineFromScene(
    scene: Scene,
    options?: {
      timelineId?: string;
      includeAudio?: boolean;
      includeSubtitles?: boolean;
    }
  ): CinematicTimeline | undefined {
    // Find video assets for this scene
    const videoAssets = this.findSceneVideoAssets(scene.id);
    
    if (videoAssets.length === 0) {
      console.warn(`No video assets found for scene ${scene.id}`);
      return undefined;
    }
    
    // Create timeline (simplified - would expand in real implementation)
    const now = new Date().toISOString();
    const timelineId = options?.timelineId || crypto.randomUUID();
    
    // Calculate total duration
    const totalDuration = scene.shots.reduce((total, shot) => total + shot.duration, 0);
    
    // Create video track with clips from assets
    const videoTrack = {
      id: crypto.randomUUID(),
      name: 'Video Track',
      type: 'video' as const,
      index: 0,
      elements: []
    };
    
    // Map assets to shots and create clips
    let currentStartTime = 0;
    for (const shot of scene.shots) {
      // Find asset for this shot
      const asset = videoAssets.find(a => 
        a.metadata.shot_id === shot.id || 
        a.metadata.generation_params?.shotId === shot.id
      );
      
      if (asset) {
        // Create a clip for this asset
        const clip: TimelineClip = {
          id: crypto.randomUUID(),
          type: 'clip',
          trackId: videoTrack.id,
          startTime: currentStartTime,
          duration: shot.duration,
          endTime: currentStartTime + shot.duration,
          data: {
            id: crypto.randomUUID(),
            type: 'video',
            startTime: currentStartTime,
            duration: shot.duration,
            asset: asset,
            shot: {
              type: shot.type,
              camera: shot.camera_movement || 'static',
              description: shot.description
            }
          }
        };
        
        videoTrack.elements.push(clip);
      } else {
        console.warn(`No asset found for shot ${shot.id} in scene ${scene.id}`);
      }
      
      // Update start time for next shot
      currentStartTime += shot.duration;
    }
    
    // Create the timeline
    const timeline: CinematicTimeline = {
      id: timelineId,
      name: `Scene: ${scene.title}`,
      sequenceId: crypto.randomUUID(),
      description: `Timeline for scene ${scene.id}`,
      duration: totalDuration,
      tracks: [videoTrack],
      markers: [],
      created: now,
      updated: now,
      settings: {
        frameRate: 30,
        width: 1920,
        height: 1080,
        audioChannels: 2,
        audioSampleRate: 48000
      }
    };
    
    return timeline;
  }
  
  /**
   * Get video generation jobs for a scene
   */
  public getJobsForScene(sceneId: string): VideoGenerationJob[] {
    const allJobs = this.orchestrator.getAllJobs();
    return allJobs.filter(job => job.sceneId === sceneId);
  }
  
  /**
   * Cancel all jobs for a scene
   */
  public cancelAllJobsForScene(sceneId: string): number {
    const jobs = this.getJobsForScene(sceneId);
    let cancelCount = 0;
    
    for (const job of jobs) {
      if (this.orchestrator.cancelJob(job.id)) {
        cancelCount++;
      }
    }
    
    return cancelCount;
  }
}