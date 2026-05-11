import { BrowserEventEmitter } from '../../lib/BrowserEventEmitter';
import { Asset } from '../../domain/assets/entities/Asset';
import { Job, createJob } from '../../domain/rendering/entities/Job';

export type VideoSequenceType = 'scene' | 'episode' | 'sequence' | 'transition' | 'custom';

export interface VideoClipDefinition {
  id: string;
  assetId?: string;
  asset?: Asset;
  type: 'image' | 'video';
  url?: string;
  startTime: number; // in seconds from sequence start
  duration: number; // in seconds
  transitionIn?: TransitionDefinition;
  transitionOut?: TransitionDefinition;
  audioTrackIds?: string[]; // IDs of associated audio tracks
  subtitleTrackIds?: string[]; // IDs of associated subtitle tracks
  metadata?: Record<string, any>;
  shot?: {
    type: 'closeup' | 'medium' | 'wide' | 'establishing' | 'pov' | 'custom';
    camera: string;
    description?: string;
  };
  settings?: {
    scale?: number;
    position?: [number, number]; // [x, y] as percentage of frame
    crop?: [number, number, number, number]; // [left, top, right, bottom] in pixels
    speed?: number; // playback speed multiplier
    filters?: VideoFilterDefinition[];
  };
}

export interface TransitionDefinition {
  id: string;
  type: 'cut' | 'crossfade' | 'fade' | 'wipe' | 'zoom' | 'custom';
  duration: number; // in seconds
  params?: Record<string, any>; // transition-specific parameters
}

export interface VideoFilterDefinition {
  id: string;
  type: string;
  params: Record<string, any>;
}

export interface AudioTrackDefinition {
  id: string;
  assetId?: string;
  asset?: Asset;
  url?: string;
  startTime: number; // in seconds from sequence start
  duration: number; // in seconds
  volume: number; // 0-1
  fadeIn?: number; // fade in duration in seconds
  fadeOut?: number; // fade out duration in seconds
  loop?: boolean;
  type: 'dialogue' | 'music' | 'sfx' | 'ambient';
  metadata?: Record<string, any>;
}

export interface SubtitleDefinition {
  id: string;
  startTime: number; // in seconds from sequence start
  endTime: number; // in seconds from sequence start
  text: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    position?: [number, number]; // [x, y] as percentage of frame
    alignment?: 'left' | 'center' | 'right';
  };
  language?: string;
  speaker?: string;
}

export interface VideoSequence {
  id: string;
  name: string;
  description?: string;
  type: VideoSequenceType;
  clips: VideoClipDefinition[];
  audioTracks: AudioTrackDefinition[];
  subtitles: SubtitleDefinition[];
  totalDuration: number; // calculated from clips
  width: number;
  height: number;
  fps: number;
  metadata?: Record<string, any>;
  parentId?: string; // ID of parent sequence if this is a subscene
  children?: VideoSequence[]; // Child sequences
  created: string;
  updated: string;
  thumbnail?: string;
  settings: {
    format: 'mp4' | 'webm' | 'gif' | 'mov';
    quality: 'low' | 'medium' | 'high' | 'ultra';
    preset?: string; // encoding preset
    customSettings?: Record<string, any>;
    watermark?: {
      image: string;
      position: [number, number]; // [x, y] as percentage of frame
      size: number; // as percentage of frame height
      opacity: number; // 0-1
    };
  };
}

export interface RenderRequest {
  sequenceId: string;
  outputPath: string;
  quality: 'draft' | 'preview' | 'final';
  selectedClipIds?: string[]; // If only specific clips should be rendered
  startTime?: number;
  endTime?: number;
  settings?: Partial<VideoSequence['settings']>;
}

export interface RenderProgress {
  jobId: string;
  sequenceId: string;
  progress: number;
  currentClip?: string;
  stage: 'preparing' | 'rendering' | 'exporting' | 'finalizing';
  timeRemaining?: number; // in seconds
  error?: string;
  warning?: string;
  outputPath?: string;
}

/**
 * Service for sequencing and managing video clips
 * 
 * This is the core of the cinematic pipeline, allowing for arranging
 * images and video clips into sequences with transitions, audio, and subtitles.
 */
export class VideoSequencer extends BrowserEventEmitter {
  private sequences: Map<string, VideoSequence> = new Map();
  private renderJobs: Map<string, Job> = new Map();
  private activeRenders: Set<string> = new Set(); // Set of active render job IDs
  
  constructor() {
    super();
  }
  
  /**
   * Create a new video sequence
   */
  public createSequence(
    name: string,
    options: {
      type?: VideoSequenceType;
      description?: string;
      width?: number;
      height?: number;
      fps?: number;
      metadata?: Record<string, any>;
      parentId?: string;
    } = {}
  ): VideoSequence {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const sequence: VideoSequence = {
      id,
      name,
      description: options.description,
      type: options.type || 'scene',
      clips: [],
      audioTracks: [],
      subtitles: [],
      totalDuration: 0,
      width: options.width || 1920,
      height: options.height || 1080,
      fps: options.fps || 24,
      metadata: options.metadata || {},
      parentId: options.parentId,
      created: now,
      updated: now,
      settings: {
        format: 'mp4',
        quality: 'high'
      }
    };
    
    this.sequences.set(id, sequence);
    
    this.emit('sequence:created', { id, name });
    
    return sequence;
  }
  
  /**
   * Get a sequence by ID
   */
  public getSequence(id: string): VideoSequence | undefined {
    return this.sequences.get(id);
  }
  
  /**
   * Update a sequence
   */
  public updateSequence(
    id: string, 
    updates: Partial<Omit<VideoSequence, 'id' | 'created'>>
  ): VideoSequence | undefined {
    const sequence = this.sequences.get(id);
    
    if (!sequence) {
      return undefined;
    }
    
    // Apply updates
    const updatedSequence = {
      ...sequence,
      ...updates,
      updated: new Date().toISOString()
    };
    
    // Calculate total duration if clips changed
    if (updates.clips) {
      updatedSequence.totalDuration = this.calculateTotalDuration(updatedSequence.clips);
    }
    
    this.sequences.set(id, updatedSequence);
    
    this.emit('sequence:updated', { id, sequence: updatedSequence });
    
    return updatedSequence;
  }
  
  /**
   * Add a clip to a sequence
   */
  public addClip(
    sequenceId: string,
    clip: Omit<VideoClipDefinition, 'id' | 'startTime'>,
    position?: number // Position in the sequence (0-indexed), if undefined adds to the end
  ): VideoClipDefinition | undefined {
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      return undefined;
    }
    
    // Generate ID for the clip
    const clipId = crypto.randomUUID();
    
    // Calculate start time based on position
    let startTime = 0;
    const clips = [...sequence.clips];
    
    if (position === undefined || position >= clips.length) {
      // Add to the end
      position = clips.length;
      
      if (clips.length > 0) {
        const lastClip = clips[clips.length - 1];
        startTime = lastClip.startTime + lastClip.duration;
      }
    } else {
      // Insert at position
      startTime = position > 0 ? clips[position - 1].startTime + clips[position - 1].duration : 0;
      
      // Adjust start times of subsequent clips
      for (let i = position; i < clips.length; i++) {
        clips[i].startTime += clip.duration;
      }
    }
    
    // Create the new clip
    const newClip: VideoClipDefinition = {
      id: clipId,
      ...clip,
      startTime
    };
    
    // Insert the clip
    clips.splice(position, 0, newClip);
    
    // Update the sequence
    const updatedSequence = this.updateSequence(sequenceId, {
      clips,
      totalDuration: this.calculateTotalDuration(clips),
      updated: new Date().toISOString()
    });
    
    if (updatedSequence) {
      this.emit('clip:added', { sequenceId, clipId, position });
      return newClip;
    }
    
    return undefined;
  }
  
  /**
   * Update a clip in a sequence
   */
  public updateClip(
    sequenceId: string,
    clipId: string,
    updates: Partial<Omit<VideoClipDefinition, 'id'>>
  ): VideoClipDefinition | undefined {
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      return undefined;
    }
    
    // Find the clip
    const clipIndex = sequence.clips.findIndex(c => c.id === clipId);
    
    if (clipIndex === -1) {
      return undefined;
    }
    
    const clips = [...sequence.clips];
    const oldClip = clips[clipIndex];
    
    // Apply updates
    const updatedClip = {
      ...oldClip,
      ...updates
    };
    
    // If duration changed, adjust subsequent clip start times
    if (updates.duration && updates.duration !== oldClip.duration) {
      const durationDiff = updates.duration - oldClip.duration;
      
      for (let i = clipIndex + 1; i < clips.length; i++) {
        clips[i].startTime += durationDiff;
      }
    }
    
    // Update the clip
    clips[clipIndex] = updatedClip;
    
    // Update the sequence
    const updatedSequence = this.updateSequence(sequenceId, {
      clips,
      totalDuration: this.calculateTotalDuration(clips),
      updated: new Date().toISOString()
    });
    
    if (updatedSequence) {
      this.emit('clip:updated', { sequenceId, clipId, clip: updatedClip });
      return updatedClip;
    }
    
    return undefined;
  }
  
  /**
   * Remove a clip from a sequence
   */
  public removeClip(
    sequenceId: string,
    clipId: string
  ): boolean {
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      return false;
    }
    
    // Find the clip
    const clipIndex = sequence.clips.findIndex(c => c.id === clipId);
    
    if (clipIndex === -1) {
      return false;
    }
    
    const clips = [...sequence.clips];
    const removedClip = clips[clipIndex];
    
    // Remove the clip
    clips.splice(clipIndex, 1);
    
    // Adjust start times of subsequent clips
    for (let i = clipIndex; i < clips.length; i++) {
      clips[i].startTime -= removedClip.duration;
    }
    
    // Update the sequence
    const updatedSequence = this.updateSequence(sequenceId, {
      clips,
      totalDuration: this.calculateTotalDuration(clips),
      updated: new Date().toISOString()
    });
    
    if (updatedSequence) {
      this.emit('clip:removed', { sequenceId, clipId });
      return true;
    }
    
    return false;
  }
  
  /**
   * Add an audio track to a sequence
   */
  public addAudioTrack(
    sequenceId: string,
    track: Omit<AudioTrackDefinition, 'id'>
  ): AudioTrackDefinition | undefined {
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      return undefined;
    }
    
    // Generate ID for the track
    const trackId = crypto.randomUUID();
    
    // Create the new track
    const newTrack: AudioTrackDefinition = {
      id: trackId,
      ...track
    };
    
    // Add the track
    const audioTracks = [...sequence.audioTracks, newTrack];
    
    // Update the sequence
    const updatedSequence = this.updateSequence(sequenceId, {
      audioTracks,
      updated: new Date().toISOString()
    });
    
    if (updatedSequence) {
      this.emit('audioTrack:added', { sequenceId, trackId });
      return newTrack;
    }
    
    return undefined;
  }
  
  /**
   * Add a subtitle to a sequence
   */
  public addSubtitle(
    sequenceId: string,
    subtitle: Omit<SubtitleDefinition, 'id'>
  ): SubtitleDefinition | undefined {
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      return undefined;
    }
    
    // Generate ID for the subtitle
    const subtitleId = crypto.randomUUID();
    
    // Create the new subtitle
    const newSubtitle: SubtitleDefinition = {
      id: subtitleId,
      ...subtitle
    };
    
    // Add the subtitle
    const subtitles = [...sequence.subtitles, newSubtitle];
    
    // Sort subtitles by start time
    subtitles.sort((a, b) => a.startTime - b.startTime);
    
    // Update the sequence
    const updatedSequence = this.updateSequence(sequenceId, {
      subtitles,
      updated: new Date().toISOString()
    });
    
    if (updatedSequence) {
      this.emit('subtitle:added', { sequenceId, subtitleId });
      return newSubtitle;
    }
    
    return undefined;
  }
  
  /**
   * Start rendering a sequence
   */
  public startRender(request: RenderRequest): Job | undefined {
    const sequence = this.sequences.get(request.sequenceId);
    
    if (!sequence) {
      return undefined;
    }
    
    // Create a render job
    const job = createJob('render-scene', {
      sequenceId: request.sequenceId,
      outputPath: request.outputPath,
      quality: request.quality,
      selectedClipIds: request.selectedClipIds,
      startTime: request.startTime,
      endTime: request.endTime,
      settings: request.settings
    }, {
      priority: request.quality === 'final' ? 'high' : 'medium',
      maxRetries: 2
    });
    
    // Store the job
    this.renderJobs.set(job.id, job);
    this.activeRenders.add(job.id);
    
    // Emit event
    this.emit('render:started', { 
      jobId: job.id, 
      sequenceId: request.sequenceId,
      outputPath: request.outputPath,
      quality: request.quality
    });
    
    // Start the render process
    this.processRenderJob(job.id);
    
    return job;
  }
  
  /**
   * Process a render job
   * This is a placeholder for the actual rendering logic
   */
  private async processRenderJob(jobId: string): Promise<void> {
    const job = this.renderJobs.get(jobId);
    
    if (!job) {
      return;
    }
    
    const sequenceId = job.params.sequenceId;
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      this.renderJobs.set(jobId, {
        ...job,
        status: 'failed',
        error_message: 'Sequence not found'
      });
      this.activeRenders.delete(jobId);
      
      this.emit('render:failed', { 
        jobId, 
        sequenceId, 
        error: 'Sequence not found' 
      });
      
      return;
    }
    
    // Placeholder for actual rendering logic
    // In a real implementation, this would use FFmpeg or a similar tool
    
    // Simulate rendering progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 5;
      
      this.emit('render:progress', {
        jobId,
        sequenceId,
        progress,
        stage: progress < 30 ? 'preparing' : progress < 80 ? 'rendering' : 'finalizing',
        currentClip: sequence.clips[Math.floor(progress / 100 * sequence.clips.length)]?.id
      } as RenderProgress);
      
      // When complete
      if (progress >= 100) {
        clearInterval(progressInterval);
        
        // Mark job as complete
        this.renderJobs.set(jobId, {
          ...job,
          status: 'completed',
          progress: 100,
          result: {
            output_url: job.params.outputPath,
            metadata: {
              duration: sequence.totalDuration,
              width: sequence.width,
              height: sequence.height,
              fps: sequence.fps,
              format: sequence.settings.format,
              quality: sequence.settings.quality
            }
          },
          completed_at: new Date().toISOString()
        });
        
        this.activeRenders.delete(jobId);
        
        this.emit('render:completed', { 
          jobId, 
          sequenceId, 
          outputPath: job.params.outputPath 
        });
      }
    }, 200);
    
    // In a real implementation, we would execute FFmpeg commands here
    // and stream the output to track progress
  }
  
  /**
   * Cancel a render job
   */
  public cancelRender(jobId: string): boolean {
    const job = this.renderJobs.get(jobId);
    
    if (!job || !this.activeRenders.has(jobId)) {
      return false;
    }
    
    // Mark job as cancelled
    this.renderJobs.set(jobId, {
      ...job,
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });
    
    this.activeRenders.delete(jobId);
    
    this.emit('render:cancelled', { 
      jobId, 
      sequenceId: job.params.sequenceId 
    });
    
    return true;
  }
  
  /**
   * Calculate the total duration of a sequence from its clips
   */
  private calculateTotalDuration(clips: VideoClipDefinition[]): number {
    if (clips.length === 0) {
      return 0;
    }
    
    // Find the clip that ends latest
    const lastEndTime = clips.reduce((maxEnd, clip) => {
      const clipEnd = clip.startTime + clip.duration;
      return clipEnd > maxEnd ? clipEnd : maxEnd;
    }, 0);
    
    return lastEndTime;
  }
  
  /**
   * Export a sequence definition to a JSON representation
   */
  public exportSequence(sequenceId: string): string {
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      throw new Error(`Sequence not found: ${sequenceId}`);
    }
    
    return JSON.stringify(sequence, null, 2);
  }
  
  /**
   * Import a sequence from a JSON representation
   */
  public importSequence(json: string): VideoSequence {
    try {
      const sequence = JSON.parse(json) as VideoSequence;
      
      // Generate a new ID for the imported sequence
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Create a new sequence with the imported data
      const importedSequence: VideoSequence = {
        ...sequence,
        id: newId,
        created: now,
        updated: now
      };
      
      // Store the sequence
      this.sequences.set(newId, importedSequence);
      
      this.emit('sequence:imported', { id: newId, name: importedSequence.name });
      
      return importedSequence;
    } catch (error) {
      throw new Error(`Failed to import sequence: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Delete a sequence
   */
  public deleteSequence(sequenceId: string): boolean {
    const sequence = this.sequences.get(sequenceId);
    
    if (!sequence) {
      return false;
    }
    
    // Check if there are any active renders for this sequence
    const activeRenders = Array.from(this.activeRenders)
      .filter(jobId => {
        const job = this.renderJobs.get(jobId);
        return job && job.params.sequenceId === sequenceId;
      });
    
    if (activeRenders.length > 0) {
      throw new Error(`Cannot delete sequence with active renders: ${activeRenders.join(', ')}`);
    }
    
    // Delete the sequence
    this.sequences.delete(sequenceId);
    
    this.emit('sequence:deleted', { id: sequenceId });
    
    return true;
  }
}