import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Scene } from "../../../domain/storytelling/entities/Scene";

/**
 * Enhances scene prompts for better image generation
 */
export class PromptEnhancer {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Enhance a scene's visual prompt to create better images
   */
  async enhancePrompt(
    scene: Scene, 
    styleDescription?: string,
    options?: { 
      detailLevel?: 'basic' | 'standard' | 'detailed' | 'highly_detailed';
      improveComposition?: boolean;
      improveLighting?: boolean;
      focus?: 'character' | 'environment' | 'action' | 'balanced';
    }
  ): Promise<{ 
    prompt: string;
    negative_prompt: string;
  }> {
    try {
      const providers = await this.aiRegistry.getFallbackChain('prompt-enhancement');
      
      if (providers.length === 0) {
        // Return the original prompts if no providers are available
        return {
          prompt: scene.prompt_text,
          negative_prompt: scene.negative_prompt
        };
      }
      
      const detailLevel = options?.detailLevel || 'standard';
      const focus = options?.focus || 'balanced';
      
            // Build a compact prompt to enhance the scene's visual prompt (BUG 1 fix: compact JSON, avoid maxTokens)
      console.log('[PROMPT ENHANCER] using compact mode');
      const promptTemplate = `
Enhance this scene into compact JSON for AI image generation.

Scene: ${scene.title}, Mood: ${scene.environment.mood}
Camera: ${scene.cinematography.camera_angle}, Lighting: ${scene.cinematography.lighting}
${scene.characters.length > 0 ? `Characters: ${scene.characters.map(char => `${char.emotion}${char.action ? `, ${char.action}` : ''}`).join('; ')}` : ''}
${styleDescription ? `Style: ${styleDescription}` : ''}
Current prompt: ${scene.prompt_text}
Current negative: ${scene.negative_prompt}

Return ONLY compact JSON:
{"positive":"<enhanced visual prompt, max 200 words>","negative":"<enhanced negative, max 50 words>"}
`;      // Try each provider until one works
      for (const provider of providers) {
        try {
                    const result = await provider.generateJSON<{
            prompt?: string;
            positive?: string;
            negative_prompt?: string;
            negative?: string;
          }>(promptTemplate, { maxTokens: 1500 });
          
          // Handle both {prompt, negative_prompt} and {positive, negative} schemas
          const positive = result.prompt || result.positive || scene.prompt_text;
          const negative = result.negative_prompt || result.negative || scene.negative_prompt;
          
          if (!positive || positive.length === 0) {
            console.log('[PROMPT ENHANCER] fallback to original prompt');
            return {
              prompt: scene.prompt_text,
              negative_prompt: scene.negative_prompt
            };
          }
          
          return {
            prompt: positive,
            negative_prompt: negative
          };        } catch (error) {
          console.warn(`Prompt enhancement failed with provider ${provider.id}:`, error);
        }
      }
      
      // If all providers fail, return original prompts
      return {
        prompt: scene.prompt_text,
        negative_prompt: scene.negative_prompt
      };
      
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
      // Return original prompts if enhancement fails
      return {
        prompt: scene.prompt_text,
        negative_prompt: scene.negative_prompt
      };
    }
  }
  
  /**
   * Enhance prompts for an array of scenes
   */
  async enhanceScenePrompts(
    scenes: Scene[],
    styleDescription?: string,
    options?: {
      detailLevel?: 'basic' | 'standard' | 'detailed' | 'highly_detailed';
      improveComposition?: boolean;
      improveLighting?: boolean;
    }
  ): Promise<Scene[]> {
    // Track which scenes need different focus
    const sceneTypes = this.categorizeScenes(scenes);
    
    // Process scenes in parallel with different focus based on their type
    const enhancedScenes = await Promise.all(
      scenes.map(async (scene, index) => {
        // Determine focus based on scene type
        const focus = this.determineFocus(scene, sceneTypes, index);
        
        // Enhance the prompt
        const enhancedPrompts = await this.enhancePrompt(
          scene,
          styleDescription,
          { ...options, focus }
        );
        
        // Return updated scene
        return {
          ...scene,
          prompt_text: enhancedPrompts.prompt,
          negative_prompt: enhancedPrompts.negative_prompt,
          updated_at: new Date().toISOString()
        };
      })
    );
    
    return enhancedScenes;
  }
  
  /**
   * Categorize scenes by their narrative role
   */
  private categorizeScenes(scenes: Scene[]): {
    establishment: number[];
    character: number[];
    action: number[];
    emotional: number[];
  } {
    const establishment: number[] = [];
    const character: number[] = [];
    const action: number[] = [];
    const emotional: number[] = [];
    
    scenes.forEach((scene, index) => {
      // First scene is usually establishment
      if (index === 0) {
        establishment.push(index);
        return;
      }
      
      // Categorize based on narrative_type and content
      switch(scene.narrative_type) {
        case 'setup':
          establishment.push(index);
          break;
        case 'conflict':
          action.push(index);
          break;
        case 'climax':
          action.push(index);
          emotional.push(index);
          break;
        case 'resolution':
          emotional.push(index);
          break;
        default:
          // For 'transition' or undefined, look at other clues
          break;
      }
      
      // Check character focus
      if (scene.characters.length > 0) {
        // If characters have emotions described, it's more character-focused
        const hasEmotions = scene.characters.some(c => 
          c.emotion && !['neutral', 'normal', 'standard'].includes(c.emotion.toLowerCase())
        );
        
        if (hasEmotions) {
          character.push(index);
          emotional.push(index);
        } else {
          character.push(index);
        }
      }
      
      // Check for action words in description
      const actionWords = ['run', 'jump', 'fight', 'chase', 'escape', 'battle', 'race', 'climb'];
      const hasActionWords = actionWords.some(word => 
        scene.description.toLowerCase().includes(word)
      );
      
      if (hasActionWords) {
        action.push(index);
      }
    });
    
    return {
      establishment,
      character,
      action,
      emotional
    };
  }
  
  /**
   * Determine the focus for a scene based on its type
   */
  private determineFocus(
    scene: Scene, 
    sceneTypes: {
      establishment: number[];
      character: number[];
      action: number[];
      emotional: number[];
    },
    index: number
  ): 'character' | 'environment' | 'action' | 'balanced' {
    // Establishment scenes should focus on environment
    if (sceneTypes.establishment.includes(index)) {
      return 'environment';
    }
    
    // Action scenes should focus on action
    if (sceneTypes.action.includes(index) && !sceneTypes.character.includes(index)) {
      return 'action';
    }
    
    // Character+emotional scenes should focus on characters
    if (sceneTypes.character.includes(index) && sceneTypes.emotional.includes(index)) {
      return 'character';
    }
    
    // Default to balanced
    return 'balanced';
  }
}