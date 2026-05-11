/**
 * SERI AI STUDIO - Storytelling Module
 * 
 * Exports all storytelling-related services and components
 */

// Core storytelling services
export { StoryGenerator } from './services/StoryGenerator';
export { WorkflowOrchestrator } from './services/WorkflowOrchestrator';
export { EnhancedWorkflowOrchestrator } from './services/WorkflowOrchestrator.enhanced';
export { WorkflowOrchestratorFactory } from './services/WorkflowOrchestratorFactory';

// Story Intelligence Engine
export { StoryIntelligenceEngine } from './services/StoryIntelligenceEngine';
export { StoryIntelligenceFactory } from './services/StoryIntelligenceFactory';

// Cinematic intelligence components
export { CinematicIntelligenceEngine } from './services/CinematicIntelligenceEngine';
export { EmotionalArcEngine } from './services/EmotionalArcEngine';
export { AntiRepetitionSystem } from './services/AntiRepetitionSystem';
export { NarrativeEnhancer } from './services/NarrativeEnhancer';
export { CameraPlanGenerator } from './services/CameraPlanGenerator';
export { PromptEnhancer } from './services/PromptEnhancer';

// Analysis and validation components
export { StoryAnalyzer } from './services/StoryAnalyzer';
export { ContinuityTracker } from './services/ContinuityTracker';

// Character continuity
export { CharacterContinuityService } from './services/CharacterContinuity';

// Domain model re-exports
export { 
  Story, 
  createStory, 
  addNarrativeArc,
  addScene,
  updateStoryStatus
} from '../../domain/storytelling/entities/Story';

export {
  Scene,
  createScene,
  updateScenePrompt,
  updateSceneNarration,
  addCharacterToScene
} from '../../domain/storytelling/entities/Scene';

export {
  NarrativeArc,
  createNarrativeArc,
  addNarrativeElement,
  addSceneToArc
} from '../../domain/storytelling/entities/NarrativeArc';

export {
  createCharacterMemory,
  updateConsistencySettings,
  addSceneAppearance,
  addReferenceImage
} from '../../domain/storytelling/entities/CharacterConsistency';

// Test utilities
export { testStoryIntelligenceEngine } from './tests/StoryIntelligenceEngineTest';