import { Asset } from '../../domain/assets/entities/Asset';
import { AssetIndexer } from '../../services/comfyui/assets/assetIndexer';
import { VideoGenerationOrchestrator } from '../../domain/video/services/VideoGenerationOrchestrator';
import { WANVideoProvider } from '../../domain/video/services/WANVideoProvider';
import { LipSyncService } from '../../domain/video/services/LipSyncService';
import { MockLipSyncProvider } from '../../domain/video/services/MockLipSyncProvider';
import { SceneVideoService } from './services/SceneVideoService';
import { VideoGenerationJob } from '../../domain/video/entities/VideoGenerationJob';
import { SubtitleService } from '../../domain/subtitle/services/SubtitleService';
import { FFmpegService } from '../../services/video/FFmpegService';
import { RenderService } from '../../services/video/RenderService';
import { TimelineEngine } from '../../services/video/TimelineEngine';
import { CinematicTimeline } from '../../services/video/TimelineEngine';

/**
 * Production Pipeline
 * 
 * This is the main service that integrates all components of the production pipeline:
 * - Video generation
 * - Scene video service
 * - Lip sync
 * - Subtitle generation
 * - Render service
 */
export class ProductionPipeline {
  // Core services
  private assetIndexer: AssetIndexer;
  private videoOrchestrator: VideoGenerationOrchestrator;
  private sceneVideoService: SceneVideoService;
  private lipSyncService: LipSyncService;
  private subtitleService: SubtitleService;
  private renderService: RenderService;
  private timelineEngine: TimelineEngine;
  private ffmpegService: FFmpegService;
  
  constructor() {
    // Initialize services
    this.assetIndexer = new AssetIndexer();
    this.assetIndexer.initialize();
    
    // Video generation
    this.videoOrchestrator = new VideoGenerationOrchestrator();
    this.videoOrchestrator.registerProvider('wan', new WANVideoProvider());
    this.videoOrchestrator.setAssetCreationCallback(this.handleAssetCreation.bind(this));
    
    // Scene video
    this.sceneVideoService = new SceneVideoService(this.assetIndexer);
    
    // Lip sync
    this.lipSyncService = new LipSyncService();
    this.lipSyncService.registerProvider('mock', new MockLipSyncProvider());
    this.lipSyncService.setJobCallback(this.submitVideoGenerationJob.bind(this));
    
    // Subtitle
    this.subtitleService = new SubtitleService();
    
    // Render
    this.ffmpegService = new FFmpegService();
    this.renderService = new RenderService({ useMockRender: true });
    this.renderService.initialize();
    
    // Timeline
    this.timelineEngine = new TimelineEngine();
    this.timelineEngine.connectAssetIndexer(this.assetIndexer);
  }
  
  /**
   * Handle asset creation
   * This is called when a new asset is created
   */
  private async handleAssetCreation(asset: Asset): Promise<void> {
    // Index the asset
    this.assetIndexer.indexAsset(asset);
    
    // If this is a voice asset, we may want to generate subtitles
    if (asset.type === 'audio' && asset.category === 'voice' && asset.status === 'complete') {
      // Check if the asset has word timestamps (needed for proper subtitles)
      const metadata = asset.metadata as any;
      if (metadata.word_timestamps) {
        // Generate subtitles from this voice asset
        this.subtitleService.generateSubtitlesFromAudio(
          asset,
          metadata.language || 'en'
        );
      }
    }
  }
  
  /**
   * Submit a video generation job to the orchestrator
   */
  private async submitVideoGenerationJob(job: VideoGenerationJob): Promise<VideoGenerationJob> {
    return this.videoOrchestrator.addJob(job);
  }
  
  /**
   * Generate video from an image
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
    }
  ): Promise<VideoGenerationJob> {
    return this.sceneVideoService.generateVideoFromImage(imageUrl, options);
  }
  
  /**
   * Generate videos for all shots in a scene
   */
  public async generateVideosForScene(scene: any): Promise<VideoGenerationJob[]> {
    return this.sceneVideoService.generateAllShotsForScene(scene);
  }
  
  /**
   * Create a timeline from a scene
   */
  public createTimelineFromScene(scene: any): CinematicTimeline | undefined {
    return this.sceneVideoService.createTimelineFromScene(scene);
  }
  
  /**
   * Apply lip sync to a video with audio
   */
  public async applyLipSync(
    videoAsset: Asset,
    audioAsset: Asset,
    options?: {
      faceRect?: [number, number, number, number];
      sceneId?: string;
    }
  ): Promise<VideoGenerationJob | undefined> {
    return this.lipSyncService.syncLipsForAssets(videoAsset, audioAsset, options);
  }
  
  /**
   * Export subtitles for a timeline
   */
  public exportSubtitlesForTimeline(
    timelineId: string,
    language: string,
    format: 'srt' | 'vtt' | 'json' | 'ass'
  ): string | undefined {
    // Find or generate subtitles for this timeline
    // This is a simplified implementation
    
    // In a real implementation, we would:
    // 1. Look for voice assets associated with the timeline
    // 2. Generate subtitles from those assets if not already available
    // 3. Export to the requested format
    
    // For now, we'll just return a placeholder
    return `WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nExample subtitle for timeline ${timelineId}\n`;
  }
  
  /**
   * Prepare a timeline for rendering
   */
  public async prepareTimelineForRender(
    timeline: CinematicTimeline
  ): Promise<{ isValid: boolean; missingAssets: string[]; invalidAssets: string[] }> {
    await this.ffmpegService.initialize();
    const result = await this.ffmpegService.prepareRender(timeline);
    
    return {
      isValid: result.isValid,
      missingAssets: result.missingAssets,
      invalidAssets: result.invalidAssets
    };
  }
  
  /**
   * Render a timeline
   */
  public async renderTimeline(
    timeline: CinematicTimeline,
    outputPath: string,
    options?: {
      quality?: 'low' | 'medium' | 'high' | 'max';
      includeAudio?: boolean;
      includeSubtitles?: boolean;
    }
  ): Promise<string> {
    // Create a render job
    const job = this.renderService.createRenderJob(timeline, outputPath, {
      quality: options?.quality,
      includeAudio: options?.includeAudio,
      includeSubtitles: options?.includeSubtitles
    });
    
    // Validate the job
    await this.renderService.validateJob(job.id, timeline);
    
    // Start the render
    await this.renderService.startRender(job.id, timeline);
    
    // In a real implementation, we would return a job ID that can be used to track progress
    // For this simplified version, we'll just return the output path
    return outputPath;
  }
}