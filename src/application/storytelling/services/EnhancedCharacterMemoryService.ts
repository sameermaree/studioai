import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { Character, Scene } from "../../../types";
import { CharacterMemoryRepository } from "../../../infrastructure/persistence/CharacterMemoryRepository";
import { 
  EnhancedCharacterMemory, 
  createEnhancedCharacterMemory,
  updateCharacterEmotion,
  updateCharacterAppearance,
  addExhibitedBehavior,
  setCorePersonalityTraits,
  updateCharacterRelationship,
  addCharacterKnowledge,
  addMemoryElement,
  getRecentEmotions,
  getDominantTraits,
  getImportantKnowledge
} from "../../../domain/storytelling/entities/CharacterMemory";

/**
 * Enhanced service for managing character memory and consistency across scenes and episodes
 */
export class EnhancedCharacterMemoryService {
  private repository: CharacterMemoryRepository;
  
  constructor(private aiRegistry: AIProviderRegistry) {
    this.repository = new CharacterMemoryRepository();
    
    // Migrate legacy memories on initialization
    this.migrateLegacyMemories();
  }
  
  /**
   * Initialize character memory
   */
  initializeCharacterMemory(character: Character): EnhancedCharacterMemory {
    // Check if memory already exists
    const existingMemory = this.repository.getMemory(character.id);
    
    if (existingMemory) {
      return existingMemory;
    }
    
    // Create new memory
    const memory = createEnhancedCharacterMemory(character.id);
    
    // Extract initial metadata
    const enhancedMemory = this.extractCharacterMetadata(memory, character);
    
    // Extract personality traits
    let memoryWithTraits = enhancedMemory;
    if (character.personality_notes) {
      const traits = this.extractPersonalityTraits(character.personality_notes);
      memoryWithTraits = setCorePersonalityTraits(enhancedMemory, traits);
    }
    
    // Save and return
    return this.repository.saveMemory(memoryWithTraits);
  }
  
  /**
   * Get a character's memory
   */
  getCharacterMemory(characterId: string): EnhancedCharacterMemory | null {
    return this.repository.getMemory(characterId);
  }
  
  /**
   * Update a character's memory after a scene
   */
  async updateCharacterMemoryFromScene(
    character: Character,
    scene: Scene,
    generatedImageUrl?: string
  ): Promise<EnhancedCharacterMemory> {
    // Get existing memory or initialize
    let memory = this.repository.getMemory(character.id) || 
                 this.initializeCharacterMemory(character);
    
    // Find the character in the scene
    const sceneCharacter = scene.characters.find(sc => sc.characterId === character.id);
    
    if (!sceneCharacter) {
      throw new Error(`Character ${character.id} not found in scene ${scene.id}`);
    }
    
    // Update emotion
    if (sceneCharacter.emotion) {
      memory = updateCharacterEmotion(memory, sceneCharacter.emotion, scene.id);
    }
    
    // Update appearance if there's an image
    if (generatedImageUrl) {
      // Add to scene appearances (legacy structure)
      memory.scene_appearances.push({
        scene_id: scene.id,
        image_url: generatedImageUrl,
        emotion: sceneCharacter.emotion || 'neutral'
      });
      
      // Add to appearance history
      memory = updateCharacterAppearance(
        memory,
        scene.id,
        'default', // TODO: Extract outfit information if available
        `${character.name} in scene "${scene.title}" with emotion: ${sceneCharacter.emotion || 'neutral'}`
      );
    }
    
    // Extract behavior from action if available
    if (sceneCharacter.action) {
      // Try to extract a personality trait from the action
      const traits = await this.extractTraitsFromAction(
        character.name,
        sceneCharacter.action,
        sceneCharacter.emotion || 'neutral'
      );
      
      // Add each extracted trait
      for (const trait of traits) {
        memory = addExhibitedBehavior(
          memory,
          trait,
          scene.id,
          sceneCharacter.action || ''
        );
      }
    }
    
    // Extract interactions with other characters
    const otherCharactersInScene = scene.characters
      .filter(sc => sc.characterId !== character.id);
    
    if (otherCharactersInScene.length > 0) {
      memory = await this.extractCharacterInteractions(
        memory,
        character,
        otherCharactersInScene,
        scene
      );
    }
    
    // Save and return updated memory
    return this.repository.saveMemory(memory);
  }
  
  /**
   * Generate a character description for a scene with memory-based consistency
   */
  async generateMemoryEnhancedDescription(
    character: Character,
    scene: Scene,
    otherCharactersInScene: Character[]
  ): Promise<string> {
    // Get memory or initialize
    const memory = this.repository.getMemory(character.id) || 
                  this.initializeCharacterMemory(character);
    
    // Find the character in the scene
    const sceneCharacter = scene.characters.find(sc => sc.characterId === character.id);
    
    if (!sceneCharacter) {
      throw new Error(`Character ${character.id} not found in scene ${scene.id}`);
    }
    
    // Get providers for AI generation
    const providers = await this.aiRegistry.getFallbackChain('character-generation');
    
    if (providers.length === 0) {
      // Fall back to basic description if no providers
      return this.createBasicCharacterDescription(
        character,
        memory,
        sceneCharacter.emotion || 'neutral',
        sceneCharacter.action
      );
    }
    
    // Build memory-enhanced prompt
    const prompt = await this.buildMemoryEnhancedPrompt(
      character,
      memory,
      scene,
      sceneCharacter,
      otherCharactersInScene
    );
    
    // Try each provider until one works
    for (const provider of providers) {
      try {
        const result = await provider.generateText(prompt);
        return result.text.trim();
      } catch (error) {
        console.warn(`Memory-enhanced character description failed with provider ${provider.id}:`, error);
      }
    }
    
    // Fall back to basic description if all providers fail
    return this.createBasicCharacterDescription(
      character,
      memory,
      sceneCharacter.emotion || 'neutral',
      sceneCharacter.action
    );
  }
  
  /**
   * Add a memory element for a character
   */
  addMemoryElement(
    characterId: string,
    key: string,
    value: string,
    importance: number = 5
  ): EnhancedCharacterMemory | null {
    const memory = this.repository.getMemory(characterId);
    
    if (!memory) {
      return null;
    }
    
    const updatedMemory = addMemoryElement(memory, key, value, importance);
    return this.repository.saveMemory(updatedMemory);
  }
  
  /**
   * Get all memories for characters in a story/episode
   */
  getMemoriesForStory(storyId: string): EnhancedCharacterMemory[] {
    return this.repository.getMemoriesByStoryId(storyId);
  }
  
  /**
   * Get characters that have a relationship with this character
   */
  getRelatedCharacterIds(characterId: string): string[] {
    const memory = this.repository.getMemory(characterId);
    
    if (!memory) {
      return [];
    }
    
    return Object.keys(memory.relationships);
  }
  
  /**
   * Generate a summary of a character's memory
   */
  async generateCharacterMemorySummary(characterId: string): Promise<string | null> {
    const memory = this.repository.getMemory(characterId);
    
    if (!memory) {
      return null;
    }
    
    // Get providers for text generation
    const providers = await this.aiRegistry.getFallbackChain('text-generation');
    
    if (providers.length === 0) {
      // Fall back to basic summary
      return this.createBasicMemorySummary(memory);
    }
    
    // Build memory summary prompt
    const prompt = `
Create a concise summary of this character's memory and history:

CHARACTER ID: ${memory.characterId}

PHYSICAL ATTRIBUTES:
- Facial features: ${memory.metadata.facial_features}
- Clothing: ${memory.metadata.clothing_description}
- Body type: ${memory.metadata.body_type}
- Color scheme: ${memory.metadata.color_scheme}

PERSONALITY TRAITS:
${memory.personality.core_traits.map(trait => `- ${trait}`).join('\n')}

EXHIBITED BEHAVIORS:
${memory.personality.exhibited_behaviors.slice(0, 5).map(b => `- ${b.trait}: ${b.description}`).join('\n')}

EMOTIONAL HISTORY:
${memory.emotional_state.history.slice(0, 5).map(e => `- ${e.emotion} (in scene ${e.scene_id})`).join('\n')}

KEY RELATIONSHIPS:
${Object.entries(memory.relationships).map(([id, rel]) => 
  `- With ${id}: ${rel.type} (sentiment: ${rel.sentiment})`
).join('\n')}

IMPORTANT KNOWLEDGE:
${memory.knowledge.map(k => `- ${k.fact} (${k.importance} importance)`).join('\n')}

SCENE APPEARANCES:
${memory.scene_appearances.slice(0, 5).map(a => `- Scene ${a.scene_id}: ${a.emotion}`).join('\n')}

Create a paragraph summarizing this character's history, personality, relationships and visual consistency.
Focus on the most important aspects that would help maintain character consistency across scenes.
`;
    
    // Try each provider until one works
    for (const provider of providers) {
      try {
        const result = await provider.generateText(prompt);
        return result.text.trim();
      } catch (error) {
        console.warn(`Character memory summary failed with provider ${provider.id}:`, error);
      }
    }
    
    // Fall back to basic summary if all providers fail
    return this.createBasicMemorySummary(memory);
  }
  
  /**
   * Build a memory-enhanced prompt for character description
   */
  private async buildMemoryEnhancedPrompt(
    character: Character,
    memory: EnhancedCharacterMemory,
    scene: Scene,
    sceneCharacter: { characterId: string; emotion?: string; action?: string },
    otherCharactersInScene: Character[]
  ): Promise<string> {
    // Get recent emotions (for emotional continuity)
    const recentEmotions = getRecentEmotions(memory, 3);
    
    // Get dominant traits
    const dominantTraits = [
      ...memory.personality.core_traits.slice(0, 3),
      ...getDominantTraits(memory, 2)
    ];
    
    // Get important knowledge
    const importantFacts = getImportantKnowledge(memory, 'high');
    
    // Get relationship data for characters in this scene
    const relationshipContext: string[] = [];
    
    for (const otherChar of otherCharactersInScene) {
      const relationship = memory.relationships[otherChar.id];
      
      if (relationship) {
        // Add relationship context
        relationshipContext.push(`- Relationship with ${otherChar.name}: ${relationship.type} (sentiment: ${relationship.sentiment})`);
        
        // Add recent interactions if available
        const recentInteraction = relationship.interactions
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 1)
          .map(i => `  - Last interaction: ${i.description}`)
          .join('\n');
          
        if (recentInteraction) {
          relationshipContext.push(recentInteraction);
        }
      }
    }
    
    // Get previous appearances for visual continuity
    const previousAppearances = memory.appearance_history
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 2)
      .map(a => `- Previous appearance: ${a.description}`)
      .join('\n');
    
    // Build the prompt
    return `
Generate a detailed visual description of a character for an animated scene that maintains perfect consistency with the character's established appearance, personality, and history:

CHARACTER DETAILS:
Name: ${character.name}
Base description: ${character.description}
${character.personality_notes ? `Personality: ${character.personality_notes}` : ''}
${character.cinematic_notes ? `Cinematic notes: ${character.cinematic_notes}` : ''}

VISUAL CONSISTENCY (HIGH PRIORITY):
Face: ${memory.metadata.facial_features || 'Follow base description'}
Hair: ${this.extractHairDescription(memory, character)}
Eyes: ${this.extractEyeDescription(memory, character)}
Body: ${memory.metadata.body_type || 'Follow base description'}
Clothing: ${memory.metadata.clothing_description || 'Follow base description'}
Color scheme: ${memory.metadata.color_scheme || 'Follow base description'}
${previousAppearances ? `\nPREVIOUS APPEARANCES:\n${previousAppearances}` : ''}

PERSONALITY & EMOTIONAL CONSISTENCY:
Core traits: ${dominantTraits.join(', ')}
Current emotion: ${sceneCharacter.emotion || 'neutral'}
Emotional history: ${recentEmotions.join(' → ')}
${importantFacts.length > 0 ? `Important character facts: ${importantFacts.join('; ')}` : ''}

SCENE CONTEXT:
Scene title: ${scene.title}
Scene description: ${scene.description}
Environment: ${scene.environment.location}, ${scene.environment.time}
Mood: ${scene.environment.mood}
${sceneCharacter.action ? `Action: ${sceneCharacter.action}` : ''}

${relationshipContext.length > 0 ? `CHARACTER RELATIONSHIPS:\n${relationshipContext.join('\n')}` : ''}

MEMORY ELEMENTS (MUST INCLUDE):
${memory.memory_elements
  .sort((a, b) => b.importance - a.importance)
  .slice(0, 5)
  .map(el => `- ${el.key}: ${el.value}`)
  .join('\n')}

Your task:
Generate a detailed visual description of ${character.name} for this specific scene.
Maintain perfect consistency with the character's established appearance while showing the correct emotion and action.
Focus on visual details that would be important for image generation.
Do not add dialogue or narration - only describe visual appearance.

Return just the description text without additional commentary.
`;
  }
  
  /**
   * Create a basic character description from memory
   */
  private createBasicCharacterDescription(
    character: Character,
    memory: EnhancedCharacterMemory,
    emotion: string,
    action?: string
  ): string {
    const visualParts: string[] = [];
    
    // Add base description
    visualParts.push(character.description);
    
    // Add visual consistency elements
    if (memory.metadata.facial_features) {
      visualParts.push(`Face: ${memory.metadata.facial_features}`);
    }
    
    if (memory.metadata.clothing_description) {
      visualParts.push(`Wearing: ${memory.metadata.clothing_description}`);
    }
    
    // Add emotion
    visualParts.push(`Looking ${emotion}`);
    
    // Add action if available
    if (action) {
      visualParts.push(action);
    }
    
    // Add memory elements
    const importantElements = memory.memory_elements
      .filter(el => el.importance >= 8)
      .map(el => `${el.value}`);
      
    visualParts.push(...importantElements);
    
    return visualParts.join('. ');
  }
  
  /**
   * Extract personality traits from personality notes
   */
  private extractPersonalityTraits(personalityNotes: string): string[] {
    // Simple extraction - split by commas, semicolons, etc.
    const traits = personalityNotes
      .split(/[,;]/)
      .map(trait => trait.trim())
      .filter(trait => trait.length > 0);
      
    return traits;
  }
  
  /**
   * Extract traits from character action
   */
  private async extractTraitsFromAction(
    characterName: string,
    action: string,
    emotion: string
  ): Promise<string[]> {
    try {
      // Get AI providers for text generation
      const providers = await this.aiRegistry.getFallbackChain('text-generation');
      
      if (providers.length === 0) {
        // Return simple traits if no providers available
        return this.extractSimpleTraitsFromAction(action, emotion);
      }
      
      // Build prompt for trait extraction
      const prompt = `
Extract personality traits demonstrated by this character action:

Character: ${characterName}
Action: ${action}
Emotion: ${emotion}

What personality traits does this action and emotion demonstrate?
Return just 1-3 simple trait words separated by commas (e.g., "brave, impulsive, caring").
`;
      
      // Try each provider until one works
      for (const provider of providers) {
        try {
          const result = await provider.generateText(prompt);
          
          // Parse the result
          return result.text
            .split(',')
            .map(trait => trait.trim())
            .filter(trait => trait.length > 0);
        } catch (error) {
          console.warn(`Trait extraction failed with provider ${provider.id}:`, error);
        }
      }
      
      // Fall back to simple extraction if all providers fail
      return this.extractSimpleTraitsFromAction(action, emotion);
    } catch (error) {
      console.error('Failed to extract traits from action:', error);
      return [];
    }
  }
  
  /**
   * Simple trait extraction without AI
   */
  private extractSimpleTraitsFromAction(action: string, emotion: string): string[] {
    const traits: string[] = [];
    
    // Map common emotions to traits
    if (emotion) {
      const emotionToTraits: Record<string, string[]> = {
        'happy': ['cheerful', 'optimistic'],
        'sad': ['sensitive', 'emotional'],
        'angry': ['temperamental', 'passionate'],
        'scared': ['cautious', 'nervous'],
        'surprised': ['observant', 'reactive'],
        'disgusted': ['discerning', 'judgmental'],
        'confused': ['curious', 'thoughtful'],
        'excited': ['enthusiastic', 'energetic'],
        'nervous': ['anxious', 'careful'],
        'brave': ['courageous', 'determined'],
        'shy': ['introverted', 'reserved'],
        'confident': ['self-assured', 'bold'],
      };
      
      // Add traits based on emotion
      for (const [key, value] of Object.entries(emotionToTraits)) {
        if (emotion.toLowerCase().includes(key)) {
          traits.push(...value);
          break;
        }
      }
    }
    
    // Check for action-based traits
    const actionPhrases: Record<string, string[]> = {
      'help': ['helpful', 'kind'],
      'run': ['energetic', 'active'],
      'hide': ['cautious', 'secretive'],
      'laugh': ['humorous', 'joyful'],
      'think': ['thoughtful', 'analytical'],
      'search': ['curious', 'detail-oriented'],
      'fight': ['brave', 'confrontational'],
      'protect': ['protective', 'loyal'],
      'speak': ['communicative', 'expressive'],
      'listen': ['attentive', 'patient'],
      'teach': ['knowledgeable', 'patient'],
      'play': ['playful', 'fun-loving'],
      'organize': ['organized', 'methodical'],
      'lead': ['leadership', 'assertive'],
      'follow': ['cooperative', 'team-player'],
    };
    
    // Add traits based on action phrases
    for (const [key, value] of Object.entries(actionPhrases)) {
      if (action.toLowerCase().includes(key)) {
        traits.push(...value);
      }
    }
    
    // Return unique traits (up to 3)
    return [...new Set(traits)].slice(0, 3);
  }
  
  /**
   * Extract metadata from character
   */
  private extractCharacterMetadata(
    memory: EnhancedCharacterMemory,
    character: Character
  ): EnhancedCharacterMemory {
    // Updated memory with extracted metadata
    const updatedMemory = {
      ...memory,
      metadata: {
        ...memory.metadata,
        facial_features: this.extractFacialFeatures(character),
        clothing_description: this.extractClothingDescription(character),
        color_scheme: this.extractColorScheme(character),
        body_type: this.extractBodyType(character),
        animation_style: character.style_preset_id ? 'Based on style preset' : 'Standard animation',
      }
    };
    
    return updatedMemory;
  }
  
  /**
   * Extract facial features from character
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
   * Extract hair description
   */
  private extractHairDescription(memory: EnhancedCharacterMemory, character: Character): string {
    // Try to extract from memory metadata
    const facialFeatures = memory.metadata.facial_features || character.description;
    
    // Find sentences containing hair keywords
    const hairKeywords = ['hair', 'hairstyle', 'haircut'];
    const sentences = facialFeatures.split(/[.!?]+/).map(s => s.trim());
    
    for (const sentence of sentences) {
      if (hairKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        return sentence;
      }
    }
    
    return 'Maintain consistent hair appearance';
  }
  
  /**
   * Extract eye description
   */
  private extractEyeDescription(memory: EnhancedCharacterMemory, character: Character): string {
    // Try to extract from memory metadata
    const facialFeatures = memory.metadata.facial_features || character.description;
    
    // Find sentences containing eye keywords
    const eyeKeywords = ['eye', 'eyes', 'gaze'];
    const sentences = facialFeatures.split(/[.!?]+/).map(s => s.trim());
    
    for (const sentence of sentences) {
      if (eyeKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        return sentence;
      }
    }
    
    return 'Maintain consistent eye appearance';
  }
  
  /**
   * Extract clothing description
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
   * Extract color scheme
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
   * Extract body type
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
   * Extract character interactions from a scene
   */
  private async extractCharacterInteractions(
    memory: EnhancedCharacterMemory,
    character: Character,
    otherCharactersInScene: { characterId: string; emotion?: string; action?: string }[],
    scene: Scene
  ): Promise<EnhancedCharacterMemory> {
    let updatedMemory = memory;
    
    try {
      // Get AI providers
      const providers = await this.aiRegistry.getFallbackChain('character-generation');
      
      if (providers.length === 0) {
        // Use simple interaction extraction if no providers
        return this.addSimpleInteractions(memory, character, otherCharactersInScene, scene);
      }
      
      // Process each character interaction
      for (const otherCharacter of otherCharactersInScene) {
        // Build prompt for interaction extraction
        const prompt = `
Extract the relationship and interaction between these two characters in this scene:

SCENE: "${scene.title}"
DESCRIPTION: ${scene.description}

CHARACTER 1: ${character.name}
EMOTION: ${scene.characters.find(sc => sc.characterId === character.id)?.emotion || 'neutral'}
ACTION: ${scene.characters.find(sc => sc.characterId === character.id)?.action || 'Not specified'}

CHARACTER 2: ID ${otherCharacter.characterId}
EMOTION: ${otherCharacter.emotion || 'neutral'}
ACTION: ${otherCharacter.action || 'Not specified'}

Based on this information, describe:
1. What is the nature of their interaction in this scene?
2. What type of relationship is shown (friends, enemies, family, etc.)?
3. Is the interaction positive (1-10) or negative (-1 to -10)? (0 is neutral)

Return a JSON object:
{
  "interaction": "Description of their interaction in this scene",
  "relationshipType": "Type of relationship shown",
  "sentiment": 0 (number between -10 and 10)
}
`;
        
        let interactionData = {
          interaction: "Characters are in the same scene",
          relationshipType: "unknown",
          sentiment: 0
        };
        
        // Try each provider until one works
        for (const provider of providers) {
          try {
            interactionData = await provider.generateJSON<{
              interaction: string;
              relationshipType: string;
              sentiment: number;
            }>(prompt);
            break;
          } catch (error) {
            console.warn(`Character interaction extraction failed with provider ${provider.id}:`, error);
          }
        }
        
        // Update memory with relationship info
        updatedMemory = updateCharacterRelationship(
          updatedMemory,
          otherCharacter.characterId,
          {
            type: interactionData.relationshipType,
            sentiment: interactionData.sentiment
          },
          interactionData.interaction,
          scene.id
        );
      }
      
      return updatedMemory;
    } catch (error) {
      console.error('Failed to extract character interactions:', error);
      return this.addSimpleInteractions(memory, character, otherCharactersInScene, scene);
    }
  }
  
  /**
   * Add simple interactions between characters (fallback method)
   */
  private addSimpleInteractions(
    memory: EnhancedCharacterMemory,
    character: Character,
    otherCharactersInScene: { characterId: string; emotion?: string; action?: string }[],
    scene: Scene
  ): EnhancedCharacterMemory {
    let updatedMemory = memory;
    
    // Get the character's emotion in this scene
    const characterEmotion = scene.characters.find(sc => 
      sc.characterId === character.id
    )?.emotion || 'neutral';
    
    // Process each interaction
    for (const otherCharacter of otherCharactersInScene) {
      const otherCharacterEmotion = otherCharacter.emotion || 'neutral';
      
      // Determine relationship type based on emotions
      let relationshipType = 'acquaintance';
      let sentiment = 0;
      
      // Simple sentiment calculation based on emotions
      const positiveEmotions = ['happy', 'excited', 'pleased', 'joyful', 'friendly'];
      const negativeEmotions = ['angry', 'scared', 'sad', 'upset', 'furious', 'annoyed'];
      
      // Check if character's emotion is positive toward other
      if (positiveEmotions.some(e => characterEmotion.includes(e))) {
        sentiment += 5;
        relationshipType = 'friendly';
      } else if (negativeEmotions.some(e => characterEmotion.includes(e))) {
        sentiment -= 5;
        relationshipType = 'antagonistic';
      }
      
      // Adjust based on other character's emotion
      if (positiveEmotions.some(e => otherCharacterEmotion.includes(e))) {
        sentiment += 2;
      } else if (negativeEmotions.some(e => otherCharacterEmotion.includes(e))) {
        sentiment -= 2;
      }
      
      // Ensure sentiment stays in range
      sentiment = Math.max(-10, Math.min(10, sentiment));
      
      // Create basic interaction description
      const interaction = `${character.name} (${characterEmotion}) interacts with character ${otherCharacter.characterId} (${otherCharacterEmotion}) in scene "${scene.title}"`;
      
      // Update memory
      updatedMemory = updateCharacterRelationship(
        updatedMemory,
        otherCharacter.characterId,
        {
          type: relationshipType,
          sentiment
        },
        interaction,
        scene.id
      );
    }
    
    return updatedMemory;
  }
  
  /**
   * Create a basic memory summary without AI
   */
  private createBasicMemorySummary(memory: EnhancedCharacterMemory): string {
    const parts: string[] = [];
    
    // Add basic identity
    parts.push(`Character memory for ${memory.characterId}.`);
    
    // Add appearance details
    if (memory.metadata.facial_features || memory.metadata.body_type || memory.metadata.clothing_description) {
      parts.push(`Physical attributes: ${memory.metadata.facial_features} ${memory.metadata.body_type} ${memory.metadata.clothing_description}`.trim());
    }
    
    // Add personality
    if (memory.personality.core_traits.length > 0) {
      parts.push(`Personality traits: ${memory.personality.core_traits.join(', ')}.`);
    }
    
    // Add current emotional state
    parts.push(`Current emotional state: ${memory.emotional_state.current}.`);
    
    // Add relationship count
    const relationshipCount = Object.keys(memory.relationships).length;
    if (relationshipCount > 0) {
      parts.push(`Has ${relationshipCount} known relationships.`);
    }
    
    // Add scene appearance count
    parts.push(`Appeared in ${memory.scene_appearances.length} scenes.`);
    
    return parts.join(' ');
  }
  
  /**
   * Migrate legacy memories to the enhanced format
   */
  private migrateLegacyMemories(): number {
    return this.repository.migrateAllLegacyMemories();
  }
}