import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { StoryGenerator } from "./StoryGenerator";
import { StoryIntelligenceEngine } from "./StoryIntelligenceEngine";
import { CinematicIntelligenceEngine } from "./CinematicIntelligenceEngine";
import { EmotionalArcEngine } from "./EmotionalArcEngine";
import { AntiRepetitionSystem } from "./AntiRepetitionSystem";
import { NarrativeEnhancer } from "./NarrativeEnhancer";
import AIEnhancementsConfig from "../../../config/AIEnhancements";

/**
 * Factory for creating and configuring Story Intelligence Engine instances
 */
export class StoryIntelligenceFactory {
  /**
   * Create a fully configured Story Intelligence Engine
   */
  static create(
    aiRegistry: AIProviderRegistry, 
    storyGenerator: StoryGenerator
  ): StoryIntelligenceEngine {
    // Create the Story Intelligence Engine
    const engine = new StoryIntelligenceEngine(
      aiRegistry,
      storyGenerator
    );
    
    return engine;
  }
  
  /**
   * Create individual intelligence components
   */
  static createComponents(aiRegistry: AIProviderRegistry) {
    return {
      cinematicEngine: new CinematicIntelligenceEngine(aiRegistry),
      emotionalEngine: new EmotionalArcEngine(aiRegistry),
      antiRepetitionSystem: new AntiRepetitionSystem(aiRegistry),
      narrativeEnhancer: new NarrativeEnhancer(aiRegistry)
    };
  }
  
  /**
   * Get the enhancement options based on configuration
   */
  static getEnhancementOptions() {
    const config = AIEnhancementsConfig.storyIntelligence;
    
    // If story intelligence is disabled, return all options as false
    if (!config.enabled) {
      return {
        enhanceNarrative: false,
        enhanceCinematic: false,
        enhanceEmotional: false,
        enhanceVariety: false,
        enhanceSuspense: false,
        enhanceNarrativeRhythm: false,
        enhanceScenePurpose: false,
        applyCameraVariety: false,
      };
    }
    
    // Otherwise, return configured options
    return {
      enhanceNarrative: config.enhancedStorytelling,
      enhanceCinematic: config.cinematicIntelligence,
      enhanceEmotional: config.emotionalArcs,
      enhanceVariety: config.antiRepetition,
      enhanceSuspense: config.suspenseGeneration,
      enhanceNarrativeRhythm: config.narrativeRhythm,
      enhanceScenePurpose: config.cinematicIntelligence,
      applyCameraVariety: config.antiRepetition,
    };
  }
}