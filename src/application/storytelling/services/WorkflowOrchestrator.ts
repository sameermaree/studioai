import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { StoryGenerator } from "./StoryGenerator";
import { Episode, Scene, StylePreset, Character, Prompt, SubtitleTrack, SubtitleEntry, RenderJob, RenderSettings, EpisodeWorkflowConfig } from "../../../types";
import { Story, StoryMetadata } from "../../../domain/storytelling/entities/Story";

export interface WorkflowResult {
  episode: Episode;
  prompts: Prompt[];
  subtitleTracks: SubtitleTrack[];
  renderJobs: RenderJob[];
}

export class WorkflowOrchestrator {
  constructor(
    private aiRegistry: AIProviderRegistry,
    private storyGenerator: StoryGenerator
  ) {}
  
  /**
   * Generate a complete workflow from a story premise
   */
  async generateEpisodeWorkflow(
    config: EpisodeWorkflowConfig,
    stylePresets: StylePreset[],
    characters: Character[]
  ): Promise<WorkflowResult> {
    try {
      console.log('Starting workflow generation...');
      
      // Convert the basic config into a story
      const story = await this.generateStoryFromConfig(config, characters);
      
      // Find the style preset
      const stylePreset = stylePresets.find(s => s.id === config.style_preset_id);
      
      // Create the episode structure
      const episode = this.createEpisodeFromStory(story, config, stylePreset);
      
      // Create prompts for each scene
      const prompts = this.createPromptsFromStory(story, config, stylePreset);
      
      // Create subtitle tracks
      const subtitleTracks = this.createSubtitleTracks(story, config);
      
      // Create render jobs
      const renderJobs = this.createRenderJobs(episode);
      
      console.log('Workflow generation completed successfully');
      
      return {
        episode,
        prompts,
        subtitleTracks,
        renderJobs
      };
    } catch (error) {
      console.error('Workflow generation failed:', error);
      // Fall back to local generation if AI-based generation fails
      return this.fallbackLocalGeneration(config, stylePresets, characters);
    }
  }
  
  /**
   * Generate a story from the workflow config
   */
  private async generateStoryFromConfig(
    config: EpisodeWorkflowConfig,
    characters: Character[]
  ): Promise<Story> {
    // Map characters to the ones specified in the config
    const selectedCharacters = characters.filter(char => 
      config.character_ids.includes(char.id)
    );
    
    // Generate the story
    return await this.storyGenerator.generateStory(config.story, {
      title: config.title,
      language: config.target_language,
      targetAudienceAge: config.target_audience_age,
      stylePresetId: config.style_preset_id,
      consistencyStrength: config.consistency_strength,
      aspectRatio: config.aspect_ratio,
      musicMood: config.music_mood,
      characters: selectedCharacters,
      estimatedSceneCount: config.estimated_scenes,
      durationSeconds: config.duration_seconds,
    });
  }
  
  /**
   * Create an episode structure from a generated story
   */
  private createEpisodeFromStory(
    story: Story,
    config: EpisodeWorkflowConfig,
    stylePreset?: StylePreset
  ): Episode {
    const now = new Date().toISOString();
    const scenes: Scene[] = story.scenes.map((storyScene, index) => ({
      id: storyScene.id,
      episode_id: story.id,
      order: index + 1,
      title: storyScene.title,
      prompt_id: null,
      prompt_text: storyScene.prompt_text,
      negative_prompt: storyScene.negative_prompt,
      camera_angle: storyScene.cinematography.camera_angle,
      motion_instructions: storyScene.cinematography.camera_movement,
      characters: storyScene.characters.map(char => char.characterId),
      style_preset_id: config.style_preset_id || null,
      voice_id: null,
      music_url: null,
      sound_effects: '',
      narration: storyScene.narration,
      subtitle_text: storyScene.subtitle_text,
      subtitles: [],
      duration: storyScene.duration,
      seed: null,
      render_status: 'pending',
      render_url: null,
      image_references: [],
      video_references: [],
      created_at: now,
      updated_at: now,
    }));
    
    return {
      id: story.id,
      title: story.title,
      description: story.description,
      status: 'in_production',
      scenes,
      thumbnail_url: null,
      duration_estimate: scenes.reduce((sum, scene) => sum + scene.duration, 0),
      style_preset_id: config.style_preset_id || null,
      workflow_config: config,
      created_at: now,
      updated_at: now,
    };
  }
  
  /**
   * Create prompts for each scene in the story
   */
  private createPromptsFromStory(
    story: Story,
    config: EpisodeWorkflowConfig,
    stylePreset?: StylePreset
  ): Prompt[] {
    const now = new Date().toISOString();
    
    return story.scenes.map((scene, index) => ({
      id: crypto.randomUUID(),
      name: `${story.title} - ${scene.title}`,
      category: 'cinematic',
      template: scene.prompt_text,
      negative_prompt: scene.negative_prompt,
      language: config.target_language,
      tags: [
        story.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        `scene-${index + 1}`,
        stylePreset?.category || 'custom',
      ],
      is_preset: false,
      style_preset_id: config.style_preset_id || null,
      seed: null,
      metadata: {
        episode_id: story.id,
        scene_id: scene.id,
        environment: scene.environment,
        cinematography: scene.cinematography,
      },
      created_at: now,
      updated_at: now,
    }));
  }
  
  /**
   * Create subtitle tracks for the story
   */
  private createSubtitleTracks(
    story: Story,
    config: EpisodeWorkflowConfig
  ): SubtitleTrack[] {
    const now = new Date().toISOString();
    
    return config.subtitle_languages.map(lang => {
      let timeOffset = 0;
      
      const entries: SubtitleEntry[] = story.scenes.map((scene, index) => {
        const entry: SubtitleEntry = {
          id: crypto.randomUUID(),
          index: index + 1,
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
        episode_id: story.id,
        language: lang,
        entries,
        format: 'srt',
        created_at: now,
        updated_at: now,
      };
    });
  }
  
  /**
   * Create render jobs for an episode
   */
  private createRenderJobs(episode: Episode): RenderJob[] {
    const now = new Date().toISOString();
    
    const resolution = this.resolutionFromAspectRatio(
      episode.workflow_config?.aspect_ratio || '16:9'
    );
    
    const renderSettings: RenderSettings = {
      resolution,
      fps: 24,
      format: 'mp4',
      quality: episode.workflow_config?.consistency_strength === 'strict' ? 'ultra' : 'high',
      burn_subtitles: false,
      subtitle_language: null,
    };
    
    // Create scene render jobs
    const sceneJobs: RenderJob[] = episode.scenes.map(scene => ({
      id: crypto.randomUUID(),
      episode_id: episode.id,
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
    
    // Create episode render job
    const episodeJob: RenderJob = {
      id: crypto.randomUUID(),
      episode_id: episode.id,
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
    };
    
    return [...sceneJobs, episodeJob];
  }
  
  /**
   * Get resolution from aspect ratio
   */
  private resolutionFromAspectRatio(ratio: string): string {
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
   * Fall back to local generation if AI generation fails
   * This maintains compatibility with the existing workflow
   */
  private fallbackLocalGeneration(
    config: EpisodeWorkflowConfig,
    stylePresets: StylePreset[],
    characters: Character[]
  ): WorkflowResult {
    console.warn('Falling back to local generation');
    
    const now = new Date().toISOString();
    const episodeId = crypto.randomUUID();
    
    // Find the style preset
    const stylePreset = stylePresets.find(s => s.id === config.style_preset_id);
    
    // Parse story into scenes
    const sceneTexts = this.parseStoryToScenes(config.story, config.estimated_scenes);
    
    // Calculate scene duration
    const sceneDuration = Math.max(
      3,
      Math.floor(config.duration_seconds / sceneTexts.length)
    );
    
    // Create scenes
    const scenes: Scene[] = sceneTexts.map((text, i) => {
      const { template, negative } = this.buildPromptFromScene(
        text,
        config,
        stylePreset,
        characters
      );
      
      return {
        id: crypto.randomUUID(),
        episode_id: episodeId,
        order: i + 1,
        title: this.generateSceneTitle(text, i),
        prompt_id: null,
        prompt_text: template,
        negative_prompt: negative,
        camera_angle:
          config.camera_style === 'cinematic' ? 'Wide shot' : 'Medium shot',
        motion_instructions:
          config.camera_style === 'dynamic' ? 'Dynamic tracking shot' : 'Slow dolly',
        characters: config.character_ids,
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
    
    // Create render jobs
    const renderSettings: RenderSettings = {
      resolution: this.resolutionFromAspectRatio(config.aspect_ratio),
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
  
  /**
   * Parse a story into scene texts (used for local fallback)
   */
  private parseStoryToScenes(story: string, estimatedScenes: number): string[] {
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
  
  /**
   * Generate a scene title from scene text (used for local fallback)
   */
  private generateSceneTitle(sceneText: string, index: number): string {
    const words = sceneText.split(/\s+/).slice(0, 4).join(' ');
    return `Scene ${index + 1} - ${words}${words.length < sceneText.length ? '...' : ''}`;
  }
  
  /**
   * Build a prompt from scene text (used for local fallback)
   */
  private buildPromptFromScene(
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
}