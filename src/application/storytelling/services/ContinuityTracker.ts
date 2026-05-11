import { Story } from "../../../domain/storytelling/entities/Story";
import { Scene } from "../../../domain/storytelling/entities/Scene";
import { Character } from "../../../types";

export interface ContinuityElements {
  locations: Set<string>;
  times: Set<string>;
  objects: Set<string>;
  characterTraits: Map<string, Set<string>>;
  characterOutfits: Map<string, string>;
  characterPositions: Map<string, string>;
  continuityNotes: string[];
}

export interface ContinuityIssue {
  type: 'location' | 'time' | 'object' | 'character' | 'logic';
  sceneIndex: number;
  previousSceneIndex?: number;
  element: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface ContinuityValidation {
  isValid: boolean;
  issues: ContinuityIssue[];
  continuityElements: ContinuityElements;
}

/**
 * Service for tracking and validating continuity across scenes
 */
export class ContinuityTracker {
  private continuityElements: ContinuityElements;
  
  constructor() {
    this.continuityElements = {
      locations: new Set<string>(),
      times: new Set<string>(),
      objects: new Set<string>(),
      characterTraits: new Map<string, Set<string>>(),
      characterOutfits: new Map<string, string>(),
      characterPositions: new Map<string, string>(),
      continuityNotes: [],
    };
  }
  
  /**
   * Reset the continuity tracker
   */
  reset(): void {
    this.continuityElements = {
      locations: new Set<string>(),
      times: new Set<string>(),
      objects: new Set<string>(),
      characterTraits: new Map<string, Set<string>>(),
      characterOutfits: new Map<string, string>(),
      characterPositions: new Map<string, string>(),
      continuityNotes: [],
    };
  }
  
  /**
   * Track continuity elements from a scene
   */
  trackScene(scene: Scene, characters: Character[]): void {
    // Track location
    if (scene.environment.location) {
      this.continuityElements.locations.add(scene.environment.location.toLowerCase());
    }
    
    // Track time
    if (scene.environment.time) {
      this.continuityElements.times.add(scene.environment.time.toLowerCase());
    }
    
    // Track characters and their traits
    for (const sceneChar of scene.characters) {
      const character = characters.find(c => c.id === sceneChar.characterId);
      
      if (character) {
        // Initialize character traits if not already tracked
        if (!this.continuityElements.characterTraits.has(character.id)) {
          this.continuityElements.characterTraits.set(character.id, new Set<string>());
          
          // Add traits from character description
          this.extractCharacterTraits(character).forEach(trait => {
            this.continuityElements.characterTraits.get(character.id)?.add(trait);
          });
        }
        
        // Track character emotion as a trait
        if (sceneChar.emotion) {
          this.continuityElements.characterTraits.get(character.id)?.add(sceneChar.emotion.toLowerCase());
        }
        
        // Track character position
        if (sceneChar.action) {
          this.continuityElements.characterPositions.set(character.id, sceneChar.action);
        }
      }
    }
    
    // Extract objects from description
    const objects = this.extractObjects(scene.description);
    objects.forEach(obj => this.continuityElements.objects.add(obj));
    
    // Add scene-specific continuity note
    this.continuityElements.continuityNotes.push(
      `Scene ${scene.order}: ${scene.environment.location}, ${scene.environment.time}`
    );
  }
  
  /**
   * Validate continuity across scenes
   */
  validateContinuity(story: Story, characters: Character[]): ContinuityValidation {
    const issues: ContinuityIssue[] = [];
    
    // Reset and track all scenes to build continuity elements
    this.reset();
    story.scenes.forEach(scene => this.trackScene(scene, characters));
    
    // Check time continuity (day/night logic)
    const timeSequence = story.scenes.map(scene => scene.environment.time.toLowerCase());
    
    for (let i = 1; i < timeSequence.length; i++) {
      const prevTime = timeSequence[i-1];
      const currTime = timeSequence[i];
      
      // Check for impossible time transitions
      if (
        (prevTime.includes('night') && currTime.includes('morning') && !this.sceneHasTimeskip(story.scenes[i])) ||
        (prevTime.includes('evening') && currTime.includes('morning') && !this.sceneHasTimeskip(story.scenes[i])) ||
        (prevTime.includes('morning') && currTime.includes('night') && !this.sceneHasTimeskip(story.scenes[i])) ||
        (prevTime.includes('dawn') && currTime.includes('dusk') && !this.sceneHasTimeskip(story.scenes[i]))
      ) {
        issues.push({
          type: 'time',
          sceneIndex: i,
          previousSceneIndex: i-1,
          element: `${prevTime} -> ${currTime}`,
          description: `Impossible time transition from ${prevTime} to ${currTime} without time skip`,
          severity: 'high',
          suggestion: `Add a transition indicating time passing, or adjust the time of day in one of the scenes`
        });
      }
    }
    
    // Check location continuity
    const locationSequence = story.scenes.map(scene => scene.environment.location);
    
    for (let i = 1; i < locationSequence.length; i++) {
      const prevLocation = locationSequence[i-1];
      const currLocation = locationSequence[i];
      
      // Check if locations are completely different without transition
      if (
        prevLocation !== currLocation && 
        !this.locationsAreRelated(prevLocation, currLocation) &&
        !this.sceneHasTransition(story.scenes[i])
      ) {
        issues.push({
          type: 'location',
          sceneIndex: i,
          previousSceneIndex: i-1,
          element: `${prevLocation} -> ${currLocation}`,
          description: `Abrupt location change from ${prevLocation} to ${currLocation} without transition`,
          severity: 'medium',
          suggestion: `Add a transition scene or transitional elements between these locations`
        });
      }
    }
    
    // Check character consistency
    for (const scene of story.scenes) {
      for (const sceneChar of scene.characters) {
        const character = characters.find(c => c.id === sceneChar.characterId);
        
        if (character) {
          // Check for character teleportation (character in consecutive scenes with distant locations)
          const sceneIndex = story.scenes.indexOf(scene);
          if (sceneIndex > 0) {
            const prevScene = story.scenes[sceneIndex - 1];
            
            // Check if character was in previous scene
            const wasInPrevScene = prevScene.characters.some(c => c.characterId === sceneChar.characterId);
            
            if (
              wasInPrevScene && 
              prevScene.environment.location !== scene.environment.location &&
              !this.locationsAreRelated(prevScene.environment.location, scene.environment.location) &&
              !this.sceneHasTransition(scene)
            ) {
              issues.push({
                type: 'character',
                sceneIndex: sceneIndex,
                previousSceneIndex: sceneIndex - 1,
                element: character.name,
                description: `${character.name} appears in two consecutive scenes with distant locations without explanation`,
                severity: 'medium',
                suggestion: `Add a transition explaining how ${character.name} traveled between locations`
              });
            }
          }
        }
      }
    }
    
    // Check logical narrative flow
    for (let i = 1; i < story.scenes.length; i++) {
      const prevScene = story.scenes[i-1];
      const currScene = story.scenes[i];
      
      // Check for narrative type sequence issues
      if (
        (prevScene.narrative_type === 'resolution' && currScene.narrative_type === 'setup') ||
        (prevScene.narrative_type === 'climax' && currScene.narrative_type === 'setup' && i < story.scenes.length - 2)
      ) {
        issues.push({
          type: 'logic',
          sceneIndex: i,
          previousSceneIndex: i-1,
          element: `${prevScene.narrative_type} -> ${currScene.narrative_type}`,
          description: `Unusual narrative flow from ${prevScene.narrative_type} to ${currScene.narrative_type}`,
          severity: 'low',
          suggestion: `Consider reordering scenes or adding a transition to explain this narrative shift`
        });
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      continuityElements: this.continuityElements,
    };
  }
  
  /**
   * Extract character traits from description
   */
  private extractCharacterTraits(character: Character): string[] {
    const traits: string[] = [];
    
    // Extract physical traits from description
    const physicalTraits = [
      'tall', 'short', 'thin', 'heavy', 'muscular', 'slender',
      'blue eyes', 'brown eyes', 'green eyes', 'hazel eyes',
      'blonde hair', 'brown hair', 'black hair', 'red hair',
      'beard', 'mustache', 'glasses', 'scar'
    ];
    
    for (const trait of physicalTraits) {
      if (character.description.toLowerCase().includes(trait)) {
        traits.push(trait);
      }
    }
    
    // Extract personality traits if available
    if (character.personality_notes) {
      const personalityWords = character.personality_notes
        .toLowerCase()
        .split(/[,.]/)
        .map(word => word.trim())
        .filter(word => word.length > 2);
        
      traits.push(...personalityWords);
    }
    
    return traits;
  }
  
  /**
   * Extract objects mentioned in a description
   */
  private extractObjects(description: string): string[] {
    const objects: string[] = [];
    
    // List of common objects to look for
    const commonObjects = [
      'table', 'chair', 'desk', 'book', 'phone', 'computer',
      'car', 'door', 'window', 'bed', 'light', 'lamp',
      'cup', 'plate', 'knife', 'spoon', 'fork', 'bottle',
      'bag', 'key', 'lock', 'sword', 'wand', 'staff',
      'ring', 'necklace', 'crown', 'throne', 'map', 'compass'
    ];
    
    for (const object of commonObjects) {
      if (description.toLowerCase().includes(object)) {
        objects.push(object);
      }
    }
    
    return objects;
  }
  
  /**
   * Check if locations are related (part of same area)
   */
  private locationsAreRelated(location1: string, location2: string): boolean {
    // Normalize locations
    const loc1 = location1.toLowerCase();
    const loc2 = location2.toLowerCase();
    
    // Check if one location contains the other
    if (loc1.includes(loc2) || loc2.includes(loc1)) {
      return true;
    }
    
    // Check for common parent locations
    const commonParents = [
      ['house', 'kitchen', 'bedroom', 'living room', 'bathroom', 'hallway', 'basement', 'attic'],
      ['school', 'classroom', 'hallway', 'cafeteria', 'gymnasium', 'office'],
      ['forest', 'clearing', 'woods', 'trees', 'grove'],
      ['castle', 'throne room', 'dungeon', 'tower', 'hall', 'chamber'],
      ['city', 'street', 'alley', 'building', 'park', 'downtown']
    ];
    
    for (const parentGroup of commonParents) {
      if (
        parentGroup.some(parent => loc1.includes(parent)) &&
        parentGroup.some(parent => loc2.includes(parent))
      ) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a scene includes time skip indicators
   */
  private sceneHasTimeskip(scene: Scene): boolean {
    const timeskipIndicators = [
      'later', 'after', 'next day', 'following day', 'next morning',
      'hours later', 'days later', 'that night', 'that morning',
      'time passes', 'the next day', 'weeks later', 'months later'
    ];
    
    // Check description for time skip indicators
    return timeskipIndicators.some(indicator => 
      scene.description.toLowerCase().includes(indicator)
    );
  }
  
  /**
   * Check if a scene includes transition indicators
   */
  private sceneHasTransition(scene: Scene): boolean {
    const transitionIndicators = [
      'meanwhile', 'elsewhere', 'at the same time', 'transition',
      'traveling', 'journey', 'on the way', 'as they arrive',
      'arriving at', 'entering', 'leaving', 'exiting'
    ];
    
    // Check if narrative type is 'transition'
    if (scene.narrative_type === 'transition') {
      return true;
    }
    
    // Check description for transition indicators
    return transitionIndicators.some(indicator => 
      scene.description.toLowerCase().includes(indicator)
    );
  }
}