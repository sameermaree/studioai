# SERI AI STUDIO

A cinematic AI production platform for creating videos, animations, and stories with AI-generated content. Built with React, TypeScript, Vite, and TailwindCSS.

## Quick Start

```bash
npm install
npm run dev
```

The app runs entirely in the browser with localStorage persistence. No API keys are required for startup.

## Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | No | Supabase project URL (for future cloud sync) |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anonymous key (for future cloud sync) |

If Supabase credentials are missing, the app operates in fully local mode with no errors.

## Project Architecture

```
src/
├── application/        # Application services and business logic
├── components/         # Shared UI components (Sidebar, TopBar)
├── context/            # React context providers (Language/i18n)
├── data/               # Mock/demo data, style presets, workflow templates
├── domain/             # Domain entities and business logic
│   ├── assets/         # Asset entities and operations
│   ├── rendering/      # Rendering job entities
│   └── storytelling/   # Story and scene entities
├── hooks/              # Custom React hooks (useLanguage)
├── infrastructure/     # Infrastructure services
│   ├── ai/             # AI provider interfaces
│   ├── filesystem/     # File system operations
│   ├── persistence/    # Data persistence
│   └── queue/          # Job queue management
├── layouts/            # Page layouts (StudioLayout)
├── lib/                # Constants, Supabase client, utilities
├── pages/              # Route-level page components
├── services/           # Business logic separated from UI
│   ├── ai/             # AI provider adapter architecture
│   ├── audio/          # TTS and subtitle services
│   ├── comfyui/        # ComfyUI orchestration
│   │   ├── assets/     # Asset indexing and management
│   │   ├── providers/  # TTS providers implementation
│   │   └── storage/    # Queue persistence
│   ├── integration/    # Integration services
│   ├── prompts/        # Prompt template engine
│   ├── publishing/     # Platform publishing service
│   ├── rendering/      # Render queue service
│   ├── subtitles/      # SRT/VTT subtitle generation & export
│   ├── video/          # Video pipeline services
│   ├── voice/          # TTS & voice cloning service
│   └── workflow/       # Episode generation pipeline
├── store/              # Zustand state management with localStorage persistence
├── translations/       # i18n dictionaries (en, ar, fr)
└── types/              # TypeScript type definitions
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/store/useStudioStore.ts` | Central state management with localStorage persistence |
| `src/services/workflow/index.ts` | Episode workflow generation (story to scenes to render queue) |
| `src/translations/` | Multilingual dictionaries (English, Arabic RTL, French) |
| `src/types/index.ts` | All TypeScript interfaces and type definitions |
| `src/data/stylePresets.ts` | Visual style preset library |
| `src/services/ai/index.ts` | AI provider adapter registry |

## Features

### ComfyUI Integration
- Complete ComfyUI orchestration system
- Workflow template management with versioning
- Model detection and switching
- Batch generation with queue management
- Asset indexing and organization
- Health monitoring and stability layer

### Production Pipeline
- Story-to-episode workflow generation
- Scene breakdown with visual prompts, narration, and subtitles
- Character consistency management
- Render queue with job tracking

### Video Pipeline
- Complete cinematic sequencing system
- Timeline editing with multi-track support
- Clip operations (add, move, trim, split, delete)
- Transitions and effects
- FFmpeg orchestration layer

### Audio & Voice Pipeline
- Text-to-speech with multiple language support
- Arabic voice integration
- Voice customization and parameter control
- Automatic subtitle generation and synchronization
- Multiple subtitle format support (SRT, VTT)

### Character System
- Persistent character profiles with visual references
- Outfit management
- Voice assignment
- Style preset binding
- Consistency lock settings
- Memory system for character history

### Style Presets
- 14 built-in cinematic styles (3D animation, anime, watercolor, clay, etc.)
- Color palettes, lighting rules, camera guidance
- Negative prompt templates
- Sample prompts for each style

### Multilingual Support
- English, Arabic (RTL), French
- Full UI translation via centralized dictionaries
- RTL layout support with proper sidebar/form alignment
- Subtitle tracks in all supported languages

### Data Management
- All data persists in localStorage (survives refresh)
- Export project data as JSON backup
- Import data from backup file
- Reset to demo data
- Settings > General tab for data operations

## Episode Workflow

1. Click "New Episode" on the Episodes page
2. Fill in story, language, audience, visual style, production settings
3. Select characters from the library
4. Configure voice style, camera style, consistency strength
5. Click "Generate Episode Workflow"
6. System creates: scenes, prompts, subtitle tracks, render queue jobs
7. All data persists immediately

## System Architecture

The SERI AI STUDIO is built with a modular architecture following clean architecture principles:

### Service Layers

1. **Video Pipeline**
   - `VideoSequencer`: Core service for defining video sequences
   - `TimelineEngine`: Timeline editing operations
   - `FFmpegService`: Video processing operations

2. **ComfyUI Integration**
   - `ComfyUIService`: Main service for ComfyUI orchestration
   - `WorkflowLoader`: Workflow template loading and validation
   - `BatchGenerator`: Batch generation management
   - `StabilityLayer`: Connection stability and error handling

3. **Audio Pipeline**
   - `TTSService`: Text-to-speech abstraction
   - `SubtitleService`: Subtitle generation and synchronization
   - `TTS Providers`: Implementation of different voice engines

### Integration Layer

The `CinematicPipeline` service connects all components to provide end-to-end generation capabilities:

- Cinematic sequence generation from scene definitions
- Voice generation and synchronization
- Video assembly from generated assets
- Subtitle generation and burning

### AI Provider Architecture

The `src/services/ai/` module provides a clean adapter pattern for AI integrations:

- ComfyUI (image and video generation)
- Stable Diffusion (image generation)
- Ollama (local text generation)
- Web Speech API (browser TTS)
- Arabic TTS (specialized Arabic voice)

## Placeholder Systems

These are architecturally prepared but not connected to real services:

- Render queue (ready for FFmpeg/ComfyUI/WAN integration)
- Voice studio (ready for ElevenLabs/OpenAI TTS)
- Publishing (ready for YouTube/TikTok/Instagram/Facebook APIs)
- Media upload (ready for Supabase Storage)
- Subtitle translation (ready for translation API)

## Adding Future AI Integrations

1. Add provider config in `src/services/ai/index.ts`
2. Implement the generation function for the provider
3. Add API key in edge function secrets (not client-side)
4. Create edge function to proxy the API call
5. Update the render queue service to call the edge function

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
npm run typecheck # TypeScript type verification
```

## Known Limitations

- All data stored client-side in localStorage (no multi-device sync)
- Some AI providers are placeholder-only
- ComfyUI integration requires a running ComfyUI instance
- FFmpeg operations require FFmpeg to be installed
- Voice cloning UI exists but is not connected to a service
- No user authentication (single-user local mode)

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite 5** - Build tool and dev server
- **TailwindCSS 3** - Utility-first CSS
- **Zustand** - State management with localStorage persistence
- **React Router 7** - Client-side routing
- **Lucide React** - Icon library
- **FFmpeg** - Video processing
- **ComfyUI** - AI image and video generation
- **Web Speech API** - Browser-based TTS
- **Supabase** - Optional cloud backend (not required for local dev)
