# SERI AI STUDIO Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         SERI AI STUDIO ARCHITECTURE                     │
└────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                             │
├────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Dashboard  │  │ Characters │  │  Episodes  │  │ Media      │        │
│  │            │  │            │  │            │  │ Studio     │        │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘        │
│                                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ ComfyUI    │  │ ComfyUI    │  │ ComfyUI    │  │ Timeline   │        │
│  │ Studio     │  │ Advanced   │  │ Assets     │  │ Editor     │        │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘        │
└────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION LAYER                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     CinematicPipeline                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                     │
                 ┌──────────────────┬┴┬──────────────────┐
                 │                  │ │                  │
                 ▼                  ▼ │                  ▼
┌────────────────────────┐ ┌─────────┴─────────┐ ┌────────────────────────┐
│    VIDEO PIPELINE      │ │    AI SERVICES    │ │     AUDIO PIPELINE     │
├────────────────────────┤ ├───────────────────┤ ├────────────────────────┤
│ ┌──────────────────┐   │ │ ┌───────────────┐ │ │ ┌──────────────────┐   │
│ │  VideoSequencer  │   │ │ │ ComfyUIService│ │ │ │    TTSService    │   │
│ └──────────────────┘   │ │ └───────────────┘ │ │ └──────────────────┘   │
│                        │ │                   │ │                        │
│ ┌──────────────────┐   │ │ ┌───────────────┐ │ │ ┌──────────────────┐   │
│ │  TimelineEngine  │   │ │ │BatchGenerator │ │ │ │  SubtitleService │   │
│ └──────────────────┘   │ │ └───────────────┘ │ │ └──────────────────┘   │
│                        │ │                   │ │                        │
│ ┌──────────────────┐   │ │ ┌───────────────┐ │ │ ┌──────────────────┐   │
│ │  FFmpegService   │   │ │ │ AssetIndexer  │ │ │ │   TTS Providers  │   │
│ └──────────────────┘   │ │ └───────────────┘ │ │ └──────────────────┘   │
└────────────────────────┘ └───────────────────┘ └────────────────────────┘
                 │                  │                   │
                 └──────────────────┼───────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Filesystem │  │ Job Queue  │  │ Local      │  │ Asset      │        │
│  │ Manager    │  │            │  │ Storage    │  │ Repository │        │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  ComfyUI   │  │   FFmpeg   │  │    TTS     │  │ External   │        │
│  │  Instance  │  │            │  │ Providers  │  │ APIs       │        │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## Architecture Overview

The SERI AI STUDIO architecture is designed as a modular, layered system that follows clean architecture principles and maintains separation of concerns.

### Application Layer

This layer contains the user interfaces and entry points:

- **ComfyUI Studio**: Simple image and video generation interface
- **ComfyUI Advanced**: More detailed controls for batch generation and models
- **ComfyUI Assets**: Management of generated assets
- **Timeline Editor**: Interface for editing video sequences

### Integration Layer

This layer coordinates between different services:

- **CinematicPipeline**: Main orchestrator that connects AI generation with video processing

### Service Layers

The system has three main service areas:

1. **Video Pipeline**
   - **VideoSequencer**: Defines video sequences with clips, audio, and subtitles
   - **TimelineEngine**: Manages editing operations on timelines
   - **FFmpegService**: Handles video processing operations

2. **AI Services**
   - **ComfyUIService**: Provides access to ComfyUI for generation
   - **BatchGenerator**: Manages batch generation jobs
   - **AssetIndexer**: Indexes and organizes generated assets

3. **Audio Pipeline**
   - **TTSService**: Provides text-to-speech capabilities
   - **SubtitleService**: Manages subtitles and synchronization
   - **TTS Providers**: Implementation of different TTS engines

### Infrastructure Layer

This layer provides core infrastructure services:

- **Filesystem Manager**: Handles file operations
- **Job Queue**: Manages background jobs
- **Local Storage**: Persists application state
- **Asset Repository**: Stores and retrieves assets

### External Services

The system integrates with external tools and services:

- **ComfyUI Instance**: For image and video generation
- **FFmpeg**: For video processing
- **TTS Providers**: For voice generation
- **External APIs**: For additional functionality

## Data Flow

1. User requests are received through the Application Layer
2. The Integration Layer coordinates the necessary services
3. Service Layers process the request using domain logic
4. Infrastructure Layer handles persistence and resource management
5. External Services provide specialized capabilities

## Key Design Principles

- **Modularity**: Components have clear boundaries and responsibilities
- **Extensibility**: New providers and features can be added easily
- **Resilience**: Systems handle errors and recover from failures
- **Performance**: Operations are optimized for efficiency
- **Type Safety**: Comprehensive TypeScript types throughout