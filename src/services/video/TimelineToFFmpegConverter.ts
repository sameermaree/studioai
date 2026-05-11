import { CinematicTimeline, TimelineClip, TimelineAudio, TimelineSubtitle, TimelineTransition } from './TimelineEngine';
import { FFmpegFilterOptions } from './FFmpegService';

/**
 * Service to convert timeline data into FFmpeg commands
 */
export class TimelineToFFmpegConverter {
  /**
   * Generate a filter complex for a timeline
   */
  public generateFilterComplex(timeline: CinematicTimeline): {
    inputFiles: string[];
    filterComplex: string;
    subtitleFiles?: string[];
  } {
    // Collect all clips and audio elements
    const videoClips = timeline.tracks
      .filter(track => track.type === 'video')
      .flatMap(track => track.elements)
      .filter(element => element.type === 'clip') as TimelineClip[];
    
    const audioElements = timeline.tracks
      .filter(track => track.type === 'audio')
      .flatMap(track => track.elements)
      .filter(element => element.type === 'audio') as TimelineAudio[];
    
    const subtitleElements = timeline.tracks
      .filter(track => track.type === 'subtitle')
      .flatMap(track => track.elements)
      .filter(element => element.type === 'subtitle') as TimelineSubtitle[];
    
    // Sort elements by start time
    videoClips.sort((a, b) => a.startTime - b.startTime);
    audioElements.sort((a, b) => a.startTime - b.startTime);
    
    // Collect input files
    const inputFiles: string[] = [];
    const videoInputMap = new Map<string, number>(); // Maps clip ID to input index
    const audioInputMap = new Map<string, number>(); // Maps audio ID to input index
    
    // Add video clips to input files
    for (const clip of videoClips) {
      if (clip.data.asset?.url) {
        inputFiles.push(clip.data.asset.url);
        videoInputMap.set(clip.id, inputFiles.length - 1);
      }
    }
    
    // Add audio elements to input files
    for (const audio of audioElements) {
      if (audio.data.asset?.url) {
        inputFiles.push(audio.data.asset.url);
        audioInputMap.set(audio.id, inputFiles.length - 1);
      }
    }
    
    // Collect subtitle files if available
    const subtitleFiles: string[] = [];
    for (const subtitle of subtitleElements) {
      if (subtitle.data.file) {
        subtitleFiles.push(subtitle.data.file);
      }
    }
    
    // Generate filter complex
    let filterComplex = '';
    const videoLabelMap = new Map<string, string>(); // Maps clip ID to its label in filter complex
    const audioLabelMap = new Map<string, string>(); // Maps audio ID to its label in filter complex
    
    // Process video clips
    for (const [index, clip] of videoClips.entries()) {
      const inputIndex = videoInputMap.get(clip.id);
      if (inputIndex === undefined) continue;
      
      const clipLabel = `clip${index}`;
      
      // Add clip filter
      filterComplex += `[${inputIndex}]`;
      
      // Add trim if needed
      if (clip.data.startTime > 0 || clip.duration < clip.data.asset?.metadata?.duration) {
        filterComplex += `trim=start=${clip.data.startTime}:duration=${clip.duration},`;
        filterComplex += `setpts=PTS-STARTPTS,`;
      }
      
      // Add scale to match timeline dimensions
      filterComplex += `scale=${timeline.settings.width}:${timeline.settings.height}:force_original_aspect_ratio=decrease,`;
      filterComplex += `pad=${timeline.settings.width}:${timeline.settings.height}:(ow-iw)/2:(oh-ih)/2,`;
      
      // Set frame rate
      filterComplex += `fps=${timeline.settings.frameRate},`;
      
      // Add format for consistency
      filterComplex += `format=yuv420p`;
      
      // Name this output
      filterComplex += `[${clipLabel}];\n`;
      
      // Store label
      videoLabelMap.set(clip.id, clipLabel);
    }
    
    // Process audio elements
    for (const [index, audio] of audioElements.entries()) {
      const inputIndex = audioInputMap.get(audio.id);
      if (inputIndex === undefined) continue;
      
      const audioLabel = `audio${index}`;
      
      // Add audio filter
      filterComplex += `[${inputIndex}]`;
      
      // Add trim if needed
      if (audio.data.startTime > 0 || audio.duration < audio.data.asset?.metadata?.duration) {
        filterComplex += `atrim=start=${audio.data.startTime}:duration=${audio.duration},`;
        filterComplex += `asetpts=PTS-STARTPTS,`;
      }
      
      // Add volume adjustment if needed
      if (audio.data.volume !== 1) {
        filterComplex += `volume=${audio.data.volume},`;
      }
      
      // Add fade in/out if needed
      if (audio.data.fadeIn) {
        filterComplex += `afade=t=in:st=0:d=${audio.data.fadeIn},`;
      }
      
      if (audio.data.fadeOut) {
        filterComplex += `afade=t=out:st=${audio.duration - audio.data.fadeOut}:d=${audio.data.fadeOut},`;
      }
      
      // Name this output
      filterComplex += `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[${audioLabel}];\n`;
      
      // Store label
      audioLabelMap.set(audio.id, audioLabel);
    }
    
    // Concatenate video clips in timeline order
    if (videoLabelMap.size > 0) {
      // For each video clip, get its label
      const videoLabels = videoClips
        .filter(clip => videoLabelMap.has(clip.id))
        .map(clip => videoLabelMap.get(clip.id)!);
      
      // Concatenate all video clips
      if (videoLabels.length > 1) {
        // Add all inputs
        for (const label of videoLabels) {
          filterComplex += `[${label}]`;
        }
        
        // Add concat filter
        filterComplex += `concat=n=${videoLabels.length}:v=1:a=0[v];\n`;
      } else if (videoLabels.length === 1) {
        // Just one clip, so name it directly
        filterComplex += `[${videoLabels[0]}]null[v];\n`;
      }
    } else {
      // No video clips, create a blank video
      filterComplex += `color=c=black:s=${timeline.settings.width}x${timeline.settings.height}:r=${timeline.settings.frameRate}:d=${timeline.duration}[v];\n`;
    }
    
    // Mix audio elements
    if (audioLabelMap.size > 0) {
      // For each audio element, get its label
      const audioLabels = audioElements
        .filter(audio => audioLabelMap.has(audio.id))
        .map(audio => audioLabelMap.get(audio.id)!);
      
      // Mix all audio elements
      if (audioLabels.length > 1) {
        // Add all inputs
        for (const label of audioLabels) {
          filterComplex += `[${label}]`;
        }
        
        // Add mix filter
        filterComplex += `amix=inputs=${audioLabels.length}:duration=longest[a];\n`;
      } else if (audioLabels.length === 1) {
        // Just one audio, so name it directly
        filterComplex += `[${audioLabels[0]}]anull[a];\n`;
      }
    } else if (videoLabelMap.size > 0) {
      // No audio elements, but we have video, create silent audio
      filterComplex += `anullsrc=r=48000:cl=stereo:d=${timeline.duration}[a];\n`;
    }
    
    // If there are subtitles, handle them (simplified)
    if (subtitleElements.length > 0) {
      // In real implementation, we might need to generate subtitle files
      // or set up subtitle filters for burning them in
      
      // For now, we'll just note that subtitles exist
      console.log(`Timeline has ${subtitleElements.length} subtitle elements`);
    }
    
    return { inputFiles, filterComplex, subtitleFiles };
  }
  
  /**
   * Generate subtitle file for a timeline track
   */
  public generateSubtitleFile(
    timeline: CinematicTimeline,
    trackId: string,
    format: 'srt' | 'vtt' = 'srt'
  ): string {
    const track = timeline.tracks.find(t => t.id === trackId);
    if (!track || track.type !== 'subtitle') {
      throw new Error(`Track ${trackId} is not a subtitle track`);
    }
    
    const subtitles = track.elements.filter(e => e.type === 'subtitle') as TimelineSubtitle[];
    if (subtitles.length === 0) {
      return '';
    }
    
    // Sort by start time
    subtitles.sort((a, b) => a.startTime - b.startTime);
    
    if (format === 'srt') {
      return this.generateSRT(subtitles);
    } else {
      return this.generateVTT(subtitles);
    }
  }
  
  /**
   * Generate SRT format subtitles
   */
  private generateSRT(subtitles: TimelineSubtitle[]): string {
    let srt = '';
    
    subtitles.forEach((subtitle, index) => {
      // Add index
      srt += `${index + 1}\n`;
      
      // Add timecode (format: 00:00:00,000 --> 00:00:00,000)
      srt += `${this.formatSrtTime(subtitle.startTime)} --> ${this.formatSrtTime(subtitle.endTime)}\n`;
      
      // Add text
      srt += `${subtitle.data.text}\n\n`;
    });
    
    return srt;
  }
  
  /**
   * Generate WebVTT format subtitles
   */
  private generateVTT(subtitles: TimelineSubtitle[]): string {
    let vtt = 'WEBVTT\n\n';
    
    subtitles.forEach((subtitle, index) => {
      // Add index (optional in VTT)
      vtt += `${index + 1}\n`;
      
      // Add timecode (format: 00:00:00.000 --> 00:00:00.000)
      vtt += `${this.formatVttTime(subtitle.startTime)} --> ${this.formatVttTime(subtitle.endTime)}`;
      
      // Add positioning if available
      if (subtitle.data.style?.position) {
        vtt += ` position:${subtitle.data.style.position[0]}%,line:${subtitle.data.style.position[1]}%`;
      }
      
      vtt += '\n';
      
      // Add text
      vtt += `${subtitle.data.text}\n\n`;
    });
    
    return vtt;
  }
  
  /**
   * Format time in SRT format (00:00:00,000)
   */
  private formatSrtTime(seconds: number): string {
    const date = new Date(seconds * 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
  
  /**
   * Format time in WebVTT format (00:00:00.000)
   */
  private formatVttTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}