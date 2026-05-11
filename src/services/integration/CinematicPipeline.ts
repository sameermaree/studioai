import { EventEmitter } from 'events';
import { ComfyUIService } from '../comfyui';
import { VideoSequencer, VideoSequence, VideoClipDefinition } from '../video/VideoSequencer';
import { FFmpegService } from '../video/FFmpegService';
import { TimelineEngine, CinematicTimeline } from '../video/TimelineEngine';
import { TTSService } from '../audio/TTSService';
import { SubtitleService, SubtitleEntry } from '../audio/SubtitleService';
import { Asset } from '../../domain/assets/entities/Asset';
import { Job, createJob } from '../../domain/rendering/entities/Job';
import { BatchJob } from '../comfyui/batchGenerator';

/**
 * Cinematic sequence definition for creating scenes
 */
export interface CinematicSequenceDefinition {
  id: string;
  name: string;
  description?: string;
  scenes: CinematicSceneDefinition[];
  audioTracks?: {
    type: 'music' | 'ambient' | 'sfx';
    assetId?: string;
    url?: string;
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
    startTime?: number;
    loop?: boolean;
  }[];
  settings?: {
    width: number;
    height: number;
    fps: number;
    format: 'mp4' | 'webm';
    quality: 'draft' | 'preview' | 'final';
  };
  metadata?: Record<string, any>;
}

/**
 * Scene definition for a cinematic sequence
 */
export interface CinematicSceneDefinition {
  id: string;
  name: string;
  description?: string;
  shots: CinematicShotDefinition[];
  voiceover?: {
    text: string;
    voiceId?: string;
    language?: string;
    volume?: number;
  };
  background?: {
    type: 'image' | 'video';
    assetId?: string;
    url?: string;
    prompt?: string;
  };
  transitions?: {
    in?: {
      type: 'fade' | 'crossfade' | 'wipe' | 'none';
      duration?: number;
    };
    out?: {
      type: 'fade' | 'crossfade' | 'wipe' | 'none';
      duration?: number;
    };
  };
  duration?: number; // in seconds, if specified will override calculated duration
}

/**
 * Shot definition for a scene
 */
export interface CinematicShotDefinition {
  id: string;
  type: 'closeup' | 'medium' | 'wide' | 'establishing' | 'pov' | 'custom';
  description: string;
  prompt?: string;
  negativePrompt?: string;
  duration?: number; // in seconds
  characters?: string[]; // character IDs or names
  generateOptions?: {
    width?: number;
    height?: number;
    seed?: number;
    steps?: number;
    model?: string;
    template?: string;
  };
  camera?: {
    movement?: 'static' | 'pan' | 'zoom' | 'track';
    direction?: 'left' | 'right' | 'in' | 'out';
    speed?: 'slow' | 'medium' | 'fast';
  };
  subtitles?: {
    enabled?: boolean;
    position?: [number, number]; // [x, y] as percentage
    style?: {
      color?: string;
      backgroundColor?: string;
      fontSize?: number;
    };
  };
  transitions?: {
    in?: {
      type: 'cut' | 'fade' | 'crossfade' | 'wipe' | 'none';
      duration?: number;
    };
    out?: {
      type: 'cut' | 'fade' | 'crossfade' | 'wipe' | 'none';
      duration?: number;
    };
  };
}

/**
 * Result of a cinematic generation
 */
export interface CinematicGenerationResult {
  sequence: VideoSequence;
  timeline: CinematicTimeline;
  assets: Asset[];
  outputPath: string;
  subtitles: {
    srt: string;
    vtt: string;
  };
  jobs: Job[];
}

/**
 * Generation progress information
 */
export interface CinematicGenerationProgress {
  stage: 'preparing' | 'generating' | 'assembling' | 'rendering' | 'finalizing';
  progress: number; // 0-100
  currentScene?: string;
  currentShot?: string;
  message?: string;
  assets?: Asset[];
  outputPath?: string;
  subtitles?: {
    srt?: string;
    vtt?: string;
  };
}

/**
 * Cinematic Pipeline Service
 * 
 * This service coordinates the video pipeline, ComfyUI orchestration, 
 * and audio systems to generate complete cinematic sequences.
 */
export class CinematicPipeline extends EventEmitter {
  private comfyService: ComfyUIService;
  private videoSequencer: VideoSequencer;
  private timelineEngine: TimelineEngine;
  private ffmpegService: FFmpegService;
  private ttsService: TTSService;
  private subtitleService: SubtitleService;
  
  constructor(
    comfyService: ComfyUIService,
    videoSequencer: VideoSequencer,
    timelineEngine: TimelineEngine,
    ffmpegService: FFmpegService,
    ttsService: TTSService,
    subtitleService: SubtitleService
  ) {
    super();
    this.comfyService = comfyService;
    this.videoSequencer = videoSequencer;
    this.timelineEngine = timelineEngine;
    this.ffmpegService = ffmpegService;
    this.ttsService = ttsService;
    this.subtitleService = subtitleService;
  }
  
  /**
   * Generate a complete cinematic sequence
   */
  public async generateSequence(
    definition: CinematicSequenceDefinition,
    outputPath: string,
    options?: {
      progressCallback?: (progress: CinematicGenerationProgress) => void;
    }
  ): Promise<CinematicGenerationResult> {
    // Create the video sequence
    const videoSequence = this.videoSequencer.createSequence(
      definition.name,
      {
        type: 'scene',
        description: definition.description,
        width: definition.settings?.width || 1920,
        height: definition.settings?.height || 1080,
        fps: definition.settings?.fps || 24
      }
    );
    
    // Create timeline from sequence
    const timeline = this.timelineEngine.createTimeline(
      definition.name,
      videoSequence.id,
      {
        frameRate: definition.settings?.fps || 24,
        width: definition.settings?.width || 1920,
        height: definition.settings?.height || 1080
      }
    );
    
    // Track assets, jobs, and subtitles
    const assets: Asset[] = [];
    const jobs: Job[] = [];
    const subtitles: SubtitleEntry[] = [];
    
    // Report initial progress
    const reportProgress = (progress: Partial<CinematicGenerationProgress>) => {
      const fullProgress: CinematicGenerationProgress = {
        stage: progress.stage || 'preparing',
        progress: progress.progress || 0,
        currentScene: progress.currentScene,
        currentShot: progress.currentShot,
        message: progress.message,
        assets: progress.assets || assets,
        outputPath: progress.outputPath,
        subtitles: progress.subtitles
      };
      
      if (options?.progressCallback) {
        options.progressCallback(fullProgress);
      }
      
      this.emit('progress', fullProgress);
    };
    
    reportProgress({ stage: 'preparing', progress: 0, message: 'Preparing cinematic sequence' });
    
    // Process each scene
    for (let i = 0; i < definition.scenes.length; i++) {
      const scene = definition.scenes[i];
      const sceneProgress = i / definition.scenes.length * 100;
      
      reportProgress({
        stage: 'generating',
        progress: sceneProgress,
        currentScene: scene.name,
        message: `Generating scene ${i + 1}/${definition.scenes.length}: ${scene.name}`
      });
      
      // Generate voice for the scene if specified
      let voiceAsset: Asset | undefined;
      let voiceSubtitles: SubtitleEntry[] = [];
      
      if (scene.voiceover) {
        // Generate the voice
        const speechResult = await this.ttsService.generateSpeechWithDefaultVoice(
          scene.voiceover.text,
          scene.voiceover.language || 'en-US',
          {
            speed: 1.0,
            volume: scene.voiceover.volume ? scene.voiceover.volume * 100 : 100
          }
        );
        
        // Convert to URL
        const audioUrl = this.ttsService.speechResultToURL(speechResult);
        
        // Create an asset (in a real implementation, we would save the audio file)
        const audioAsset = {
          id: crypto.randomUUID(),
          filename: `voice_${scene.id}.mp3`,
          display_name: `Voice for ${scene.name}`,
          type: 'audio',
          category: 'voice',
          mime_type: speechResult.mimeType,
          status: 'complete',
          path: '',
          url: audioUrl,
          metadata: speechResult.metadata,
          tags: ['generated', 'voice', scene.voiceover.language || 'en'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Asset;
        
        assets.push(audioAsset);
        voiceAsset = audioAsset;
        
        // Generate subtitles from the speech result
        voiceSubtitles = this.subtitleService.generateSubtitlesFromTTS(
          speechResult,
          {
            strategy: 'sentences',
            language: scene.voiceover.language,
            speaker: scene.name
          }
        );
        
        // Add the subtitles
        subtitles.push(...voiceSubtitles);
      }
      
      // Process each shot in the scene
      for (let j = 0; j < scene.shots.length; j++) {
        const shot = scene.shots[j];
        const shotProgress = (i * scene.shots.length + j) / (definition.scenes.length * scene.shots.length) * 70;
        
        reportProgress({
          stage: 'generating',
          progress: shotProgress,
          currentScene: scene.name,
          currentShot: shot.description,
          message: `Generating shot ${j + 1}/${scene.shots.length} in scene ${i + 1}: ${shot.description}`
        });
        
        // Generate the shot image or video
        if (shot.prompt) {
          // If there's a prompt, generate the shot
          let shotAsset: Asset;
          
          // Determine if this should be an image or video
          const generateVideo = shot.camera && shot.camera.movement !== 'static';
          
          if (generateVideo) {
            // Generate a video
            const { asset, job } = await this.comfyService.generateVideo(
              shot.prompt,
              {
                negativePrompt: shot.negativePrompt,
                width: shot.generateOptions?.width || definition.settings?.width || 1024,
                height: shot.generateOptions?.height || definition.settings?.height || 576,
                durationSeconds: shot.duration || 3,
                fps: definition.settings?.fps || 24,
                seed: shot.generateOptions?.seed,
                assetDisplayName: `${scene.name} - ${shot.description}`,
                assetCategory: 'scene',
                assetTags: ['generated', 'video', shot.type]
              }
            );
            
            shotAsset = asset;
            jobs.push(job);
          } else {
            // Generate an image
            const { asset, job } = await this.comfyService.generateImage(
              shot.prompt,
              {
                negativePrompt: shot.negativePrompt,
                width: shot.generateOptions?.width || definition.settings?.width || 1024,
                height: shot.generateOptions?.height || definition.settings?.height || 576,
                seed: shot.generateOptions?.seed,
                assetDisplayName: `${scene.name} - ${shot.description}`,
                assetCategory: 'scene',
                assetTags: ['generated', 'image', shot.type]
              }
            );
            
            shotAsset = asset;
            jobs.push(job);
          }
          
          assets.push(shotAsset);
          
          // Add the shot to the sequence
          const clipDuration = shot.duration || 3; // Default to 3 seconds
          
          // Create a video clip definition
          const clip: VideoClipDefinition = {
            id: crypto.randomUUID(),
            assetId: shotAsset.id,
            asset: shotAsset,
            type: generateVideo ? 'video' : 'image',
            startTime: 0, // Will be calculated by the sequencer
            duration: clipDuration,
            shot: {
              type: shot.type,
              camera: shot.camera?.movement || 'static',
              description: shot.description
            },
            settings: {
              // For image-to-video settings
              scale: 1.0,
              filters: []
            }
          };
          
          // Add transition if specified
          if (shot.transitions) {
            if (shot.transitions.in && shot.transitions.in.type !== 'none') {
              clip.transitionIn = {
                id: crypto.randomUUID(),
                type: shot.transitions.in.type === 'cut' ? 'cut' : 'crossfade',
                duration: shot.transitions.in.duration || 0.5
              };
            }
            
            if (shot.transitions.out && shot.transitions.out.type !== 'none') {
              clip.transitionOut = {
                id: crypto.randomUUID(),
                type: shot.transitions.out.type === 'cut' ? 'cut' : 'crossfade',
                duration: shot.transitions.out.duration || 0.5
              };
            }
          }
          
          // Add clip to the sequence
          this.videoSequencer.addClip(
            videoSequence.id,
            'video',
            clip,
            undefined // Add to the end
          );
          
          // Add relevant subtitles for this shot
          if (voiceSubtitles.length > 0 && shot.subtitles?.enabled !== false) {
            // Find subtitles that fall within this shot's time range
            const shotStartTime = videoSequence.clips.reduce((sum, c) => sum + c.duration, 0) - clipDuration;
            const shotEndTime = shotStartTime + clipDuration;
            
            const shotSubtitles = voiceSubtitles.filter(sub => 
              (sub.startTime >= shotStartTime && sub.startTime < shotEndTime) ||
              (sub.endTime > shotStartTime && sub.endTime <= shotEndTime)
            );
            
            // Add subtitles
            for (const sub of shotSubtitles) {
              // Adjust subtitle timing to be relative to shot
              const adjustedSub = {
                ...sub,
                startTime: Math.max(0, sub.startTime - shotStartTime),
                endTime: Math.min(clipDuration, sub.endTime - shotStartTime)
              };
              
              // Apply styling if specified
              if (shot.subtitles?.style) {
                adjustedSub.style = {
                  ...adjustedSub.style,
                  ...shot.subtitles.style
                };
              }
              
              if (shot.subtitles?.position) {
                adjustedSub.style = {
                  ...adjustedSub.style,
                  position: shot.subtitles.position
                };
              }
              
              // Add to the video sequence
              this.videoSequencer.addSubtitle(
                videoSequence.id,
                adjustedSub
              );
            }
          }
        }
      }
      
      // Add voice track if we have one
      if (voiceAsset) {
        this.videoSequencer.addAudioTrack(
          videoSequence.id,
          {
            id: crypto.randomUUID(),
            assetId: voiceAsset.id,
            asset: voiceAsset,
            url: voiceAsset.url,
            startTime: 0, // Start at the beginning of the scene
            duration: voiceAsset.metadata.duration || videoSequence.totalDuration,
            volume: scene.voiceover?.volume || 1.0,
            type: 'dialogue'
          }
        );
      }
    }
    
    // Add background audio tracks if specified
    if (definition.audioTracks) {
      for (const track of definition.audioTracks) {
        // In a real implementation, we would resolve the asset or URL
        
        // For now, just add the track
        this.videoSequencer.addAudioTrack(
          videoSequence.id,
          {
            id: crypto.randomUUID(),
            assetId: track.assetId,
            url: track.url,
            startTime: track.startTime || 0,
            duration: track.loop ? videoSequence.totalDuration * 2 : undefined, // For looping
            volume: track.volume || 0.5,
            fadeIn: track.fadeIn,
            fadeOut: track.fadeOut,
            loop: track.loop,
            type: track.type
          }
        );
      }
    }
    
    // Now render the sequence
    reportProgress({ 
      stage: 'assembling', 
      progress: 80, 
      message: 'Assembling video sequence' 
    });
    
    // Convert the sequence to SRT and VTT formats
    const srtSubtitles = this.subtitleService.toSRT(subtitles);
    const vttSubtitles = this.subtitleService.toVTT(subtitles);
    
    // In a real implementation, we would render the sequence using FFmpeg
    
    // Create a render job
    const renderJob = this.videoSequencer.startRender({
      sequenceId: videoSequence.id,
      outputPath,
      quality: definition.settings?.quality || 'preview'
    });
    
    if (renderJob) {
      jobs.push(renderJob);
    }
    
    // Wait for render to complete
    // In a real implementation, this would wait for the render job to finish
    
    reportProgress({ 
      stage: 'finalizing', 
      progress: 95, 
      message: 'Finalizing output', 
      outputPath, 
      subtitles: {
        srt: srtSubtitles,
        vtt: vttSubtitles
      } 
    });
    
    // Final result
    return {
      sequence: videoSequence,
      timeline,
      assets,
      outputPath,
      subtitles: {
        srt: srtSubtitles,
        vtt: vttSubtitles
      },
      jobs
    };
  }
  
  /**
   * Generate a video from a ComfyUI batch result
   */
  public async generateFromBatch(
    batchJob: BatchJob,
    outputPath: string,
    options?: {
      fps?: number;
      imageDuration?: number;
      transitionDuration?: number;
      transitionType?: 'crossfade' | 'fade' | 'wipe';
      audio?: {
        url: string;
        volume?: number;
      };
      subtitles?: SubtitleEntry[];
      progressCallback?: (progress: CinematicGenerationProgress) => void;
    }
  ): Promise<CinematicGenerationResult> {
    // Create the video sequence
    const videoSequence = this.videoSequencer.createSequence(
      batchJob.name,
      {
        type: 'scene',
        description: `Generated from batch ${batchJob.id}`,
        width: batchJob.config.common?.width || 1024,
        height: batchJob.config.common?.height || 576,
        fps: options?.fps || 24
      }
    );
    
    // Create timeline
    const timeline = this.timelineEngine.createTimeline(
      batchJob.name,
      videoSequence.id,
      {
        frameRate: options?.fps || 24,
        width: batchJob.config.common?.width || 1024,
        height: batchJob.config.common?.height || 576
      }
    );
    
    // Track assets, jobs, and subtitles
    const assets = [...batchJob.assets];
    const jobs = [...batchJob.jobs];
    let subtitles = options?.subtitles || [];
    
    // Progress reporting
    const reportProgress = (progress: Partial<CinematicGenerationProgress>) => {
      const fullProgress: CinematicGenerationProgress = {
        stage: progress.stage || 'preparing',
        progress: progress.progress || 0,
        message: progress.message,
        assets: progress.assets || assets,
        outputPath: progress.outputPath,
        subtitles: progress.subtitles
      };
      
      if (options?.progressCallback) {
        options.progressCallback(fullProgress);
      }
      
      this.emit('progress', fullProgress);
    };
    
    reportProgress({ 
      stage: 'preparing', 
      progress: 0, 
      message: `Preparing sequence from ${batchJob.assets.length} assets` 
    });
    
    // Add each asset as a clip
    const imageDuration = options?.imageDuration || 3; // Default duration for images
    const transitionDuration = options?.transitionDuration || 0.5;
    
    for (let i = 0; i < batchJob.assets.length; i++) {
      const asset = batchJob.assets[i];
      const assetProgress = i / batchJob.assets.length * 50;
      
      reportProgress({ 
        stage: 'assembling', 
        progress: assetProgress, 
        message: `Adding asset ${i + 1}/${batchJob.assets.length}` 
      });
      
      // Determine if this is an image or video
      const isVideo = asset.type === 'video';
      
      // Create a clip
      const clip: VideoClipDefinition = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        asset,
        type: isVideo ? 'video' : 'image',
        startTime: 0, // Will be calculated by the sequencer
        duration: isVideo ? asset.metadata.duration || 5 : imageDuration,
        settings: {
          scale: 1.0
        }
      };
      
      // Add transitions except for the first clip
      if (i > 0 && options?.transitionType !== 'none') {
        clip.transitionIn = {
          id: crypto.randomUUID(),
          type: options?.transitionType || 'crossfade',
          duration: transitionDuration
        };
      }
      
      // Add to the sequence
      this.videoSequencer.addClip(
        videoSequence.id,
        'video',
        clip,
        undefined // Add to the end
      );
    }
    
    // Add audio if specified
    if (options?.audio) {
      // In a real implementation, we would resolve the audio asset
      
      // Add the audio track
      this.videoSequencer.addAudioTrack(
        videoSequence.id,
        {
          id: crypto.randomUUID(),
          url: options.audio.url,
          startTime: 0,
          duration: videoSequence.totalDuration,
          volume: options.audio.volume || 0.8,
          type: 'music'
        }
      );
    }
    
    // Now render the sequence
    reportProgress({ 
      stage: 'rendering', 
      progress: 70, 
      message: 'Rendering video sequence' 
    });
    
    // In a real implementation, this would use FFmpeg to render the video
    
    // Create a render job
    const renderJob = this.videoSequencer.startRender({
      sequenceId: videoSequence.id,
      outputPath,
      quality: 'preview'
    });
    
    if (renderJob) {
      jobs.push(renderJob);
    }
    
    // Convert subtitles
    const srtSubtitles = subtitles.length > 0 ? this.subtitleService.toSRT(subtitles) : '';
    const vttSubtitles = subtitles.length > 0 ? this.subtitleService.toVTT(subtitles) : '';
    
    reportProgress({ 
      stage: 'finalizing', 
      progress: 95, 
      message: 'Finalizing output', 
      outputPath, 
      subtitles: {
        srt: srtSubtitles,
        vtt: vttSubtitles
      } 
    });
    
    // Return the result
    return {
      sequence: videoSequence,
      timeline,
      assets,
      outputPath,
      subtitles: {
        srt: srtSubtitles,
        vtt: vttSubtitles
      },
      jobs
    };
  }
}