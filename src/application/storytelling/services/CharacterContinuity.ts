import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Character } from "../../../types";
import { CharacterConsistencyMetadata, CharacterMemory, createCharacterMemory } from "../../../domain/storytelling/entities/CharacterConsistency";
import { Scene } from "../../../domain/storytelling/entities/Scene";

/**
 * Manages character continuity and consistency across scenes
 */
export class CharacterContinuityService {
  private characterMemoryMap = new Map<string, CharacterMemory>();
  
  constructor(private aiRegistry: AIProviderRegistry) {}
  
  /**
   * Initialize character memory
   */
  initializeCharacterMemory(character: Character): CharacterMemory {
    // Check if memory already exists
    if (this.characterMemoryMap.has(character.id)) {
      return this.characterMemoryMap.get(character.id)!;
    }
    
    // Create new memory
    const memory = createCharacterMemory(character.id);
    
    // Extract initial metadata from character
    const initialMetadata: CharacterConsistencyMetadata = {
      facial_features: this.extractFacialFeatures(character),
      clothing_description: this.extractClothingDescription(character),
      color_scheme: this.extractColorScheme(character),
      body_type: this.extractBodyType(character),
      animation_style: character.style_preset_id ? 'Based on style preset' : 'Standard animation',
    };
    
    // Update memory
    const updatedMemory: CharacterMemory = {
      ...memory,
      metadata: initialMetadata,
      reference_images: character.reference_images || [],
    };
    
    // Store in map
    this.characterMemoryMap.set(character.id, updatedMemory);
    
    return updatedMemory;
  }
  
  /**
   * Generate consistent character descriptions for a scene
   */
  async generateConsistentCharacterDescriptions(
    scene: Scene,
    characters: Character[]
  ): Promise<{ characterId: string; description: string }[]> {
    // Filter characters to those in the scene
    const sceneCharacters = characters.filter(character => 
      scene.characters.some(sc => sc.characterId === character.id)
    );
    
    // If no characters in scene, return empty array
    if (sceneCharacters.length === 0) {
      return [];
    }
    
    // Initialize memories if needed
    for (const character of sceneCharacters) {
      if (!this.characterMemoryMap.has(character.id)) {
        this.initializeCharacterMemory(character);
      }
    }
    
    // Generate descriptions
    const descriptions = await Promise.all(
      sceneCharacters.map(character => 
        this.generateConsistentDescription(
          character,
          scene,
          this.characterMemoryMap.get(character.id)!
        )
      )
    );
    
    return descriptions;
  }
  
  /**
   * Get a character memory
   */
  getCharacterMemory(characterId: string): CharacterMemory | undefined {
    return this.characterMemoryMap.get(characterId);
  }
  
  /**
   * Record a character appearance in a scene
   */
  recordSceneAppearance(
    characterId: string,
    sceneId: string,
    imageUrl: string,
    emotion: string
  ): void {
    // Get memory
    const memory = this.characterMemoryMap.get(characterId);
    
    if (!memory) {
      console.warn(`No memory found for character ${characterId}`);
      return;
    }
    
    // Add appearance
    const updatedMemory: CharacterMemory = {
      ...memory,
      scene_appearances: [
        ...memory.scene_appearances,
        { scene_id: sceneId, image_url: imageUrl, emotion }
      ]
    };
    
    // Store updated memory
    this.characterMemoryMap.set(characterId, updatedMemory);
  }
  
  /**
   * Get consistency settings for prompt engineering
   */
  getConsistencyPromptGuidance(characterId: string): string {
    // Get memory
    const memory = this.characterMemoryMap.get(characterId);
    
    if (!memory) {
      return '';
    }
    
    // Build guidance based on consistency settings
    const parts: string[] = [];
    
    if (memory.consistencySettings.face && memory.metadata.facial_features) {
      parts.push(`Face: ${memory.metadata.facial_features}`);
    }
    
    if (memory.consistencySettings.clothing && memory.metadata.clothing_description) {
      parts.push(`Clothing: ${memory.metadata.clothing_description}`);
    }
    
    if (memory.consistencySettings.color_palette && memory.metadata.color_scheme) {
      parts.push(`Colors: ${memory.metadata.color_scheme}`);
    }
    
    if (memory.consistencySettings.body_proportions && memory.metadata.body_type) {
      parts.push(`Body: ${memory.metadata.body_type}`);
    }
    
    if (memory.consistencySettings.animation_style && memory.metadata.animation_style) {
      parts.push(`Style: ${memory.metadata.animation_style}`);
    }
    
    if (memory.metadata.seed) {
      parts.push(`Seed: ${memory.metadata.seed}`);
    }
    
    if (memory.metadata.lora_weights) {
      parts.push(`LoRA weights: ${memory.metadata.lora_weights}`);
    }
    
    return parts.join('. ');
  }
  
  /**
   * Generate a consistent character description for a scene
   */
  private async generateConsistentDescription(
    character: Character,
    scene: Scene,
    memory: CharacterMemory
  ): Promise<{ characterId: string; description: string }> {
    try {
      // Find the character's emotion and action in this scene
      const sceneCharacter = scene.characters.find(sc => sc.characterId === character.id);
      
      if (!sceneCharacter) {
        throw new Error(`Character ${character.id} not found in scene ${scene.id}`);
      }
      
      // Get providers for AI generation
      const providers = await this.aiRegistry.getFallbackChain('character-generation');
      
      if (providers.length === 0) {
        // Fall back to basic description
        return {
          characterId: character.id,
          description: this.createBasicCharacterDescription(
            character,
            sceneCharacter.emotion,
            sceneCharacter.action
          )
        };
      }
      
      // Build prompt
      const referenceDescriptions = memory.scene_appearances.length > 0 
        ? memory.scene_appearances.slice(-3).map(a => `Scene appearance: Character looking ${a.emotion}`).join('\n')
        : 'No previous appearances';
        
      const consistencyGuidance = this.getConsistencyPromptGuidance(character.id);
      
      const prompt = `
Generate a consistent visual description of a character for an animated scene:

CHARACTER DETAILS:
Name: ${character.name}
Description: ${character.description}
${character.personality_notes ? `Personality: ${character.personality_notes}` : ''}
${character.cinematic_notes ? `Cinematic notes: ${character.cinematic_notes}` : ''}

SCENE CONTEXT:
Scene title: ${scene.title}
Scene description: ${scene.description}
Environment: ${scene.environment.location}, ${scene.environment.time}
Mood: ${scene.environment.mood}

CHARACTER IN THIS SCENE:
Emotion: ${sceneCharacter.emotion}
${sceneCharacter.action ? `Action: ${sceneCharacter.action}` : ''}

CONSISTENCY GUIDANCE:
${consistencyGuidance || 'Maintain visual consistency with character description'}

PREVIOUS APPEARANCES:
${referenceDescriptions}

Your task:
Generate a detailed visual description of this character for this specific scene.
Focus on maintaining visual consistency while expressing the correct emotion and action.
Only describe the visual appearance - do not add dialogue or narration.

Return just the description text without additional commentary.
      `;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateText(prompt);
          
          return {
            characterId: character.id,
            description: result.text.trim()
          };
        } catch (error) {
          console.warn(`Character description generation failed with provider ${provider.id}:`, error);
        }
      }
      
      // Fall back to basic description if all providers fail
      return {
        characterId: character.id,
        description: this.createBasicCharacterDescription(
          character,
          sceneCharacter.emotion,
          sceneCharacter.action
        )
      };
      
    } catch (error) {
      console.error(`Failed to generate consistent character description:`, error);
      
      // Fall back to basic description
      return {
        characterId: character.id,
        description: this.createBasicCharacterDescription(
          character,
          scene.characters.find(sc => sc.characterId === character.id)?.emotion || 'neutral',
          scene.characters.find(sc => sc.characterId === character.id)?.action
        )
      };
    }
  }
  
  /**
   * Create a basic character description as fallback
   */
  private createBasicCharacterDescription(
    character: Character,
    emotion: string,
    action?: string
  ): string {
    return `${character.name}: ${character.description}. ${emotion ? `Looking ${emotion}.` : ''} ${action || ''}`.trim();
  }
  
  /**
   * Extract facial features from character description
   */
  private extractFacialFeatures(character: Character): string {
    // In a real implementation, use AI to extract specific facial features
    // For now, use a simple heuristic
    
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
}