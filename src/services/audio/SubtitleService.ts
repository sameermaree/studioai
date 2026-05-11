import { TTSSpeechResult } from './TTSService';

export interface SubtitleEntry {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  speaker?: string;
  language?: string;
  style?: {
    color?: string;
    backgroundColor?: string;
    fontName?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    alignment?: 'left' | 'center' | 'right';
    position?: [number, number]; // [x, y] as percentage of screen
  };
}

export interface SubtitleOptions {
  format?: 'srt' | 'vtt' | 'ass' | 'json';
  maxLineLength?: number;
  maxLinesPerSubtitle?: number;
  minDuration?: number; // minimum duration in seconds
  maxDuration?: number; // maximum duration in seconds
  defaultStyle?: SubtitleEntry['style'];
  outputFile?: string;
}

export interface SubtitleSegmentationOptions {
  strategy: 'words' | 'sentences' | 'time' | 'fixed';
  maxDuration?: number; // For time-based segmentation
  maxChars?: number; // For text-based segmentation
  breakOnPunctuation?: boolean; // Break on punctuation like .?!
}

/**
 * Service for creating, editing, and synchronizing subtitles
 */
export class SubtitleService {
  /**
   * Generate subtitles from text with timing
   */
  public generateSubtitles(
    text: string,
    timing: {
      startTime: number;
      endTime: number;
    },
    options: SubtitleSegmentationOptions & {
      language?: string;
      speaker?: string;
      style?: SubtitleEntry['style'];
    } = { strategy: 'sentences' }
  ): SubtitleEntry[] {
    const { startTime, endTime } = timing;
    const duration = endTime - startTime;
    
    // Different segmentation strategies
    switch (options.strategy) {
      case 'sentences':
        return this.segmentBySentences(text, startTime, duration, options);
        
      case 'words':
        return this.segmentByWords(text, startTime, duration, options);
        
      case 'time':
        return this.segmentByTime(text, startTime, duration, options);
        
      case 'fixed':
        return this.segmentFixed(text, startTime, duration, options);
        
      default:
        return this.segmentBySentences(text, startTime, duration, options);
    }
  }
  
  /**
   * Generate subtitles based on TTS speech results with word timings
   */
  public generateSubtitlesFromTTS(
    speechResult: TTSSpeechResult,
    options: {
      strategy?: 'words' | 'sentences';
      maxWordsPerSubtitle?: number;
      language?: string;
      speaker?: string;
      style?: SubtitleEntry['style'];
    } = { strategy: 'sentences' }
  ): SubtitleEntry[] {
    // If the speech result has word timings, use them
    if (speechResult.wordTimings && speechResult.wordTimings.length > 0) {
      return this.generateFromWordTimings(speechResult.wordTimings, options);
    }
    
    // If the speech result has text segments, use them
    if (speechResult.textSegments && speechResult.textSegments.length > 0) {
      return speechResult.textSegments.map((segment, index) => ({
        id: `sub-${index + 1}`,
        startTime: segment.startTime,
        endTime: segment.endTime,
        text: segment.text,
        language: options.language,
        speaker: options.speaker,
        style: options.style
      }));
    }
    
    // Otherwise, use the full text and duration
    return this.generateSubtitles(
      speechResult.metadata.text,
      {
        startTime: 0,
        endTime: speechResult.duration
      },
      {
        strategy: options.strategy || 'sentences',
        language: options.language,
        speaker: options.speaker,
        style: options.style
      }
    );
  }
  
  /**
   * Generate subtitles from word timings
   */
  private generateFromWordTimings(
    wordTimings: TTSSpeechResult['wordTimings'],
    options: {
      strategy?: 'words' | 'sentences';
      maxWordsPerSubtitle?: number;
      language?: string;
      speaker?: string;
      style?: SubtitleEntry['style'];
    }
  ): SubtitleEntry[] {
    if (!wordTimings || wordTimings.length === 0) {
      return [];
    }
    
    const subtitles: SubtitleEntry[] = [];
    const maxWords = options.maxWordsPerSubtitle || 7; // Default to 7 words per subtitle
    
    // For sentence-based segmentation
    if (options.strategy === 'sentences') {
      let currentSubtitle: {
        words: typeof wordTimings;
        text: string;
        startTime: number;
        endTime: number;
      } | null = null;
      
      // Group words into sentences based on punctuation
      for (let i = 0; i < wordTimings.length; i++) {
        const word = wordTimings[i];
        
        if (!currentSubtitle) {
          currentSubtitle = {
            words: [word],
            text: word.word,
            startTime: word.startTime,
            endTime: word.endTime
          };
        } else {
          currentSubtitle.words.push(word);
          currentSubtitle.text += ' ' + word.word;
          currentSubtitle.endTime = word.endTime;
        }
        
        // Check if this word ends a sentence or if we've reached the max words
        const endsWithPunctuation = /[.!?;]$/.test(word.word);
        
        if (endsWithPunctuation || currentSubtitle.words.length >= maxWords || i === wordTimings.length - 1) {
          // Add the subtitle
          subtitles.push({
            id: `sub-${subtitles.length + 1}`,
            startTime: currentSubtitle.startTime,
            endTime: currentSubtitle.endTime,
            text: currentSubtitle.text.trim(),
            language: options.language,
            speaker: options.speaker,
            style: options.style
          });
          
          // Reset the current subtitle
          currentSubtitle = null;
        }
      }
    }
    // For word-based segmentation
    else {
      for (let i = 0; i < wordTimings.length; i += maxWords) {
        const chunk = wordTimings.slice(i, i + maxWords);
        const text = chunk.map(w => w.word).join(' ');
        
        subtitles.push({
          id: `sub-${subtitles.length + 1}`,
          startTime: chunk[0].startTime,
          endTime: chunk[chunk.length - 1].endTime,
          text,
          language: options.language,
          speaker: options.speaker,
          style: options.style
        });
      }
    }
    
    return subtitles;
  }
  
  /**
   * Segment text into subtitles by sentences
   */
  private segmentBySentences(
    text: string,
    startTime: number,
    duration: number,
    options: SubtitleSegmentationOptions & {
      language?: string;
      speaker?: string;
      style?: SubtitleEntry['style'];
    }
  ): SubtitleEntry[] {
    // Split text into sentences
    const sentenceDelimiters = /([.!?]+)\s+/g;
    const sentences = text.split(sentenceDelimiters)
      .filter(s => s.trim())
      .map(s => s.trim());
    
    const maxChars = options.maxChars || 42; // Default max chars per line
    const subtitles: SubtitleEntry[] = [];
    let currentSubtitle: string[] = [];
    let currentLength = 0;
    
    // Group sentences into subtitles
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      if (currentLength + sentence.length <= maxChars) {
        currentSubtitle.push(sentence);
        currentLength += sentence.length;
      } else {
        // Add the current subtitle
        if (currentSubtitle.length > 0) {
          subtitles.push({
            text: currentSubtitle.join(' '),
            id: `sub-${subtitles.length + 1}`,
            language: options.language,
            speaker: options.speaker,
            style: options.style,
            startTime: 0, // To be calculated later
            endTime: 0 // To be calculated later
          });
          
          currentSubtitle = [sentence];
          currentLength = sentence.length;
        } else {
          // The sentence is longer than maxChars, split it
          currentSubtitle = [sentence];
          currentLength = sentence.length;
          
          subtitles.push({
            text: currentSubtitle.join(' '),
            id: `sub-${subtitles.length + 1}`,
            language: options.language,
            speaker: options.speaker,
            style: options.style,
            startTime: 0,
            endTime: 0
          });
          
          currentSubtitle = [];
          currentLength = 0;
        }
      }
    }
    
    // Add any remaining subtitle
    if (currentSubtitle.length > 0) {
      subtitles.push({
        text: currentSubtitle.join(' '),
        id: `sub-${subtitles.length + 1}`,
        language: options.language,
        speaker: options.speaker,
        style: options.style,
        startTime: 0,
        endTime: 0
      });
    }
    
    // Calculate timing for each subtitle
    this.calculateTiming(subtitles, startTime, duration);
    
    return subtitles;
  }
  
  /**
   * Segment text into subtitles by words
   */
  private segmentByWords(
    text: string,
    startTime: number,
    duration: number,
    options: SubtitleSegmentationOptions & {
      language?: string;
      speaker?: string;
      style?: SubtitleEntry['style'];
    }
  ): SubtitleEntry[] {
    // Split text into words
    const words = text.split(/\s+/).filter(w => w.trim());
    const maxWordsPerSubtitle = options.maxChars || 7;
    const subtitles: SubtitleEntry[] = [];
    
    // Group words into subtitles
    for (let i = 0; i < words.length; i += maxWordsPerSubtitle) {
      const chunk = words.slice(i, i + maxWordsPerSubtitle);
      
      subtitles.push({
        text: chunk.join(' '),
        id: `sub-${subtitles.length + 1}`,
        language: options.language,
        speaker: options.speaker,
        style: options.style,
        startTime: 0, // To be calculated later
        endTime: 0 // To be calculated later
      });
    }
    
    // Calculate timing for each subtitle
    this.calculateTiming(subtitles, startTime, duration);
    
    return subtitles;
  }
  
  /**
   * Segment text into subtitles by time
   */
  private segmentByTime(
    text: string,
    startTime: number,
    duration: number,
    options: SubtitleSegmentationOptions & {
      language?: string;
      speaker?: string;
      style?: SubtitleEntry['style'];
    }
  ): SubtitleEntry[] {
    const maxDuration = options.maxDuration || 3; // Default max duration is 3 seconds
    const numSegments = Math.ceil(duration / maxDuration);
    
    // If text is empty or only one segment, return a single subtitle
    if (!text.trim() || numSegments <= 1) {
      return [{
        id: 'sub-1',
        startTime,
        endTime: startTime + duration,
        text,
        language: options.language,
        speaker: options.speaker,
        style: options.style
      }];
    }
    
    // Split text into roughly equal segments
    const words = text.split(/\s+/).filter(w => w.trim());
    const wordsPerSegment = Math.ceil(words.length / numSegments);
    const subtitles: SubtitleEntry[] = [];
    
    // Create segments
    for (let i = 0; i < numSegments; i++) {
      const segmentWords = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment);
      const segmentText = segmentWords.join(' ');
      
      const segmentStartTime = startTime + (i * maxDuration);
      const segmentEndTime = i === numSegments - 1 
        ? startTime + duration // Last segment ends at the overall end time
        : segmentStartTime + maxDuration;
      
      subtitles.push({
        id: `sub-${i + 1}`,
        startTime: segmentStartTime,
        endTime: segmentEndTime,
        text: segmentText,
        language: options.language,
        speaker: options.speaker,
        style: options.style
      });
    }
    
    return subtitles;
  }
  
  /**
   * Segment text into a fixed number of subtitles
   */
  private segmentFixed(
    text: string,
    startTime: number,
    duration: number,
    options: SubtitleSegmentationOptions & {
      language?: string;
      speaker?: string;
      style?: SubtitleEntry['style'];
    }
  ): SubtitleEntry[] {
    // Default to a single subtitle
    const subtitle: SubtitleEntry = {
      id: 'sub-1',
      startTime,
      endTime: startTime + duration,
      text,
      language: options.language,
      speaker: options.speaker,
      style: options.style
    };
    
    return [subtitle];
  }
  
  /**
   * Calculate timing for each subtitle
   */
  private calculateTiming(
    subtitles: SubtitleEntry[],
    startTime: number,
    duration: number
  ): void {
    const count = subtitles.length;
    
    if (count === 0) {
      return;
    }
    
    if (count === 1) {
      subtitles[0].startTime = startTime;
      subtitles[0].endTime = startTime + duration;
      return;
    }
    
    // Estimate the duration of each subtitle based on its text length
    const totalTextLength = subtitles.reduce((sum, sub) => sum + sub.text.length, 0);
    
    let currentStartTime = startTime;
    for (let i = 0; i < count; i++) {
      const subtitle = subtitles[i];
      const textLengthRatio = subtitle.text.length / totalTextLength;
      const subtitleDuration = duration * textLengthRatio;
      
      subtitle.startTime = currentStartTime;
      subtitle.endTime = currentStartTime + subtitleDuration;
      
      currentStartTime = subtitle.endTime;
    }
    
    // Ensure the last subtitle ends at the overall end time
    subtitles[count - 1].endTime = startTime + duration;
  }
  
  /**
   * Convert subtitles to SRT format
   */
  public toSRT(subtitles: SubtitleEntry[]): string {
    return subtitles
      .map((subtitle, index) => {
        const startTime = this.formatSRTTime(subtitle.startTime);
        const endTime = this.formatSRTTime(subtitle.endTime);
        return `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
      })
      .join('\n');
  }
  
  /**
   * Convert subtitles to VTT format
   */
  public toVTT(subtitles: SubtitleEntry[]): string {
    let vtt = 'WEBVTT\n\n';
    
    vtt += subtitles
      .map((subtitle, index) => {
        const startTime = this.formatVTTTime(subtitle.startTime);
        const endTime = this.formatVTTTime(subtitle.endTime);
        let cue = `${subtitle.id}\n${startTime} --> ${endTime}`;
        
        // Add style information if available
        if (subtitle.style) {
          const style = subtitle.style;
          let styleAttr = '';
          
          if (style.alignment) {
            styleAttr += ` align:${style.alignment}`;
          }
          
          if (style.position) {
            styleAttr += ` position:${style.position[0]}%,${style.position[1]}%`;
          }
          
          if (styleAttr) {
            cue += styleAttr;
          }
        }
        
        cue += `\n${subtitle.text}`;
        
        return cue;
      })
      .join('\n\n');
    
    return vtt;
  }
  
  /**
   * Format time for SRT format
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millisecs = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${
      minutes.toString().padStart(2, '0')}:${
      secs.toString().padStart(2, '0')},${
      millisecs.toString().padStart(3, '0')}`;
  }
  
  /**
   * Format time for VTT format
   */
  private formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millisecs = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${
      minutes.toString().padStart(2, '0')}:${
      secs.toString().padStart(2, '0')}.${
      millisecs.toString().padStart(3, '0')}`;
  }
  
  /**
   * Parse SRT subtitles
   */
  public parseSRT(srt: string): SubtitleEntry[] {
    const regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\d+\n|$)/g;
    const subtitles: SubtitleEntry[] = [];
    
    let match;
    while ((match = regex.exec(srt)) !== null) {
      const [, index, startTimeStr, endTimeStr, text] = match;
      
      subtitles.push({
        id: `sub-${index}`,
        startTime: this.parseSRTTime(startTimeStr),
        endTime: this.parseSRTTime(endTimeStr),
        text: text.trim()
      });
    }
    
    return subtitles;
  }
  
  /**
   * Parse VTT subtitles
   */
  public parseVTT(vtt: string): SubtitleEntry[] {
    // Remove WEBVTT header and notes
    vtt = vtt.replace(/^WEBVTT\n?(?:.+\n)*\n/g, '');
    
    const regex = /(?:([\w\d-]+)\n)?(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})(?: .*?)?\n([\s\S]*?)(?=\n\n|$)/g;
    const subtitles: SubtitleEntry[] = [];
    
    let match;
    while ((match = regex.exec(vtt)) !== null) {
      const [, id, startTimeStr, endTimeStr, text] = match;
      
      subtitles.push({
        id: id || `sub-${subtitles.length + 1}`,
        startTime: this.parseVTTTime(startTimeStr),
        endTime: this.parseVTTTime(endTimeStr),
        text: text.trim()
      });
    }
    
    return subtitles;
  }
  
  /**
   * Parse SRT time format
   */
  private parseSRTTime(timeStr: string): number {
    const [hms, ms] = timeStr.split(',');
    const [hours, minutes, seconds] = hms.split(':').map(Number);
    
    return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000;
  }
  
  /**
   * Parse VTT time format
   */
  private parseVTTTime(timeStr: string): number {
    const [hms, ms] = timeStr.split('.');
    const [hours, minutes, seconds] = hms.split(':').map(Number);
    
    return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000;
  }
}