import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Story, createStory, StoryMetadata } from "../../../domain/storytelling/entities/Story";
import { NarrativeArc, createNarrativeArc, addNarrativeElement } from "../../../domain/storytelling/entities/NarrativeArc";
import { Scene, createScene } from "../../../domain/storytelling/entities/Scene";
import { Character } from "../../../types";

export interface StoryGenerationOptions {
  title?: string;
  language?: string;
  targetAudienceAge?: string;
  stylePresetId?: string;
  consistencyStrength?: 'low' | 'medium' | 'high' | 'strict';
  aspectRatio?: string;
  musicMood?: string;
  characters?: Character[];
  estimatedSceneCount?: number;
  durationSeconds?: number;
}

interface NarrativeStructureResponse {
  title: string;
  narrative_arcs: {
    name: string;
    elements: {
      type: 'setup' | 'conflict' | 'climax' | 'resolution';
      description: string;
    }[];
  }[];
}

interface SceneStructureResponse {
  scenes: {
    title: string;
    description: string;
    narrative_type: 'setup' | 'conflict' | 'climax' | 'resolution' | 'transition';
    environment: {
      location: string;
      time: string;
      mood: string;
    };
    cinematography: {
      camera_angle: string;
      camera_movement: string;
      lighting: string;
    };
    characters: {
      character_id: string;
      emotion: string;
      action?: string;
    }[];
    narration: string;
    visual_prompt: string;
    negative_prompt?: string;
    duration: number;
  }[];
}

export class StoryGenerator {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Generate a story from a premise
   */
  async generateStory(premise: string, options: StoryGenerationOptions = {}): Promise<Story> {
    // Create basic story structure
    const metadata: Partial<StoryMetadata> = {
      target_audience_age: options.targetAudienceAge || '8-12',
      style_id: options.stylePresetId,
      language: options.language || 'en',
      music_mood: options.musicMood,
      consistency_strength: options.consistencyStrength || 'medium',
      aspect_ratio: options.aspectRatio || '16:9',
    };
    
    const storyTitle = options.title || await this.generateTitle(premise, metadata);
    let story = createStory(storyTitle, premise, metadata);
    
    try {
      // Generate narrative structure
      const narrativeStructure = await this.generateNarrativeStructure(premise, options);
      
      // Validate narrative structure
      if (!narrativeStructure.narrative_arcs || !Array.isArray(narrativeStructure.narrative_arcs)) {
        console.warn('Invalid narrative_arcs, creating fallback structure');
        narrativeStructure.narrative_arcs = [{
          name: 'Main Story Arc',
          elements: [
            { type: 'setup', description: premise },
            { type: 'conflict', description: 'Story develops' },
            { type: 'climax', description: 'Story reaches peak' },
            { type: 'resolution', description: 'Story concludes' }
          ]
        }];
      }
      
      // Create narrative arcs
      for (const arcData of narrativeStructure.narrative_arcs) {
        const arc = createNarrativeArc(arcData.name);
        
        // Add elements to the arc
        let updatedArc = arc;
        for (const element of arcData.elements) {
          updatedArc = addNarrativeElement(updatedArc, element.type, element.description);
        }
        
        // Add arc to story
        story = {
          ...story,
          narrativeArcs: [...story.narrativeArcs, updatedArc],
        };
      }
      
      // Generate scenes based on narrative structure
      const sceneStructure = await this.generateSceneStructure(story, options);
      
      // Validate scene structure has correct count
      const requestedScenes = options.estimatedSceneCount || 3;
      if (!sceneStructure.scenes || sceneStructure.scenes.length === 0) {
        console.error('No scenes returned from generateSceneStructure, creating fallback');
        throw new Error('Scene generation failed');
      }
      
      // Create scenes
      const scenes: Scene[] = [];
      
      for (const [index, sceneData] of sceneStructure.scenes.entries()) {
        const scene = createScene(
          story.id,
          index + 1,
          sceneData.title,
          sceneData.description
        );
        
        // Update scene with generated data
        const updatedScene: Scene = {
          ...scene,
          narrative_type: sceneData.narrative_type,
          environment: sceneData.environment,
          cinematography: sceneData.cinematography,
          narration: sceneData.narration,
          subtitle_text: sceneData.narration,
          prompt_text: sceneData.visual_prompt,
          negative_prompt: sceneData.negative_prompt || '',
          duration: sceneData.duration || 5,
          characters: sceneData.characters.map(char => ({
            characterId: char.character_id,
            emotion: char.emotion,
            action: char.action
          })),
        };
        
        scenes.push(updatedScene);
      }
      
      // Add all scenes to the story
      story = {
        ...story,
        scenes,
      };
      
      return story;
      
    } catch (error) {
      console.error('Error in story generation:', error);
      
      // If AI generation fails, return a basic story with minimal structure
      return this.createBasicStory(premise, options);
    }
  }
  
  /**
   * Generate a title for the story
   */
  private async generateTitle(premise: string, metadata: Partial<StoryMetadata>): Promise<string> {
    try {
      // Get AI providers for text generation
      const providers = await this.aiRegistry.getFallbackChain('text-generation');
      
      if (providers.length === 0) {
        return `Story ${new Date().toISOString()}`;
      }
      
      const language = metadata.language || 'en';
      const languageInstruction = language === 'ar' 
        ? 'CRITICAL: Generate the title in Arabic language only. لا تستخدم الإنجليزية.' 
        : `Generate the title in ${language} language.`;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const prompt = `
${languageInstruction}
Generate a catchy, engaging title for a children's animated story with this premise:
"${premise}"

Target audience age: ${metadata.target_audience_age || '8-12'}

The title should be short (2-7 words), engaging, and appropriate for animation.
Return only the title without quotes or additional text.`;
          
          const result = await provider.generateText(prompt);
          return result.text.trim().replace(/^["']|["']$/g, '');
        } catch (error) {
          console.warn(`Title generation failed with provider ${provider.id}:`, error);
        }
      }
      
      return `Story ${new Date().toISOString()}`;
    } catch (error) {
      console.error('Failed to generate title:', error);
      return `Story ${new Date().toISOString()}`;
    }
  }
  
  /**
   * Generate narrative structure for a story
   */
  private async generateNarrativeStructure(
    premise: string, 
    options: StoryGenerationOptions
  ): Promise<NarrativeStructureResponse> {
    // Get AI providers for narrative structure
    const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
    
    if (providers.length === 0) {
      throw new Error('No available AI providers for narrative structure generation');
    }
    
    // Prepare characters for prompt
    const characterDescriptions = options.characters 
      ? options.characters.map(char => `- ${char.name}: ${char.description}`).join('\n')
      : 'No specific characters provided.';
    
    const language = options.language || 'en';
    const languageInstruction = language === 'ar' 
      ? 'CRITICAL: Generate ALL content (titles, descriptions, narration) in Arabic language only. لا تستخدم الإنجليزية أبداً.' 
      : `Generate ALL content in ${language} language.`;
    
    // Create prompt for narrative structure
    const prompt = `
${languageInstruction}
Create a narrative structure for an animated story with the following premise:
"${premise}"

Target audience age: ${options.targetAudienceAge || '8-12'}

Characters:
${characterDescriptions}

The structure should include 1-3 narrative arcs, each with setup, conflict, climax, and resolution elements.

Return a JSON object with this structure:
{
  "title": "Story Title",
  "narrative_arcs": [
    {
      "name": "Arc Name",
      "elements": [
        {
          "type": "setup",
          "description": "Description of setup"
        },
        {
          "type": "conflict",
          "description": "Description of conflict"
        },
        {
          "type": "climax",
          "description": "Description of climax"
        },
        {
          "type": "resolution",
          "description": "Description of resolution"
        }
      ]
    }
  ]
}

Make sure each narrative element description is detailed and provides clear guidance for scene creation.`;
    
    // Try each provider until one works
    for (const provider of providers) {
      try {
        const result = await provider.generateJSON<NarrativeStructureResponse>(prompt);
        return result;
      } catch (error) {
        console.warn(`Narrative structure generation failed with provider ${provider.id}:`, error);
      }
    }
    
    throw new Error('All AI providers failed to generate narrative structure');
  }
  
  /**
   * Generate scene structure based on narrative structure
   */
  private async generateSceneStructure(
    story: Story, 
    options: StoryGenerationOptions
  ): Promise<SceneStructureResponse> {
    // Get AI providers for scene generation
    const providers = await this.aiRegistry.getFallbackChain('scene-generation');
    
    if (providers.length === 0) {
      throw new Error('No available AI providers for scene generation');
    }
    
    // Use EXACT scene count from options, no fallback calculation
    const sceneCount = options.estimatedSceneCount || 3;
    console.log(`StoryGenerator: Generating ${sceneCount} scenes (from options.estimatedSceneCount: ${options.estimatedSceneCount})`);
    
    // Prepare narrative arcs for prompt
    const narrativeArcsText = story.narrativeArcs.map(arc => {
      const elementsText = arc.elements.map(el => 
        `    - ${el.type}: ${el.description}`
      ).join('\n');
      
      return `  - ${arc.name}:\n${elementsText}`;
    }).join('\n');
    
    // Prepare characters for prompt
    const characterIds = options.characters 
      ? options.characters.map(char => char.id)
      : [];
      
    const characterDescriptions = options.characters 
      ? options.characters.map(char => 
          `  - ID: "${char.id}", Name: "${char.name}", Description: "${char.description}"`
        ).join('\n')
      : 'No specific characters provided.';
    
    const language = options.language || 'en';
    const isArabic = language === 'ar';
    const languageInstruction = isArabic
      ? `LANGUAGE: Arabic for user-facing text, English for visual_prompt.
Generate:
- title, description, narration: Arabic (example: "في غابة مظلمة، يظهر ضوء غامض")
- location, time, mood: Arabic (example: "غابة كثيفة، وقت الغروب، جو غامض")
- camera_angle, camera_movement, lighting: Arabic (example: "لقطة واسعة، حركة بطيئة، إضاءة خافتة")
- emotion, action: Arabic (example: "فضولي، يتقدم بحذر")
- visual_prompt: English for image generation (example: "A mysterious glowing portal in a dense forest at sunset")
Avoid repetition. Each scene must advance the story with unique events, emotions, and details.`
      : `Generate ALL content in ${language}. Avoid repetition. Each scene must be unique and advance the story.`;
    
    // Create prompt for scene structure
    const prompt = `
${languageInstruction}
Create a detailed scene breakdown for an animated story with the following details:

TITLE: "${story.title}"

PREMISE: "${story.premise}"

NARRATIVE ARCS:
${narrativeArcsText}

CHARACTERS:
${characterDescriptions}

TARGET AUDIENCE AGE: ${options.targetAudienceAge || '8-12'}

IMPORTANT: Generate EXACTLY ${sceneCount} scenes.

CONTINUITY RULES:
- Each scene builds on the previous
- Characters remember what happened
- Emotions evolve naturally
- Avoid repeating phrases or scenarios
- Show progression, not just description

Each scene needs:
- title, description, narration (in target language)
- narrative_type (setup/conflict/climax/resolution/transition)
- environment (location, time, mood in target language)
- cinematography (camera_angle, camera_movement, lighting in target language)
- characters (emotion, action in target language)
- visual_prompt (English, brief, image-generation focused)
- negative_prompt (optional)
- duration (5-15 seconds)

Return a JSON object with this structure:
{
  "scenes": [
    {
      "title": "Scene title",
      "description": "Scene description",
      "narrative_type": "setup",
      "environment": {
        "location": "Location description",
        "time": "Time of day",
        "mood": "Environmental mood"
      },
      "cinematography": {
        "camera_angle": "Camera angle description",
        "camera_movement": "Camera movement description",
        "lighting": "Lighting description"
      },
      "characters": [
        {
          "character_id": "${characterIds.length > 0 ? characterIds[0] : 'character-id'}",
          "emotion": "Character's emotion",
          "action": "Character's action"
        }
      ],
      "narration": "Narration text for this scene",
      "visual_prompt": "Detailed visual prompt for image generation",
      "negative_prompt": "Optional negative prompt",
      "duration": 8
    }
  ]
}

Make visual prompts detailed and descriptive for AI image generation. Include style, lighting, composition, and character details.`;
    
    // Try each provider until one works
    let lastError: Error | null = null;
    
    for (const provider of providers) {
      try {
        const result = await provider.generateJSON<SceneStructureResponse>(prompt);
        
        // Validate scene count matches requested count
        console.log(`Provider ${provider.id} returned ${result.scenes?.length || 0} scenes, requested: ${sceneCount}`);
        
        // CRITICAL: Enforce exact scene count
        if (!result.scenes || result.scenes.length === 0) {
          console.error(`Provider ${provider.id} returned no scenes!`);
          lastError = new Error('No scenes returned');
          continue;
        }
        
        if (result.scenes.length < sceneCount) {
          console.warn(`Provider returned only ${result.scenes.length} scenes. Padding to ${sceneCount}...`);
          const lastScene = result.scenes[result.scenes.length - 1];
          while (result.scenes.length < sceneCount) {
            result.scenes.push({ 
              ...lastScene,
              title: `${lastScene.title} (Part ${result.scenes.length + 1})`
            });
          }
        } else if (result.scenes.length > sceneCount) {
          console.warn(`Provider returned ${result.scenes.length} scenes. Truncating to ${sceneCount}...`);
          result.scenes = result.scenes.slice(0, sceneCount);
        }
        
        console.log(`Final scene count after adjustment: ${result.scenes.length}`);
        console.log(`Scene titles: ${result.scenes.map((s, i) => `${i + 1}. ${s.title}`).join(', ')}`);
        console.log(`Scene languages sample: title="${result.scenes[0]?.title}", narration="${result.scenes[0]?.narration?.substring(0, 50)}..."`);
        
        return result;
      } catch (error) {
        console.warn(`Scene structure generation failed with provider ${provider.id}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    
    // All providers failed - create fallback scenes programmatically
    console.error('All providers failed, creating fallback scenes');
    console.error('Last error:', lastError?.message);
    
    const fallbackScenes: SceneStructureResponse['scenes'] = [];
    
    for (let i = 0; i < sceneCount; i++) {
      const num = i + 1;
      fallbackScenes.push({
        title: isArabic ? `المشهد ${num}` : `Scene ${num}`,
        description: isArabic ? `${story.premise} (الجزء ${num})` : `${story.premise} (Part ${num})`,
        narrative_type: i === 0 ? 'setup' : i === sceneCount - 1 ? 'resolution' : 'conflict',
        environment: {
          location: isArabic ? 'موقع المشهد' : 'Scene location',
          time: isArabic ? 'وقت النهار' : 'Daytime',
          mood: isArabic ? 'جو المشهد' : 'Scene mood'
        },
        cinematography: {
          camera_angle: isArabic ? 'لقطة متوسطة' : 'Medium shot',
          camera_movement: isArabic ? 'حركة بطيئة' : 'Slow movement',
          lighting: isArabic ? 'إضاءة طبيعية' : 'Natural lighting'
        },
        characters: options.characters?.map(char => ({
          character_id: char.id,
          emotion: isArabic ? 'محايد' : 'neutral',
          action: isArabic ? 'يتحرك' : 'moving'
        })) || [],
        narration: isArabic ? `${story.premise} (الجزء ${num})` : `${story.premise} (Part ${num})`,
        visual_prompt: isArabic ? `مشهد من ${story.title}، الجزء ${num}` : `Scene from ${story.title}, part ${num}`,
        negative_prompt: 'blurry, low quality, deformed',
        duration: 8
      });
    }
    
    console.log(`Created ${fallbackScenes.length} programmatic fallback scenes in ${language}`);
    return { scenes: fallbackScenes };
  }
  
  /**
   * Create a basic story with minimal structure (fallback)
   */
  private createBasicStory(premise: string, options: StoryGenerationOptions): Story {
    const metadata: Partial<StoryMetadata> = {
      target_audience_age: options.targetAudienceAge || '8-12',
      style_id: options.stylePresetId,
      language: options.language || 'en',
      music_mood: options.musicMood,
      consistency_strength: options.consistencyStrength || 'medium',
      aspect_ratio: options.aspectRatio || '16:9',
    };
    
    const title = options.title || `Story ${new Date().toISOString()}`;
    let story = createStory(title, premise, metadata);
    
    // Create a simple narrative arc
    const arc = createNarrativeArc('Main Arc');
    const updatedArc = addNarrativeElement(arc, 'setup', premise);
    
    // Create scenes equal to requested count
    const requestedScenes = options.estimatedSceneCount || 3;
    const scenes: Scene[] = [];
    
    for (let i = 0; i < requestedScenes; i++) {
      const scene = createScene(
        story.id, 
        i + 1, 
        `Scene ${i + 1}`, 
        `${premise} (Part ${i + 1})`
      );
      scenes.push(scene);
    }
    
    console.log(`Created fallback story with ${scenes.length} scenes (requested: ${requestedScenes})`);
    
    return {
      ...story,
      narrativeArcs: [updatedArc],
      scenes,
    };
  }
}