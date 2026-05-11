import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Story } from "../../../domain/storytelling/entities/Story";
import { Scene } from "../../../domain/storytelling/entities/Scene";
import { Character } from "../../../types";

export interface StoryQualityScore {
  overall: number; // 0-100
  narrative: number; // 0-100
  cinematic: number; // 0-100
  emotional: number; // 0-100
  pacing: number; // 0-100
  variety: number; // 0-100
  characterDevelopment: number; // 0-100
}

export interface StoryAnalysis {
  qualityScores: StoryQualityScore;
  strengths: string[];
  weaknesses: string[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    area: string;
    suggestion: string;
  }[];
  sceneAnalysis: Array<{
    sceneIndex: number;
    qualityScore: number;
    notes: string[];
  }>;
}

/**
 * Service for analyzing story quality and providing feedback
 */
export class StoryAnalyzer {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Analyze story quality and provide feedback
   */
  async analyzeStory(
    story: Story, 
    characters: Character[]
  ): Promise<StoryAnalysis> {
    try {
      // Get AI providers for narrative analysis
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for story analysis');
      }
      
      // Create a story summary for analysis
      const sceneSummary = story.scenes.map((scene, index) => 
        `Scene ${index + 1}: "${scene.title}" (${scene.narrative_type})
  - Description: ${scene.description.substring(0, 100)}...
  - Environment: ${scene.environment.location}, ${scene.environment.time}, ${scene.environment.mood}
  - Camera: ${scene.cinematography.camera_angle}, ${scene.cinematography.camera_movement}
  - Characters: ${scene.characters.map(sc => {
      const character = characters.find(c => c.id === sc.characterId);
      return character ? `${character.name} (${sc.emotion})` : sc.characterId;
    }).join(', ')}`
      ).join('\n\n');
      
      // Create character summary
      const characterSummary = characters.map(character => 
        `${character.name}: ${character.description.substring(0, 100)}...`
      ).join('\n');
      
      // Create prompt for story analysis
      const prompt = `
As a master storyteller and film director, analyze this animated story:

TITLE: "${story.title}"
PREMISE: "${story.premise}"

CHARACTERS:
${characterSummary}

SCENE BREAKDOWN:
${sceneSummary}

Your task:
Provide a comprehensive analysis of this story's strengths and weaknesses, with actionable recommendations.

Return a detailed analysis as a JSON object with:
{
  "qualityScores": {
    "overall": 0-100 score,
    "narrative": 0-100 score,
    "cinematic": 0-100 score,
    "emotional": 0-100 score,
    "pacing": 0-100 score,
    "variety": 0-100 score,
    "characterDevelopment": 0-100 score
  },
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    ...
  ],
  "weaknesses": [
    "Specific weakness 1",
    "Specific weakness 2",
    ...
  ],
  "recommendations": [
    {
      "priority": "high/medium/low",
      "area": "Area of improvement",
      "suggestion": "Detailed suggestion"
    },
    ...
  ],
  "sceneAnalysis": [
    {
      "sceneIndex": 0,
      "qualityScore": 0-100 score,
      "notes": [
        "Specific note about this scene",
        ...
      ]
    },
    ...
  ]
}

Focus on providing constructive, actionable feedback that would improve the storytelling quality.
Be specific about both strengths and weaknesses, with particular attention to cinematic storytelling aspects.`;

      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<StoryAnalysis>(prompt);
          return this.validateAnalysis(result);
        } catch (error) {
          console.warn(`Story analysis failed with provider ${provider.id}:`, error);
        }
      }
      
      throw new Error('All providers failed to analyze story');
    } catch (error) {
      console.error('Failed to analyze story:', error);
      // Return basic analysis if AI analysis fails
      return this.createBasicAnalysis(story);
    }
  }
  
  /**
   * Calculate basic story metrics without AI
   */
  calculateBasicMetrics(story: Story): StoryQualityScore {
    const scenes = story.scenes;
    
    // Check for proper narrative structure
    const hasSetup = scenes.some(s => s.narrative_type === 'setup');
    const hasConflict = scenes.some(s => s.narrative_type === 'conflict');
    const hasClimax = scenes.some(s => s.narrative_type === 'climax');
    const hasResolution = scenes.some(s => s.narrative_type === 'resolution');
    
    // Calculate basic narrative score
    let narrativeScore = 60; // Start with average score
    if (hasSetup) narrativeScore += 10;
    if (hasConflict) narrativeScore += 10;
    if (hasClimax) narrativeScore += 10;
    if (hasResolution) narrativeScore += 10;
    
    // Calculate camera variety score
    const uniqueCameraAngles = new Set(scenes.map(s => s.cinematography.camera_angle)).size;
    const uniqueCameraMovements = new Set(scenes.map(s => s.cinematography.camera_movement)).size;
    const cameraVarietyRatio = Math.min(1, (uniqueCameraAngles + uniqueCameraMovements) / (2 * scenes.length));
    const cinematicScore = Math.round(cameraVarietyRatio * 100);
    
    // Calculate mood/emotion variety score
    const uniqueMoods = new Set(scenes.map(s => s.environment.mood)).size;
    const moodVarietyRatio = Math.min(1, uniqueMoods / scenes.length);
    const emotionalScore = Math.round(moodVarietyRatio * 100);
    
    // Calculate scene variety score
    const uniqueLocations = new Set(scenes.map(s => s.environment.location)).size;
    const uniqueTimes = new Set(scenes.map(s => s.environment.time)).size;
    const locationVarietyRatio = Math.min(1, uniqueLocations / scenes.length);
    const varietyScore = Math.round(locationVarietyRatio * 100);
    
    // Calculate pacing score based on scene distribution
    const setupCount = scenes.filter(s => s.narrative_type === 'setup').length;
    const conflictCount = scenes.filter(s => s.narrative_type === 'conflict').length;
    const climaxCount = scenes.filter(s => s.narrative_type === 'climax').length;
    const resolutionCount = scenes.filter(s => s.narrative_type === 'resolution').length;
    
    // Ideal distribution is roughly 20% setup, 40% conflict, 20% climax, 20% resolution
    const setupRatio = setupCount / scenes.length;
    const conflictRatio = conflictCount / scenes.length;
    const climaxRatio = climaxCount / scenes.length;
    const resolutionRatio = resolutionCount / scenes.length;
    
    // Calculate deviation from ideal distribution
    const setupDeviation = Math.abs(setupRatio - 0.2);
    const conflictDeviation = Math.abs(conflictRatio - 0.4);
    const climaxDeviation = Math.abs(climaxRatio - 0.2);
    const resolutionDeviation = Math.abs(resolutionRatio - 0.2);
    
    // Average deviation (0 is perfect, 1 is worst)
    const averageDeviation = (setupDeviation + conflictDeviation + climaxDeviation + resolutionDeviation) / 4;
    
    // Convert to score (100 is perfect, 0 is worst)
    const pacingScore = Math.round(100 * (1 - averageDeviation));
    
    // Calculate character development score
    // (Simplistic - just checking if characters have different emotions across scenes)
    const characterEmotions = new Map<string, Set<string>>();
    
    for (const scene of scenes) {
      for (const char of scene.characters) {
        if (!characterEmotions.has(char.characterId)) {
          characterEmotions.set(char.characterId, new Set<string>());
        }
        
        if (char.emotion) {
          characterEmotions.get(char.characterId)?.add(char.emotion);
        }
      }
    }
    
    // Calculate average emotion variety per character
    let totalEmotionVariety = 0;
    let characterCount = 0;
    
    for (const emotions of characterEmotions.values()) {
      totalEmotionVariety += emotions.size;
      characterCount++;
    }
    
    const averageEmotionVariety = characterCount > 0 ? totalEmotionVariety / characterCount : 0;
    
    // Score based on average emotion variety (ideally at least 3 emotions per character)
    const characterDevelopmentScore = Math.min(100, Math.round(averageEmotionVariety / 3 * 100));
    
    // Calculate overall score (weighted average)
    const overall = Math.round(
      (narrativeScore * 0.25) +
      (cinematicScore * 0.2) +
      (emotionalScore * 0.15) +
      (pacingScore * 0.2) +
      (varietyScore * 0.1) +
      (characterDevelopmentScore * 0.1)
    );
    
    return {
      overall,
      narrative: narrativeScore,
      cinematic: cinematicScore,
      emotional: emotionalScore,
      pacing: pacingScore,
      variety: varietyScore,
      characterDevelopment: characterDevelopmentScore,
    };
  }
  
  /**
   * Create a basic analysis if AI analysis fails
   */
  private createBasicAnalysis(story: Story): StoryAnalysis {
    const scores = this.calculateBasicMetrics(story);
    
    // Generate basic strengths
    const strengths: string[] = [];
    if (scores.narrative >= 80) strengths.push("Strong narrative structure with clear beginning, middle, and end");
    if (scores.cinematic >= 80) strengths.push("Good variety of camera angles and movements");
    if (scores.emotional >= 80) strengths.push("Effective emotional variety across scenes");
    if (scores.pacing >= 80) strengths.push("Well-paced storytelling with balanced narrative elements");
    if (scores.variety >= 80) strengths.push("Good variety of environments and settings");
    if (scores.characterDevelopment >= 80) strengths.push("Characters show emotional range and development");
    
    // Generate basic weaknesses
    const weaknesses: string[] = [];
    if (scores.narrative < 60) weaknesses.push("Weak narrative structure lacking clear story progression");
    if (scores.cinematic < 60) weaknesses.push("Limited variety in camera work leading to visual monotony");
    if (scores.emotional < 60) weaknesses.push("Lack of emotional variation across scenes");
    if (scores.pacing < 60) weaknesses.push("Pacing issues with unbalanced narrative elements");
    if (scores.variety < 60) weaknesses.push("Limited variety in environments and settings");
    if (scores.characterDevelopment < 60) weaknesses.push("Characters lack emotional range and development");
    
    // Generate basic recommendations
    const recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      area: string;
      suggestion: string;
    }> = [];
    
    // Add recommendations based on lowest scores
    if (scores.narrative < 70) {
      recommendations.push({
        priority: scores.narrative < 50 ? 'high' : 'medium',
        area: 'Narrative Structure',
        suggestion: 'Ensure story has clear setup, conflict, climax, and resolution elements'
      });
    }
    
    if (scores.cinematic < 70) {
      recommendations.push({
        priority: scores.cinematic < 50 ? 'high' : 'medium',
        area: 'Cinematography',
        suggestion: 'Increase variety of camera angles and movements between scenes'
      });
    }
    
    if (scores.emotional < 70) {
      recommendations.push({
        priority: scores.emotional < 50 ? 'high' : 'medium',
        area: 'Emotional Arcs',
        suggestion: 'Add greater variety of emotional beats and moods across scenes'
      });
    }
    
    if (scores.pacing < 70) {
      recommendations.push({
        priority: scores.pacing < 50 ? 'high' : 'medium',
        area: 'Pacing',
        suggestion: 'Balance narrative elements for better story rhythm'
      });
    }
    
    // Create basic scene analysis
    const sceneAnalysis = story.scenes.map((scene, index) => {
      // Calculate simple scene score
      const hasDescription = scene.description.length > 20;
      const hasEnvironment = scene.environment.location && scene.environment.time && scene.environment.mood;
      const hasCinematography = scene.cinematography.camera_angle && scene.cinematography.camera_movement;
      const hasCharacters = scene.characters.length > 0;
      const hasNarration = scene.narration && scene.narration.length > 20;
      
      let sceneScore = 60; // Start with average
      if (hasDescription) sceneScore += 8;
      if (hasEnvironment) sceneScore += 8;
      if (hasCinematography) sceneScore += 8;
      if (hasCharacters) sceneScore += 8;
      if (hasNarration) sceneScore += 8;
      
      // Generate basic scene notes
      const notes: string[] = [];
      
      if (!hasDescription) notes.push("Scene lacks detailed description");
      if (!hasEnvironment) notes.push("Scene environment details are incomplete");
      if (!hasCinematography) notes.push("Scene lacks detailed cinematography");
      if (!hasCharacters) notes.push("Scene has no characters");
      if (!hasNarration) notes.push("Scene narration is minimal or missing");
      
      if (notes.length === 0) {
        notes.push("Scene is adequately detailed");
      }
      
      return {
        sceneIndex: index,
        qualityScore: sceneScore,
        notes,
      };
    });
    
    return {
      qualityScores: scores,
      strengths,
      weaknesses,
      recommendations,
      sceneAnalysis,
    };
  }
  
  /**
   * Validate analysis results and fill in gaps
   */
  private validateAnalysis(analysis: Partial<StoryAnalysis>): StoryAnalysis {
    const defaultAnalysis = {
      qualityScores: {
        overall: 70,
        narrative: 70,
        cinematic: 70,
        emotional: 70,
        pacing: 70,
        variety: 70,
        characterDevelopment: 70,
      },
      strengths: ["Coherent story structure"],
      weaknesses: ["Could benefit from more detailed storytelling"],
      recommendations: [{
        priority: 'medium' as 'high' | 'medium' | 'low',
        area: "General Storytelling",
        suggestion: "Enhance narrative details for more engaging story"
      }],
      sceneAnalysis: [],
    };
    
    // Fill in any missing properties with defaults
    return {
      qualityScores: analysis.qualityScores || defaultAnalysis.qualityScores,
      strengths: analysis.strengths || defaultAnalysis.strengths,
      weaknesses: analysis.weaknesses || defaultAnalysis.weaknesses,
      recommendations: analysis.recommendations || defaultAnalysis.recommendations,
      sceneAnalysis: analysis.sceneAnalysis || defaultAnalysis.sceneAnalysis,
    };
  }
}