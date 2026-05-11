import { BrowserEventEmitter } from '../../lib/BrowserEventEmitter';
import { VideoSequence, VideoClipDefinition, AudioTrackDefinition, SubtitleDefinition } from './VideoSequencer';
import { Asset } from '../../domain/assets/entities/Asset';
import { AssetIndexer, IndexedAsset } from '../comfyui/assets/assetIndexer';

export interface TimelineElement {
  id: string;
  type: 'clip' | 'audio' | 'subtitle' | 'transition' | 'effect' | 'marker';
  startTime: number; // in seconds from start of timeline
  duration: number; // in seconds
  endTime: number; // calculated from startTime + duration
  locked?: boolean; // if true, cannot be moved or edited
  visible?: boolean; // if false, will not be rendered but still affects timeline
  data: any; // type-specific data
}

export interface TimelineClip extends TimelineElement {
  type: 'clip';
  data: VideoClipDefinition;
  trackId: string;
  transitions?: {
    in?: string; // ID of incoming transition
    out?: string; // ID of outgoing transition
  };
}

export interface TimelineAudio extends TimelineElement {
  type: 'audio';
  data: AudioTrackDefinition;
  trackId: string;
}

export interface TimelineSubtitle extends TimelineElement {
  type: 'subtitle';
  data: SubtitleDefinition;
  trackId: string;
}

export interface TimelineTransition extends TimelineElement {
  type: 'transition';
  data: {
    type: 'cut' | 'crossfade' | 'fade' | 'wipe' | 'push' | 'slide' | 'custom';
    fromClipId: string;
    toClipId: string;
    params?: Record<string, any>;
  };
}

export interface TimelineEffect extends TimelineElement {
  type: 'effect';
  data: {
    type: string;
    params: Record<string, any>;
    targetId: string; // ID of target element
  };
}

export interface TimelineMarker extends TimelineElement {
  type: 'marker';
  data: {
    name: string;
    color?: string;
    notes?: string;
  };
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle' | 'effects';
  index: number; // order in the track list
  locked?: boolean;
  visible?: boolean;
  color?: string;
  height?: number; // in pixels
  collapsed?: boolean;
  elements: TimelineElement[];
}

export interface CinematicTimeline {
  id: string;
  name: string;
  description?: string;
  sequenceId: string; // reference to the VideoSequence
  duration: number;
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  created: string;
  updated: string;
  settings: {
    frameRate: number;
    width: number;
    height: number;
    audioChannels: number;
    audioSampleRate: number;
  };
  metadata?: Record<string, any>;
}

export interface TimelinePlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  inPoint?: number;
  outPoint?: number;
  looping: boolean;
  selectedElementIds: string[];
}

export interface TimelineElementChange {
  id: string;
  type: 'move' | 'resize' | 'split' | 'merge' | 'add' | 'remove' | 'update';
  before: Partial<TimelineElement>;
  after: Partial<TimelineElement>;
}

/**
 * Service for managing cinematic timeline operations
 * 
 * This service provides functionality for creating and editing 
 * cinematic timelines, including clips, audio, effects, and transitions.
 */
export class TimelineEngine extends BrowserEventEmitter {
  // Make timelines property public for demo purposes
  // In a production app, this would be private with proper accessor methods
  public timelines: Map<string, CinematicTimeline> = new Map();
  private playbackStates: Map<string, TimelinePlaybackState> = new Map();
  private undoStacks: Map<string, TimelineElementChange[][]> = new Map();
  private redoStacks: Map<string, TimelineElementChange[][]> = new Map();
  private playbackIntervals: Map<string, any> = new Map();
  private assetIndexer: AssetIndexer | null = null;
  
  constructor(assetIndexer?: AssetIndexer) {
    super();
    this.assetIndexer = assetIndexer || null;
  }
  
  /**
   * Connect to an asset indexer service
   */
  public connectAssetIndexer(assetIndexer: AssetIndexer): void {
    this.assetIndexer = assetIndexer;
  }
  
  /**
   * Create a new timeline
   */
  public createTimeline(
    name: string,
    sequenceId: string,
    settings: Partial<CinematicTimeline['settings']> = {},
    metadata?: Record<string, any>
  ): CinematicTimeline {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Create default tracks
    const videoTrack: TimelineTrack = {
      id: crypto.randomUUID(),
      name: 'Video 1',
      type: 'video',
      index: 0,
      elements: []
    };
    
    const audioTrack: TimelineTrack = {
      id: crypto.randomUUID(),
      name: 'Audio 1',
      type: 'audio',
      index: 1,
      elements: []
    };
    
    const subtitleTrack: TimelineTrack = {
      id: crypto.randomUUID(),
      name: 'Subtitles',
      type: 'subtitle',
      index: 2,
      elements: []
    };
    
    // Create the timeline
    const timeline: CinematicTimeline = {
      id,
      name,
      sequenceId,
      duration: 0,
      tracks: [videoTrack, audioTrack, subtitleTrack],
      markers: [],
      created: now,
      updated: now,
      settings: {
        frameRate: settings.frameRate || 24,
        width: settings.width || 1920,
        height: settings.height || 1080,
        audioChannels: settings.audioChannels || 2,
        audioSampleRate: settings.audioSampleRate || 48000,
        ...settings
      },
      metadata: metadata || {}
    };
    
    // Store the timeline
    this.timelines.set(id, timeline);
    
    // Create empty undo/redo stacks
    this.undoStacks.set(id, []);
    this.redoStacks.set(id, []);
    
    // Create initial playback state
    this.playbackStates.set(id, {
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1,
      looping: false,
      selectedElementIds: []
    });
    
    this.emit('timeline:created', { id, name });
    
    return timeline;
  }
  
  /**
   * Get a timeline by ID
   */
  public getTimeline(id: string): CinematicTimeline | undefined {
    return this.timelines.get(id);
  }
  
  /**
   * Update a timeline
   */
  public updateTimeline(
    id: string,
    updates: Partial<Omit<CinematicTimeline, 'id' | 'created'>>
  ): CinematicTimeline | undefined {
    const timeline = this.timelines.get(id);
    
    if (!timeline) {
      return undefined;
    }
    
    // Apply updates
    const updatedTimeline = {
      ...timeline,
      ...updates,
      updated: new Date().toISOString()
    };
    
    // Store the timeline
    this.timelines.set(id, updatedTimeline);
    
    this.emit('timeline:updated', { id, timeline: updatedTimeline });
    
    return updatedTimeline;
  }
  
  /**
   * Add a track to a timeline
   */
  public addTrack(
    timelineId: string,
    trackType: TimelineTrack['type'],
    name?: string
  ): TimelineTrack | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the highest track index
    const highestIndex = timeline.tracks.reduce((max, track) => 
      track.index > max ? track.index : max, -1);
    
    // Create the new track
    const track: TimelineTrack = {
      id: crypto.randomUUID(),
      name: name || `${trackType.charAt(0).toUpperCase() + trackType.slice(1)} ${timeline.tracks.filter(t => t.type === trackType).length + 1}`,
      type: trackType,
      index: highestIndex + 1,
      elements: []
    };
    
    // Add the track
    const tracks = [...timeline.tracks, track];
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      this.emit('track:added', { timelineId, trackId: track.id, type: trackType });
      return track;
    }
    
    return undefined;
  }
  
  /**
   * Add a clip to a timeline track
   */
  public addClip(
    timelineId: string,
    trackId: string,
    clipData: VideoClipDefinition,
    startTime: number
  ): TimelineClip | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the track
    const trackIndex = timeline.tracks.findIndex(t => t.id === trackId);
    
    if (trackIndex === -1) {
      return undefined;
    }
    
    // Create the clip element
    const clipElement: TimelineClip = {
      id: crypto.randomUUID(),
      type: 'clip',
      startTime,
      duration: clipData.duration,
      endTime: startTime + clipData.duration,
      trackId,
      data: clipData
    };
    
    // Record the state for undo
    const change: TimelineElementChange = {
      id: clipElement.id,
      type: 'add',
      before: {},
      after: clipElement
    };
    
    // Add the element to the track
    const tracks = [...timeline.tracks];
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      elements: [...tracks[trackIndex].elements, clipElement]
    };
    
    // Update the timeline duration if needed
    const newDuration = Math.max(timeline.duration, clipElement.endTime);
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      duration: newDuration,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, [change]);
      
      this.emit('element:added', { 
        timelineId, 
        trackId, 
        elementId: clipElement.id,
        type: 'clip' 
      });
      
      return clipElement;
    }
    
    return undefined;
  }
  
  /**
   * Add an audio track to the timeline
   */
  public addAudio(
    timelineId: string,
    trackId: string,
    audioData: AudioTrackDefinition,
    startTime: number
  ): TimelineAudio | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the track
    const trackIndex = timeline.tracks.findIndex(t => t.id === trackId);
    
    if (trackIndex === -1) {
      return undefined;
    }
    
    // Create the audio element
    const audioElement: TimelineAudio = {
      id: crypto.randomUUID(),
      type: 'audio',
      startTime,
      duration: audioData.duration,
      endTime: startTime + audioData.duration,
      trackId,
      data: audioData
    };
    
    // Record the state for undo
    const change: TimelineElementChange = {
      id: audioElement.id,
      type: 'add',
      before: {},
      after: audioElement
    };
    
    // Add the element to the track
    const tracks = [...timeline.tracks];
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      elements: [...tracks[trackIndex].elements, audioElement]
    };
    
    // Update the timeline duration if needed
    const newDuration = Math.max(timeline.duration, audioElement.endTime);
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      duration: newDuration,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, [change]);
      
      this.emit('element:added', { 
        timelineId, 
        trackId, 
        elementId: audioElement.id,
        type: 'audio' 
      });
      
      return audioElement;
    }
    
    return undefined;
  }
  
  /**
   * Add a subtitle to the timeline
   */
  public addSubtitle(
    timelineId: string,
    trackId: string,
    subtitleData: SubtitleDefinition
  ): TimelineSubtitle | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the track
    const trackIndex = timeline.tracks.findIndex(t => t.id === trackId);
    
    if (trackIndex === -1) {
      return undefined;
    }
    
    // Create the subtitle element
    const subtitleElement: TimelineSubtitle = {
      id: crypto.randomUUID(),
      type: 'subtitle',
      startTime: subtitleData.startTime,
      duration: subtitleData.endTime - subtitleData.startTime,
      endTime: subtitleData.endTime,
      trackId,
      data: subtitleData
    };
    
    // Record the state for undo
    const change: TimelineElementChange = {
      id: subtitleElement.id,
      type: 'add',
      before: {},
      after: subtitleElement
    };
    
    // Add the element to the track
    const tracks = [...timeline.tracks];
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      elements: [...tracks[trackIndex].elements, subtitleElement]
    };
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, [change]);
      
      this.emit('element:added', { 
        timelineId, 
        trackId, 
        elementId: subtitleElement.id,
        type: 'subtitle' 
      });
      
      return subtitleElement;
    }
    
    return undefined;
  }
  
  /**
   * Add a transition between two clips
   */
  public addTransition(
    timelineId: string,
    fromClipId: string,
    toClipId: string,
    type: TimelineTransition['data']['type'],
    duration: number,
    params?: Record<string, any>
  ): TimelineTransition | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the clips
    let fromClip: TimelineClip | undefined;
    let toClip: TimelineClip | undefined;
    let fromTrackIndex = -1;
    let fromClipIndex = -1;
    let toTrackIndex = -1;
    let toClipIndex = -1;
    
    for (let i = 0; i < timeline.tracks.length; i++) {
      const track = timeline.tracks[i];
      
      for (let j = 0; j < track.elements.length; j++) {
        const element = track.elements[j];
        
        if (element.type === 'clip') {
          if (element.id === fromClipId) {
            fromClip = element as TimelineClip;
            fromTrackIndex = i;
            fromClipIndex = j;
          } else if (element.id === toClipId) {
            toClip = element as TimelineClip;
            toTrackIndex = i;
            toClipIndex = j;
          }
        }
      }
    }
    
    if (!fromClip || !toClip) {
      return undefined;
    }
    
    // Ensure clips are adjacent or overlapping
    if (fromClip.endTime < toClip.startTime || toClip.endTime < fromClip.startTime) {
      throw new Error('Clips must be adjacent or overlapping to add a transition');
    }
    
    // Create the transition element
    const transitionElement: TimelineTransition = {
      id: crypto.randomUUID(),
      type: 'transition',
      startTime: Math.max(fromClip.endTime - duration / 2, toClip.startTime - duration / 2),
      duration,
      endTime: Math.min(fromClip.endTime + duration / 2, toClip.startTime + duration / 2),
      data: {
        type,
        fromClipId,
        toClipId,
        params
      }
    };
    
    // Record the state for undo
    const changes: TimelineElementChange[] = [
      {
        id: transitionElement.id,
        type: 'add',
        before: {},
        after: transitionElement
      }
    ];
    
    // Update the from clip
    const updatedFromClip: TimelineClip = {
      ...fromClip,
      transitions: {
        ...(fromClip.transitions || {}),
        out: transitionElement.id
      }
    };
    
    changes.push({
      id: fromClipId,
      type: 'update',
      before: { transitions: fromClip.transitions },
      after: { transitions: updatedFromClip.transitions }
    });
    
    // Update the to clip
    const updatedToClip: TimelineClip = {
      ...toClip,
      transitions: {
        ...(toClip.transitions || {}),
        in: transitionElement.id
      }
    };
    
    changes.push({
      id: toClipId,
      type: 'update',
      before: { transitions: toClip.transitions },
      after: { transitions: updatedToClip.transitions }
    });
    
    // Update the clips in the tracks
    const tracks = [...timeline.tracks];
    
    tracks[fromTrackIndex] = {
      ...tracks[fromTrackIndex],
      elements: [
        ...tracks[fromTrackIndex].elements.slice(0, fromClipIndex),
        updatedFromClip,
        ...tracks[fromTrackIndex].elements.slice(fromClipIndex + 1)
      ]
    };
    
    if (fromTrackIndex === toTrackIndex) {
      // If the clips are on the same track, we need to make sure we're updating the right index
      // since we just modified the elements array
      const adjustedToClipIndex = toClipIndex > fromClipIndex 
        ? toClipIndex // If toClip is after fromClip, index is still valid
        : toClipIndex; // If toClip is before fromClip, index is still valid
      
      tracks[toTrackIndex] = {
        ...tracks[toTrackIndex],
        elements: [
          ...tracks[toTrackIndex].elements.slice(0, adjustedToClipIndex),
          updatedToClip,
          ...tracks[toTrackIndex].elements.slice(adjustedToClipIndex + 1)
        ]
      };
    } else {
      // If the clips are on different tracks
      tracks[toTrackIndex] = {
        ...tracks[toTrackIndex],
        elements: [
          ...tracks[toTrackIndex].elements.slice(0, toClipIndex),
          updatedToClip,
          ...tracks[toTrackIndex].elements.slice(toClipIndex + 1)
        ]
      };
    }
    
    // Find or create a transitions track
    let transitionsTrackIndex = tracks.findIndex(t => t.type === 'effects');
    
    if (transitionsTrackIndex === -1) {
      // Create a new transitions track
      const transitionsTrack: TimelineTrack = {
        id: crypto.randomUUID(),
        name: 'Effects',
        type: 'effects',
        index: tracks.length,
        elements: [transitionElement]
      };
      
      tracks.push(transitionsTrack);
    } else {
      // Add to existing transitions track
      tracks[transitionsTrackIndex] = {
        ...tracks[transitionsTrackIndex],
        elements: [...tracks[transitionsTrackIndex].elements, transitionElement]
      };
    }
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, changes);
      
      this.emit('transition:added', { 
        timelineId, 
        transitionId: transitionElement.id,
        fromClipId,
        toClipId
      });
      
      return transitionElement;
    }
    
    return undefined;
  }
  
  /**
   * Add a marker to the timeline
   */
  public addMarker(
    timelineId: string,
    time: number,
    name: string,
    options?: {
      color?: string;
      notes?: string;
      duration?: number;
    }
  ): TimelineMarker | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Create the marker
    const marker: TimelineMarker = {
      id: crypto.randomUUID(),
      type: 'marker',
      startTime: time,
      duration: options?.duration || 0,
      endTime: time + (options?.duration || 0),
      data: {
        name,
        color: options?.color,
        notes: options?.notes
      }
    };
    
    // Record the state for undo
    const change: TimelineElementChange = {
      id: marker.id,
      type: 'add',
      before: {},
      after: marker
    };
    
    // Add the marker
    const markers = [...timeline.markers, marker];
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      markers,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, [change]);
      
      this.emit('marker:added', { 
        timelineId, 
        markerId: marker.id,
        time
      });
      
      return marker;
    }
    
    return undefined;
  }
  
  /**
   * Move a timeline element
   */
  public moveElement(
    timelineId: string,
    elementId: string,
    newStartTime: number,
    newTrackId?: string
  ): TimelineElement | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the element
    let element: TimelineElement | undefined;
    let trackIndex = -1;
    let elementIndex = -1;
    
    for (let i = 0; i < timeline.tracks.length; i++) {
      const track = timeline.tracks[i];
      
      for (let j = 0; j < track.elements.length; j++) {
        const el = track.elements[j];
        
        if (el.id === elementId) {
          element = el;
          trackIndex = i;
          elementIndex = j;
          break;
        }
      }
      
      if (element) break;
    }
    
    if (!element || trackIndex === -1) {
      return undefined;
    }
    
    // Calculate the new end time
    const newEndTime = newStartTime + element.duration;
    
    // Record the state for undo
    const change: TimelineElementChange = {
      id: elementId,
      type: 'move',
      before: { 
        startTime: element.startTime,
        endTime: element.endTime,
        trackId: 'trackId' in element ? element.trackId : undefined
      },
      after: { 
        startTime: newStartTime,
        endTime: newEndTime,
        trackId: newTrackId || ('trackId' in element ? element.trackId : undefined)
      }
    };
    
    // Update the element
    const updatedElement = {
      ...element,
      startTime: newStartTime,
      endTime: newEndTime,
      ...(newTrackId && 'trackId' in element ? { trackId: newTrackId } : {})
    };
    
    // If we're moving to a different track
    if (newTrackId && 'trackId' in element && newTrackId !== element.trackId) {
      // Find the new track
      const newTrackIndex = timeline.tracks.findIndex(t => t.id === newTrackId);
      
      if (newTrackIndex === -1) {
        return undefined;
      }
      
      // Remove from old track
      const tracks = [...timeline.tracks];
      tracks[trackIndex] = {
        ...tracks[trackIndex],
        elements: [
          ...tracks[trackIndex].elements.slice(0, elementIndex),
          ...tracks[trackIndex].elements.slice(elementIndex + 1)
        ]
      };
      
      // Add to new track
      tracks[newTrackIndex] = {
        ...tracks[newTrackIndex],
        elements: [...tracks[newTrackIndex].elements, updatedElement]
      };
      
      // Update the timeline
      const updatedTimeline = this.updateTimeline(timelineId, {
        tracks,
        updated: new Date().toISOString()
      });
      
      if (updatedTimeline) {
        // Add to undo stack
        this.addToUndoStack(timelineId, [change]);
        
        this.emit('element:moved', { 
          timelineId, 
          elementId,
          fromTrackId: element.trackId,
          toTrackId: newTrackId,
          startTime: newStartTime
        });
        
        return updatedElement;
      }
    } else {
      // Update in the same track
      const tracks = [...timeline.tracks];
      tracks[trackIndex] = {
        ...tracks[trackIndex],
        elements: [
          ...tracks[trackIndex].elements.slice(0, elementIndex),
          updatedElement,
          ...tracks[trackIndex].elements.slice(elementIndex + 1)
        ]
      };
      
      // Update the timeline
      const updatedTimeline = this.updateTimeline(timelineId, {
        tracks,
        updated: new Date().toISOString()
      });
      
      if (updatedTimeline) {
        // Add to undo stack
        this.addToUndoStack(timelineId, [change]);
        
        this.emit('element:moved', { 
          timelineId, 
          elementId,
          fromTrackId: 'trackId' in element ? element.trackId : undefined,
          toTrackId: 'trackId' in element ? element.trackId : undefined,
          startTime: newStartTime
        });
        
        return updatedElement;
      }
    }
    
    return undefined;
  }
  
  /**
   * Resize a timeline element
   */
  public resizeElement(
    timelineId: string,
    elementId: string,
    newDuration: number,
    fromStart: boolean = false
  ): TimelineElement | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the element
    let element: TimelineElement | undefined;
    let trackIndex = -1;
    let elementIndex = -1;
    
    for (let i = 0; i < timeline.tracks.length; i++) {
      const track = timeline.tracks[i];
      
      for (let j = 0; j < track.elements.length; j++) {
        const el = track.elements[j];
        
        if (el.id === elementId) {
          element = el;
          trackIndex = i;
          elementIndex = j;
          break;
        }
      }
      
      if (element) break;
    }
    
    if (!element || trackIndex === -1) {
      return undefined;
    }
    
    // Calculate the new start and end times
    let newStartTime = element.startTime;
    let newEndTime = element.endTime;
    
    if (fromStart) {
      newStartTime = element.endTime - newDuration;
    } else {
      newEndTime = element.startTime + newDuration;
    }
    
    // Record the state for undo
    const change: TimelineElementChange = {
      id: elementId,
      type: 'resize',
      before: { 
        startTime: element.startTime,
        duration: element.duration,
        endTime: element.endTime 
      },
      after: { 
        startTime: newStartTime,
        duration: newDuration,
        endTime: newEndTime 
      }
    };
    
    // Update the element
    const updatedElement = {
      ...element,
      startTime: newStartTime,
      duration: newDuration,
      endTime: newEndTime
    };
    
    // Update the track
    const tracks = [...timeline.tracks];
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      elements: [
        ...tracks[trackIndex].elements.slice(0, elementIndex),
        updatedElement,
        ...tracks[trackIndex].elements.slice(elementIndex + 1)
      ]
    };
    
    // Update the timeline duration if needed
    const newTimelineDuration = Math.max(
      ...tracks.flatMap(track => 
        track.elements.map(el => el.endTime)
      ),
      0
    );
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      duration: newTimelineDuration,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, [change]);
      
      this.emit('element:resized', { 
        timelineId, 
        elementId,
        duration: newDuration,
        fromStart
      });
      
      return updatedElement;
    }
    
    return undefined;
  }
  
  /**
   * Split a timeline element at the specified time
   */
  public splitElement(
    timelineId: string,
    elementId: string,
    splitTime: number
  ): { left: TimelineElement, right: TimelineElement } | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the element
    let element: TimelineElement | undefined;
    let trackIndex = -1;
    let elementIndex = -1;
    
    for (let i = 0; i < timeline.tracks.length; i++) {
      const track = timeline.tracks[i];
      
      for (let j = 0; j < track.elements.length; j++) {
        const el = track.elements[j];
        
        if (el.id === elementId) {
          element = el;
          trackIndex = i;
          elementIndex = j;
          break;
        }
      }
      
      if (element) break;
    }
    
    if (!element || trackIndex === -1) {
      return undefined;
    }
    
    // Ensure split time is within the element
    if (splitTime <= element.startTime || splitTime >= element.endTime) {
      throw new Error('Split time must be within the element duration');
    }
    
    // Create the left element (original)
    const leftDuration = splitTime - element.startTime;
    const leftElement = {
      ...element,
      duration: leftDuration,
      endTime: splitTime
    };
    
    // Create the right element (new)
    const rightId = crypto.randomUUID();
    const rightDuration = element.endTime - splitTime;
    
    // For type-specific cloning
    let rightElement: TimelineElement;
    
    if (element.type === 'clip') {
      const clipElement = element as TimelineClip;
      
      // Clone the clip data with adjusted timing
      const rightClipData = {
        ...clipElement.data,
        startTime: clipElement.data.startTime + leftDuration
      };
      
      rightElement = {
        ...clipElement,
        id: rightId,
        startTime: splitTime,
        duration: rightDuration,
        endTime: element.endTime,
        data: rightClipData
      };
    } else if (element.type === 'audio') {
      const audioElement = element as TimelineAudio;
      
      // Clone the audio data with adjusted timing
      const rightAudioData = {
        ...audioElement.data,
        startTime: audioElement.data.startTime + leftDuration
      };
      
      rightElement = {
        ...audioElement,
        id: rightId,
        startTime: splitTime,
        duration: rightDuration,
        endTime: element.endTime,
        data: rightAudioData
      };
    } else if (element.type === 'subtitle') {
      const subtitleElement = element as TimelineSubtitle;
      
      // Clone the subtitle data with adjusted timing
      const rightSubtitleData = {
        ...subtitleElement.data,
        startTime: splitTime,
        endTime: element.endTime
      };
      
      rightElement = {
        ...subtitleElement,
        id: rightId,
        startTime: splitTime,
        duration: rightDuration,
        endTime: element.endTime,
        data: rightSubtitleData
      };
    } else {
      // Generic split for other element types
      rightElement = {
        ...element,
        id: rightId,
        startTime: splitTime,
        duration: rightDuration,
        endTime: element.endTime
      };
    }
    
    // Record the state for undo
    const changes: TimelineElementChange[] = [
      {
        id: elementId,
        type: 'split',
        before: { 
          duration: element.duration,
          endTime: element.endTime 
        },
        after: { 
          duration: leftDuration,
          endTime: splitTime 
        }
      },
      {
        id: rightId,
        type: 'add',
        before: {},
        after: rightElement
      }
    ];
    
    // Update the track
    const tracks = [...timeline.tracks];
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      elements: [
        ...tracks[trackIndex].elements.slice(0, elementIndex),
        leftElement,
        rightElement,
        ...tracks[trackIndex].elements.slice(elementIndex + 1)
      ]
    };
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, changes);
      
      this.emit('element:split', { 
        timelineId, 
        originalElementId: elementId,
        leftElementId: elementId,
        rightElementId: rightId,
        splitTime
      });
      
      return { 
        left: leftElement, 
        right: rightElement 
      };
    }
    
    return undefined;
  }
  
  /**
   * Delete an element from the timeline
   */
  public deleteElement(
    timelineId: string,
    elementId: string
  ): boolean {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return false;
    }
    
    // Find the element
    let element: TimelineElement | undefined;
    let trackIndex = -1;
    let elementIndex = -1;
    
    // First check tracks
    for (let i = 0; i < timeline.tracks.length; i++) {
      const track = timeline.tracks[i];
      
      for (let j = 0; j < track.elements.length; j++) {
        const el = track.elements[j];
        
        if (el.id === elementId) {
          element = el;
          trackIndex = i;
          elementIndex = j;
          break;
        }
      }
      
      if (element) break;
    }
    
    // If not found in tracks, check markers
    if (!element) {
      const markerIndex = timeline.markers.findIndex(m => m.id === elementId);
      
      if (markerIndex !== -1) {
        const marker = timeline.markers[markerIndex];
        
        // Record the state for undo
        const change: TimelineElementChange = {
          id: elementId,
          type: 'remove',
          before: marker,
          after: {}
        };
        
        // Remove the marker
        const markers = [
          ...timeline.markers.slice(0, markerIndex),
          ...timeline.markers.slice(markerIndex + 1)
        ];
        
        // Update the timeline
        const updatedTimeline = this.updateTimeline(timelineId, {
          markers,
          updated: new Date().toISOString()
        });
        
        if (updatedTimeline) {
          // Add to undo stack
          this.addToUndoStack(timelineId, [change]);
          
          this.emit('marker:removed', { 
            timelineId, 
            markerId: elementId
          });
          
          return true;
        }
        
        return false;
      }
      
      return false;
    }
    
    // Record the state for undo
    const change: TimelineElementChange = {
      id: elementId,
      type: 'remove',
      before: element,
      after: {}
    };
    
    // Handle transitions if this is a clip
    let additionalChanges: TimelineElementChange[] = [];
    
    if (element.type === 'clip') {
      const clipElement = element as TimelineClip;
      
      if (clipElement.transitions) {
        // If this clip has transitions, remove them
        if (clipElement.transitions.in) {
          const removedTransition = this.findTransition(timeline, clipElement.transitions.in);
          
          if (removedTransition) {
            additionalChanges.push({
              id: clipElement.transitions.in,
              type: 'remove',
              before: removedTransition,
              after: {}
            });
            
            // Also update the other clip connected to this transition
            const otherClipId = removedTransition.data.fromClipId === elementId
              ? removedTransition.data.toClipId
              : removedTransition.data.fromClipId;
            
            const otherClip = this.findClip(timeline, otherClipId);
            
            if (otherClip) {
              const transitionType = removedTransition.data.fromClipId === elementId
                ? 'in'
                : 'out';
              
              const updatedTransitions = { ...otherClip.transitions };
              delete updatedTransitions[transitionType];
              
              additionalChanges.push({
                id: otherClipId,
                type: 'update',
                before: { transitions: otherClip.transitions },
                after: { transitions: updatedTransitions }
              });
              
              // Find and update the other clip
              for (let i = 0; i < timeline.tracks.length; i++) {
                const track = timeline.tracks[i];
                const clipIndex = track.elements.findIndex(el => 
                  el.type === 'clip' && el.id === otherClipId
                );
                
                if (clipIndex !== -1) {
                  const updatedTracks = [...timeline.tracks];
                  const updatedElements = [...track.elements];
                  
                  updatedElements[clipIndex] = {
                    ...updatedElements[clipIndex] as TimelineClip,
                    transitions: updatedTransitions
                  };
                  
                  updatedTracks[i] = {
                    ...updatedTracks[i],
                    elements: updatedElements
                  };
                  
                  // Update the timeline with the modified other clip
                  this.updateTimeline(timelineId, {
                    tracks: updatedTracks,
                    updated: new Date().toISOString()
                  });
                  
                  break;
                }
              }
            }
          }
        }
        
        if (clipElement.transitions.out) {
          // Similar logic for outgoing transition
          const removedTransition = this.findTransition(timeline, clipElement.transitions.out);
          
          if (removedTransition) {
            additionalChanges.push({
              id: clipElement.transitions.out,
              type: 'remove',
              before: removedTransition,
              after: {}
            });
            
            // Update the other clip
            // (Similar logic as above)
            const otherClipId = removedTransition.data.fromClipId === elementId
              ? removedTransition.data.toClipId
              : removedTransition.data.fromClipId;
            
            const otherClip = this.findClip(timeline, otherClipId);
            
            if (otherClip) {
              const transitionType = removedTransition.data.fromClipId === elementId
                ? 'out'
                : 'in';
              
              const updatedTransitions = { ...otherClip.transitions };
              delete updatedTransitions[transitionType];
              
              additionalChanges.push({
                id: otherClipId,
                type: 'update',
                before: { transitions: otherClip.transitions },
                after: { transitions: updatedTransitions }
              });
              
              // Find and update the other clip
              for (let i = 0; i < timeline.tracks.length; i++) {
                const track = timeline.tracks[i];
                const clipIndex = track.elements.findIndex(el => 
                  el.type === 'clip' && el.id === otherClipId
                );
                
                if (clipIndex !== -1) {
                  const updatedTracks = [...timeline.tracks];
                  const updatedElements = [...track.elements];
                  
                  updatedElements[clipIndex] = {
                    ...updatedElements[clipIndex] as TimelineClip,
                    transitions: updatedTransitions
                  };
                  
                  updatedTracks[i] = {
                    ...updatedTracks[i],
                    elements: updatedElements
                  };
                  
                  // Update the timeline with the modified other clip
                  this.updateTimeline(timelineId, {
                    tracks: updatedTracks,
                    updated: new Date().toISOString()
                  });
                  
                  break;
                }
              }
            }
          }
        }
        
        // Remove the transitions from the timeline
        for (const transitionId of [clipElement.transitions.in, clipElement.transitions.out]) {
          if (!transitionId) continue;
          
          // Find the transition and remove it
          for (let i = 0; i < timeline.tracks.length; i++) {
            const track = timeline.tracks[i];
            
            const transitionIndex = track.elements.findIndex(el => 
              el.id === transitionId
            );
            
            if (transitionIndex !== -1) {
              const updatedTracks = [...timeline.tracks];
              
              updatedTracks[i] = {
                ...updatedTracks[i],
                elements: [
                  ...track.elements.slice(0, transitionIndex),
                  ...track.elements.slice(transitionIndex + 1)
                ]
              };
              
              // Update the timeline without transitions
              this.updateTimeline(timelineId, {
                tracks: updatedTracks,
                updated: new Date().toISOString()
              });
              
              break;
            }
          }
        }
      }
    } else if (element.type === 'transition') {
      // If we're deleting a transition, update the connected clips
      const transitionElement = element as TimelineTransition;
      
      const fromClip = this.findClip(timeline, transitionElement.data.fromClipId);
      const toClip = this.findClip(timeline, transitionElement.data.toClipId);
      
      if (fromClip) {
        const updatedFromTransitions = { ...fromClip.transitions };
        delete updatedFromTransitions.out;
        
        additionalChanges.push({
          id: fromClip.id,
          type: 'update',
          before: { transitions: fromClip.transitions },
          after: { transitions: updatedFromTransitions }
        });
        
        // Find and update the from clip
        for (let i = 0; i < timeline.tracks.length; i++) {
          const track = timeline.tracks[i];
          const clipIndex = track.elements.findIndex(el => 
            el.id === fromClip.id
          );
          
          if (clipIndex !== -1) {
            const updatedTracks = [...timeline.tracks];
            const updatedElements = [...track.elements];
            
            updatedElements[clipIndex] = {
              ...updatedElements[clipIndex] as TimelineClip,
              transitions: updatedFromTransitions
            };
            
            updatedTracks[i] = {
              ...updatedTracks[i],
              elements: updatedElements
            };
            
            // Update the timeline with the modified from clip
            this.updateTimeline(timelineId, {
              tracks: updatedTracks,
              updated: new Date().toISOString()
            });
            
            break;
          }
        }
      }
      
      if (toClip) {
        const updatedToTransitions = { ...toClip.transitions };
        delete updatedToTransitions.in;
        
        additionalChanges.push({
          id: toClip.id,
          type: 'update',
          before: { transitions: toClip.transitions },
          after: { transitions: updatedToTransitions }
        });
        
        // Find and update the to clip
        for (let i = 0; i < timeline.tracks.length; i++) {
          const track = timeline.tracks[i];
          const clipIndex = track.elements.findIndex(el => 
            el.id === toClip.id
          );
          
          if (clipIndex !== -1) {
            const updatedTracks = [...timeline.tracks];
            const updatedElements = [...track.elements];
            
            updatedElements[clipIndex] = {
              ...updatedElements[clipIndex] as TimelineClip,
              transitions: updatedToTransitions
            };
            
            updatedTracks[i] = {
              ...updatedTracks[i],
              elements: updatedElements
            };
            
            // Update the timeline with the modified to clip
            this.updateTimeline(timelineId, {
              tracks: updatedTracks,
              updated: new Date().toISOString()
            });
            
            break;
          }
        }
      }
    }
    
    // Remove the element from the track
    const tracks = [...timeline.tracks];
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      elements: [
        ...tracks[trackIndex].elements.slice(0, elementIndex),
        ...tracks[trackIndex].elements.slice(elementIndex + 1)
      ]
    };
    
    // Update the timeline
    const updatedTimeline = this.updateTimeline(timelineId, {
      tracks,
      updated: new Date().toISOString()
    });
    
    if (updatedTimeline) {
      // Add to undo stack
      this.addToUndoStack(timelineId, [change, ...additionalChanges]);
      
      this.emit('element:removed', { 
        timelineId, 
        elementId,
        trackId: 'trackId' in element ? element.trackId : undefined,
        type: element.type
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Find a clip in a timeline
   */
  private findClip(
    timeline: CinematicTimeline,
    clipId: string
  ): TimelineClip | undefined {
    for (const track of timeline.tracks) {
      for (const element of track.elements) {
        if (element.type === 'clip' && element.id === clipId) {
          return element as TimelineClip;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Find a transition in a timeline
   */
  private findTransition(
    timeline: CinematicTimeline,
    transitionId: string
  ): TimelineTransition | undefined {
    for (const track of timeline.tracks) {
      for (const element of track.elements) {
        if (element.type === 'transition' && element.id === transitionId) {
          return element as TimelineTransition;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Add a change to the undo stack
   */
  private addToUndoStack(timelineId: string, changes: TimelineElementChange[]): void {
    const undoStack = this.undoStacks.get(timelineId) || [];
    undoStack.push(changes);
    this.undoStacks.set(timelineId, undoStack);
    
    // Clear the redo stack when a new change is made
    this.redoStacks.set(timelineId, []);
  }
  
  /**
   * Undo the last change
   */
  public undo(timelineId: string): boolean {
    const timeline = this.timelines.get(timelineId);
    const undoStack = this.undoStacks.get(timelineId);
    
    if (!timeline || !undoStack || undoStack.length === 0) {
      return false;
    }
    
    // Get the last change group
    const changes = undoStack.pop()!;
    
    // Apply the changes in reverse order
    const redoChanges: TimelineElementChange[] = [];
    
    for (let i = changes.length - 1; i >= 0; i--) {
      const change = changes[i];
      
      // Apply the reverse of this change
      switch (change.type) {
        case 'add':
          // Reverse of add is remove
          this.deleteElement(timelineId, change.id);
          break;
          
        case 'remove':
          // Reverse of remove is add
          // This is complex and depends on the element type
          // For now, we'll just log a warning
          console.warn('Undo of remove not fully implemented');
          break;
          
        case 'move':
          // Move the element back to its original position
          if (change.before.startTime !== undefined) {
            this.moveElement(
              timelineId,
              change.id,
              change.before.startTime,
              change.before.trackId as string | undefined
            );
          }
          break;
          
        case 'resize':
          // Resize the element back to its original size
          if (change.before.duration !== undefined) {
            const fromStart = change.before.startTime !== change.after.startTime;
            this.resizeElement(
              timelineId,
              change.id,
              change.before.duration,
              fromStart
            );
          }
          break;
          
        case 'split':
          // Reverse of split is complex
          console.warn('Undo of split not fully implemented');
          break;
          
        case 'update':
          // For general updates, we need to find and update the element
          // TODO: Implement this
          break;
      }
      
      // Record the change for redo
      redoChanges.push({
        ...change,
        before: change.after,
        after: change.before
      });
    }
    
    // Add to redo stack
    const redoStack = this.redoStacks.get(timelineId) || [];
    redoStack.push(redoChanges);
    this.redoStacks.set(timelineId, redoStack);
    
    // Save the undo stack
    this.undoStacks.set(timelineId, undoStack);
    
    this.emit('timeline:undone', { timelineId });
    
    return true;
  }
  
  /**
   * Redo the last undone change
   */
  public redo(timelineId: string): boolean {
    const timeline = this.timelines.get(timelineId);
    const redoStack = this.redoStacks.get(timelineId);
    
    if (!timeline || !redoStack || redoStack.length === 0) {
      return false;
    }
    
    // Get the last undone change group
    const changes = redoStack.pop()!;
    
    // Apply the changes
    // (Implementation would be similar to undo but in forward direction)
    
    this.emit('timeline:redone', { timelineId });
    
    return true;
  }
  
  /**
   * Set the playback state of a timeline
   */
  public setPlaybackState(
    timelineId: string,
    state: Partial<TimelinePlaybackState>
  ): TimelinePlaybackState | undefined {
    const playbackState = this.playbackStates.get(timelineId);
    
    if (!playbackState) {
      return undefined;
    }
    
    // Apply updates
    const updatedState = {
      ...playbackState,
      ...state
    };
    
    // Store the state
    this.playbackStates.set(timelineId, updatedState);
    
    // Handle play/pause
    if ('isPlaying' in state) {
      if (state.isPlaying) {
        this.startPlayback(timelineId);
      } else {
        this.stopPlayback(timelineId);
      }
    }
    
    this.emit('playback:updated', { timelineId, state: updatedState });
    
    return updatedState;
  }
  
  /**
   * Start timeline playback
   */
  private startPlayback(timelineId: string): void {
    const playbackState = this.playbackStates.get(timelineId);
    const timeline = this.timelines.get(timelineId);
    
    if (!playbackState || !timeline) {
      return;
    }
    
    // Stop any existing playback
    this.stopPlayback(timelineId);
    
    // Start a new playback interval
    const fps = timeline.settings.frameRate;
    const frameTime = 1000 / fps;
    
    const intervalId = setInterval(() => {
      const state = this.playbackStates.get(timelineId);
      
      if (!state) {
        this.stopPlayback(timelineId);
        return;
      }
      
      // Calculate next time
      let nextTime = state.currentTime + (frameTime / 1000) * state.playbackRate;
      
      // Handle looping
      if (state.looping && state.outPoint && nextTime >= state.outPoint) {
        nextTime = state.inPoint || 0;
      } else if (!state.looping && state.outPoint && nextTime >= state.outPoint) {
        // Stop at out point
        nextTime = state.outPoint;
        this.stopPlayback(timelineId);
      } else if (nextTime >= timeline.duration) {
        if (state.looping) {
          nextTime = 0;
        } else {
          nextTime = timeline.duration;
          this.stopPlayback(timelineId);
        }
      }
      
      // Update the current time
      this.setPlaybackState(timelineId, { currentTime: nextTime });
      
      this.emit('playback:timeUpdate', { 
        timelineId, 
        currentTime: nextTime,
        isPlaying: nextTime < timeline.duration
      });
      
    }, frameTime);
    
    this.playbackIntervals.set(timelineId, intervalId);
    
    this.emit('playback:started', { 
      timelineId, 
      currentTime: playbackState.currentTime 
    });
  }
  
  /**
   * Stop timeline playback
   */
  private stopPlayback(timelineId: string): void {
    const intervalId = this.playbackIntervals.get(timelineId);
    
    if (intervalId) {
      clearInterval(intervalId);
      this.playbackIntervals.delete(timelineId);
      
      this.emit('playback:stopped', { 
        timelineId,
        currentTime: this.playbackStates.get(timelineId)?.currentTime || 0
      });
    }
  }
  
  /**
   * Set the current time in a timeline
   */
  public seekTo(
    timelineId: string,
    time: number
  ): number | undefined {
    const timeline = this.timelines.get(timelineId);
    const playbackState = this.playbackStates.get(timelineId);
    
    if (!timeline || !playbackState) {
      return undefined;
    }
    
    // Clamp time to timeline duration
    const clampedTime = Math.max(0, Math.min(time, timeline.duration));
    
    // Update the playback state
    const updatedState = this.setPlaybackState(timelineId, { currentTime: clampedTime });
    
    this.emit('playback:seeked', { 
      timelineId, 
      currentTime: clampedTime 
    });
    
    return clampedTime;
  }
  
  /**
   * Set in and out points for playback
   */
  public setInOutPoints(
    timelineId: string,
    inPoint: number | undefined,
    outPoint: number | undefined
  ): { inPoint?: number, outPoint?: number } | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Validate in/out points
    if (inPoint !== undefined && outPoint !== undefined && inPoint >= outPoint) {
      throw new Error('In point must be before out point');
    }
    
    if (inPoint !== undefined) {
      inPoint = Math.max(0, Math.min(inPoint, timeline.duration));
    }
    
    if (outPoint !== undefined) {
      outPoint = Math.max(0, Math.min(outPoint, timeline.duration));
    }
    
    // Update the playback state
    const updatedState = this.setPlaybackState(timelineId, { inPoint, outPoint });
    
    this.emit('playback:inOutSet', { 
      timelineId, 
      inPoint, 
      outPoint 
    });
    
    return { inPoint, outPoint };
  }
  
  /**
   * Export a timeline to a serializable format
   */
  public exportTimeline(timelineId: string): string {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      throw new Error(`Timeline not found: ${timelineId}`);
    }
    
    return JSON.stringify(timeline, null, 2);
  }
  
  /**
   * Link asset to a timeline clip
   */
  public linkAssetToClip(
    timelineId: string,
    clipId: string,
    assetId: string
  ): TimelineClip | undefined {
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return undefined;
    }
    
    // Find the clip
    let trackIndex = -1;
    let clipIndex = -1;
    
    for (let i = 0; i < timeline.tracks.length; i++) {
      const track = timeline.tracks[i];
      const idx = track.elements.findIndex(el => el.id === clipId);
      
      if (idx !== -1) {
        trackIndex = i;
        clipIndex = idx;
        break;
      }
    }
    
    if (trackIndex === -1 || clipIndex === -1) {
      return undefined;
    }
    
    // Get the clip
    const clip = timeline.tracks[trackIndex].elements[clipIndex] as TimelineClip;
    
    // Find the asset
    let asset: Asset | null = null;
    let indexedAsset: IndexedAsset | null = null;
    
    if (this.assetIndexer) {
      indexedAsset = this.assetIndexer.getAsset(assetId);
      
      if (indexedAsset) {
        // Convert from indexed asset to domain asset
        asset = {
          id: indexedAsset.id,
          filename: indexedAsset.id, // Use id as fallback
          display_name: indexedAsset.type + " " + indexedAsset.id.substring(0, 8),
          type: indexedAsset.type as any, // Assuming types are compatible
          category: indexedAsset.category as any,
          mime_type: indexedAsset.type === 'image' ? 'image/jpeg' : 'video/mp4', // Reasonable defaults
          status: 'complete',
          path: '',
          url: indexedAsset.url,
          thumbnail_url: indexedAsset.thumbnailUrl,
          metadata: {
            width: indexedAsset.width,
            height: indexedAsset.height,
            duration: indexedAsset.duration,
            framerate: indexedAsset.fps,
            ...indexedAsset.metadata
          },
          tags: indexedAsset.tags,
          created_at: indexedAsset.createdAt,
          updated_at: indexedAsset.createdAt
        };
      }
    }
    
    if (!asset) {
      return undefined;
    }
    
    // Update the clip data
    const updatedClip: TimelineClip = {
      ...clip,
      data: {
        ...clip.data,
        assetId: assetId,
        asset: asset,
        type: asset.type === 'image' ? 'image' : 'video'
      }
    };
    
    // Update the clip in the track
    const tracks = [...timeline.tracks];
    const updatedElements = [...tracks[trackIndex].elements];
    updatedElements[clipIndex] = updatedClip;
    
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      elements: updatedElements
    };
    
    // Update the timeline
    this.updateTimeline(timelineId, {
      tracks,
      updated: new Date().toISOString()
    });
    
    this.emit('clip:assetLinked', { timelineId, clipId, assetId });
    
    return updatedClip;
  }
  
  /**
   * Scan all timeline clips and try to link them to indexed assets
   */
  public linkAssetsToTimeline(timelineId: string): { 
    linked: number, 
    failed: number, 
    clips: TimelineClip[] 
  } {
    if (!this.assetIndexer) {
      return { linked: 0, failed: 0, clips: [] };
    }
    
    const timeline = this.timelines.get(timelineId);
    
    if (!timeline) {
      return { linked: 0, failed: 0, clips: [] };
    }
    
    let linkedCount = 0;
    let failedCount = 0;
    const linkedClips: TimelineClip[] = [];
    
    // Find all clips that need assets
    const tracks = [...timeline.tracks];
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
      if (track.type !== 'video') continue;
      
      for (let j = 0; j < track.elements.length; j++) {
        const element = track.elements[j];
        
        if (element.type !== 'clip') continue;
        
        const clip = element as TimelineClip;
        
        // Skip if already has a valid asset
        if (clip.data.asset && clip.data.asset.status === 'complete') continue;
        
        // If we have an assetId, try to link it
        if (clip.data.assetId) {
          const linkedClip = this.linkAssetToClip(timelineId, clip.id, clip.data.assetId);
          
          if (linkedClip) {
            linkedCount++;
            linkedClips.push(linkedClip);
          } else {
            failedCount++;
          }
        } else {
          // Try to find a matching asset by name or other metadata
          // This is more of a heuristic approach
          const assetQuery = {
            type: clip.data.type === 'image' ? 'image' : 'video',
            limit: 1
          };
          
          const searchResults = this.assetIndexer.search(assetQuery);
          
          if (searchResults.assets.length > 0) {
            const asset = searchResults.assets[0];
            const linkedClip = this.linkAssetToClip(timelineId, clip.id, asset.id);
            
            if (linkedClip) {
              linkedCount++;
              linkedClips.push(linkedClip);
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        }
      }
    }
    
    return { linked: linkedCount, failed: failedCount, clips: linkedClips };
  }
  
  /**
   * Import a timeline from a serialized format
   */
  public importTimeline(json: string): CinematicTimeline {
    try {
      const timeline = JSON.parse(json) as CinematicTimeline;
      
      // Generate a new ID for the imported timeline
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Create a new timeline with the imported data
      const importedTimeline: CinematicTimeline = {
        ...timeline,
        id: newId,
        created: now,
        updated: now
      };
      
      // Store the timeline
      this.timelines.set(newId, importedTimeline);
      
      // Create empty undo/redo stacks
      this.undoStacks.set(newId, []);
      this.redoStacks.set(newId, []);
      
      // Create initial playback state
      this.playbackStates.set(newId, {
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1,
        looping: false,
        selectedElementIds: []
      });
      
      // Try to link assets if we have an asset indexer
      if (this.assetIndexer) {
        this.linkAssetsToTimeline(newId);
      }
      
      this.emit('timeline:imported', { id: newId, name: importedTimeline.name });
      
      return importedTimeline;
    } catch (error) {
      throw new Error(`Failed to import timeline: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}