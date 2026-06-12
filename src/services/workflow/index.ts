import type {
  EpisodeWorkflowConfig,
  Episode,
  Scene,
  Prompt,
  SubtitleTrack,
  SubtitleEntry,
  RenderJob,
  RenderSettings,
  StylePreset,
  Character,
  CharacterBibleEntry,
} from '../../types';

// Import Ollama service
import { generateWorkflowWithOllama } from '../ai/ollama';

// Import enhanced workflow orchestrator
import { WorkflowOrchestrator } from '../../application/storytelling/services/WorkflowOrchestrator.updated';
import { StoryGenerator } from '../../application/storytelling/services/StoryGenerator';
import { AIProviderRegistry } from '../../infrastructure/ai/AIProviderRegistry';
import { AIServiceFactory } from '../../infrastructure/ai/AIServiceFactory';

// Initialize the AI provider registry
const aiRegistry = new AIProviderRegistry();
AIServiceFactory.initializeRegistry(aiRegistry);

// Initialize the story generator
const storyGenerator = new StoryGenerator(aiRegistry);

// Initialize the workflow orchestrator
const workflowOrchestrator = new WorkflowOrchestrator(aiRegistry, storyGenerator);

interface WorkflowResult {
  episode: Episode;
  prompts: Prompt[];
  subtitleTracks: SubtitleTrack[];
  renderJobs: RenderJob[];
}

function parseStoryToScenes(story: string, estimatedScenes: number): string[] {
  const sentences = story
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length <= estimatedScenes) {
    return sentences.length > 0 ? sentences : [story];
  }

  const chunkSize = Math.ceil(sentences.length / estimatedScenes);
  const scenes: string[] = [];

  for (let i = 0; i < sentences.length; i += chunkSize) {
    scenes.push(sentences.slice(i, i + chunkSize).join('. ') + '.');
  }

  return scenes.slice(0, estimatedScenes);
}

function generateSceneTitle(sceneText: string, index: number): string {
  const words = sceneText.split(/\s+/).slice(0, 4).join(' ');
  return `Scene ${index + 1} - ${words}${words.length < sceneText.length ? '...' : ''}`;
}

function buildPromptFromScene(
  sceneText: string,
  config: EpisodeWorkflowConfig,
  stylePreset: StylePreset | undefined,
  characters: Character[]
): { template: string; negative: string } {
  const charDescriptions = config.character_ids
    .map((id) => characters.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => c!.description)
    .join(', ');

  const styleParts: string[] = [];

  if (stylePreset) {
    styleParts.push(stylePreset.rendering_style);
    styleParts.push(stylePreset.lighting_rules);
    styleParts.push(`mood: ${stylePreset.cinematic_mood}`);
  }

  styleParts.push(`camera: ${config.camera_style}`);
  styleParts.push(`aspect ratio: ${config.aspect_ratio}`);

  const template = [
    sceneText,
    charDescriptions ? `Characters: ${charDescriptions}` : '',
    ...styleParts,
  ].filter(Boolean).join('. ');

  const negative =
    stylePreset?.negative_prompts ||
    'blurry, low quality, deformed, ugly';

  return { template, negative };
}

function resolutionFromAspectRatio(ratio: string): string {
  switch (ratio) {
    case '9:16':
      return '1080x1920';
    case '1:1':
      return '1080x1080';
    default:
      return '1920x1080';
  }
}

/**
 * Generate an episode workflow with AI-powered story generation
 * 
 * This function now uses the enhanced WorkflowOrchestrator with improved:
 * - narrative quality
 * - scene diversity
 * - prompt engineering
 * - character consistency
 * - pacing and transitions
 */
export async function generateEpisodeWorkflow(
  config: EpisodeWorkflowConfig & { story_characters?: CharacterBibleEntry[] },
  stylePresets: StylePreset[],
  characters: Character[]
): Promise<WorkflowResult> {
  // Resolve which IDs go into scene.characters[].
  // If story_characters (CharacterBibleEntry[]) are available, use their IDs —
  // this ensures new scenes carry CharacterBibleEntry.id values, making Phase 4
  // (ScenePromptComposer migration) safe.
  // Otherwise fall back to config.character_ids (legacy store.characters IDs).
  const resolvedCharacterIds: string[] =
    config.story_characters && config.story_characters.length > 0
      ? config.story_characters.map((e) => e.id)
      : config.character_ids;

  try {
    // Use the enhanced workflow orchestrator
    console.log('Using enhanced workflow orchestrator...');
    return await workflowOrchestrator.generateEpisodeWorkflow(config, stylePresets, characters);
  } catch (error) {
    console.error('Enhanced orchestrator failed, falling back to basic implementation:', error);
    
    // Fall back to the original implementation if the orchestrator fails
    try {
      console.log('Attempting to generate with Ollama (basic)...');
      
      // Find style preset
      const stylePreset = stylePresets.find(
        (s) => s.id === config.style_preset_id
      );
      
      // Try to generate with Ollama
      const ollamaResult = await generateWorkflowWithOllama(
        config,
        characters,
        stylePreset
      );
      
      // If Ollama fails or returns invalid/empty result, fall back to local generation
      if (!ollamaResult || !Array.isArray(ollamaResult.scenes) || ollamaResult.scenes.length === 0) {
        console.log('Ollama returned invalid or empty result, falling back to local generation');
        return generateLocalWorkflow(config, stylePresets, characters, resolvedCharacterIds);
      }

      // Process Ollama-generated scenes into proper format
      const now = new Date().toISOString();
      const episodeId = crypto.randomUUID();
      
      // Convert Ollama scenes to our Scene format
// Add character_outfits to scenes generated by Ollama
      const scenes: Scene[] = ollamaResult.scenes.map((ollamaScene, i) => {
        return {
          id: crypto.randomUUID(),
          episode_id: episodeId,
          order: i + 1,
          title: ollamaScene.title || `Scene ${i + 1}`,
          prompt_id: null,
          prompt_text: ollamaScene.visual_prompt,
          negative_prompt: ollamaScene.negative_prompt,
          camera_angle: ollamaScene.camera_angle || 'Medium shot',
          motion_instructions: ollamaScene.motion_instructions || 'Slow dolly',
          characters: resolvedCharacterIds,
          character_outfits: {},
          style_preset_id: config.style_preset_id || null,
          voice_id: null,
          music_url: null,
          sound_effects: '',
          narration: ollamaScene.narration,
          subtitle_text: ollamaScene.narration,
          subtitles: [],
          duration: ollamaScene.duration || Math.ceil(config.duration_seconds / ollamaResult.scenes.length),
          seed: null,
          render_status: 'pending',
          render_url: null,
          image_references: [],
          video_references: [],
          created_at: now,
          updated_at: now,
        };
      });
      
      // Create episode
      const episode: Episode = {
        id: episodeId,
        title: config.title,
        description: config.story.slice(0, 200),
        status: 'in_production',
        scenes,
        thumbnail_url: null,
        duration_estimate: scenes.reduce((sum, scene) => sum + scene.duration, 0),
        style_preset_id: config.style_preset_id || null,
        workflow_config: config,
        created_at: now,
        updated_at: now,
      };
      
      // Create prompts
      const prompts: Prompt[] = scenes.map((scene, i) => ({
        id: crypto.randomUUID(),
        name: `${config.title} - ${scene.title}`,
        category: 'cinematic',
        template: scene.prompt_text,
        negative_prompt: scene.negative_prompt,
        language: config.target_language,
        tags: [
          config.title.toLowerCase(),
          `scene-${i + 1}`,
          stylePreset?.category || 'custom',
        ],
        is_preset: false,
        style_preset_id: config.style_preset_id || null,
        seed: null,
        metadata: {
          episode_id: episodeId,
          scene_id: scene.id,
        },
        created_at: now,
        updated_at: now,
      }));
      
      // Create subtitle tracks
      const subtitleTracks: SubtitleTrack[] = config.subtitle_languages.map((lang) => {
        let timeOffset = 0;

        const entries: SubtitleEntry[] = scenes.map((scene, i) => {
          const entry: SubtitleEntry = {
            id: crypto.randomUUID(),
            index: i + 1,
            start_time: timeOffset,
            end_time: timeOffset + scene.duration,
            text: scene.narration,
          };

          timeOffset += scene.duration;
          return entry;
        });

        return {
          id: crypto.randomUUID(),
          scene_id: null,
          episode_id: episodeId,
          language: lang,
          entries,
          format: 'srt',
          created_at: now,
          updated_at: now,
        };
      });
      
      // Create render settings
      const renderSettings: RenderSettings = {
        resolution: resolutionFromAspectRatio(config.aspect_ratio),
        fps: 24,
        format: 'mp4',
        quality: config.consistency_strength === 'strict' ? 'ultra' : 'high',
        burn_subtitles: false,
        subtitle_language: null,
      };
      
      // Create render jobs
      const renderJobs: RenderJob[] = scenes.map((scene) => ({
        id: crypto.randomUUID(),
        episode_id: episodeId,
        scene_id: scene.id,
        type: 'scene',
        status: 'pending',
        progress: 0,
        output_url: null,
        settings: renderSettings,
        error_message: null,
        started_at: null,
        completed_at: null,
        created_at: now,
      }));

      renderJobs.push({
        id: crypto.randomUUID(),
        episode_id: episodeId,
        scene_id: null,
        type: 'episode',
        status: 'pending',
        progress: 0,
        output_url: null,
        settings: renderSettings,
        error_message: null,
        started_at: null,
        completed_at: null,
        created_at: now,
      });
      
      console.log('Successfully generated workflow with basic Ollama integration');
      
      return {
        episode,
        prompts,
        subtitleTracks,
        renderJobs,
      };
      
    } catch (innerError) {
      // If Ollama integration fails, fall back to local generation
      console.error('All AI-based generation failed:', innerError);
      console.log('Falling back to local workflow generation');
      return generateLocalWorkflow(config, stylePresets, characters, resolvedCharacterIds);
    }
  }
}

/**
 * Local fallback workflow generation (no AI)
 */
function generateLocalWorkflow(
  config: EpisodeWorkflowConfig & { story_characters?: CharacterBibleEntry[] },
  stylePresets: StylePreset[],
  characters: Character[],
  resolvedCharacterIds: string[]
): WorkflowResult {
  const now = new Date().toISOString();
  const episodeId = crypto.randomUUID();

  const stylePreset = stylePresets.find(
    (s) => s.id === config.style_preset_id
  );

  const sceneTexts = parseStoryToScenes(
    config.story,
    config.estimated_scenes
  );

  const sceneDuration = Math.max(
    3,
    Math.floor(config.duration_seconds / sceneTexts.length)
  );

  const scenes: Scene[] = sceneTexts.map((text, i) => {
    const { template, negative } = buildPromptFromScene(
      text,
      config,
      stylePreset,
      characters
    );

    return {
      id: crypto.randomUUID(),
      episode_id: episodeId,
      order: i + 1,
      title: generateSceneTitle(text, i),
      prompt_id: null,
      prompt_text: template,
      negative_prompt: negative,
      camera_angle:
        config.camera_style === 'cinematic' ? 'Wide shot' : 'Medium shot',
      motion_instructions:
        config.camera_style === 'dynamic' ? 'Dynamic tracking shot' : 'Slow dolly',
      characters: resolvedCharacterIds,
      character_outfits: {},
      style_preset_id: config.style_preset_id || null,
      voice_id: null,
      music_url: null,
      sound_effects: '',
      narration: text,
      subtitle_text: text,
      subtitles: [],
      duration: sceneDuration,
      seed: null,
      render_status: 'pending',
      render_url: null,
      image_references: [],
      video_references: [],
      created_at: now,
      updated_at: now,
    };
  });

  const episode: Episode = {
    id: episodeId,
    title: config.title,
    description: config.story.slice(0, 200),
    status: 'in_production',
    scenes,
    thumbnail_url: null,
    duration_estimate: scenes.reduce((sum, scene) => sum + scene.duration, 0),
    style_preset_id: config.style_preset_id || null,
    workflow_config: config,
    story_characters: config.story_characters || [],
    created_at: now,
    updated_at: now,
  };

  const prompts: Prompt[] = scenes.map((scene, i) => ({
    id: crypto.randomUUID(),
    name: `${config.title} - Scene ${i + 1}`,
    category: 'cinematic',
    template: scene.prompt_text,
    negative_prompt: scene.negative_prompt,
    language: config.target_language,
    tags: [
      config.title.toLowerCase(),
      `scene-${i + 1}`,
      stylePreset?.category || 'custom',
    ],
    is_preset: false,
    style_preset_id: config.style_preset_id || null,
    seed: null,
    metadata: {
      episode_id: episodeId,
      scene_id: scene.id,
    },
    created_at: now,
    updated_at: now,
  }));

  const subtitleTracks: SubtitleTrack[] = config.subtitle_languages.map((lang) => {
    let timeOffset = 0;

    const entries: SubtitleEntry[] = scenes.map((scene, i) => {
      const entry: SubtitleEntry = {
        id: crypto.randomUUID(),
        index: i + 1,
        start_time: timeOffset,
        end_time: timeOffset + scene.duration,
        text: scene.narration,
      };

      timeOffset += scene.duration;
      return entry;
    });

    return {
      id: crypto.randomUUID(),
      scene_id: null,
      episode_id: episodeId,
      language: lang,
      entries,
      format: 'srt',
      created_at: now,
      updated_at: now,
    };
  });

  const renderSettings: RenderSettings = {
    resolution: resolutionFromAspectRatio(config.aspect_ratio),
    fps: 24,
    format: 'mp4',
    quality: config.consistency_strength === 'strict' ? 'ultra' : 'high',
    burn_subtitles: false,
    subtitle_language: null,
  };

  const renderJobs: RenderJob[] = scenes.map((scene) => ({
    id: crypto.randomUUID(),
    episode_id: episodeId,
    scene_id: scene.id,
    type: 'scene',
    status: 'pending',
    progress: 0,
    output_url: null,
    settings: renderSettings,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: now,
  }));

  renderJobs.push({
    id: crypto.randomUUID(),
    episode_id: episodeId,
    scene_id: null,
    type: 'episode',
    status: 'pending',
    progress: 0,
    output_url: null,
    settings: renderSettings,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: now,
  });

  return {
    episode,
    prompts,
    subtitleTracks,
    renderJobs,
  };
}