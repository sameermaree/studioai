import { CinematicTimeline, TimelineClip, TimelineAudio, TimelineSubtitle } from '../services/video/TimelineEngine';

/**
 * Generate a sample timeline for demonstration purposes
 */
export function createSampleTimeline(id: string = 'sample-timeline'): CinematicTimeline {
  const now = new Date().toISOString();

  // Create video track clips
  const videoClips: TimelineClip[] = [
    {
      id: 'clip-1',
      type: 'clip',
      trackId: 'track-1',
      startTime: 0,
      duration: 4,
      endTime: 4,
      data: {
        id: 'clip-1-data',
        type: 'image',
        startTime: 0,
        duration: 4,
        shot: {
          type: 'establishing',
          camera: 'static',
          description: 'Establishing shot of the city'
        },
        asset: {
          id: 'asset-1',
          filename: 'city.jpg',
          display_name: 'City Landscape',
          type: 'image',
          category: 'background',
          mime_type: 'image/jpeg',
          status: 'complete',
          path: '',
          url: 'https://picsum.photos/id/1031/1200/800',
          metadata: { width: 1200, height: 800 },
          tags: ['city', 'landscape'],
          created_at: now,
          updated_at: now
        }
      },
      transitions: {
        out: 'transition-1'
      }
    },
    {
      id: 'clip-2',
      type: 'clip',
      trackId: 'track-1',
      startTime: 3.5,
      duration: 5,
      endTime: 8.5,
      data: {
        id: 'clip-2-data',
        type: 'video',
        startTime: 3.5,
        duration: 5,
        shot: {
          type: 'medium',
          camera: 'pan',
          description: 'Character walking in the street'
        },
        asset: {
          id: 'asset-2',
          filename: 'character_walking.mp4',
          display_name: 'Character Walking',
          type: 'video',
          category: 'scene',
          mime_type: 'video/mp4',
          status: 'complete',
          path: '',
          url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
          metadata: { width: 1280, height: 720, duration: 5, framerate: 30 },
          tags: ['character', 'walking'],
          created_at: now,
          updated_at: now
        }
      },
      transitions: {
        in: 'transition-1',
        out: 'transition-2'
      }
    },
    {
      id: 'clip-3',
      type: 'clip',
      trackId: 'track-1',
      startTime: 8,
      duration: 6,
      endTime: 14,
      data: {
        id: 'clip-3-data',
        type: 'video',
        startTime: 8,
        duration: 6,
        shot: {
          type: 'closeup',
          camera: 'static',
          description: 'Character close-up emotional scene'
        },
        asset: {
          id: 'asset-3',
          filename: 'character_closeup.mp4',
          display_name: 'Character Close-up',
          type: 'video',
          category: 'scene',
          mime_type: 'video/mp4',
          status: 'complete',
          path: '',
          url: 'https://samplelib.com/lib/preview/mp4/sample-10s.mp4',
          metadata: { width: 1280, height: 720, duration: 10, framerate: 30 },
          tags: ['character', 'closeup'],
          created_at: now,
          updated_at: now
        }
      },
      transitions: {
        in: 'transition-2'
      }
    }
  ];

  // Create audio track clips
  const audioClips: TimelineAudio[] = [
    {
      id: 'audio-1',
      type: 'audio',
      trackId: 'track-2',
      startTime: 0,
      duration: 14,
      endTime: 14,
      data: {
        id: 'audio-1-data',
        type: 'music',
        url: 'https://samplelib.com/lib/preview/mp3/sample-15s.mp3',
        startTime: 0,
        duration: 14,
        volume: 0.7,
        fadeIn: 1,
        fadeOut: 1,
        assetId: 'asset-4',
        asset: {
          id: 'asset-4',
          filename: 'background_music.mp3',
          display_name: 'Background Music',
          type: 'audio',
          category: 'music',
          mime_type: 'audio/mpeg',
          status: 'complete',
          path: '',
          url: 'https://samplelib.com/lib/preview/mp3/sample-15s.mp3',
          metadata: { duration: 15 },
          tags: ['music', 'background'],
          created_at: now,
          updated_at: now
        }
      }
    },
    {
      id: 'audio-2',
      type: 'audio',
      trackId: 'track-3',
      startTime: 4,
      duration: 4,
      endTime: 8,
      data: {
        id: 'audio-2-data',
        type: 'dialogue',
        url: 'https://samplelib.com/lib/preview/mp3/sample-3s.mp3',
        startTime: 4,
        duration: 4,
        volume: 1,
        assetId: 'asset-5',
        asset: {
          id: 'asset-5',
          filename: 'dialogue.mp3',
          display_name: 'Character Dialogue',
          type: 'audio',
          category: 'dialogue',
          mime_type: 'audio/mpeg',
          status: 'complete',
          path: '',
          url: 'https://samplelib.com/lib/preview/mp3/sample-3s.mp3',
          metadata: { duration: 3 },
          tags: ['dialogue', 'character'],
          created_at: now,
          updated_at: now
        }
      }
    }
  ];

  // Create subtitle track clips
  const subtitleClips: TimelineSubtitle[] = [
    {
      id: 'subtitle-1',
      type: 'subtitle',
      trackId: 'track-4',
      startTime: 4,
      duration: 2,
      endTime: 6,
      data: {
        id: 'subtitle-1-data',
        startTime: 4,
        endTime: 6,
        text: 'Hello, this is the first subtitle.',
        language: 'en',
        style: {
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          position: [50, 90]
        }
      }
    },
    {
      id: 'subtitle-2',
      type: 'subtitle',
      trackId: 'track-4',
      startTime: 6,
      duration: 2.5,
      endTime: 8.5,
      data: {
        id: 'subtitle-2-data',
        startTime: 6,
        endTime: 8.5,
        text: 'This is the second subtitle with a longer duration.',
        language: 'en',
        style: {
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          position: [50, 90]
        }
      }
    },
    {
      id: 'subtitle-3',
      type: 'subtitle',
      trackId: 'track-5',
      startTime: 4,
      duration: 2,
      endTime: 6,
      data: {
        id: 'subtitle-3-data',
        startTime: 4,
        endTime: 6,
        text: 'مرحبا، هذه الترجمة الأولى.',
        language: 'ar',
        style: {
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          position: [50, 90]
        }
      }
    },
    {
      id: 'subtitle-4',
      type: 'subtitle',
      trackId: 'track-5',
      startTime: 6,
      duration: 2.5,
      endTime: 8.5,
      data: {
        id: 'subtitle-4-data',
        startTime: 6,
        endTime: 8.5,
        text: 'هذه الترجمة الثانية ذات المدة الطويلة.',
        language: 'ar',
        style: {
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          position: [50, 90]
        }
      }
    }
  ];

  // Create timeline
  const timeline: CinematicTimeline = {
    id,
    name: 'Sample Timeline',
    sequenceId: 'sample-sequence',
    description: 'A sample timeline for demonstration purposes',
    duration: 14,
    tracks: [
      {
        id: 'track-1',
        name: 'Video Track',
        type: 'video',
        index: 0,
        elements: videoClips,
      },
      {
        id: 'track-2',
        name: 'Music',
        type: 'audio',
        index: 1,
        elements: [audioClips[0]],
      },
      {
        id: 'track-3',
        name: 'Dialogue',
        type: 'audio',
        index: 2,
        elements: [audioClips[1]],
      },
      {
        id: 'track-4',
        name: 'English Subtitles',
        type: 'subtitle',
        index: 3,
        elements: [subtitleClips[0], subtitleClips[1]],
      },
      {
        id: 'track-5',
        name: 'Arabic Subtitles',
        type: 'subtitle',
        index: 4,
        elements: [subtitleClips[2], subtitleClips[3]],
      }
    ],
    markers: [
      {
        id: 'marker-1',
        type: 'marker',
        startTime: 0,
        duration: 0,
        endTime: 0,
        data: {
          name: 'Start',
          color: '#00FF00'
        }
      },
      {
        id: 'marker-2',
        type: 'marker',
        startTime: 4,
        duration: 0,
        endTime: 4,
        data: {
          name: 'Dialogue Start',
          color: '#0000FF'
        }
      },
      {
        id: 'marker-3',
        type: 'marker',
        startTime: 8,
        duration: 0,
        endTime: 8,
        data: {
          name: 'Scene Change',
          color: '#FF0000'
        }
      },
      {
        id: 'marker-4',
        type: 'marker',
        startTime: 14,
        duration: 0,
        endTime: 14,
        data: {
          name: 'End',
          color: '#FF00FF'
        }
      }
    ],
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
 * Get a sample timeline or create one if not available
 */
export function getSampleTimeline(id: string = 'sample-timeline'): CinematicTimeline {
  // For production, we might retrieve from a store or localStorage
  return createSampleTimeline(id);
}