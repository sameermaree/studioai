/**
 * Subtitle formats supported by the system
 */
export type SubtitleFormat = 'srt' | 'vtt' | 'json' | 'ass';

/**
 * A single subtitle entry/cue
 */
export interface SubtitleCue {
  id: string;
  index: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  speaker?: string; // character/speaker name
  style?: {
    color?: string;
    backgroundColor?: string;
    fontStyle?: 'normal' | 'italic' | 'bold';
    position?: [number, number]; // [x, y] as percentage of frame
    align?: 'left' | 'center' | 'right';
  };
}

/**
 * Subtitle document containing all cues
 */
export interface SubtitleDocument {
  id: string;
  name: string;
  language: string;
  cues: SubtitleCue[];
  format: SubtitleFormat;
  created: string;
  updated: string;
  metadata?: {
    framerate?: number;
    duration?: number;
    source?: string;
    translatedFrom?: string;
    videoId?: string;
    sceneId?: string;
  };
}

/**
 * Create a new subtitle document
 */
export function createSubtitleDocument(
  language: string,
  options?: {
    name?: string;
    format?: SubtitleFormat;
    cues?: SubtitleCue[];
    metadata?: SubtitleDocument['metadata'];
  }
): SubtitleDocument {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  
  return {
    id,
    name: options?.name || `Subtitles (${language})`,
    language,
    cues: options?.cues || [],
    format: options?.format || 'srt',
    created: now,
    updated: now,
    metadata: options?.metadata
  };
}

/**
 * Create a new subtitle cue
 */
export function createSubtitleCue(
  index: number,
  startTime: number,
  endTime: number,
  text: string,
  options?: {
    speaker?: string;
    style?: SubtitleCue['style'];
  }
): SubtitleCue {
  return {
    id: crypto.randomUUID(),
    index,
    startTime,
    endTime,
    text,
    speaker: options?.speaker,
    style: options?.style
  };
}

/**
 * Add a cue to a subtitle document
 */
export function addSubtitleCue(
  document: SubtitleDocument,
  cue: Omit<SubtitleCue, 'id' | 'index'>
): SubtitleDocument {
  const newIndex = document.cues.length + 1;
  
  const newCue: SubtitleCue = {
    ...cue,
    id: crypto.randomUUID(),
    index: newIndex
  };
  
  const sortedCues = [...document.cues, newCue].sort((a, b) => a.startTime - b.startTime);
  
  // Re-index cues
  const reindexedCues = sortedCues.map((cue, i) => ({ ...cue, index: i + 1 }));
  
  return {
    ...document,
    cues: reindexedCues,
    updated: new Date().toISOString()
  };
}

/**
 * Format a time value (in seconds) to SRT format (HH:MM:SS,mmm)
 */
export function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Format a time value (in seconds) to VTT format (HH:MM:SS.mmm)
 */
export function formatVttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}