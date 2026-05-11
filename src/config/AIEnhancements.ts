/**
 * Configuration for AI enhancements in the application
 * Controls which advanced storytelling features are enabled
 */

export interface AIEnhancementsConfig {
  // Story Intelligence Engine features
  storyIntelligence: {
    enabled: boolean; // Master switch for Story Intelligence
    enhancedStorytelling: boolean; // Enhanced story generation with better narrative structures
    cinematicIntelligence: boolean; // Cinematic enhancements for better visual storytelling
    emotionalArcs: boolean; // Emotional arc management for better story engagement
    antiRepetition: boolean; // Anti-repetition system to prevent boring content
    suspenseGeneration: boolean; // Enhanced suspense and tension generation
    narrativeRhythm: boolean; // Dialogue and narration rhythm enhancement
  };
  
  // Character Memory System features
  characterMemory: {
    enabled: boolean; // Master switch for Character Memory
    persistentMemory: boolean; // Whether characters remember past scenes
    visualConsistency: boolean; // Consistency in character appearance
    personalityConsistency: boolean; // Consistency in character personality
    relationshipTracking: boolean; // Track character relationships
    emotionalMemory: boolean; // Remember character emotions
    appearanceLocking: boolean; // Lock specific appearance traits
    sceneAwareContinuity: boolean; // Adjust descriptions based on scene context
  };
  
  // Override orchestrator choice
  workflow: {
    orchestratorType: 'standard' | 'enhanced' | 'auto';
  };
}

/**
 * Default configuration with reasonable defaults
 * Production settings can be adjusted as needed
 */
const AIEnhancementsConfig: AIEnhancementsConfig = {
  storyIntelligence: {
    enabled: true, // Enable by default
    enhancedStorytelling: true,
    cinematicIntelligence: true,
    emotionalArcs: true,
    antiRepetition: true,
    suspenseGeneration: false, // Can be expensive, off by default
    narrativeRhythm: true
  },
  
  characterMemory: {
    enabled: true, // Enable character memory system
    persistentMemory: true, // Enable persistent memory across scenes
    visualConsistency: true, // Maintain consistent appearance
    personalityConsistency: true, // Maintain consistent personality
    relationshipTracking: true, // Track character relationships
    emotionalMemory: true, // Remember character emotions
    appearanceLocking: true, // Lock appearance traits
    sceneAwareContinuity: true // Adjust based on scene context
  },
  
  workflow: {
    orchestratorType: 'auto' // Let system decide based on available AI capabilities
  }
};

export default AIEnhancementsConfig;