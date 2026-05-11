import { Story } from "../../../domain/storytelling/entities/Story";
import { Scene } from "../../../domain/storytelling/entities/Scene";
import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";

export interface RepetitionAnalysis {
  issues: {
    repetitiveSceneDescriptions: number[][];
    repetitiveCameraAngles: number[][];
    repetitiveCameraMovements: number[][];
    repetitiveEnvironments: number[][];
    repetitiveMoods: number[][];
    repetitiveNarration: number[][];
  };
  metrics: {
    uniqueCameraAnglesRatio: number;
    uniqueEnvironmentsRatio: number;
    uniqueMoodsRatio: number;
    cameraAngleDistribution: Record<string, number>;
    environmentDistribution: Record<string, number>;
    moodDistribution: Record<string, number>;
  };
  suggestions: {
    sceneVariations: Array<{
      sceneIndex: number;
      variationSuggestion: string;
    }>;
    cameraVariations: Array<{
      sceneIndex: number;
      suggestedCamera: string;
      suggestedMovement: string;
    }>;
    environmentVariations: Array<{
      sceneIndex: number;
      suggestedLocation: string;
      suggestedTime: string;
    }>;
    moodVariations: Array<{
      sceneIndex: number;
      suggestedMood: string;
    }>;
  };
}

/**
 * System to detect and prevent repetitive storytelling elements
 */
export class AntiRepetitionSystem {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Analyze a story for repetitive elements
   */
  async analyzeRepetition(story: Story): Promise<RepetitionAnalysis> {
    // Initialize analysis result
    const analysis: RepetitionAnalysis = {
      issues: {
        repetitiveSceneDescriptions: [],
        repetitiveCameraAngles: [],
        repetitiveCameraMovements: [],
        repetitiveEnvironments: [],
        repetitiveMoods: [],
        repetitiveNarration: [],
      },
      metrics: {
        uniqueCameraAnglesRatio: 1,
        uniqueEnvironmentsRatio: 1,
        uniqueMoodsRatio: 1,
        cameraAngleDistribution: {},
        environmentDistribution: {},
        moodDistribution: {},
      },
      suggestions: {
        sceneVariations: [],
        cameraVariations: [],
        environmentVariations: [],
        moodVariations: [],
      },
    };
    
    // Extract elements for analysis
    const cameraAngles = story.scenes.map(scene => scene.cinematography.camera_angle);
    const cameraMovements = story.scenes.map(scene => scene.cinematography.camera_movement);
    const environments = story.scenes.map(scene => scene.environment.location);
    const moods = story.scenes.map(scene => scene.environment.mood);
    const descriptions = story.scenes.map(scene => scene.description);
    const narrations = story.scenes.map(scene => scene.narration);
    
    // Calculate distribution and uniqueness ratios
    analysis.metrics.cameraAngleDistribution = this.calculateDistribution(cameraAngles);
    analysis.metrics.environmentDistribution = this.calculateDistribution(environments);
    analysis.metrics.moodDistribution = this.calculateDistribution(moods);
    
    // Calculate uniqueness ratios
    analysis.metrics.uniqueCameraAnglesRatio = Object.keys(analysis.metrics.cameraAngleDistribution).length / story.scenes.length;
    analysis.metrics.uniqueEnvironmentsRatio = Object.keys(analysis.metrics.environmentDistribution).length / story.scenes.length;
    analysis.metrics.uniqueMoodsRatio = Object.keys(analysis.metrics.moodDistribution).length / story.scenes.length;
    
    // Detect repetitive sequences of camera angles
    analysis.issues.repetitiveCameraAngles = this.detectRepetitiveSequences(cameraAngles);
    
    // Detect repetitive sequences of camera movements
    analysis.issues.repetitiveCameraMovements = this.detectRepetitiveSequences(cameraMovements);
    
    // Detect repetitive sequences of environments
    analysis.issues.repetitiveEnvironments = this.detectRepetitiveSequences(environments);
    
    // Detect repetitive sequences of moods
    analysis.issues.repetitiveMoods = this.detectRepetitiveSequences(moods);
    
    // Detect similar scene descriptions
    analysis.issues.repetitiveSceneDescriptions = this.detectSimilarTexts(descriptions);
    
    // Detect similar narrations
    analysis.issues.repetitiveNarration = this.detectSimilarTexts(narrations);
    
    // Generate suggestions using AI if there are issues to fix
    if (
      analysis.issues.repetitiveCameraAngles.length > 0 ||
      analysis.issues.repetitiveCameraMovements.length > 0 ||
      analysis.issues.repetitiveEnvironments.length > 0 ||
      analysis.issues.repetitiveMoods.length > 0 ||
      analysis.issues.repetitiveSceneDescriptions.length > 0 ||
      analysis.metrics.uniqueCameraAnglesRatio < 0.7 ||
      analysis.metrics.uniqueEnvironmentsRatio < 0.7 ||
      analysis.metrics.uniqueMoodsRatio < 0.7
    ) {
      try {
        const enhancedAnalysis = await this.generateAISuggestions(story, analysis);
        return enhancedAnalysis;
      } catch (error) {
        console.error('Failed to generate AI suggestions for repetition analysis:', error);
        // Return basic analysis if AI generation fails
        return analysis;
      }
    }
    
    return analysis;
  }
  
  /**
   * Apply anti-repetition improvements to a story
   */
  async enhanceVariety(story: Story): Promise<Story> {
    try {
      // Analyze repetition first
      const analysis = await this.analyzeRepetition(story);
      
      // If there are no significant issues, return the story unchanged
      if (
        analysis.issues.repetitiveCameraAngles.length === 0 &&
        analysis.issues.repetitiveCameraMovements.length === 0 &&
        analysis.issues.repetitiveEnvironments.length === 0 &&
        analysis.issues.repetitiveMoods.length === 0 &&
        analysis.issues.repetitiveSceneDescriptions.length === 0 &&
        analysis.metrics.uniqueCameraAnglesRatio >= 0.7 &&
        analysis.metrics.uniqueEnvironmentsRatio >= 0.7 &&
        analysis.metrics.uniqueMoodsRatio >= 0.7
      ) {
        return story;
      }
      
      // Copy scenes for enhancement
      let enhancedScenes = [...story.scenes];
      
      // Apply camera variations
      for (const variation of analysis.suggestions.cameraVariations) {
        const sceneIndex = variation.sceneIndex;
        
        if (sceneIndex < 0 || sceneIndex >= enhancedScenes.length) {
          continue;
        }
        
        enhancedScenes[sceneIndex] = {
          ...enhancedScenes[sceneIndex],
          cinematography: {
            ...enhancedScenes[sceneIndex].cinematography,
            camera_angle: variation.suggestedCamera || enhancedScenes[sceneIndex].cinematography.camera_angle,
            camera_movement: variation.suggestedMovement || enhancedScenes[sceneIndex].cinematography.camera_movement,
          },
          updated_at: new Date().toISOString(),
        };
      }
      
      // Apply environment variations
      for (const variation of analysis.suggestions.environmentVariations) {
        const sceneIndex = variation.sceneIndex;
        
        if (sceneIndex < 0 || sceneIndex >= enhancedScenes.length) {
          continue;
        }
        
        enhancedScenes[sceneIndex] = {
          ...enhancedScenes[sceneIndex],
          environment: {
            ...enhancedScenes[sceneIndex].environment,
            location: variation.suggestedLocation || enhancedScenes[sceneIndex].environment.location,
            time: variation.suggestedTime || enhancedScenes[sceneIndex].environment.time,
          },
          updated_at: new Date().toISOString(),
        };
      }
      
      // Apply mood variations
      for (const variation of analysis.suggestions.moodVariations) {
        const sceneIndex = variation.sceneIndex;
        
        if (sceneIndex < 0 || sceneIndex >= enhancedScenes.length) {
          continue;
        }
        
        enhancedScenes[sceneIndex] = {
          ...enhancedScenes[sceneIndex],
          environment: {
            ...enhancedScenes[sceneIndex].environment,
            mood: variation.suggestedMood || enhancedScenes[sceneIndex].environment.mood,
          },
          updated_at: new Date().toISOString(),
        };
      }
      
      // Apply scene variations (requires AI for detailed scene changes)
      if (analysis.suggestions.sceneVariations.length > 0) {
        enhancedScenes = await this.applySceneVariations(
          enhancedScenes,
          analysis.suggestions.sceneVariations
        );
      }
      
      return {
        ...story,
        scenes: enhancedScenes,
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to enhance variety:', error);
      // Return original story if enhancement fails
      return story;
    }
  }
  
  /**
   * Apply scene variations using AI to change scene descriptions
   */
  private async applySceneVariations(
    scenes: Scene[],
    variations: Array<{
      sceneIndex: number;
      variationSuggestion: string;
    }>
  ): Promise<Scene[]> {
    // Get AI providers for enhancement
    const providers = await this.aiRegistry.getFallbackChain('scene-generation');
    
    if (providers.length === 0) {
      return scenes;
    }
    
    // Copy scenes
    const enhancedScenes = [...scenes];
    
    // Apply variations
    for (const variation of variations) {
      const sceneIndex = variation.sceneIndex;
      
      if (sceneIndex < 0 || sceneIndex >= enhancedScenes.length) {
        continue;
      }
      
      const scene = enhancedScenes[sceneIndex];
      
      // Create prompt for scene variation
      const variationPrompt = `
Enhance this scene to make it more unique and varied:

SCENE: "${scene.title}"
CURRENT DESCRIPTION:
${scene.description}

CURRENT NARRATION:
${scene.narration}

VARIATION SUGGESTION:
${variation.variationSuggestion}

Your task:
Modify this scene to follow the variation suggestion while maintaining the story's continuity.
Make the scene more distinctive and less repetitive.

Return a JSON object with:
{
  "modifiedDescription": "Enhanced scene description",
  "modifiedNarration": "Enhanced scene narration"
}

Ensure your modifications maintain the core narrative purpose of the scene while making it more unique.`;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<{
            modifiedDescription: string;
            modifiedNarration: string;
          }>(variationPrompt);
          
          // Update scene
          enhancedScenes[sceneIndex] = {
            ...enhancedScenes[sceneIndex],
            description: result.modifiedDescription || enhancedScenes[sceneIndex].description,
            narration: result.modifiedNarration || enhancedScenes[sceneIndex].narration,
            subtitle_text: result.modifiedNarration || enhancedScenes[sceneIndex].subtitle_text,
            updated_at: new Date().toISOString(),
          };
          
          break;
        } catch (error) {
          console.warn(`Scene variation failed with provider ${provider.id}:`, error);
        }
      }
    }
    
    return enhancedScenes;
  }
  
  /**
   * Generate AI-powered suggestions for fixing repetitive elements
   */
  private async generateAISuggestions(
    story: Story,
    analysis: RepetitionAnalysis
  ): Promise<RepetitionAnalysis> {
    // Get AI providers
    const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
    
    if (providers.length === 0) {
      return analysis;
    }
    
    // Create story summary for prompt
    const sceneSummary = story.scenes.map((scene, index) => 
      `Scene ${index + 1}: "${scene.title}"
  - Camera: ${scene.cinematography.camera_angle}, ${scene.cinematography.camera_movement}
  - Environment: ${scene.environment.location}, ${scene.environment.time}
  - Mood: ${scene.environment.mood}`
    ).join('\n\n');
    
    // Identify specific repetition issues
    const repetitiveScenes = analysis.issues.repetitiveSceneDescriptions.map(group => 
      `Scenes ${group.map(i => i + 1).join(', ')} have similar descriptions`
    ).join('\n');
    
    const repetitiveCameras = analysis.issues.repetitiveCameraAngles.map(group => 
      `Scenes ${group.map(i => i + 1).join(', ')} use the same camera angle "${story.scenes[group[0]].cinematography.camera_angle}"`
    ).join('\n');
    
    const repetitiveEnvironments = analysis.issues.repetitiveEnvironments.map(group => 
      `Scenes ${group.map(i => i + 1).join(', ')} use the same location "${story.scenes[group[0]].environment.location}"`
    ).join('\n');
    
    const repetitiveMoods = analysis.issues.repetitiveMoods.map(group => 
      `Scenes ${group.map(i => i + 1).join(', ')} use the same mood "${story.scenes[group[0]].environment.mood}"`
    ).join('\n');
    
    const prompt = `
As a master filmmaker focused on visual variety, analyze this story for repetitive elements:

STORY: "${story.title}"
PREMISE: "${story.premise}"

SCENE SUMMARY:
${sceneSummary}

IDENTIFIED REPETITION ISSUES:
${repetitiveScenes || 'No significant issues with scene descriptions'}
${repetitiveCameras || 'No significant issues with camera angles'}
${repetitiveEnvironments || 'No significant issues with environments'}
${repetitiveMoods || 'No significant issues with moods'}

METRICS:
- Unique camera angles ratio: ${analysis.metrics.uniqueCameraAnglesRatio.toFixed(2)}
- Unique environments ratio: ${analysis.metrics.uniqueEnvironmentsRatio.toFixed(2)}
- Unique moods ratio: ${analysis.metrics.uniqueMoodsRatio.toFixed(2)}

Your task:
Generate suggestions to increase variety and eliminate repetition.
For each issue, provide specific variations that would improve the story.

Return a JSON object with:
{
  "suggestions": {
    "sceneVariations": [
      {
        "sceneIndex": scene index,
        "variationSuggestion": "Specific suggestion for making this scene more unique"
      }
    ],
    "cameraVariations": [
      {
        "sceneIndex": scene index,
        "suggestedCamera": "Suggested camera angle that provides better variety",
        "suggestedMovement": "Suggested camera movement that provides better variety"
      }
    ],
    "environmentVariations": [
      {
        "sceneIndex": scene index,
        "suggestedLocation": "Suggested location that provides better variety",
        "suggestedTime": "Suggested time that provides better variety"
      }
    ],
    "moodVariations": [
      {
        "sceneIndex": scene index,
        "suggestedMood": "Suggested mood that provides better variety"
      }
    ]
  }
}

Focus on professional cinematic techniques that create visual variety while maintaining narrative coherence.
Provide specific, actionable suggestions rather than general advice.`;
    
    // Try each provider until one works
    for (const provider of providers) {
      try {
        const result = await provider.generateJSON<{
          suggestions: {
            sceneVariations: Array<{
              sceneIndex: number;
              variationSuggestion: string;
            }>;
            cameraVariations: Array<{
              sceneIndex: number;
              suggestedCamera: string;
              suggestedMovement: string;
            }>;
            environmentVariations: Array<{
              sceneIndex: number;
              suggestedLocation: string;
              suggestedTime: string;
            }>;
            moodVariations: Array<{
              sceneIndex: number;
              suggestedMood: string;
            }>;
          };
        }>(prompt);
        
        // Merge AI suggestions with the analysis
        return {
          ...analysis,
          suggestions: result.suggestions
        };
      } catch (error) {
        console.warn(`Repetition suggestion generation failed with provider ${provider.id}:`, error);
      }
    }
    
    return analysis;
  }
  
  /**
   * Calculate distribution of elements in an array
   */
  private calculateDistribution(elements: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const element of elements) {
      if (!element) continue;
      
      const normalizedElement = element.trim().toLowerCase();
      distribution[normalizedElement] = (distribution[normalizedElement] || 0) + 1;
    }
    
    return distribution;
  }
  
  /**
   * Detect repetitive sequences of elements
   * Returns arrays of indices where the same element appears multiple times in sequence
   */
  private detectRepetitiveSequences(elements: string[]): number[][] {
    const repetitiveGroups: number[][] = [];
    let currentGroup: number[] = [];
    let currentElement = '';
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]?.trim().toLowerCase() || '';
      
      if (!element) continue;
      
      if (element === currentElement) {
        // Continue the current group
        currentGroup.push(i);
      } else {
        // Check if we had a group with more than 2 elements
        if (currentGroup.length >= 2) {
          repetitiveGroups.push([...currentGroup]);
        }
        
        // Start a new group
        currentGroup = [i];
        currentElement = element;
      }
    }
    
    // Check the last group
    if (currentGroup.length >= 2) {
      repetitiveGroups.push(currentGroup);
    }
    
    return repetitiveGroups;
  }
  
  /**
   * Detect similar texts using basic similarity checks
   * Returns arrays of indices where text content is substantially similar
   */
  private detectSimilarTexts(texts: string[]): number[][] {
    const similarGroups: number[][] = [];
    
    for (let i = 0; i < texts.length; i++) {
      // Skip processing if this index is already in a group
      if (similarGroups.some(group => group.includes(i))) {
        continue;
      }
      
      const currentText = texts[i]?.toLowerCase().trim() || '';
      if (!currentText) continue;
      
      const currentGroup: number[] = [i];
      
      // Compare with other texts
      for (let j = i + 1; j < texts.length; j++) {
        const otherText = texts[j]?.toLowerCase().trim() || '';
        if (!otherText) continue;
        
        // Check for similarity (very basic check, could be improved)
        if (this.calculateSimilarity(currentText, otherText) > 0.7) {
          currentGroup.push(j);
        }
      }
      
      // Add group if it contains multiple indices
      if (currentGroup.length > 1) {
        similarGroups.push(currentGroup);
      }
    }
    
    return similarGroups;
  }
  
  /**
   * Calculate text similarity using a simple approach
   * Returns a value between 0 and 1, with 1 being identical
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Use a simple algorithm for quick similarity check
    // Get unique words from each text
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
    
    // Count common words
    let commonWords = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        commonWords++;
      }
    }
    
    // Calculate Jaccard similarity
    const union = words1.size + words2.size - commonWords;
    return union > 0 ? commonWords / union : 0;
  }
}