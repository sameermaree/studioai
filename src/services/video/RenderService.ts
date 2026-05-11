import { CinematicTimeline, TimelineClip, TimelineAudio, TimelineSubtitle } from './TimelineEngine';
import { FFmpegService, RenderPreparationResult, FFmpegExecutionProgress } from './FFmpegService';
import { TimelineToFFmpegConverter } from './TimelineToFFmpegConverter';

export type RenderJobState = 
  | 'pending'    // Job created but not yet validated
  | 'validating' // Checking all assets and files
  | 'ready'      // Ready to render
  | 'rendering'  // Currently rendering
  | 'completed'  // Render completed successfully 
  | 'failed';    // Render failed

export interface RenderJob {
  id: string;
  timelineId: string;
  state: RenderJobState;
  progress: number;
  outputPath: string;
  settings: {
    width: number;
    height: number;
    fps: number;
    quality: 'low' | 'medium' | 'high' | 'max';
    includeAudio: boolean;
    includeSubtitles: boolean;
    format: 'mp4' | 'webm' | 'mov' | 'gif';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    preset?: 'youtube' | 'tiktok' | 'instagram' | 'custom';
  };
  readinessChecks?: {
    missingAssets: string[];
    invalidAssets: string[];
    durationMismatches: string[];
    unsupportedFiles: string[];
    subtitleWarnings: string[];
    audioWarnings: string[];
  };
  estimatedDuration?: number;
  estimatedSize?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Service for safely managing render jobs
 */
export class RenderService {
  private ffmpegService: FFmpegService;
  private converter: TimelineToFFmpegConverter;
  private jobs: Map<string, RenderJob> = new Map();
  private useMockRender: boolean = true;
  
  constructor(options?: { useMockRender?: boolean }) {
    this.ffmpegService = new FFmpegService();
    this.converter = new TimelineToFFmpegConverter();
    this.useMockRender = options?.useMockRender !== false;
  }
  
  /**
   * Initialize the render service
   */
  public async initialize(): Promise<boolean> {
    try {
      return await this.ffmpegService.initialize();
    } catch (error) {
      console.error('Failed to initialize render service:', error);
      return false;
    }
  }
  
  /**
   * Create a new render job
   */
  public createRenderJob(
    timeline: CinematicTimeline,
    outputPath: string,
    settings?: Partial<RenderJob['settings']>
  ): RenderJob {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Default settings based on timeline
    const defaultSettings = {
      width: timeline.settings.width,
      height: timeline.settings.height,
      fps: timeline.settings.frameRate,
      quality: 'high' as const,
      includeAudio: true,
      includeSubtitles: true,
      format: 'mp4' as const,
      aspectRatio: '16:9' as const,
      preset: 'custom' as const
    };
    
    // Apply preset settings if specified
    if (settings?.preset) {
      const presetSettings = this.getPresetSettings(settings.preset, timeline);
      Object.assign(defaultSettings, presetSettings);
    }
    
    // Create the job
    const job: RenderJob = {
      id,
      timelineId: timeline.id,
      state: 'pending',
      progress: 0,
      outputPath,
      settings: { ...defaultSettings, ...settings },
      createdAt: now
    };
    
    // Store the job
    this.jobs.set(id, job);
    
    return job;
  }
  
  /**
   * Get a render job by ID
   */
  public getJob(id: string): RenderJob | undefined {
    return this.jobs.get(id);
  }
  
  /**
   * Validate a render job and check if it's ready to render
   */
  public async validateJob(
    jobId: string,
    timeline: CinematicTimeline
  ): Promise<RenderJob> {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Update job state
    const updatedJob: RenderJob = {
      ...job,
      state: 'validating',
    };
    this.jobs.set(jobId, updatedJob);
    
    try {
      // Prepare the render and validate assets
      const prepResult = await this.ffmpegService.prepareRender(timeline, {
        outputFile: job.outputPath,
        width: job.settings.width,
        height: job.settings.height,
        frameRate: job.settings.fps,
        quality: job.settings.quality,
        includeAudio: job.settings.includeAudio
      });
      
      // Check for audio and subtitle issues
      const audioWarnings = this.checkAudioTracks(timeline);
      const subtitleWarnings = this.checkSubtitleTracks(timeline);
      const durationMismatches = this.checkDurationMismatches(timeline);
      
      // Prepare readiness checks
      const readinessChecks = {
        missingAssets: prepResult.missingAssets,
        invalidAssets: prepResult.invalidAssets,
        unsupportedFiles: [], // Would check file format compatibility
        durationMismatches,
        subtitleWarnings,
        audioWarnings
      };
      
      // Update job with validation results
      const validatedJob: RenderJob = {
        ...updatedJob,
        state: prepResult.isValid ? 'ready' : 'failed',
        readinessChecks,
        estimatedDuration: prepResult.estimatedDuration,
        estimatedSize: prepResult.estimatedSize,
        error: !prepResult.isValid ? 'Missing or invalid assets' : undefined
      };
      
      this.jobs.set(jobId, validatedJob);
      return validatedJob;
    } catch (error) {
      // Update job with error
      const failedJob: RenderJob = {
        ...updatedJob,
        state: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.jobs.set(jobId, failedJob);
      return failedJob;
    }
  }
  
  /**
   * Start a render job
   */
  public async startRender(
    jobId: string,
    timeline: CinematicTimeline
  ): Promise<RenderJob> {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    if (job.state !== 'ready' && job.state !== 'pending') {
      throw new Error(`Job is not ready to render: ${job.state}`);
    }
    
    // If job is pending, validate it first
    if (job.state === 'pending') {
      await this.validateJob(jobId, timeline);
      const validatedJob = this.jobs.get(jobId);
      
      if (!validatedJob || validatedJob.state !== 'ready') {
        throw new Error('Job validation failed');
      }
    }
    
    // Update job state
    const now = new Date().toISOString();
    const updatedJob: RenderJob = {
      ...job,
      state: 'rendering',
      progress: 0,
      startedAt: now
    };
    this.jobs.set(jobId, updatedJob);
    
    // Start the render
    if (this.useMockRender) {
      this.startMockRender(jobId, timeline);
    } else {
      this.startActualRender(jobId, timeline);
    }
    
    return updatedJob;
  }
  
  /**
   * Cancel a render job
   */
  public cancelRender(jobId: string): RenderJob | undefined {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return undefined;
    }
    
    // Update job state
    const now = new Date().toISOString();
    const updatedJob: RenderJob = {
      ...job,
      state: 'failed',
      error: 'Render cancelled by user',
      completedAt: now
    };
    this.jobs.set(jobId, updatedJob);
    
    // TODO: If using actual FFmpeg, would need to kill the process
    
    return updatedJob;
  }
  
  /**
   * Start a mock render (for development/testing)
   */
  private startMockRender(
    jobId: string,
    timeline: CinematicTimeline
  ): void {
    let progress = 0;
    const job = this.jobs.get(jobId);
    
    if (!job) return;
    
    // Simulate render progress
    const interval = setInterval(() => {
      progress += 2;
      
      // Update job progress
      const updatedJob: RenderJob = {
        ...this.jobs.get(jobId)!,
        progress
      };
      this.jobs.set(jobId, updatedJob);
      
      // Complete render when progress reaches 100%
      if (progress >= 100) {
        clearInterval(interval);
        
        const completedJob: RenderJob = {
          ...updatedJob,
          state: 'completed',
          progress: 100,
          completedAt: new Date().toISOString()
        };
        this.jobs.set(jobId, completedJob);
      }
    }, 250);
  }
  
  /**
   * Start the actual FFmpeg render
   */
  private async startActualRender(
    jobId: string,
    timeline: CinematicTimeline
  ): Promise<void> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) return;
      
      // Prepare the render
      const prepResult = await this.ffmpegService.prepareRender(timeline, {
        outputFile: job.outputPath,
        width: job.settings.width,
        height: job.settings.height,
        frameRate: job.settings.fps,
        quality: job.settings.quality,
        includeAudio: job.settings.includeAudio
      });
      
      if (!prepResult.isValid) {
        throw new Error('Render preparation failed: missing or invalid assets');
      }
      
      // Generate the filter complex for this timeline
      const { inputFiles, filterComplex, subtitleFiles } = this.converter.generateFilterComplex(timeline);
      
      // Set up progress tracking
      const handleProgress = (progress: FFmpegExecutionProgress) => {
        const updatedJob = this.jobs.get(jobId);
        if (updatedJob && updatedJob.state === 'rendering') {
          this.jobs.set(jobId, {
            ...updatedJob,
            progress: progress.percentage
          });
        }
      };
      
      // Execute the FFmpeg render
      await this.ffmpegService.executeRender(
        inputFiles,
        job.outputPath,
        filterComplex,
        {
          width: job.settings.width,
          height: job.settings.height,
          frameRate: job.settings.fps,
          quality: job.settings.quality,
          includeAudio: job.settings.includeAudio,
          includeSubtitles: job.settings.includeSubtitles,
          subtitleFile: subtitleFiles?.[0],
          aspectRatio: job.settings.aspectRatio,
          onProgress: handleProgress
        }
      );
      
      // Update job to completed
      const completedJob: RenderJob = {
        ...job,
        state: 'completed',
        progress: 100,
        completedAt: new Date().toISOString()
      };
      this.jobs.set(jobId, completedJob);
      
    } catch (error) {
      // Update job with error
      const job = this.jobs.get(jobId);
      if (!job) return;
      
      const failedJob: RenderJob = {
        ...job,
        state: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString()
      };
      this.jobs.set(jobId, failedJob);
    }
  }
  
  /**
   * Check for issues with audio tracks
   */
  private checkAudioTracks(timeline: CinematicTimeline): string[] {
    const warnings: string[] = [];
    
    const audioTracks = timeline.tracks.filter(track => track.type === 'audio');
    const audioElements = audioTracks.flatMap(track => 
      track.elements.filter(el => el.type === 'audio')
    ) as TimelineAudio[];
    
    // Check for missing audio assets
    for (const audio of audioElements) {
      if (!audio.data.asset) {
        warnings.push(`Audio element ${audio.id} has no associated asset`);
      } else if (audio.data.asset.status !== 'complete') {
        warnings.push(`Audio asset ${audio.data.asset.id} is not ready (${audio.data.asset.display_name})`);
      }
    }
    
    return warnings;
  }
  
  /**
   * Check for issues with subtitle tracks
   */
  private checkSubtitleTracks(timeline: CinematicTimeline): string[] {
    const warnings: string[] = [];
    
    const subtitleTracks = timeline.tracks.filter(track => track.type === 'subtitle');
    const subtitleElements = subtitleTracks.flatMap(track => 
      track.elements.filter(el => el.type === 'subtitle')
    ) as TimelineSubtitle[];
    
    // Check for overlapping subtitles
    for (let i = 0; i < subtitleElements.length; i++) {
      const sub = subtitleElements[i];
      
      for (let j = i + 1; j < subtitleElements.length; j++) {
        const otherSub = subtitleElements[j];
        
        // If on the same track and overlapping
        if (sub.trackId === otherSub.trackId && 
            sub.startTime < otherSub.endTime && 
            sub.endTime > otherSub.startTime) {
          warnings.push(`Subtitles ${sub.id} and ${otherSub.id} overlap on track ${sub.trackId}`);
        }
      }
      
      // Check if subtitle extends beyond timeline duration
      if (sub.endTime > timeline.duration) {
        warnings.push(`Subtitle ${sub.id} extends beyond timeline duration`);
      }
    }
    
    return warnings;
  }
  
  /**
   * Check for clip duration mismatches (asset duration vs clip duration)
   */
  /**
   * Get settings for a specific export preset
   */
  private getPresetSettings(
    preset: 'youtube' | 'tiktok' | 'instagram' | 'custom',
    timeline: CinematicTimeline
  ): Partial<RenderJob['settings']> {
    switch (preset) {
      case 'youtube':
        return {
          width: 1920,
          height: 1080,
          fps: 30,
          quality: 'high' as const,
          includeAudio: true,
          includeSubtitles: true,
          format: 'mp4' as const,
          aspectRatio: '16:9' as const
        };
        
      case 'tiktok':
        return {
          width: 1080,
          height: 1920,
          fps: 30,
          quality: 'high' as const,
          includeAudio: true,
          includeSubtitles: true,
          format: 'mp4' as const,
          aspectRatio: '9:16' as const
        };
        
      case 'instagram':
        return {
          width: 1080,
          height: 1080,
          fps: 30,
          quality: 'high' as const,
          includeAudio: true,
          includeSubtitles: true,
          format: 'mp4' as const,
          aspectRatio: '1:1' as const
        };
        
      default:
        return {
          width: timeline.settings.width,
          height: timeline.settings.height,
          fps: timeline.settings.frameRate,
          quality: 'high' as const,
          includeAudio: true,
          includeSubtitles: true,
          format: 'mp4' as const,
          aspectRatio: '16:9' as const
        };
    }
  }
  
  private checkDurationMismatches(timeline: CinematicTimeline): string[] {
    const warnings: string[] = [];
    
    const videoTracks = timeline.tracks.filter(track => track.type === 'video');
    const clipElements = videoTracks.flatMap(track => 
      track.elements.filter(el => el.type === 'clip')
    ) as TimelineClip[];
    
    for (const clip of clipElements) {
      if (clip.data.asset && 
          clip.data.asset.type === 'video' && 
          clip.data.asset.metadata.duration) {
        
        const assetDuration = clip.data.asset.metadata.duration;
        
        // If clip duration exceeds asset duration
        if (clip.duration > assetDuration) {
          warnings.push(
            `Clip ${clip.id} (${clip.data.asset.display_name}) duration (${clip.duration}s) ` +
            `exceeds asset duration (${assetDuration}s)`
          );
        }
      }
    }
    
    return warnings;
  }
}