import { LocalStorageRepository } from './LocalStorageRepository';
import { EnhancedCharacterMemory } from '../../domain/storytelling/entities/CharacterMemory';
import { CharacterMemory as BaseCharacterMemory } from '../../domain/storytelling/entities/CharacterConsistency';
import { migrateToEnhancedMemory } from '../../domain/storytelling/entities/CharacterMemory';

/**
 * Repository for persisting enhanced character memory
 */
export class CharacterMemoryRepository {
  private repository: LocalStorageRepository<EnhancedCharacterMemory>;
  private legacyRepository: LocalStorageRepository<BaseCharacterMemory>;
  
  constructor() {
    this.repository = new LocalStorageRepository<EnhancedCharacterMemory>('character-memory');
    this.legacyRepository = new LocalStorageRepository<BaseCharacterMemory>('character-consistency');
  }
  
  /**
   * Get memory for a character
   */
  getMemory(characterId: string): EnhancedCharacterMemory | null {
    // First try to get from enhanced repository
    const memory = this.repository.getById(characterId);
    
    if (memory) {
      return memory;
    }
    
    // Try to get from legacy repository and migrate
    const legacyMemory = this.legacyRepository.getById(characterId);
    
    if (legacyMemory) {
      // Migrate from legacy to enhanced memory
      const enhancedMemory = migrateToEnhancedMemory(legacyMemory);
      
      // Save the migrated memory
      this.saveMemory(enhancedMemory);
      
      return enhancedMemory;
    }
    
    return null;
  }
  
  /**
   * Get all character memories
   */
  getAllMemories(): EnhancedCharacterMemory[] {
    return this.repository.getAll();
  }
  
  /**
   * Save character memory
   */
  saveMemory(memory: EnhancedCharacterMemory): EnhancedCharacterMemory {
    return this.repository.save(memory);
  }
  
  /**
   * Save multiple character memories
   */
  saveMany(memories: EnhancedCharacterMemory[]): EnhancedCharacterMemory[] {
    return this.repository.saveMany(memories);
  }
  
  /**
   * Delete character memory
   */
  deleteMemory(characterId: string): boolean {
    return this.repository.delete(characterId);
  }
  
  /**
   * Get memories by story/episode ID (from scene appearances)
   */
  getMemoriesByStoryId(storyId: string): EnhancedCharacterMemory[] {
    return this.repository.query(memory => 
      memory.scene_appearances.some(appearance => 
        appearance.scene_id.startsWith(storyId)
      )
    );
  }
  
  /**
   * Get memories with relationships to a specific character
   */
  getRelatedMemories(characterId: string): EnhancedCharacterMemory[] {
    return this.repository.query(memory => 
      Object.keys(memory.relationships).includes(characterId)
    );
  }
  
  /**
   * Migrate all legacy memories to enhanced format
   */
  migrateAllLegacyMemories(): number {
    const legacyMemories = this.legacyRepository.getAll();
    let migratedCount = 0;
    
    for (const legacyMemory of legacyMemories) {
      // Check if already migrated
      const existing = this.repository.getById(legacyMemory.characterId);
      
      if (!existing) {
        // Migrate and save
        const enhancedMemory = migrateToEnhancedMemory(legacyMemory);
        this.repository.save(enhancedMemory);
        migratedCount++;
      }
    }
    
    return migratedCount;
  }
}