import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { StoryGenerator } from "./StoryGenerator";
import { WorkflowOrchestrator } from "./WorkflowOrchestrator";
import { EnhancedWorkflowOrchestrator } from "./WorkflowOrchestrator.enhanced";
import { PromptEnhancer } from "./PromptEnhancer";
import { NarrativeEnhancer } from "./NarrativeEnhancer";
import { CharacterContinuityService } from "./CharacterContinuity";
import { Story, StylePreset, Character, Episode, Prompt, SubtitleTrack, RenderJob } from "../../../types";

/**
 * Interface defining common workflow orchestrator methods
 */
export interface IWorkflowOrchestrator {
  generateEpisodeWorkflow(
    config: any,
    stylePresets: StylePreset[],
    characters: Character[]
  ): Promise<{
    episode: Episode;
    prompts: Prompt[];
    subtitleTracks: SubtitleTrack[];
    renderJobs: RenderJob[];
  }>;
}

/**
 * Factory for creating workflow orchestrators with different capabilities
 */
export class WorkflowOrchestratorFactory {
  /**
   * Create a workflow orchestrator instance
   * @param type The type of orchestrator to create
   * @param aiRegistry The AI provider registry
   * @param storyGenerator The story generator
   */
  static create(
    type: 'standard' | 'enhanced' | 'auto' = 'auto',
    aiRegistry: AIProviderRegistry,
    storyGenerator: StoryGenerator
  ): IWorkflowOrchestrator {
    // If 'auto' is specified, determine the best orchestrator based on available AI capabilities
    if (type === 'auto') {
      // Check if advanced AI capabilities are available
      return this.hasAdvancedAICapabilities(aiRegistry) ?
        new EnhancedWorkflowOrchestrator(aiRegistry, storyGenerator) :
        new WorkflowOrchestrator(aiRegistry, storyGenerator);
    }
    
    // Create the specified orchestrator type
    return type === 'enhanced' ?
      new EnhancedWorkflowOrchestrator(aiRegistry, storyGenerator) :
      new WorkflowOrchestrator(aiRegistry, storyGenerator);
  }
  
  /**
   * Check if the AI registry has advanced capabilities needed for enhanced orchestration
   */
  /**
   * Create shared service instances for workflow orchestrators
   */
  static createServices(aiRegistry: AIProviderRegistry, storyGenerator: StoryGenerator) {
    return {
      narrativeEnhancer: new NarrativeEnhancer(aiRegistry),
      promptEnhancer: new PromptEnhancer(aiRegistry),
      characterContinuity: new CharacterContinuityService(aiRegistry),
      storyGenerator
    };
  }
  
  private static async hasAdvancedAICapabilities(aiRegistry: AIProviderRegistry): Promise<boolean> {
    try {
      // Check for advanced AI capabilities
      const narrativeProviders = await aiRegistry.getFallbackChain('narrative-structure');
      const sceneProviders = await aiRegistry.getFallbackChain('scene-generation');
      const characterProviders = await aiRegistry.getFallbackChain('character-generation');
      
      // Need at least narrative and scene capabilities for enhanced orchestrator
      return narrativeProviders.length > 0 && sceneProviders.length > 0;
    } catch (error) {
      console.warn('Error checking AI capabilities:', error);
      // Fall back to standard orchestrator if we can't determine capabilities
      return false;
    }
  }
}