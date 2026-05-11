import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Story } from "../../../domain/storytelling/entities/Story";
import { Scene } from "../../../domain/storytelling/entities/Scene";
import { Character } from "../../../types";

export interface EmotionalBeat {
  type: 'tension' | 'relief' | 'revelation' | 'anticipation' | 'climax' | 'resolution' | 'setup';
  intensity: number; // 1-10
  description: string;
}

export interface EmotionalArc {
  name: string;
  beats: Array<{
    sceneIndex: number;
    beat: EmotionalBeat;
  }>;
}

export interface EmotionalAnalysisResult {
  emotionalArcs: EmotionalArc[];
  emotionalGaps: number[]; // Scene indices with weak emotional engagement
  flatSequences: Array<{
    startIndex: number;
    endIndex: number;
    issue: string;
  }>;
  tensionGraph: number[]; // Tension level (1-10) for each scene
  recommendations: Array<{
    sceneIndex: number;
    recommendation: string;
    suggestedEmotion: string;
    suggestedIntensity: number;
  }>;
}

/**
 * Manages emotional arcs, suspense, and tension throughout a story
 */
export class EmotionalArcEngine {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Analyze the emotional arcs of a story
   */
  async analyzeEmotionalArcs(story: Story, characters: Character[]): Promise<EmotionalAnalysisResult> {
    try {
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for emotional arc analysis');
      }
      
      // Create a scene breakdown for the prompt
      const sceneBreakdown = story.scenes.map((scene, index) => 
        `Scene ${index + 1}: "${scene.title}" (${scene.narrative_type})
  - Description: ${scene.description.substring(0, 100)}...
  - Mood: ${scene.environment.mood}
  - Characters: ${scene.characters.map(sc => {
      const character = characters.find(c => c.id === sc.characterId);
      return character ? `${character.name} (${sc.emotion})` : sc.characterId;
    }).join(', ')}`
      ).join("\n\n");
      
      const prompt = `
As a master storyteller specializing in emotional resonance, analyze the emotional arcs in this animated story:

Title: "${story.title}"
Premise: "${story.premise}"

SCENE BREAKDOWN:
${sceneBreakdown}

Analyze the emotional journey of this story and provide:

1. Major emotional arcs (character journeys or thematic developments)
2. Scene-by-scene emotional beats and their intensity (1-10)
3. Identification of emotional gaps or flat sequences
4. A tension graph showing how suspense/tension rises and falls
5. Specific recommendations for improving emotional resonance

Return a JSON object with:
{
  "emotionalArcs": [
    {
      "name": "Arc name (character journey or thematic arc)",
      "beats": [
        {
          "sceneIndex": scene index,
          "beat": {
            "type": "tension/relief/revelation/anticipation/climax/resolution/setup",
            "intensity": number 1-10,
            "description": "Description of the emotional beat"
          }
        }
      ]
    }
  ],
  "emotionalGaps": [scene indices with weak emotional engagement],
  "flatSequences": [
    {
      "startIndex": first scene index,
      "endIndex": last scene index,
      "issue": "Description of emotional flatness issue"
    }
  ],
  "tensionGraph": [tension level 1-10 for each scene],
  "recommendations": [
    {
      "sceneIndex": scene index,
      "recommendation": "Specific recommendation to improve scene",
      "suggestedEmotion": "Suggested primary emotion",
      "suggestedIntensity": intensity level 1-10
    }
  ]
}

Focus on creating an emotionally satisfying journey that builds tension effectively and creates narrative payoff.`;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<EmotionalAnalysisResult>(prompt);
          return this.validateAnalysisResult(result);
        } catch (error) {
          console.warn(`Emotional arc analysis failed with provider ${provider.id}:`, error);
        }
      }
      
      throw new Error('All providers failed to analyze emotional arcs');
    } catch (error) {
      console.error('Failed to analyze emotional arcs:', error);
      // Return default empty analysis
      return this.getDefaultAnalysis(story.scenes.length);
    }
  }
  
  /**
   * Apply emotional arc improvements to a story
   */
  async enhanceEmotionalArcs(story: Story, characters: Character[]): Promise<Story> {
    try {
      // Analyze emotional arcs first
      const analysis = await this.analyzeEmotionalArcs(story, characters);
      
      // If there are no significant issues, return the story unchanged
      if (
        analysis.emotionalGaps.length === 0 &&
        analysis.flatSequences.length === 0 &&
        analysis.recommendations.length === 0
      ) {
        return story;
      }
      
      // Get AI providers for enhancement
      const providers = await this.aiRegistry.getFallbackChain('scene-generation');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for emotional arc enhancement');
      }
      
      // Copy scenes for enhancement
      let enhancedScenes = [...story.scenes];
      
      // Apply improvements to scenes based on recommendations
      for (const recommendation of analysis.recommendations) {
        const sceneIndex = recommendation.sceneIndex;
        
        if (sceneIndex < 0 || sceneIndex >= enhancedScenes.length) {
          continue;
        }
        
        const scene = enhancedScenes[sceneIndex];
        
        // Find relevant tension level
        const tensionLevel = analysis.tensionGraph[sceneIndex] || 5;
        
        // Find emotional beats for this scene
        const emotionalBeats = analysis.emotionalArcs
          .flatMap(arc => arc.beats)
          .filter(beat => beat.sceneIndex === sceneIndex)
          .map(beat => beat.beat);
        
        // Get characters in the scene
        const sceneCharacters = characters.filter(character => 
          scene.characters.some(sc => sc.characterId === character.id)
        );
        
        // Create prompt for emotional enhancement
        const emotionalEnhancementPrompt = `
As a master storyteller specializing in emotional resonance, enhance this animated scene:

SCENE: "${scene.title}" (${scene.narrative_type})
DESCRIPTION: ${scene.description}
CURRENT MOOD: ${scene.environment.mood}
CHARACTERS: ${sceneCharacters.map(char => {
  const sceneChar = scene.characters.find(sc => sc.characterId === char.id);
  return `${char.name} (currently ${sceneChar?.emotion || 'neutral'})`;
}).join(', ')}

EMOTIONAL ANALYSIS:
- Tension level: ${tensionLevel}/10
- Current emotional beats: ${emotionalBeats.map(beat => 
  `${beat.type} (${beat.intensity}/10): ${beat.description}`
).join(', ')}

RECOMMENDATION:
${recommendation.recommendation}
Suggested primary emotion: ${recommendation.suggestedEmotion}
Suggested intensity: ${recommendation.suggestedIntensity}/10

Your task:
Enhance this scene to improve its emotional impact according to the recommendation.
Focus on creating authentic, resonant emotional moments that serve the story.

Return a JSON object with:
{
  "enhancedDescription": "Improved scene description with emotional elements",
  "enhancedNarration": "Improved narration text with emotional resonance",
  "environmentMood": "Enhanced mood description",
  "characterEmotions": [
    {
      "characterId": "character ID from original scene",
      "emotion": "More specific/powerful emotion",
      "action": "Action that expresses the emotion"
    }
  ],
  "visualElements": "Description of visual elements that enhance the emotion",
  "musicSuggestion": "Mood/style of music that would enhance the scene"
}

Ensure the emotional enhancement feels authentic and serves the story's purpose.`;
        
        // Try each provider until one works
        let enhancementApplied = false;
        
        for (const provider of providers) {
          try {
            const result = await provider.generateJSON<{
              enhancedDescription: string;
              enhancedNarration: string;
              environmentMood: string;
              characterEmotions: Array<{
                characterId: string;
                emotion: string;
                action?: string;
              }>;
              visualElements: string;
              musicSuggestion: string;
            }>(emotionalEnhancementPrompt);
            
            // Update scene with enhanced emotional content
            enhancedScenes[sceneIndex] = {
              ...enhancedScenes[sceneIndex],
              description: result.enhancedDescription || enhancedScenes[sceneIndex].description,
              narration: result.enhancedNarration || enhancedScenes[sceneIndex].narration,
              subtitle_text: result.enhancedNarration || enhancedScenes[sceneIndex].subtitle_text,
              environment: {
                ...enhancedScenes[sceneIndex].environment,
                mood: result.environmentMood || enhancedScenes[sceneIndex].environment.mood,
              },
              // Update character emotions
              characters: result.characterEmotions
                ? result.characterEmotions.map(ce => ({
                    characterId: ce.characterId,
                    emotion: ce.emotion,
                    action: ce.action
                  }))
                : enhancedScenes[sceneIndex].characters,
              // Add visual elements to prompt
              prompt_text: enhancedScenes[sceneIndex].prompt_text + 
                `\n\nEmotional elements: ${result.visualElements}` +
                `\n\nMusic suggestion: ${result.musicSuggestion}`,
              updated_at: new Date().toISOString(),
            };
            
            enhancementApplied = true;
            break;
          } catch (error) {
            console.warn(`Emotional enhancement failed with provider ${provider.id}:`, error);
          }
        }
        
        // If no AI enhancement worked, apply simple enhancement based on recommendation
        if (!enhancementApplied) {
          enhancedScenes[sceneIndex] = {
            ...enhancedScenes[sceneIndex],
            environment: {
              ...enhancedScenes[sceneIndex].environment,
              mood: recommendation.suggestedEmotion || enhancedScenes[sceneIndex].environment.mood,
            },
            prompt_text: enhancedScenes[sceneIndex].prompt_text + 
              `\n\nEmotional enhancement: ${recommendation.recommendation}` +
              `\n\nTarget emotion: ${recommendation.suggestedEmotion}` +
              `\n\nEmotional intensity: ${recommendation.suggestedIntensity}/10`,
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
      console.error('Failed to enhance emotional arcs:', error);
      // Return original story if enhancement fails
      return story;
    }
  }
  
  /**
   * Generate suspense elements for a story
   */
  async enhanceWithSuspense(story: Story): Promise<Story> {
    try {
      // Get AI providers for enhancement
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for suspense enhancement');
      }
      
      // Prepare scene breakdown for prompt
      const sceneBreakdown = story.scenes.map((scene, index) => 
        `Scene ${index + 1}: "${scene.title}" (${scene.narrative_type})
  - Description: ${scene.description.substring(0, 100)}...`
      ).join("\n\n");
      
      const prompt = `
As a master of narrative suspense, analyze and enhance this story with suspense techniques:

STORY:
Title: "${story.title}"
Premise: "${story.premise}"

CURRENT SCENES:
${sceneBreakdown}

Your task:
Identify opportunities to enhance suspense, anticipation, and narrative tension.
For each scene that would benefit from suspense enhancement, provide:
1. What narrative information to withhold or reveal
2. Visual suspense cues or elements
3. Specific suspense techniques to apply
4. How to modify the scene to implement the suspense

Return a JSON array:
[
  {
    "sceneIndex": scene index,
    "suspenseTechnique": "Name of technique (e.g., foreshadowing, misdirection, dramatic irony)",
    "implementation": "Specific way to implement the technique in this scene",
    "visualCues": "Visual elements that create suspense",
    "modifiedDescription": "Enhanced scene description with suspense",
    "modifiedNarration": "Enhanced narration with suspense"
  }
]

Focus on techniques appropriate for animated storytelling and the target audience.
Build tension progressively through the narrative for maximum impact.`;
      
      // Try each provider until one works
      let suspenseEnhancements: Array<{
        sceneIndex: number;
        suspenseTechnique: string;
        implementation: string;
        visualCues: string;
        modifiedDescription: string;
        modifiedNarration: string;
      }> = [];
      
      for (const provider of providers) {
        try {
          suspenseEnhancements = await provider.generateJSON(prompt);
          break;
        } catch (error) {
          console.warn(`Suspense enhancement generation failed with provider ${provider.id}:`, error);
        }
      }
      
      // If no enhancements were generated, return original story
      if (!suspenseEnhancements || suspenseEnhancements.length === 0) {
        return story;
      }
      
      // Apply suspense enhancements to scenes
      const enhancedScenes = [...story.scenes];
      
      for (const enhancement of suspenseEnhancements) {
        const sceneIndex = enhancement.sceneIndex;
        
        if (sceneIndex < 0 || sceneIndex >= enhancedScenes.length) {
          continue;
        }
        
        enhancedScenes[sceneIndex] = {
          ...enhancedScenes[sceneIndex],
          description: enhancement.modifiedDescription || enhancedScenes[sceneIndex].description,
          narration: enhancement.modifiedNarration || enhancedScenes[sceneIndex].narration,
          subtitle_text: enhancement.modifiedNarration || enhancedScenes[sceneIndex].subtitle_text,
          prompt_text: enhancedScenes[sceneIndex].prompt_text + 
            `\n\nSuspense technique: ${enhancement.suspenseTechnique}` +
            `\n\nVisual suspense cues: ${enhancement.visualCues}`,
          updated_at: new Date().toISOString(),
        };
      }
      
      return {
        ...story,
        scenes: enhancedScenes,
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to enhance with suspense:', error);
      // Return original story if enhancement fails
      return story;
    }
  }
  
  /**
   * Create an emotional rhythm for dialogue and narration
   */
  async enhanceNarrativeRhythm(story: Story): Promise<Story> {
    try {
      // Get AI providers for enhancement
      const providers = await this.aiRegistry.getFallbackChain('scene-generation');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for narrative rhythm enhancement');
      }
      
      // Create a copy of the scenes
      const enhancedScenes = [...story.scenes];
      
      // Process each scene individually for narration rhythm enhancement
      for (let i = 0; i < enhancedScenes.length; i++) {
        const scene = enhancedScenes[i];
        
        // Skip scenes with very short narration
        if (!scene.narration || scene.narration.length < 30) {
          continue;
        }
        
        // Create context from adjacent scenes
        let previousContext = '';
        let nextContext = '';
        
        if (i > 0) {
          previousContext = `Previous scene narration: "${enhancedScenes[i-1].narration}"`;
        }
        
        if (i < enhancedScenes.length - 1) {
          nextContext = `Next scene narration: "${enhancedScenes[i+1].narration}"`;
        }
        
        // Create prompt for narrative rhythm enhancement
        const rhythmPrompt = `
As a master of narrative rhythm and dialogue pacing, enhance this scene's narration:

SCENE: "${scene.title}" (${scene.narrative_type})
CURRENT NARRATION:
"${scene.narration}"

SCENE EMOTION/MOOD: ${scene.environment.mood}

CONTEXT:
${previousContext}
${nextContext}

Your task:
Enhance the narration to improve its emotional rhythm, pacing, and impact.
Make sure the narration:
1. Has varied sentence lengths for optimal rhythm
2. Uses pauses and emphasis effectively
3. Builds to emotional high points
4. Matches the scene's intended mood
5. Creates a natural flow with adjacent scenes

Return the enhanced narration text only, without additional commentary.
Preserve the original meaning and key information, but enhance the emotional impact.`;
        
        // Try each provider until one works
        let enhancedNarration = '';
        
        for (const provider of providers) {
          try {
            const result = await provider.generateText(rhythmPrompt);
            enhancedNarration = result.text.trim();
            break;
          } catch (error) {
            console.warn(`Narrative rhythm enhancement failed with provider ${provider.id}:`, error);
          }
        }
        
        // Only update if we got a meaningful enhancement
        if (enhancedNarration && enhancedNarration.length > scene.narration.length / 2) {
          enhancedScenes[i] = {
            ...enhancedScenes[i],
            narration: enhancedNarration,
            subtitle_text: enhancedNarration,
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
      console.error('Failed to enhance narrative rhythm:', error);
      // Return original story if enhancement fails
      return story;
    }
  }
  
  /**
   * Validate the analysis result and provide fallbacks for missing fields
   */
  private validateAnalysisResult(result: Partial<EmotionalAnalysisResult>): EmotionalAnalysisResult {
    // Get default analysis as a fallback
    const defaultAnalysis = this.getDefaultAnalysis(
      result.tensionGraph?.length || 0
    );
    
    return {
      emotionalArcs: result.emotionalArcs || defaultAnalysis.emotionalArcs,
      emotionalGaps: result.emotionalGaps || defaultAnalysis.emotionalGaps,
      flatSequences: result.flatSequences || defaultAnalysis.flatSequences,
      tensionGraph: result.tensionGraph || defaultAnalysis.tensionGraph,
      recommendations: result.recommendations || defaultAnalysis.recommendations,
    };
  }
  
  /**
   * Get default empty analysis
   */
  private getDefaultAnalysis(sceneCount: number): EmotionalAnalysisResult {
    return {
      emotionalArcs: [],
      emotionalGaps: [],
      flatSequences: [],
      tensionGraph: Array(sceneCount).fill(5),
      recommendations: [],
    };
  }
}