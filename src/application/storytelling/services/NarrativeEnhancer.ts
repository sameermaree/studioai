import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { extractJsonFromText } from "../../../infrastructure/ai/providers/OllamaProvider";
import { Story } from "../../../domain/storytelling/entities/Story";
import { NarrativeArc } from "../../../domain/storytelling/entities/NarrativeArc";
import { Scene, SceneEnvironment, SceneCinematography } from "../../../domain/storytelling/entities/Scene";

interface NarrativeAnalysisResult {
  issues: {
    repetitiveScenes: { indices: number[] }[];
    emotionalFlatness: number[];
    poorPacing: boolean;
    inconsistentEnvironments: number[];
    monotonousCamerawork: boolean;
    weakTransitions: number[];
  };
  suggestions: {
    sceneVariation: string[];
    emotionalProgression: { sceneIndex: number, suggestion: string }[];
    environmentContinuity: { sceneIndex: number, suggestion: string }[];
    cameraVariation: { sceneIndex: number, suggestion: string }[];
    transitionImprovements: { sceneIndex: number, suggestion: string }[];
  };
}

/**
 * Enhances narrative quality of AI-generated stories
 */
export class NarrativeEnhancer {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Analyze a story for narrative issues and provide suggestions
   */
  async analyzeNarrative(story: Story): Promise<NarrativeAnalysisResult> {
    try {
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for narrative analysis');
      }
      
      // Create story summary for the prompt
      const sceneSummaries = story.scenes.map((scene, index) => 
        `Scene ${index + 1}: ${scene.title} - ${scene.description.substring(0, 100)}...`
      ).join("\n");
      
      const prompt = `
Analyze the following story for narrative issues:

Title: "${story.title}"
Premise: "${story.premise}"

SCENES:
${sceneSummaries}

Evaluate this story for the following issues and provide suggestions:
1. Repetitive scenes (similar content or descriptions)
2. Emotional flatness (lack of emotional variation between scenes)
3. Poor pacing (uneven distribution of setup, conflict, climax, resolution)
4. Inconsistent environments (environments that don't make logical sense together)
5. Monotonous camerawork (lack of variation in camera angles and movements)
6. Weak transitions between scenes

Return a JSON object with these structures:
{
  "issues": {
    "repetitiveScenes": [{"indices": [scene indices that are repetitive]}],
    "emotionalFlatness": [indices of emotionally flat scenes],
    "poorPacing": true/false,
    "inconsistentEnvironments": [indices of scenes with environment inconsistencies],
    "monotonousCamerawork": true/false,
    "weakTransitions": [indices of scenes with weak transitions to the next scene]
  },
  "suggestions": {
    "sceneVariation": [array of general suggestions for increasing scene variation],
    "emotionalProgression": [{"sceneIndex": index, "suggestion": specific suggestion for that scene}],
    "environmentContinuity": [{"sceneIndex": index, "suggestion": specific suggestion for that scene}],
    "cameraVariation": [{"sceneIndex": index, "suggestion": specific suggestion for that scene}],
    "transitionImprovements": [{"sceneIndex": index, "suggestion": specific suggestion for that scene}]
  }
}
      `;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<NarrativeAnalysisResult>(prompt);
          return this.validateAnalysisResult(result);
        } catch (error) {
          console.warn(`Narrative analysis failed with provider ${provider.id}:`, error);
          // Try fallback text parsing
          try {
            const textResult = await provider.generateText(prompt);
            const cleanJson = extractJsonFromText(textResult.text);
            const parsed = JSON.parse(cleanJson);
            return this.validateAnalysisResult(parsed);
          } catch (fallbackError) {
            console.warn(`Fallback parsing also failed:`, fallbackError);
          }
        }
      }
      
      throw new Error('All providers failed to analyze narrative');
    } catch (error) {
      console.error('Failed to analyze narrative:', error);
      // Return default empty analysis
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Enhance a story based on narrative analysis
   */
  async enhanceStory(story: Story, language?: string): Promise<Story> {
    try {
      // Analyze the narrative first
      const analysis = await this.analyzeNarrative(story);
      
      // If there are no significant issues, return the story unchanged
      if (
        analysis.issues.repetitiveScenes.length === 0 &&
        analysis.issues.emotionalFlatness.length === 0 &&
        !analysis.issues.poorPacing &&
        analysis.issues.inconsistentEnvironments.length === 0 &&
        !analysis.issues.monotonousCamerawork &&
        analysis.issues.weakTransitions.length === 0
      ) {
        return story;
      }
      
      // Get AI provider for enhancement
      const providers = await this.aiRegistry.getFallbackChain('scene-generation');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for story enhancement');
      }
      
      // Create an enhanced version of the story
      let enhancedStory = { ...story };
      const enhancedScenes = [...story.scenes];
      
      // Apply enhancements based on analysis
      for (let i = 0; i < enhancedScenes.length; i++) {
        let needsEnhancement = false;
        const lang = language || story.metadata.language || 'en';
        const langInstruction = lang === 'ar' 
          ? '\nCRITICAL: Generate ALL enhanced content in Arabic language ONLY. جميع الحقول يجب أن تكون بالعربية.' 
          : `\nGenerate ALL enhanced content in ${lang} language.`;
        
        let enhancementPrompt = `${langInstruction}\nEnhance this scene to improve narrative quality:\nScene Title: "${enhancedScenes[i].title}"\nScene Description: "${enhancedScenes[i].description}"\n\nCURRENT SCENE DETAILS:\nEnvironment: ${JSON.stringify(enhancedScenes[i].environment)}\nCinematography: ${JSON.stringify(enhancedScenes[i].cinematography)}\nNarration: "${enhancedScenes[i].narration}"\n\nSUGGESTED IMPROVEMENTS:`;
        
        // Check if this scene needs improvements
        const isRepetitive = analysis.issues.repetitiveScenes.some(
          group => group.indices.includes(i)
        );
        
        const isEmotionallyFlat = analysis.issues.emotionalFlatness.includes(i);
        const hasEnvironmentIssue = analysis.issues.inconsistentEnvironments.includes(i);
        const hasWeakTransition = analysis.issues.weakTransitions.includes(i);
        
        // Add specific improvement suggestions to the prompt
        if (isRepetitive) {
          needsEnhancement = true;
          enhancementPrompt += "\n- Make this scene more unique and distinct from other scenes";
        }
        
        if (isEmotionallyFlat) {
          needsEnhancement = true;
          enhancementPrompt += "\n- Add more emotional depth and variation to this scene";
          
          // Add specific emotional progression suggestion if available
          const emotionSuggestion = analysis.suggestions.emotionalProgression.find(
            s => s.sceneIndex === i
          );
          if (emotionSuggestion) {
            enhancementPrompt += `\n  Suggestion: ${emotionSuggestion.suggestion}`;
          }
        }
        
        if (hasEnvironmentIssue) {
          needsEnhancement = true;
          enhancementPrompt += "\n- Improve the environment description for better continuity";
          
          // Add specific environment continuity suggestion if available
          const environmentSuggestion = analysis.suggestions.environmentContinuity.find(
            s => s.sceneIndex === i
          );
          if (environmentSuggestion) {
            enhancementPrompt += `\n  Suggestion: ${environmentSuggestion.suggestion}`;
          }
        }
        
        if (analysis.issues.monotonousCamerawork) {
          needsEnhancement = true;
          enhancementPrompt += "\n- Use more varied and interesting camera work";
          
          // Add specific camera variation suggestion if available
          const cameraSuggestion = analysis.suggestions.cameraVariation.find(
            s => s.sceneIndex === i
          );
          if (cameraSuggestion) {
            enhancementPrompt += `\n  Suggestion: ${cameraSuggestion.suggestion}`;
          }
        }
        
        if (hasWeakTransition && i < enhancedScenes.length - 1) {
          needsEnhancement = true;
          enhancementPrompt += "\n- Improve the transition to the next scene";
          
          // Add next scene context for better transitions
          if (i < enhancedScenes.length - 1) {
            enhancementPrompt += `\n  Next scene: "${enhancedScenes[i+1].title}" - ${enhancedScenes[i+1].description.substring(0, 100)}...`;
          }
          
          // Add specific transition improvement suggestion if available
          const transitionSuggestion = analysis.suggestions.transitionImprovements.find(
            s => s.sceneIndex === i
          );
          if (transitionSuggestion) {
            enhancementPrompt += `\n  Suggestion: ${transitionSuggestion.suggestion}`;
          }
        }
        
        enhancementPrompt += `

Please return a JSON object with the enhanced scene:
{
  "title": "Enhanced scene title",
  "description": "Enhanced scene description",
  "environment": {
    "location": "Enhanced location",
    "time": "Enhanced time",
    "mood": "Enhanced mood"
  },
  "cinematography": {
    "camera_angle": "Enhanced camera angle",
    "camera_movement": "Enhanced camera movement",
    "lighting": "Enhanced lighting"
  },
  "narration": "Enhanced narration text"
}`;
        
        // Skip if no enhancement needed
        if (!needsEnhancement) {
          continue;
        }
        
        // Try each provider until one works
        for (const provider of providers) {
          try {
            const result = await provider.generateJSON<{
              title: string;
              description: string;
              environment: SceneEnvironment;
              cinematography: SceneCinematography;
              narration: string;
            }>(enhancementPrompt);
            
            // Update the scene with enhanced content
            enhancedScenes[i] = {
              ...enhancedScenes[i],
              title: result.title || enhancedScenes[i].title,
              description: result.description || enhancedScenes[i].description,
              environment: result.environment || enhancedScenes[i].environment,
              cinematography: result.cinematography || enhancedScenes[i].cinematography,
              narration: result.narration || enhancedScenes[i].narration,
              subtitle_text: result.narration || enhancedScenes[i].narration,
              // Re-generate prompt based on enhanced scene
              prompt_text: this.generateVisualPrompt(
                result.description || enhancedScenes[i].description,
                result.environment || enhancedScenes[i].environment,
                result.cinematography || enhancedScenes[i].cinematography
              ),
              updated_at: new Date().toISOString(),
            };
            
            break;
          } catch (error) {
            console.warn(`Scene enhancement failed with provider ${provider.id}:`, error);
            // Try fallback text parsing
            try {
              const textResult = await provider.generateText(enhancementPrompt);
              const cleanJson = extractJsonFromText(textResult.text);
              const result = JSON.parse(cleanJson);
              
              enhancedScenes[i] = {
                ...enhancedScenes[i],
                title: result.title || enhancedScenes[i].title,
                description: result.description || enhancedScenes[i].description,
                environment: result.environment || enhancedScenes[i].environment,
                cinematography: result.cinematography || enhancedScenes[i].cinematography,
                narration: result.narration || enhancedScenes[i].narration,
                subtitle_text: result.narration || enhancedScenes[i].narration,
                prompt_text: this.generateVisualPrompt(
                  result.description || enhancedScenes[i].description,
                  result.environment || enhancedScenes[i].environment,
                  result.cinematography || enhancedScenes[i].cinematography
                ),
                updated_at: new Date().toISOString(),
              };
              break;
            } catch (fallbackError) {
              console.warn(`Fallback parsing also failed:`, fallbackError);
            }
          }
        }
      }
      
      // If pacing is poor, try to add/modify narrative arcs
      if (analysis.issues.poorPacing && story.narrativeArcs.length > 0) {
        try {
          enhancedStory = await this.balanceNarrativePacing(
            { ...enhancedStory, scenes: enhancedScenes }
          );
        } catch (error) {
          console.warn('Failed to balance narrative pacing:', error);
          // Continue with other enhancements even if this fails
          enhancedStory = { ...enhancedStory, scenes: enhancedScenes };
        }
      } else {
        // Just update scenes
        enhancedStory = { ...enhancedStory, scenes: enhancedScenes };
      }
      
      return enhancedStory;
    } catch (error) {
      console.error('Failed to enhance story:', error);
      // Return original story if enhancement fails
      return story;
    }
  }
  
  /**
   * Balance narrative pacing by adjusting scene narrative types
   */
  private async balanceNarrativePacing(story: Story): Promise<Story> {
    const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
    
    if (providers.length === 0) {
      return story;
    }
    
    const sceneSummaries = story.scenes.map((scene, index) => 
      `Scene ${index + 1}: "${scene.title}" - ${scene.narrative_type}`
    ).join("\n");
    
    const prompt = `
Analyze and improve the pacing of this story:

Title: "${story.title}"
Premise: "${story.premise}"

Current narrative structure:
${story.narrativeArcs.map(arc => 
  `Arc: ${arc.name}
  Elements: ${arc.elements.map(el => `${el.type}: ${el.description}`).join(', ')}`
).join('\n')}

Current scene narrative types:
${sceneSummaries}

The pacing of this story needs improvement. Please reassign each scene to one of these narrative types: 
"setup", "conflict", "climax", "resolution", or "transition" to create better pacing.

Return a JSON array with scene indices and their improved narrative types:
[
  {
    "scene_index": 0,
    "narrative_type": "setup"
  },
  {
    "scene_index": 1,
    "narrative_type": "conflict"
  }
]

Ensure there is a natural progression from setup -> conflict -> climax -> resolution, with appropriate transitions as needed.
`;
    
    // Try each provider
    for (const provider of providers) {
      try {
        const result = await provider.generateJSON<Array<{
          scene_index: number;
          narrative_type: 'setup' | 'conflict' | 'climax' | 'resolution' | 'transition';
        }>>(prompt);
        
        // Update scene narrative types
        const updatedScenes = [...story.scenes];
        
        for (const update of result) {
          const sceneIndex = update.scene_index;
          
          if (sceneIndex >= 0 && sceneIndex < updatedScenes.length) {
            updatedScenes[sceneIndex] = {
              ...updatedScenes[sceneIndex],
              narrative_type: update.narrative_type,
              updated_at: new Date().toISOString(),
            };
          }
        }
        
        return {
          ...story,
          scenes: updatedScenes,
          updated_at: new Date().toISOString(),
        };
      } catch (error) {
        console.warn(`Narrative pacing adjustment failed with provider ${provider.id}:`, error);
        // Try fallback text parsing
        try {
          const textResult = await provider.generateText(prompt);
          const cleanJson = extractJsonFromText(textResult.text);
          const result = JSON.parse(cleanJson);
          
          const updatedScenes = [...story.scenes];
          
          for (const update of result) {
            const sceneIndex = update.scene_index;
            
            if (sceneIndex >= 0 && sceneIndex < updatedScenes.length) {
              updatedScenes[sceneIndex] = {
                ...updatedScenes[sceneIndex],
                narrative_type: update.narrative_type,
                updated_at: new Date().toISOString(),
              };
            }
          }
          
          return {
            ...story,
            scenes: updatedScenes,
            updated_at: new Date().toISOString(),
          };
        } catch (fallbackError) {
          console.warn(`Fallback parsing also failed:`, fallbackError);
        }
      }
    }
    
    // Return original story if all providers fail
    return story;
  }
  
  /**
   * Generate a visual prompt from scene details
   */
  private generateVisualPrompt(
    description: string,
    environment: SceneEnvironment,
    cinematography: SceneCinematography
  ): string {
    return [
      description,
      `Location: ${environment.location}`,
      `Time: ${environment.time}`,
      `Mood: ${environment.mood}`,
      `Camera: ${cinematography.camera_angle}`,
      `Movement: ${cinematography.camera_movement}`,
      `Lighting: ${cinematography.lighting}`
    ].filter(Boolean).join('. ');
  }
  
  /**
   * Validate the analysis result and provide fallbacks for missing fields
   */
  private validateAnalysisResult(result: Partial<NarrativeAnalysisResult>): NarrativeAnalysisResult {
    const defaultAnalysis = this.getDefaultAnalysis();
    
    return {
      issues: {
        repetitiveScenes: result.issues?.repetitiveScenes || defaultAnalysis.issues.repetitiveScenes,
        emotionalFlatness: result.issues?.emotionalFlatness || defaultAnalysis.issues.emotionalFlatness,
        poorPacing: result.issues?.poorPacing || defaultAnalysis.issues.poorPacing,
        inconsistentEnvironments: result.issues?.inconsistentEnvironments || defaultAnalysis.issues.inconsistentEnvironments,
        monotonousCamerawork: result.issues?.monotonousCamerawork || defaultAnalysis.issues.monotonousCamerawork,
        weakTransitions: result.issues?.weakTransitions || defaultAnalysis.issues.weakTransitions,
      },
      suggestions: {
        sceneVariation: result.suggestions?.sceneVariation || defaultAnalysis.suggestions.sceneVariation,
        emotionalProgression: result.suggestions?.emotionalProgression || defaultAnalysis.suggestions.emotionalProgression,
        environmentContinuity: result.suggestions?.environmentContinuity || defaultAnalysis.suggestions.environmentContinuity,
        cameraVariation: result.suggestions?.cameraVariation || defaultAnalysis.suggestions.cameraVariation,
        transitionImprovements: result.suggestions?.transitionImprovements || defaultAnalysis.suggestions.transitionImprovements,
      }
    };
  }
  
  /**
   * Get default empty analysis
   */
  private getDefaultAnalysis(): NarrativeAnalysisResult {
    return {
      issues: {
        repetitiveScenes: [],
        emotionalFlatness: [],
        poorPacing: false,
        inconsistentEnvironments: [],
        monotonousCamerawork: false,
        weakTransitions: [],
      },
      suggestions: {
        sceneVariation: [],
        emotionalProgression: [],
        environmentContinuity: [],
        cameraVariation: [],
        transitionImprovements: [],
      }
    };
  }
}