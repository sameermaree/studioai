import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Story } from "../../../domain/storytelling/entities/Story";
import { Character } from "../../../types";
import { NarrativeEnhancer } from "./NarrativeEnhancer";
import { CinematicIntelligenceEngine } from "./CinematicIntelligenceEngine";
import { EmotionalArcEngine } from "./EmotionalArcEngine";
import { AntiRepetitionSystem } from "./AntiRepetitionSystem";
import { StoryGenerator } from "./StoryGenerator";

export interface EnhancementOptions {
  enhanceNarrative?: boolean;
  enhanceCinematic?: boolean;
  enhanceEmotional?: boolean;
  enhanceVariety?: boolean;
  enhanceSuspense?: boolean;
  enhanceNarrativeRhythm?: boolean;
  enhanceScenePurpose?: boolean;
  applyCameraVariety?: boolean;
}

export interface EnhancementResult {
  enhancedStory: Story;
  enhancementStats: {
    narrativeIssuesFixed: number;
    cinematicIssuesFixed: number;
    emotionalIssuesFixed: number;
    repetitionIssuesFixed: number;
    suspenseElementsAdded: number;
    scenesEnhanced: number;
  };
  duration: number;
}

/**
 * Central engine for improving storytelling intelligence across all dimensions
 */
export class StoryIntelligenceEngine {
  private narrativeEnhancer: NarrativeEnhancer;
  private cinematicEngine: CinematicIntelligenceEngine;
  private emotionalEngine: EmotionalArcEngine;
  private antiRepetitionSystem: AntiRepetitionSystem;
  
  constructor(
    private aiRegistry: AIProviderRegistry,
    private storyGenerator: StoryGenerator
  ) {
    this.narrativeEnhancer = new NarrativeEnhancer(aiRegistry);
    this.cinematicEngine = new CinematicIntelligenceEngine(aiRegistry);
    this.emotionalEngine = new EmotionalArcEngine(aiRegistry);
    this.antiRepetitionSystem = new AntiRepetitionSystem(aiRegistry);
  }
  
  /**
   * Enhance a story's intelligence across multiple dimensions
   */
  async enhanceStory(
    story: Story,
    characters: Character[],
    options: EnhancementOptions = {}
  ): Promise<EnhancementResult> {
    const startTime = Date.now();
    
    // Create stats object to track enhancements
    const enhancementStats = {
      narrativeIssuesFixed: 0,
      cinematicIssuesFixed: 0,
      emotionalIssuesFixed: 0,
      repetitionIssuesFixed: 0,
      suspenseElementsAdded: 0,
      scenesEnhanced: 0,
    };
    
    // Set default options
    const enhanceOptions: Required<EnhancementOptions> = {
      enhanceNarrative: options.enhanceNarrative ?? true,
      enhanceCinematic: options.enhanceCinematic ?? true,
      enhanceEmotional: options.enhanceEmotional ?? true,
      enhanceVariety: options.enhanceVariety ?? true,
      enhanceSuspense: options.enhanceSuspense ?? true,
      enhanceNarrativeRhythm: options.enhanceNarrativeRhythm ?? true,
      enhanceScenePurpose: options.enhanceScenePurpose ?? true,
      applyCameraVariety: options.applyCameraVariety ?? true,
    };
    
    // Make copy of story for enhancement
    let enhancedStory = { ...story };
    
    try {
      // 1. First, check and enhance narrative structure and flow
      if (enhanceOptions.enhanceNarrative) {
        console.log('Enhancing narrative structure...');
        const originalScenes = enhancedStory.scenes.map(s => s.id);
        
        enhancedStory = await this.narrativeEnhancer.enhanceStory(enhancedStory);
        
        // Count changes
        enhancementStats.narrativeIssuesFixed += 
          this.countSceneChanges(originalScenes, enhancedStory.scenes.map(s => s.id));
        
        enhancementStats.scenesEnhanced += 
          this.countChangedScenes(story.scenes, enhancedStory.scenes);
      }
      
      // 2. Apply camera variety to avoid repetitive shots if needed
      if (enhanceOptions.applyCameraVariety) {
        console.log('Applying camera variety matrix...');
        const originalCameraAngles = enhancedStory.scenes.map(s => s.cinematography.camera_angle);
        
        enhancedStory = await this.cinematicEngine.applyCameraVarietyMatrix(enhancedStory);
        
        // Count changes
        enhancementStats.cinematicIssuesFixed += 
          this.countChangedValues(
            originalCameraAngles, 
            enhancedStory.scenes.map(s => s.cinematography.camera_angle)
          );
      }
      
      // 3. Enhance cinematic qualities
      if (enhanceOptions.enhanceCinematic) {
        console.log('Enhancing cinematic qualities...');
        const originalCinematography = enhancedStory.scenes.map(s => ({
          camera: s.cinematography.camera_angle,
          movement: s.cinematography.camera_movement,
          lighting: s.cinematography.lighting,
        }));
        
        enhancedStory = await this.cinematicEngine.enhanceCinematography(enhancedStory, characters);
        
        // Count changes
        const newCinematography = enhancedStory.scenes.map(s => ({
          camera: s.cinematography.camera_angle,
          movement: s.cinematography.camera_movement,
          lighting: s.cinematography.lighting,
        }));
        
        enhancementStats.cinematicIssuesFixed += 
          this.countChangedComplexValues(originalCinematography, newCinematography);
      }
      
      // 4. Enhance scene purpose (helps with pacing and clarity)
      if (enhanceOptions.enhanceScenePurpose) {
        console.log('Enhancing scene purpose...');
        const originalDescriptions = enhancedStory.scenes.map(s => s.description);
        
        enhancedStory = await this.cinematicEngine.enhanceScenePurpose(enhancedStory);
        
        // Count changes
        enhancementStats.cinematicIssuesFixed += 
          this.countChangedValues(
            originalDescriptions, 
            enhancedStory.scenes.map(s => s.description)
          );
      }
      
      // 5. Enhance emotional arcs
      if (enhanceOptions.enhanceEmotional) {
        console.log('Enhancing emotional arcs...');
        const originalMoods = enhancedStory.scenes.map(s => s.environment.mood);
        const originalNarrations = enhancedStory.scenes.map(s => s.narration);
        
        enhancedStory = await this.emotionalEngine.enhanceEmotionalArcs(enhancedStory, characters);
        
        // Count changes
        enhancementStats.emotionalIssuesFixed += 
          this.countChangedValues(
            originalMoods, 
            enhancedStory.scenes.map(s => s.environment.mood)
          );
        
        enhancementStats.emotionalIssuesFixed += 
          this.countChangedValues(
            originalNarrations, 
            enhancedStory.scenes.map(s => s.narration)
          );
      }
      
      // 6. Add suspense elements
      if (enhanceOptions.enhanceSuspense) {
        console.log('Adding suspense elements...');
        const originalNarrations = enhancedStory.scenes.map(s => s.narration);
        
        enhancedStory = await this.emotionalEngine.enhanceWithSuspense(enhancedStory);
        
        // Count changes
        enhancementStats.suspenseElementsAdded = 
          this.countChangedValues(
            originalNarrations, 
            enhancedStory.scenes.map(s => s.narration)
          );
      }
      
      // 7. Enhance narrative rhythm (dialogue and pacing)
      if (enhanceOptions.enhanceNarrativeRhythm) {
        console.log('Enhancing narrative rhythm...');
        const originalNarrations = enhancedStory.scenes.map(s => s.narration);
        
        enhancedStory = await this.emotionalEngine.enhanceNarrativeRhythm(enhancedStory);
        
        // Count changes but don't double-count with previous enhancements
        const newNarrationChanges = this.countChangedValues(
          originalNarrations, 
          enhancedStory.scenes.map(s => s.narration)
        );
        
        if (newNarrationChanges > enhancementStats.emotionalIssuesFixed) {
          enhancementStats.emotionalIssuesFixed = newNarrationChanges;
        }
      }
      
      // 8. Fix repetition issues
      if (enhanceOptions.enhanceVariety) {
        console.log('Fixing repetition issues...');
        const originalScenes = enhancedStory.scenes.map(s => ({
          camera: s.cinematography.camera_angle,
          environment: s.environment.location,
          mood: s.environment.mood,
          description: s.description,
        }));
        
        enhancedStory = await this.antiRepetitionSystem.enhanceVariety(enhancedStory);
        
        // Count changes
        const newScenes = enhancedStory.scenes.map(s => ({
          camera: s.cinematography.camera_angle,
          environment: s.environment.location,
          mood: s.environment.mood,
          description: s.description,
        }));
        
        enhancementStats.repetitionIssuesFixed = 
          this.countChangedComplexValues(originalScenes, newScenes);
      }
      
      // Update total scenes enhanced
      enhancementStats.scenesEnhanced = 
        this.countChangedScenes(story.scenes, enhancedStory.scenes);
      
    } catch (error) {
      console.error('Error in story intelligence enhancement:', error);
      // If enhancement fails, return original story with error stats
      return {
        enhancedStory: story,
        enhancementStats: {
          narrativeIssuesFixed: 0,
          cinematicIssuesFixed: 0,
          emotionalIssuesFixed: 0,
          repetitionIssuesFixed: 0,
          suspenseElementsAdded: 0,
          scenesEnhanced: 0,
        },
        duration: Date.now() - startTime,
      };
    }
    
    return {
      enhancedStory,
      enhancementStats,
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * Generate a completely new story with enhanced storytelling features from the start
   */
  async generateEnhancedStory(
    premise: string,
    options: any, // Using StoryGenerationOptions from StoryGenerator
    characters: Character[]
  ): Promise<Story> {
    try {
      // 1. Generate basic story
      console.log('Generating base story...');
      const baseStory = await this.storyGenerator.generateStory(premise, options);
      
      // 2. Enhance with intelligence
      console.log('Enhancing generated story...');
      const enhancementResult = await this.enhanceStory(baseStory, characters, {
        enhanceNarrative: true,
        enhanceCinematic: true,
        enhanceEmotional: true,
        enhanceVariety: true,
        enhanceSuspense: true,
        enhanceNarrativeRhythm: true,
        enhanceScenePurpose: true,
        applyCameraVariety: true,
      });
      
      console.log('Story enhancement complete with stats:', enhancementResult.enhancementStats);
      
      return enhancementResult.enhancedStory;
    } catch (error) {
      console.error('Failed to generate enhanced story:', error);
      // Fallback to basic story generation
      return this.storyGenerator.generateStory(premise, options);
    }
  }
  
  /**
   * Count the number of scenes that were changed or added
   */
  private countChangedScenes(originalScenes: any[], newScenes: any[]): number {
    let changedCount = 0;
    
    // Check for changes in existing scenes
    for (let i = 0; i < Math.min(originalScenes.length, newScenes.length); i++) {
      const originalScene = originalScenes[i];
      const newScene = newScenes[i];
      
      // Compare descriptions as a simple change detection
      if (originalScene.description !== newScene.description ||
          originalScene.narration !== newScene.narration ||
          originalScene.cinematography?.camera_angle !== newScene.cinematography?.camera_angle ||
          originalScene.environment?.mood !== newScene.environment?.mood) {
        changedCount++;
      }
    }
    
    // Add count of new scenes
    if (newScenes.length > originalScenes.length) {
      changedCount += newScenes.length - originalScenes.length;
    }
    
    return changedCount;
  }
  
  /**
   * Count how many values changed between two arrays
   */
  private countChangedValues<T>(originalValues: T[], newValues: T[]): number {
    let changedCount = 0;
    
    for (let i = 0; i < Math.min(originalValues.length, newValues.length); i++) {
      if (originalValues[i] !== newValues[i]) {
        changedCount++;
      }
    }
    
    return changedCount;
  }
  
  /**
   * Count how many complex objects changed between two arrays
   * using JSON.stringify for comparison
   */
  private countChangedComplexValues<T>(originalValues: T[], newValues: T[]): number {
    let changedCount = 0;
    
    for (let i = 0; i < Math.min(originalValues.length, newValues.length); i++) {
      if (JSON.stringify(originalValues[i]) !== JSON.stringify(newValues[i])) {
        changedCount++;
      }
    }
    
    return changedCount;
  }
}