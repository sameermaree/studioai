import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Story } from "../../../domain/storytelling/entities/Story";
import { Scene, SceneEnvironment, SceneCinematography } from "../../../domain/storytelling/entities/Scene";
import { Character } from "../../../types";

export interface CinematicAnalysisResult {
  cinematicIssues: {
    cameraRepetition: boolean;
    sceneVisualsRepetition: boolean;
    weakCameraChoices: number[];
    poorCinematicFlow: boolean;
    emotionalPacingIssues: boolean;
    inconsistentLighting: boolean;
    poorSceneDependencies: number[];
  };
  cinematicSuggestions: {
    cameraSequence: {
      sceneIndex: number;
      camera_angle: string;
      camera_movement: string;
      lighting: string;
      rationale: string;
    }[];
    emotionalPacing: {
      sceneIndex: number;
      suggestedMood: string;
      visualTone: string;
    }[];
    transitionEnhancements: {
      fromSceneIndex: number;
      toSceneIndex: number;
      transitionType: string;
      visualCue: string;
    }[];
    cinematicContinuity: {
      sceneIndex: number;
      continuityNotes: string;
    }[];
  };
}

/**
 * Enhances cinematic qualities of storytelling
 */
export class CinematicIntelligenceEngine {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Analyze a story for cinematic weaknesses and opportunities
   */
  async analyzeCinematic(story: Story): Promise<CinematicAnalysisResult> {
    try {
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for cinematic analysis');
      }
      
      // Create a scene breakdown for the prompt
      const sceneBreakdown = story.scenes.map((scene, index) => 
        `Scene ${index + 1}: "${scene.title}"
  - Description: ${scene.description.substring(0, 100)}...
  - Environment: ${scene.environment.location}, ${scene.environment.time}, Mood: ${scene.environment.mood}
  - Camera: ${scene.cinematography.camera_angle}, Movement: ${scene.cinematography.camera_movement}, Lighting: ${scene.cinematography.lighting}
  - Narrative type: ${scene.narrative_type}`
      ).join("\n\n");
      
      const prompt = `
As a master film director, analyze this animated story for cinematic storytelling quality:

Title: "${story.title}"
Premise: "${story.premise}"

SCENE BREAKDOWN:
${sceneBreakdown}

Evaluate this story specifically for cinematic issues:
1. Camera angle repetition (using the same camera angles repeatedly)
2. Scene visuals repetition (similar visual compositions across scenes)
3. Weak camera choices (camera angles that don't enhance storytelling)
4. Poor cinematic flow (awkward visual progression between scenes)
5. Emotional pacing issues (visual tone doesn't support emotional arcs)
6. Inconsistent lighting (lighting that doesn't follow logical progression)
7. Poor scene dependencies (scenes that don't visually build on each other)

Return a detailed cinematic analysis as a JSON object with these structures:
{
  "cinematicIssues": {
    "cameraRepetition": true/false,
    "sceneVisualsRepetition": true/false,
    "weakCameraChoices": [indices of scenes with poor camera choices],
    "poorCinematicFlow": true/false,
    "emotionalPacingIssues": true/false,
    "inconsistentLighting": true/false,
    "poorSceneDependencies": [indices of scenes with dependency issues]
  },
  "cinematicSuggestions": {
    "cameraSequence": [
      {
        "sceneIndex": scene index,
        "camera_angle": "Suggested camera angle",
        "camera_movement": "Suggested camera movement",
        "lighting": "Suggested lighting",
        "rationale": "Why this camera approach enhances the story"
      }
    ],
    "emotionalPacing": [
      {
        "sceneIndex": scene index,
        "suggestedMood": "Mood that better supports the narrative",
        "visualTone": "Visual tone description"
      }
    ],
    "transitionEnhancements": [
      {
        "fromSceneIndex": source scene index,
        "toSceneIndex": target scene index,
        "transitionType": "cut/fade/dissolve/etc",
        "visualCue": "Visual element that bridges the scenes"
      }
    ],
    "cinematicContinuity": [
      {
        "sceneIndex": scene index,
        "continuityNotes": "Notes on visual continuity with adjacent scenes"
      }
    ]
  }
}

Focus on professional cinematic techniques that would be used in high-quality animated productions.
Provide detailed, actionable suggestions for each issue identified.`;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<CinematicAnalysisResult>(prompt);
          return this.validateAnalysisResult(result);
        } catch (error) {
          console.warn(`Cinematic analysis failed with provider ${provider.id}:`, error);
        }
      }
      
      throw new Error('All providers failed to analyze cinematic elements');
    } catch (error) {
      console.error('Failed to analyze cinematic elements:', error);
      // Return default empty analysis
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Enhance cinematography in a story based on analysis
   */
  async enhanceCinematography(story: Story, characters: Character[]): Promise<Story> {
    try {
      // Analyze cinematic elements first
      const analysis = await this.analyzeCinematic(story);
      
      // If there are no significant issues, return the story unchanged
      if (
        !analysis.cinematicIssues.cameraRepetition &&
        !analysis.cinematicIssues.sceneVisualsRepetition &&
        analysis.cinematicIssues.weakCameraChoices.length === 0 &&
        !analysis.cinematicIssues.poorCinematicFlow &&
        !analysis.cinematicIssues.emotionalPacingIssues &&
        !analysis.cinematicIssues.inconsistentLighting &&
        analysis.cinematicIssues.poorSceneDependencies.length === 0
      ) {
        return story;
      }
      
      // Get AI provider for enhancement
      const providers = await this.aiRegistry.getFallbackChain('scene-generation');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for cinematography enhancement');
      }
      
      // Apply camera sequence suggestions if available
      let enhancedScenes = [...story.scenes];
      
      // Apply suggested camera changes
      if (analysis.cinematicSuggestions.cameraSequence.length > 0) {
        for (const suggestion of analysis.cinematicSuggestions.cameraSequence) {
          const sceneIndex = suggestion.sceneIndex;
          
          if (sceneIndex >= 0 && sceneIndex < enhancedScenes.length) {
            enhancedScenes[sceneIndex] = {
              ...enhancedScenes[sceneIndex],
              cinematography: {
                camera_angle: suggestion.camera_angle,
                camera_movement: suggestion.camera_movement,
                lighting: suggestion.lighting,
                composition: enhancedScenes[sceneIndex].cinematography.composition
              },
              updated_at: new Date().toISOString(),
            };
          }
        }
      }
      
      // Apply emotional pacing suggestions
      if (analysis.cinematicSuggestions.emotionalPacing.length > 0) {
        for (const suggestion of analysis.cinematicSuggestions.emotionalPacing) {
          const sceneIndex = suggestion.sceneIndex;
          
          if (sceneIndex >= 0 && sceneIndex < enhancedScenes.length) {
            enhancedScenes[sceneIndex] = {
              ...enhancedScenes[sceneIndex],
              environment: {
                ...enhancedScenes[sceneIndex].environment,
                mood: suggestion.suggestedMood,
              },
              updated_at: new Date().toISOString(),
            };
          }
        }
      }
      
      // For scenes that still need improvement, use AI to enhance them
      const scenesToEnhance = new Set<number>();
      
      // Add scenes with weak camera choices
      for (const index of analysis.cinematicIssues.weakCameraChoices) {
        scenesToEnhance.add(index);
      }
      
      // Add scenes with dependency issues
      for (const index of analysis.cinematicIssues.poorSceneDependencies) {
        scenesToEnhance.add(index);
      }
      
      // Add scenes with continuity issues
      for (const suggestion of analysis.cinematicSuggestions.cinematicContinuity) {
        scenesToEnhance.add(suggestion.sceneIndex);
      }
      
      // For each scene that needs enhancement
      for (const sceneIndex of scenesToEnhance) {
        if (sceneIndex < 0 || sceneIndex >= enhancedScenes.length) {
          continue;
        }
        
        const scene = enhancedScenes[sceneIndex];
        
        // Find the scene-specific suggestions
        const cameraSequenceSuggestion = analysis.cinematicSuggestions.cameraSequence.find(
          s => s.sceneIndex === sceneIndex
        );
        
        const emotionalPacingSuggestion = analysis.cinematicSuggestions.emotionalPacing.find(
          s => s.sceneIndex === sceneIndex
        );
        
        const continuitySuggestion = analysis.cinematicSuggestions.cinematicContinuity.find(
          s => s.sceneIndex === sceneIndex
        );
        
        const transitionsFrom = analysis.cinematicSuggestions.transitionEnhancements.filter(
          s => s.fromSceneIndex === sceneIndex
        );
        
        const transitionsTo = analysis.cinematicSuggestions.transitionEnhancements.filter(
          s => s.toSceneIndex === sceneIndex
        );
        
        // Get relevant characters
        const sceneCharacters = characters.filter(character => 
          scene.characters.some(sc => sc.characterId === character.id)
        );
        
        // Build context from previous and next scenes for continuity
        let previousSceneContext = '';
        let nextSceneContext = '';
        
        if (sceneIndex > 0) {
          const prevScene = enhancedScenes[sceneIndex - 1];
          previousSceneContext = `Previous scene (${prevScene.title}): ${prevScene.description.substring(0, 100)}...\nCamera: ${prevScene.cinematography.camera_angle}, Lighting: ${prevScene.cinematography.lighting}, Mood: ${prevScene.environment.mood}`;
        }
        
        if (sceneIndex < enhancedScenes.length - 1) {
          const nextScene = enhancedScenes[sceneIndex + 1];
          nextSceneContext = `Next scene (${nextScene.title}): ${nextScene.description.substring(0, 100)}...\nCamera: ${nextScene.cinematography.camera_angle}, Lighting: ${nextScene.cinematography.lighting}, Mood: ${nextScene.environment.mood}`;
        }
        
        // Create prompt for cinematography enhancement
        const cinematographyPrompt = `
As a master cinematographer, enhance this animated scene with professional cinematic techniques:

SCENE: "${scene.title}"
DESCRIPTION: ${scene.description}
NARRATIVE TYPE: ${scene.narrative_type}
CHARACTERS: ${sceneCharacters.map(c => `${c.name} (${scene.characters.find(sc => sc.characterId === c.id)?.emotion || 'neutral'})`).join(', ')}

CURRENT CINEMATOGRAPHY:
- Camera angle: ${scene.cinematography.camera_angle}
- Camera movement: ${scene.cinematography.camera_movement}
- Lighting: ${scene.cinematography.lighting}
- Environment: ${scene.environment.location}, ${scene.environment.time}
- Mood: ${scene.environment.mood}

CONTINUITY CONTEXT:
${previousSceneContext}
${nextSceneContext}

ENHANCEMENT SUGGESTIONS:
${cameraSequenceSuggestion ? `- Camera: ${cameraSequenceSuggestion.rationale}` : ''}
${emotionalPacingSuggestion ? `- Emotional: Consider mood "${emotionalPacingSuggestion.suggestedMood}" with visual tone "${emotionalPacingSuggestion.visualTone}"` : ''}
${continuitySuggestion ? `- Continuity: ${continuitySuggestion.continuityNotes}` : ''}
${transitionsFrom.length > 0 ? `- Transition to next scene: ${transitionsFrom[0].transitionType} with visual cue "${transitionsFrom[0].visualCue}"` : ''}
${transitionsTo.length > 0 ? `- Transition from previous scene: ${transitionsTo[0].transitionType} with visual cue "${transitionsTo[0].visualCue}"` : ''}

Your task is to create enhanced cinematography that elevates the scene with professional film techniques.
Return a JSON object with:
{
  "camera_angle": "Enhanced camera angle",
  "camera_movement": "Enhanced camera movement",
  "lighting": "Enhanced lighting",
  "composition": "Detailed composition description",
  "visual_prompt": "Enhanced visual prompt for image generation",
  "narration_enhancement": "Suggested enhancement to scene narration to match new cinematography",
  "directorial_notes": "Professional director's notes for rendering this scene"
}

Make sure your suggestions align with professional animation and cinematography standards.`;
        
        // Try each provider until one works
        for (const provider of providers) {
          try {
            const result = await provider.generateJSON<{
              camera_angle: string;
              camera_movement: string;
              lighting: string;
              composition: string;
              visual_prompt: string;
              narration_enhancement: string;
              directorial_notes: string;
            }>(cinematographyPrompt);
            
            // Update the scene with enhanced cinematography
            enhancedScenes[sceneIndex] = {
              ...enhancedScenes[sceneIndex],
              cinematography: {
                camera_angle: result.camera_angle || enhancedScenes[sceneIndex].cinematography.camera_angle,
                camera_movement: result.camera_movement || enhancedScenes[sceneIndex].cinematography.camera_movement,
                lighting: result.lighting || enhancedScenes[sceneIndex].cinematography.lighting,
                composition: result.composition || enhancedScenes[sceneIndex].cinematography.composition,
              },
              // Only update narration if significant enhancement provided
              narration: result.narration_enhancement?.length > 50 ? 
                result.narration_enhancement : 
                enhancedScenes[sceneIndex].narration,
              // Update subtitle if narration was updated
              subtitle_text: result.narration_enhancement?.length > 50 ? 
                result.narration_enhancement : 
                enhancedScenes[sceneIndex].subtitle_text,
              // Update prompt with visual prompt enhancement
              prompt_text: result.visual_prompt || enhancedScenes[sceneIndex].prompt_text,
              // Add composition as directorial notes in the prompt
              prompt_text: enhancedScenes[sceneIndex].prompt_text + 
                `\n\nComposition: ${result.composition}` +
                `\n\nDirectorial notes: ${result.directorial_notes}`,
              updated_at: new Date().toISOString(),
            };
            
            break;
          } catch (error) {
            console.warn(`Cinematography enhancement failed with provider ${provider.id}:`, error);
          }
        }
      }
      
      // Apply transition enhancements to scene descriptions
      for (const transition of analysis.cinematicSuggestions.transitionEnhancements) {
        const fromIndex = transition.fromSceneIndex;
        const toIndex = transition.toSceneIndex;
        
        if (
          fromIndex >= 0 && 
          fromIndex < enhancedScenes.length &&
          toIndex >= 0 && 
          toIndex < enhancedScenes.length
        ) {
          // Add transition cue to the "from" scene
          enhancedScenes[fromIndex] = {
            ...enhancedScenes[fromIndex],
            description: enhancedScenes[fromIndex].description + 
              `\n\nTransition: ${transition.transitionType} to next scene with visual cue: ${transition.visualCue}`,
            updated_at: new Date().toISOString(),
          };
          
          // Add transition reference to the "to" scene
          enhancedScenes[toIndex] = {
            ...enhancedScenes[toIndex],
            description: enhancedScenes[toIndex].description + 
              `\n\nContinuing from previous scene via ${transition.transitionType} transition with visual cue: ${transition.visualCue}`,
            updated_at: new Date().toISOString(),
          };
        }
      }
      
      return {
        ...story,
        scenes: enhancedScenes,
        updated_at: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Failed to enhance cinematography:', error);
      // Return original story if enhancement fails
      return story;
    }
  }
  
  /**
   * Generate an anti-repetition matrix to prevent repetitive cinematography
   */
  async generateCameraVarietyMatrix(sceneCount: number): Promise<{
    camera_angles: string[];
    camera_movements: string[];
    lighting_setups: string[];
    recommendedSequence: Array<{
      sceneIndex: number;
      camera_angle: string;
      camera_movement: string;
      lighting: string;
    }>;
  }> {
    try {
      // Get AI providers for generation
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for camera variety generation');
      }
      
      const prompt = `
As a master cinematographer, create a professional camera variety matrix for an animated story with ${sceneCount} scenes.

Create a sequence that provides visual variety, narrative progression, and professional cinematography.

Return a JSON object with:
{
  "camera_angles": [array of 8-12 distinct professional camera angles],
  "camera_movements": [array of 6-10 distinct camera movement techniques],
  "lighting_setups": [array of 5-8 distinct lighting approaches],
  "recommendedSequence": [
    {
      "sceneIndex": 0,
      "camera_angle": "selected camera angle",
      "camera_movement": "selected camera movement",
      "lighting": "selected lighting"
    },
    ...one entry for each scene
  ]
}

The recommended sequence should:
1. Avoid repeating the same camera angle in consecutive scenes
2. Follow logical emotional progression (wide establishing shots to intimate close-ups during emotional moments)
3. Match camera movements to scene intensity (steady for calm, dynamic for action)
4. Provide visual variety throughout the story
5. Use professional film language and techniques

Include a mix of standard shots (wide, medium, close-up) and more creative angles (low angle, high angle, etc.)
Each sequence choice should have deliberate cinematic purpose.`;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<{
            camera_angles: string[];
            camera_movements: string[];
            lighting_setups: string[];
            recommendedSequence: Array<{
              sceneIndex: number;
              camera_angle: string;
              camera_movement: string;
              lighting: string;
            }>;
          }>(prompt);
          
          // Validate and ensure we have entries for all scenes
          const validatedSequence = this.validateCameraSequence(result.recommendedSequence, sceneCount);
          
          return {
            camera_angles: result.camera_angles || [],
            camera_movements: result.camera_movements || [],
            lighting_setups: result.lighting_setups || [],
            recommendedSequence: validatedSequence,
          };
        } catch (error) {
          console.warn(`Camera variety matrix generation failed with provider ${provider.id}:`, error);
        }
      }
      
      throw new Error('All providers failed to generate camera variety matrix');
    } catch (error) {
      console.error('Failed to generate camera variety matrix:', error);
      // Return a basic default matrix
      return this.getDefaultCameraMatrix(sceneCount);
    }
  }
  
  /**
   * Apply camera variety matrix to a story
   */
  async applyCameraVarietyMatrix(story: Story): Promise<Story> {
    // Generate a camera variety matrix
    const matrix = await this.generateCameraVarietyMatrix(story.scenes.length);
    
    // Apply the matrix to the scenes
    const enhancedScenes = story.scenes.map((scene, index) => {
      // Find the recommended cinematography for this scene
      const recommendation = matrix.recommendedSequence.find(r => r.sceneIndex === index);
      
      if (!recommendation) {
        return scene;
      }
      
      return {
        ...scene,
        cinematography: {
          camera_angle: recommendation.camera_angle,
          camera_movement: recommendation.camera_movement,
          lighting: recommendation.lighting,
          composition: scene.cinematography.composition,
        },
        updated_at: new Date().toISOString(),
      };
    });
    
    return {
      ...story,
      scenes: enhancedScenes,
      updated_at: new Date().toISOString(),
    };
  }
  
  /**
   * Enhance scene purpose and emotional pacing
   */
  async enhanceScenePurpose(story: Story): Promise<Story> {
    try {
      // Get AI providers for enhancement
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for scene purpose enhancement');
      }
      
      // Prepare scene summary for prompt
      const sceneSummaries = story.scenes.map((scene, index) => 
        `Scene ${index + 1}: "${scene.title}"
  - Type: ${scene.narrative_type}
  - Description: ${scene.description.substring(0, 100)}...`
      ).join("\n\n");
      
      const prompt = `
As a master storyteller, analyze and enhance the purpose and emotional pacing of each scene:

STORY:
Title: "${story.title}"
Premise: "${story.premise}"

CURRENT SCENES:
${sceneSummaries}

For each scene, provide:
1. A clear narrative purpose (what it accomplishes in the story)
2. An emotional tone or beat (what audience should feel)
3. A suggestion for enhancing its narrative purpose
4. An improved scene description (if needed)

Return as a JSON array:
[
  {
    "sceneIndex": 0,
    "narrative_purpose": "clear statement of scene's purpose",
    "emotional_tone": "primary emotional beat",
    "enhancement_suggestion": "specific suggestion for improvement",
    "improved_description": "enhanced scene description"
  },
  ...one entry for each scene
]

Focus on creating a strong emotional arc across scenes, avoiding repetitive emotional beats,
and ensuring each scene has a distinct purpose in advancing the story.`;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<Array<{
            sceneIndex: number;
            narrative_purpose: string;
            emotional_tone: string;
            enhancement_suggestion: string;
            improved_description: string;
          }>>(prompt);
          
          // Apply the enhancements to the scenes
          const enhancedScenes = story.scenes.map((scene, index) => {
            const enhancement = result.find(e => e.sceneIndex === index);
            
            if (!enhancement) {
              return scene;
            }
            
            return {
              ...scene,
              // Update description with narrative purpose and improved description
              description: enhancement.improved_description || scene.description,
              // Update environment mood with emotional tone
              environment: {
                ...scene.environment,
                mood: enhancement.emotional_tone || scene.environment.mood,
              },
              // Add narrative purpose to the prompt
              prompt_text: scene.prompt_text + `\n\nNarrative purpose: ${enhancement.narrative_purpose}`,
              updated_at: new Date().toISOString(),
            };
          });
          
          return {
            ...story,
            scenes: enhancedScenes,
            updated_at: new Date().toISOString(),
          };
        } catch (error) {
          console.warn(`Scene purpose enhancement failed with provider ${provider.id}:`, error);
        }
      }
      
      throw new Error('All providers failed to enhance scene purpose');
    } catch (error) {
      console.error('Failed to enhance scene purpose:', error);
      // Return original story if enhancement fails
      return story;
    }
  }
  
  /**
   * Validate and ensure camera sequence has entries for all scenes
   */
  private validateCameraSequence(
    sequence: Array<{
      sceneIndex: number;
      camera_angle: string;
      camera_movement: string;
      lighting: string;
    }>,
    sceneCount: number
  ): Array<{
    sceneIndex: number;
    camera_angle: string;
    camera_movement: string;
    lighting: string;
  }> {
    // Create a default sequence for all scenes
    const defaultSequence = Array(sceneCount).fill(0).map((_, index) => ({
      sceneIndex: index,
      camera_angle: this.getDefaultCameraAngle(index, sceneCount),
      camera_movement: this.getDefaultCameraMovement(index, sceneCount),
      lighting: this.getDefaultLighting(index, sceneCount),
    }));
    
    // If sequence is empty, return default
    if (!sequence || sequence.length === 0) {
      return defaultSequence;
    }
    
    // Merge provided sequence with defaults for missing scenes
    const mergedSequence = [...defaultSequence];
    
    for (const item of sequence) {
      if (item.sceneIndex >= 0 && item.sceneIndex < sceneCount) {
        mergedSequence[item.sceneIndex] = item;
      }
    }
    
    return mergedSequence;
  }
  
  /**
   * Get default camera angle based on scene position
   */
  private getDefaultCameraAngle(index: number, sceneCount: number): string {
    // Basic progression: establish -> medium -> close -> wide -> medium -> close -> wide -> etc.
    const position = (index / sceneCount);
    
    if (index === 0) {
      return 'Establishing shot';
    } else if (position < 0.25) {
      return index % 2 === 0 ? 'Wide shot' : 'Medium shot';
    } else if (position < 0.5) {
      return index % 2 === 0 ? 'Medium shot' : 'Close-up';
    } else if (position < 0.75) {
      return index % 2 === 0 ? 'Close-up' : 'Medium shot';
    } else {
      return index % 2 === 0 ? 'Medium shot' : 'Wide shot';
    }
  }
  
  /**
   * Get default camera movement based on scene position
   */
  private getDefaultCameraMovement(index: number, sceneCount: number): string {
    // Basic progression: static -> slow -> dynamic -> static -> etc.
    if (index === 0) {
      return 'Static';
    } else if (index === sceneCount - 1) {
      return 'Slow pull out';
    } else {
      const options = ['Static', 'Slow dolly', 'Pan', 'Tilt', 'Track', 'Crane', 'Handheld'];
      return options[index % options.length];
    }
  }
  
  /**
   * Get default lighting based on scene position
   */
  private getDefaultLighting(index: number, sceneCount: number): string {
    // Basic progression through lighting styles
    const options = ['Natural', 'Soft', 'Dramatic', 'High-contrast', 'Silhouette', 'Warm', 'Cool'];
    return options[index % options.length];
  }
  
  /**
   * Get default camera matrix
   */
  private getDefaultCameraMatrix(sceneCount: number): {
    camera_angles: string[];
    camera_movements: string[];
    lighting_setups: string[];
    recommendedSequence: Array<{
      sceneIndex: number;
      camera_angle: string;
      camera_movement: string;
      lighting: string;
    }>;
  } {
    const camera_angles = [
      'Establishing shot',
      'Wide shot',
      'Medium shot',
      'Close-up',
      'Extreme close-up',
      'Over-the-shoulder',
      'Low angle',
      'High angle',
      'Bird\'s eye view',
      'Dutch angle',
      'Two-shot',
      'Point of view'
    ];
    
    const camera_movements = [
      'Static',
      'Pan',
      'Tilt',
      'Dolly in',
      'Dolly out',
      'Track',
      'Crane',
      'Zoom',
      'Handheld',
      'Steadicam'
    ];
    
    const lighting_setups = [
      'Natural',
      'High-key',
      'Low-key',
      'Three-point',
      'Silhouette',
      'Dramatic',
      'Soft',
      'Harsh'
    ];
    
    // Generate a sequence that varies
    const recommendedSequence = Array(sceneCount).fill(0).map((_, index) => ({
      sceneIndex: index,
      camera_angle: this.getDefaultCameraAngle(index, sceneCount),
      camera_movement: this.getDefaultCameraMovement(index, sceneCount),
      lighting: this.getDefaultLighting(index, sceneCount),
    }));
    
    return {
      camera_angles,
      camera_movements,
      lighting_setups,
      recommendedSequence,
    };
  }
  
  /**
   * Validate the analysis result and provide fallbacks for missing fields
   */
  private validateAnalysisResult(result: Partial<CinematicAnalysisResult>): CinematicAnalysisResult {
    const defaultAnalysis = this.getDefaultAnalysis();
    
    return {
      cinematicIssues: {
        cameraRepetition: result.cinematicIssues?.cameraRepetition || defaultAnalysis.cinematicIssues.cameraRepetition,
        sceneVisualsRepetition: result.cinematicIssues?.sceneVisualsRepetition || defaultAnalysis.cinematicIssues.sceneVisualsRepetition,
        weakCameraChoices: result.cinematicIssues?.weakCameraChoices || defaultAnalysis.cinematicIssues.weakCameraChoices,
        poorCinematicFlow: result.cinematicIssues?.poorCinematicFlow || defaultAnalysis.cinematicIssues.poorCinematicFlow,
        emotionalPacingIssues: result.cinematicIssues?.emotionalPacingIssues || defaultAnalysis.cinematicIssues.emotionalPacingIssues,
        inconsistentLighting: result.cinematicIssues?.inconsistentLighting || defaultAnalysis.cinematicIssues.inconsistentLighting,
        poorSceneDependencies: result.cinematicIssues?.poorSceneDependencies || defaultAnalysis.cinematicIssues.poorSceneDependencies,
      },
      cinematicSuggestions: {
        cameraSequence: result.cinematicSuggestions?.cameraSequence || defaultAnalysis.cinematicSuggestions.cameraSequence,
        emotionalPacing: result.cinematicSuggestions?.emotionalPacing || defaultAnalysis.cinematicSuggestions.emotionalPacing,
        transitionEnhancements: result.cinematicSuggestions?.transitionEnhancements || defaultAnalysis.cinematicSuggestions.transitionEnhancements,
        cinematicContinuity: result.cinematicSuggestions?.cinematicContinuity || defaultAnalysis.cinematicSuggestions.cinematicContinuity,
      }
    };
  }
  
  /**
   * Get default empty analysis
   */
  private getDefaultAnalysis(): CinematicAnalysisResult {
    return {
      cinematicIssues: {
        cameraRepetition: false,
        sceneVisualsRepetition: false,
        weakCameraChoices: [],
        poorCinematicFlow: false,
        emotionalPacingIssues: false,
        inconsistentLighting: false,
        poorSceneDependencies: [],
      },
      cinematicSuggestions: {
        cameraSequence: [],
        emotionalPacing: [],
        transitionEnhancements: [],
        cinematicContinuity: [],
      }
    };
  }
}