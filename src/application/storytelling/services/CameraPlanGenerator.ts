import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Story } from "../../../domain/storytelling/entities/Story";
import { Scene, SceneCinematography } from "../../../domain/storytelling/entities/Scene";

export interface CameraPlan {
  sceneId: string;
  sceneIndex: number;
  sceneTitle: string;
  sceneNarrativeType: string;
  cameraAngle: string;
  cameraMovement: string;
  lighting: string;
  composition: string;
  purpose: string;
  visualImpact: string;
}

export interface ShotTransition {
  fromSceneId: string;
  toSceneId: string;
  transitionType: string;
  visualContinuity: string;
}

export interface CameraSequencePlan {
  shotSequence: CameraPlan[];
  transitions: ShotTransition[];
  cinematicNotes: string[];
}

/**
 * Service for generating professional camera plans for cinematic storytelling
 */
export class CameraPlanGenerator {
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Generate a comprehensive camera plan for a story
   */
  async generateCameraSequencePlan(story: Story): Promise<CameraSequencePlan> {
    try {
      // Get AI providers for narrative structure
      const providers = await this.aiRegistry.getFallbackChain('narrative-structure');
      
      if (providers.length === 0) {
        throw new Error('No available AI providers for camera planning');
      }
      
      // Create a simplified scene breakdown for the prompt
      const sceneBreakdown = story.scenes.map((scene, index) => 
        `Scene ${index + 1}: "${scene.title}" - ${scene.narrative_type}
  - Location: ${scene.environment.location}
  - Time: ${scene.environment.time}
  - Mood: ${scene.environment.mood}
  - Description: ${scene.description.substring(0, 100)}...`
      ).join('\n\n');
      
      const prompt = `
As a master cinematographer, create a professional camera sequence plan for this animated story:

STORY: "${story.title}"
PREMISE: "${story.premise}"

SCENE BREAKDOWN:
${sceneBreakdown}

Your task:
Create a cohesive camera plan for the entire story that uses professional cinematography techniques to enhance the narrative.

For each scene, provide:
1. The appropriate camera angle with reasoning
2. Camera movement that enhances the scene
3. Lighting approach that matches the mood
4. Composition guidelines for framing
5. How this shot serves the story purpose
6. Expected visual impact on the audience

Also provide transition recommendations between scenes and overall cinematic notes.

Return a detailed JSON object with:
{
  "shotSequence": [
    {
      "sceneId": scene ID,
      "sceneIndex": scene index number,
      "sceneTitle": "Scene title",
      "sceneNarrativeType": "setup/conflict/climax/resolution/transition",
      "cameraAngle": "Specific camera angle",
      "cameraMovement": "Specific camera movement",
      "lighting": "Lighting approach",
      "composition": "Composition guidelines",
      "purpose": "How this shot serves the story",
      "visualImpact": "Expected audience impact"
    }
    ... one entry for each scene
  ],
  "transitions": [
    {
      "fromSceneId": source scene ID,
      "toSceneId": target scene ID,
      "transitionType": "cut/fade/dissolve/wipe/etc",
      "visualContinuity": "How to maintain visual flow between scenes"
    }
    ... one entry for each transition between scenes
  ],
  "cinematicNotes": [
    "Overall cinematic note 1",
    "Overall cinematic note 2",
    ... any overall notes for the visual storytelling
  ]
}

Focus on creating a cohesive visual journey that enhances the emotional impact and narrative flow.
Use varied camera techniques that prevent monotony while maintaining visual coherence.`;

      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateJSON<CameraSequencePlan>(prompt);
          return this.validateCameraPlan(result, story);
        } catch (error) {
          console.warn(`Camera plan generation failed with provider ${provider.id}:`, error);
        }
      }
      
      throw new Error('All providers failed to generate camera plan');
    } catch (error) {
      console.error('Failed to generate camera sequence plan:', error);
      // Return a basic camera plan if AI generation fails
      return this.createBasicCameraPlan(story);
    }
  }
  
  /**
   * Apply a camera sequence plan to a story
   */
  applyCameraPlan(story: Story, cameraPlan: CameraSequencePlan): Story {
    // Create a copy of the story
    const enhancedStory = { ...story };
    const updatedScenes = [...story.scenes];
    
    // Apply camera plans to each scene
    for (const shotPlan of cameraPlan.shotSequence) {
      const sceneIndex = shotPlan.sceneIndex;
      
      if (sceneIndex >= 0 && sceneIndex < updatedScenes.length) {
        // Update scene with camera plan
        updatedScenes[sceneIndex] = {
          ...updatedScenes[sceneIndex],
          cinematography: {
            camera_angle: shotPlan.cameraAngle,
            camera_movement: shotPlan.cameraMovement,
            lighting: shotPlan.lighting,
            composition: shotPlan.composition,
          },
          // Add camera notes to prompt
          prompt_text: updatedScenes[sceneIndex].prompt_text + `\n\nCinematography: ${shotPlan.cameraAngle}, ${shotPlan.cameraMovement}, ${shotPlan.lighting}\nComposition: ${shotPlan.composition}\nVisual purpose: ${shotPlan.purpose}`,
          updated_at: new Date().toISOString(),
        };
      }
    }
    
    // Apply transition information to scenes
    for (const transition of cameraPlan.transitions) {
      // Find the scenes
      const fromScene = updatedScenes.find(s => s.id === transition.fromSceneId);
      const toScene = updatedScenes.find(s => s.id === transition.toSceneId);
      
      if (fromScene && toScene) {
        // Add transition info to the "from" scene
        const fromIndex = updatedScenes.indexOf(fromScene);
        updatedScenes[fromIndex] = {
          ...updatedScenes[fromIndex],
          prompt_text: updatedScenes[fromIndex].prompt_text + `\n\nTransition to next scene: ${transition.transitionType}\nVisual continuity: ${transition.visualContinuity}`,
          updated_at: new Date().toISOString(),
        };
        
        // Add transition info to the "to" scene
        const toIndex = updatedScenes.indexOf(toScene);
        updatedScenes[toIndex] = {
          ...updatedScenes[toIndex],
          prompt_text: updatedScenes[toIndex].prompt_text + `\n\nTransition from previous scene: ${transition.transitionType}\nVisual continuity: ${transition.visualContinuity}`,
          updated_at: new Date().toISOString(),
        };
      }
    }
    
    return {
      ...enhancedStory,
      scenes: updatedScenes,
    };
  }
  
  /**
   * Create a basic camera plan if AI generation fails
   */
  private createBasicCameraPlan(story: Story): CameraSequencePlan {
    // Define standard camera angles for different narrative types
    const narrativeTypeToCameraDefaults = {
      'setup': {
        angle: 'Establishing shot',
        movement: 'Slow pan',
        lighting: 'Natural lighting',
        composition: 'Wide framing to establish environment',
        purpose: 'Introduce the setting and characters',
        impact: 'Provides context and orients the viewer'
      },
      'conflict': {
        angle: 'Medium shot',
        movement: 'Slight push in',
        lighting: 'Dramatic contrast',
        composition: 'Rule of thirds with tension in framing',
        purpose: 'Highlight character reactions and tension',
        impact: 'Creates sense of building drama'
      },
      'climax': {
        angle: 'Dynamic angle',
        movement: 'Handheld or steadicam',
        lighting: 'High contrast lighting',
        composition: 'Dramatic framing with leading lines',
        purpose: 'Maximize emotional impact of key moment',
        impact: 'Heightens tension and emotional engagement'
      },
      'resolution': {
        angle: 'Wide to Close-up',
        movement: 'Slow dolly out',
        lighting: 'Soft, warm lighting',
        composition: 'Balanced, harmonious composition',
        purpose: 'Provide emotional closure',
        impact: 'Gives sense of completion and satisfaction'
      },
      'transition': {
        angle: 'Tracking shot',
        movement: 'Continuous movement',
        lighting: 'Transitional lighting change',
        composition: 'Leading lines pointing to next location',
        purpose: 'Connect scenes smoothly',
        impact: 'Maintains flow and prevents jarring cuts'
      }
    };
    
    // Alternative camera angles for variety
    const cameraAngleVariations = [
      'Low angle', 'High angle', 'Dutch angle', 'Over-the-shoulder', 
      'Wide shot', 'Medium shot', 'Close-up', 'Extreme close-up',
      'Point of view', 'Two-shot', 'Bird\'s eye view', 'Profile shot'
    ];
    
    // Movement variations for variety
    const cameraMovementVariations = [
      'Static', 'Pan', 'Tilt', 'Dolly in', 'Dolly out', 
      'Track', 'Zoom', 'Crane up', 'Crane down', 'Arc',
      'Handheld', 'Steadicam'
    ];
    
    // Lighting variations for variety
    const lightingVariations = [
      'Natural lighting', 'High-key lighting', 'Low-key lighting',
      'Rembrandt lighting', 'Silhouette lighting', 'Dramatic contrast',
      'Soft diffused lighting', 'Practical lighting', 'Colored lighting',
      'Rim lighting', 'Moody atmospheric lighting'
    ];
    
    // Create shot sequence
    const shotSequence: CameraPlan[] = story.scenes.map((scene, index) => {
      // Get default camera settings based on narrative type
      const defaults = narrativeTypeToCameraDefaults[scene.narrative_type as keyof typeof narrativeTypeToCameraDefaults] 
        || narrativeTypeToCameraDefaults['setup'];
      
      // Add variation based on index to prevent repetition
      const angleIndex = index % cameraAngleVariations.length;
      const movementIndex = index % cameraMovementVariations.length;
      const lightingIndex = index % lightingVariations.length;
      
      // Use default or variation based on scene position
      // First scene should be establishing, climax should be dramatic
      const useVariation = index > 0 && scene.narrative_type !== 'climax';
      
      return {
        sceneId: scene.id,
        sceneIndex: index,
        sceneTitle: scene.title,
        sceneNarrativeType: scene.narrative_type,
        cameraAngle: useVariation ? cameraAngleVariations[angleIndex] : defaults.angle,
        cameraMovement: useVariation ? cameraMovementVariations[movementIndex] : defaults.movement,
        lighting: useVariation ? lightingVariations[lightingIndex] : defaults.lighting,
        composition: defaults.composition,
        purpose: defaults.purpose,
        visualImpact: defaults.impact
      };
    });
    
    // Create transitions
    const transitions: ShotTransition[] = [];
    
    for (let i = 0; i < story.scenes.length - 1; i++) {
      const fromScene = story.scenes[i];
      const toScene = story.scenes[i + 1];
      
      // Determine transition type based on narrative types
      let transitionType = 'Cut';
      let visualContinuity = 'Match on action';
      
      // Time change requires fade or dissolve
      if (fromScene.environment.time !== toScene.environment.time) {
        transitionType = 'Dissolve';
        visualContinuity = 'Gradual shift in lighting to indicate time change';
      }
      
      // Location change might require different transition
      if (fromScene.environment.location !== toScene.environment.location) {
        transitionType = 'Cut';
        visualContinuity = 'Establish new location with wide shot';
      }
      
      // Dramatic shift in narrative type
      if (
        (fromScene.narrative_type === 'climax' && toScene.narrative_type === 'resolution') ||
        (fromScene.narrative_type === 'setup' && toScene.narrative_type === 'conflict')
      ) {
        transitionType = 'Impact cut';
        visualContinuity = 'Dramatic shift in composition and lighting';
      }
      
      transitions.push({
        fromSceneId: fromScene.id,
        toSceneId: toScene.id,
        transitionType,
        visualContinuity
      });
    }
    
    return {
      shotSequence,
      transitions,
      cinematicNotes: [
        'Maintain visual consistency while varying shots for interest',
        'Use lighting to reinforce emotional tone of each scene',
        'Ensure camera movements are motivated by story or character actions',
        'Pay attention to screen direction for consistent character placement'
      ]
    };
  }
  
  /**
   * Validate a camera plan and ensure it's complete
   */
  private validateCameraPlan(
    plan: Partial<CameraSequencePlan>,
    story: Story
  ): CameraSequencePlan {
    // Create a basic plan to use as fallback
    const basicPlan = this.createBasicCameraPlan(story);
    
    // Ensure we have shot sequence for every scene
    const shotSequence = plan.shotSequence || [];
    
    // Check if we're missing any scenes in the plan
    const scenesInPlan = new Set(shotSequence.map(shot => shot.sceneId));
    const missingScenesIndices = story.scenes
      .map((scene, index) => ({scene, index}))
      .filter(({scene}) => !scenesInPlan.has(scene.id));
    
    // Fill in any missing scenes with defaults
    for (const {scene, index} of missingScenesIndices) {
      const defaultShot = basicPlan.shotSequence.find(s => s.sceneIndex === index);
      
      if (defaultShot) {
        shotSequence.push({
          ...defaultShot,
          sceneId: scene.id,
          sceneTitle: scene.title,
          sceneNarrativeType: scene.narrative_type
        });
      }
    }
    
    // Ensure we have transitions between scenes
    const transitions = plan.transitions || [];
    
    // Check if we're missing any transitions
    const transitionsInPlan = new Set(
      transitions.map(t => `${t.fromSceneId}-${t.toSceneId}`)
    );
    
    // Fill in missing transitions
    for (let i = 0; i < story.scenes.length - 1; i++) {
      const fromScene = story.scenes[i];
      const toScene = story.scenes[i + 1];
      const transitionKey = `${fromScene.id}-${toScene.id}`;
      
      if (!transitionsInPlan.has(transitionKey)) {
        const defaultTransition = basicPlan.transitions.find(
          t => t.fromSceneId === fromScene.id && t.toSceneId === toScene.id
        );
        
        if (defaultTransition) {
          transitions.push(defaultTransition);
        } else {
          // Create a basic transition
          transitions.push({
            fromSceneId: fromScene.id,
            toSceneId: toScene.id,
            transitionType: 'Cut',
            visualContinuity: 'Standard visual flow'
          });
        }
      }
    }
    
    // Ensure we have cinematic notes
    const cinematicNotes = plan.cinematicNotes?.length 
      ? plan.cinematicNotes 
      : basicPlan.cinematicNotes;
    
    return {
      shotSequence,
      transitions,
      cinematicNotes
    };
  }
}