import type { CharacterProfile, CharacterContinuity } from '../../domain/character/CharacterProfile';
import { createCharacterPrompt, createContinuityPrompt, updateContinuity } from '../../domain/character/CharacterProfile';

/**
 * Service for managing character consistency across scenes
 */
export class CharacterConsistencyService {
  private continuityMap: Map<string, CharacterContinuity> = new Map();
  
  /**
   * Initialize continuity for a character
   */
  initializeCharacter(characterId: string): void {
    if (!this.continuityMap.has(characterId)) {
      this.continuityMap.set(characterId, {
        character_id: characterId,
      });
    }
  }
  
  /**
   * Get character prompt for current scene
   */
  getCharacterPrompt(profile: CharacterProfile, sceneId?: string): string {
    const continuity = this.continuityMap.get(profile.id);
    return createContinuityPrompt(profile, continuity);
  }
  
  /**
   * Update character state after scene
   */
  updateAfterScene(
    characterId: string,
    sceneId: string,
    updates: {
      emotion?: string;
      location?: string;
      action?: string;
      visual_state?: string;
    }
  ): void {
    const current = this.continuityMap.get(characterId) || { character_id: characterId };
    const updated = updateContinuity(current, sceneId, updates);
    this.continuityMap.set(characterId, updated);
  }
  
  /**
   * Get continuity context for character
   */
  getContinuity(characterId: string): CharacterContinuity | undefined {
    return this.continuityMap.get(characterId);
  }
  
  /**
   * Reset continuity (for new episodes)
   */
  resetContinuity(characterId: string): void {
    this.continuityMap.set(characterId, {
      character_id: characterId,
    });
  }
  
  /**
   * Clear all continuity data
   */
  clearAll(): void {
    this.continuityMap.clear();
  }
}

export const characterConsistencyService = new CharacterConsistencyService();
