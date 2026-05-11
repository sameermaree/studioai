import { EnhancedCharacterMemory } from '../../domain/storytelling/entities/CharacterMemory';
import { LocalStorageRepository } from './LocalStorageRepository';
import { CharacterMemoryRepository } from './CharacterMemoryRepository';
import { Character } from '../../types';

/**
 * Service for managing persistent character memory across application sessions
 */
export class PersistentCharacterMemory {
  private repository: CharacterMemoryRepository;
  private characterRepository: LocalStorageRepository<Character>;
  
  constructor() {
    this.repository = new CharacterMemoryRepository();
    this.characterRepository = new LocalStorageRepository<Character>('characters');
  }
  
  /**
   * Get memory for a character, creating it if it doesn't exist
   */
  getOrCreateCharacterMemory(characterId: string): EnhancedCharacterMemory | null {
    // Get character memory from repository
    let memory = this.repository.getMemory(characterId);
    
    if (memory) {
      return memory;
    }
    
    // If no memory exists, get character and create memory
    const character = this.characterRepository.getById(characterId);
    
    if (!character) {
      console.warn(`Cannot create memory for unknown character ${characterId}`);
      return null;
    }
    
    // Create new memory using extracted details
    memory = this.createMemoryFromCharacter(character);
    
    // Save and return
    return this.repository.saveMemory(memory);
  }
  
  /**
   * Get all character memories
   */
  getAllCharacterMemories(): EnhancedCharacterMemory[] {
    return this.repository.getAllMemories();
  }
  
  /**
   * Get all memories with their associated characters
   */
  getAllMemoriesWithCharacters(): Array<{
    memory: EnhancedCharacterMemory;
    character: Character | null;
  }> {
    const memories = this.repository.getAllMemories();
    const result: Array<{
      memory: EnhancedCharacterMemory;
      character: Character | null;
    }> = [];
    
    for (const memory of memories) {
      const character = this.characterRepository.getById(memory.characterId);
      result.push({
        memory,
        character
      });
    }
    
    return result;
  }
  
  /**
   * Save a character memory
   */
  saveCharacterMemory(memory: EnhancedCharacterMemory): EnhancedCharacterMemory {
    return this.repository.saveMemory(memory);
  }
  
  /**
   * Delete a character's memory
   */
  deleteCharacterMemory(characterId: string): boolean {
    return this.repository.deleteMemory(characterId);
  }
  
  /**
   * Create memory for all characters that don't have it
   */
  initializeAllCharacterMemories(): number {
    const characters = this.characterRepository.getAll();
    let createdCount = 0;
    
    for (const character of characters) {
      // Check if memory already exists
      if (!this.repository.getMemory(character.id)) {
        // Create and save memory
        const memory = this.createMemoryFromCharacter(character);
        this.repository.saveMemory(memory);
        createdCount++;
      }
    }
    
    return createdCount;
  }
  
  /**
   * Export character memories to a file (for backup/transfer)
   */
  exportMemories(): string {
    const memories = this.repository.getAllMemories();
    return JSON.stringify(memories);
  }
  
  /**
   * Import character memories from a file
   */
  importMemories(jsonData: string): number {
    try {
      const memories = JSON.parse(jsonData) as EnhancedCharacterMemory[];
      
      if (!Array.isArray(memories)) {
        throw new Error('Invalid memory data format');
      }
      
      // Save each memory
      for (const memory of memories) {
        this.repository.saveMemory(memory);
      }
      
      return memories.length;
    } catch (error) {
      console.error('Failed to import memories:', error);
      throw error;
    }
  }
  
  /**
   * Create memory from a character
   */
  private createMemoryFromCharacter(character: Character): EnhancedCharacterMemory {
    const now = new Date().toISOString();
    
    // Create basic memory structure
    return {
      characterId: character.id,
      consistencySettings: character.consistency_settings || {
        face: true,
        hairstyle: true,
        eye_color: true,
        clothing: true,
        body_proportions: true,
        animation_style: true,
        color_palette: true,
      },
      metadata: {
        facial_features: this.extractFacialFeatures(character),
        clothing_description: this.extractClothingDescription(character),
        color_scheme: this.extractColorScheme(character),
        body_type: this.extractBodyType(character),
        animation_style: character.style_preset_id ? 'Based on style preset' : 'Standard animation',
      },
      reference_images: character.reference_images || [],
      scene_appearances: [],
      
      // Enhanced memory components
      relationships: {},
      emotional_state: {
        current: 'neutral',
        history: []
      },
      appearance_history: [],
      personality: {
        core_traits: this.extractPersonalityTraits(character),
        exhibited_behaviors: []
      },
      knowledge: [],
      reinforcement: {
        face_emphasis: 8,
        outfit_emphasis: 7,
        personality_emphasis: 6
      },
      memory_elements: [
        {
          key: 'name',
          value: character.name,
          importance: 10
        },
        {
          key: 'description',
          value: character.description,
          importance: 9
        }
      ],
      last_updated: now
    };
  }
  
  /**
   * Extract facial features from character description
   */
  private extractFacialFeatures(character: Character): string {
    const facialFeatureKeywords = [
      'eyes', 'nose', 'mouth', 'face', 'hair', 'expression', 
      'eyebrows', 'jaw', 'cheeks', 'forehead', 'ears'
    ];
    
    const description = character.description.toLowerCase();
    const matches: string[] = [];
    
    // Find sentences containing facial feature keywords
    const sentences = character.description.split(/[.!?]+/).map(s => s.trim());
    
    for (const sentence of sentences) {
      if (facialFeatureKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        matches.push(sentence);
      }
    }
    
    if (matches.length > 0) {
      return matches.join('. ');
    }
    
    // If no specific facial features found, use generic description
    return character.description;
  }
  
  /**
   * Extract clothing description from character description
   */
  private extractClothingDescription(character: Character): string {
    const clothingKeywords = [
      'wear', 'dressed', 'outfit', 'clothes', 'clothing', 'costume',
      'shirt', 'pants', 'dress', 'skirt', 'hat', 'coat', 'jacket',
      'uniform', 'robe', 'suit', 'armor'
    ];
    
    const description = character.description.toLowerCase();
    const matches: string[] = [];
    
    // Find sentences containing clothing keywords
    const sentences = character.description.split(/[.!?]+/).map(s => s.trim());
    
    for (const sentence of sentences) {
      if (clothingKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        matches.push(sentence);
      }
    }
    
    if (matches.length > 0) {
      return matches.join('. ');
    }
    
    // If no specific clothing description found, return empty string
    return '';
  }
  
  /**
   * Extract color scheme from character description
   */
  private extractColorScheme(character: Character): string {
    const colorKeywords = [
      'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink',
      'black', 'white', 'gray', 'brown', 'teal', 'gold', 'silver',
      'color', 'colored', 'hue', 'shade', 'tone'
    ];
    
    const description = character.description.toLowerCase();
    const matches: string[] = [];
    
    // Find sentences containing color keywords
    const sentences = character.description.split(/[.!?]+/).map(s => s.trim());
    
    for (const sentence of sentences) {
      if (colorKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        matches.push(sentence);
      }
    }
    
    if (matches.length > 0) {
      return matches.join('. ');
    }
    
    // If no specific color description found, return empty string
    return '';
  }
  
  /**
   * Extract body type from character description
   */
  private extractBodyType(character: Character): string {
    const bodyKeywords = [
      'tall', 'short', 'slim', 'thin', 'fat', 'chubby', 'muscular',
      'athletic', 'fit', 'slender', 'stocky', 'heavy', 'light',
      'build', 'body', 'frame', 'figure', 'physique'
    ];
    
    const description = character.description.toLowerCase();
    const matches: string[] = [];
    
    // Find sentences containing body type keywords
    const sentences = character.description.split(/[.!?]+/).map(s => s.trim());
    
    for (const sentence of sentences) {
      if (bodyKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        matches.push(sentence);
      }
    }
    
    if (matches.length > 0) {
      return matches.join('. ');
    }
    
    // If no specific body type description found, return empty string
    return '';
  }
  
  /**
   * Extract personality traits from character
   */
  private extractPersonalityTraits(character: Character): string[] {
    if (!character.personality_notes) {
      return [];
    }
    
    // Simple extraction - split by commas or semicolons
    const traits = character.personality_notes
      .split(/[,;]/)
      .map(trait => trait.trim())
      .filter(trait => trait.length > 0);
      
    return traits;
  }
}