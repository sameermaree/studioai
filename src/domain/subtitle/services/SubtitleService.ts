import { 
  SubtitleDocument, 
  SubtitleCue, 
  SubtitleFormat,
  createSubtitleDocument,
  createSubtitleCue,
  formatSrtTime,
  formatVttTime
} from '../entities/Subtitle';
import { Asset } from '../../assets/entities/Asset';

/**
 * Service for managing subtitles
 */
export class SubtitleService {
  private documents: Map<string, SubtitleDocument> = new Map();
  
  /**
   * Store a subtitle document
   */
  public saveDocument(document: SubtitleDocument): SubtitleDocument {
    // Update timestamp
    const updatedDoc = {
      ...document,
      updated: new Date().toISOString()
    };
    
    this.documents.set(document.id, updatedDoc);
    return updatedDoc;
  }
  
  /**
   * Get a subtitle document by ID
   */
  public getDocument(id: string): SubtitleDocument | undefined {
    return this.documents.get(id);
  }
  
  /**
   * Get all subtitle documents
   */
  public getAllDocuments(): SubtitleDocument[] {
    return Array.from(this.documents.values());
  }
  
  /**
   * Delete a subtitle document
   */
  public deleteDocument(id: string): boolean {
    return this.documents.delete(id);
  }
  
  /**
   * Generate subtitles from audio asset with word timestamps
   */
  public generateSubtitlesFromAudio(
    audioAsset: Asset,
    language: string,
    options?: {
      maxCueLength?: number;
      minCueDuration?: number;
      maxCueDuration?: number;
      name?: string;
    }
  ): SubtitleDocument | undefined {
    // Check if asset has word timestamps
    const metadata = audioAsset.metadata as any;
    if (!metadata.word_timestamps) {
      return undefined;
    }
    
    const wordTimestamps: Array<{ word: string; start: number; end: number }> = metadata.word_timestamps;
    
    // Default options
    const maxCueLength = options?.maxCueLength || 42; // characters
    const minCueDuration = options?.minCueDuration || 1.0; // seconds
    const maxCueDuration = options?.maxCueDuration || 5.0; // seconds
    
    // Create a new subtitle document
    const document = createSubtitleDocument(language, {
      name: options?.name || `Subtitles for ${audioAsset.display_name}`,
      metadata: {
        duration: metadata.duration,
        framerate: metadata.framerate,
        source: 'audio-asset',
        videoId: metadata.scene_id
      }
    });
    
    // Generate cues by grouping words into appropriately sized chunks
    const cues: SubtitleCue[] = [];
    let currentCueWords: typeof wordTimestamps = [];
    let currentCueStart = 0;
    let currentCueText = '';
    
    for (const word of wordTimestamps) {
      // If this is the first word or if adding this word doesn't exceed max length
      if (currentCueWords.length === 0 || 
          (currentCueText + ' ' + word.word).length <= maxCueLength) {
        // Add word to current cue
        currentCueWords.push(word);
        currentCueText = currentCueWords.map(w => w.word).join(' ');
        
        // Update start time if first word
        if (currentCueWords.length === 1) {
          currentCueStart = word.start;
        }
      } else {
        // Current cue is full, create it
        if (currentCueWords.length > 0) {
          const lastWord = currentCueWords[currentCueWords.length - 1];
          const cueEnd = lastWord.end;
          const cueDuration = cueEnd - currentCueStart;
          
          // Only create if duration is valid
          if (cueDuration >= minCueDuration) {
            cues.push(createSubtitleCue(
              cues.length + 1,
              currentCueStart,
              cueEnd,
              currentCueText,
              { speaker: metadata.character_id ? 'Character' : 'Narrator' }
            ));
          }
        }
        
        // Start a new cue with this word
        currentCueWords = [word];
        currentCueText = word.word;
        currentCueStart = word.start;
      }
    }
    
    // Add the last cue if there are words left
    if (currentCueWords.length > 0) {
      const lastWord = currentCueWords[currentCueWords.length - 1];
      cues.push(createSubtitleCue(
        cues.length + 1,
        currentCueStart,
        lastWord.end,
        currentCueText,
        { speaker: metadata.character_id ? 'Character' : 'Narrator' }
      ));
    }
    
    // Add cues to document
    const documentWithCues = {
      ...document,
      cues
    };
    
    // Store and return the document
    return this.saveDocument(documentWithCues);
  }
  
  /**
   * Export subtitles to a specific format
   */
  public exportSubtitles(document: SubtitleDocument, format: SubtitleFormat): string {
    switch (format) {
      case 'srt':
        return this.exportToSRT(document);
      case 'vtt':
        return this.exportToVTT(document);
      case 'json':
        return JSON.stringify(document, null, 2);
      case 'ass':
        return this.exportToASS(document);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  /**
   * Export to SRT format
   */
  private exportToSRT(document: SubtitleDocument): string {
    // Sort cues by start time
    const sortedCues = [...document.cues].sort((a, b) => a.startTime - b.startTime);
    
    // Generate SRT content
    let srtContent = '';
    
    sortedCues.forEach((cue, index) => {
      // Add index
      srtContent += `${index + 1}\n`;
      
      // Add timestamps
      srtContent += `${formatSrtTime(cue.startTime)} --> ${formatSrtTime(cue.endTime)}\n`;
      
      // Add text with speaker if available
      const text = cue.speaker 
        ? `${cue.speaker}: ${cue.text}` 
        : cue.text;
      
      srtContent += `${text}\n\n`;
    });
    
    return srtContent;
  }
  
  /**
   * Export to WebVTT format
   */
  private exportToVTT(document: SubtitleDocument): string {
    // Sort cues by start time
    const sortedCues = [...document.cues].sort((a, b) => a.startTime - b.startTime);
    
    // Generate VTT content
    let vttContent = 'WEBVTT\n\n';
    
    sortedCues.forEach((cue, index) => {
      // Add optional cue identifier
      vttContent += `${index + 1}\n`;
      
      // Add timestamps
      vttContent += `${formatVttTime(cue.startTime)} --> ${formatVttTime(cue.endTime)}`;
      
      // Add optional styling
      if (cue.style) {
        if (cue.style.align) vttContent += ` align:${cue.style.align}`;
        if (cue.style.position) vttContent += ` position:${cue.style.position[0]}%,${cue.style.position[1]}%`;
      }
      vttContent += '\n';
      
      // Add text with speaker if available
      const text = cue.speaker 
        ? `<v ${cue.speaker}>${cue.text}</v>` 
        : cue.text;
      
      vttContent += `${text}\n\n`;
    });
    
    return vttContent;
  }
  
  /**
   * Export to ASS (Advanced SubStation Alpha) format
   */
  private exportToASS(document: SubtitleDocument): string {
    // This is a simplified ASS export - real implementation would be more complex
    let assContent = '[Script Info]\n';
    assContent += 'Title: ' + document.name + '\n';
    assContent += 'ScriptType: v4.00+\n';
    assContent += 'PlayResX: 1920\n';
    assContent += 'PlayResY: 1080\n\n';
    
    assContent += '[V4+ Styles]\n';
    assContent += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
    assContent += 'Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n';
    
    assContent += '[Events]\n';
    assContent += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    
    // Sort cues by start time
    const sortedCues = [...document.cues].sort((a, b) => a.startTime - b.startTime);
    
    sortedCues.forEach(cue => {
      // Convert timestamps to ASS format (h:mm:ss.cc)
      const startTime = this.secondsToASSTime(cue.startTime);
      const endTime = this.secondsToASSTime(cue.endTime);
      
      // Add speaker if available
      const text = cue.speaker 
        ? `{\\b1}${cue.speaker}:{\\b0} ${cue.text}` 
        : cue.text;
      
      assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
    });
    
    return assContent;
  }
  
  /**
   * Convert seconds to ASS time format (h:mm:ss.cc)
   */
  private secondsToASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centisecs = Math.floor((seconds % 1) * 100);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centisecs.toString().padStart(2, '0')}`;
  }
}