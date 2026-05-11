import { CharacterConsistencyMetadata, CharacterMemory as BaseCharacterMemory } from './CharacterConsistency';

/**
 * Enhanced character memory that includes persistent state tracking
 */
export interface EnhancedCharacterMemory extends BaseCharacterMemory {
  // Relationship memory tracks interactions with other characters
  relationships: {
    [characterId: string]: CharacterRelationship;
  };
  
  // Emotional state memory tracks character's evolving emotions
  emotional_state: {
    current: string;
    history: {
      emotion: string;
      scene_id: string;
      timestamp: string;
    }[];
  };
  
  // Appearance history tracks visual changes
  appearance_history: {
    scene_id: string;
    outfit: string;
    description: string;
    timestamp: string;
  }[];
  
  // Personality traits that have been exhibited
  personality: {
    core_traits: string[];
    exhibited_behaviors: {
      trait: string;
      scene_id: string;
      description: string;
    }[];
  };
  
  // Notable facts about the character that should be remembered
  knowledge: {
    fact: string;
    source_scene_id: string;
    importance: 'high' | 'medium' | 'low';
  }[];
  
  // Consistency reinforcement settings
  reinforcement: {
    face_emphasis: number; // 0-10 scale
    outfit_emphasis: number; // 0-10 scale
    personality_emphasis: number; // 0-10 scale
  };
  
  // Memory bank for specific elements to maintain in prompts
  memory_elements: {
    key: string;
    value: string;
    importance: number; // 0-10 scale
  }[];
  
  // Last updated timestamp
  last_updated: string;
}

/**
 * Relationship between characters
 */
export interface CharacterRelationship {
  // The nature of the relationship (friend, enemy, parent, etc)
  type: string;
  
  // How the character feels about the other character
  sentiment: number; // -10 to 10, negative is negative sentiment
  
  // Notable interactions between characters
  interactions: {
    scene_id: string;
    description: string;
    timestamp: string;
  }[];
  
  // Last updated timestamp
  last_updated: string;
}

/**
 * Factory function to create an enhanced character memory
 */
export function createEnhancedCharacterMemory(characterId: string): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  return {
    characterId,
    consistencySettings: {
      face: true,
      hairstyle: true,
      eye_color: true,
      clothing: true,
      body_proportions: true,
      animation_style: true,
      color_palette: true,
    },
    metadata: {
      facial_features: '',
      clothing_description: '',
      color_scheme: '',
      body_type: '',
      animation_style: '',
    },
    reference_images: [],
    scene_appearances: [],
    
    // Enhanced memory components
    relationships: {},
    emotional_state: {
      current: 'neutral',
      history: []
    },
    appearance_history: [],
    personality: {
      core_traits: [],
      exhibited_behaviors: []
    },
    knowledge: [],
    reinforcement: {
      face_emphasis: 8,
      outfit_emphasis: 7,
      personality_emphasis: 6
    },
    memory_elements: [],
    last_updated: now
  };
}

/**
 * Update a character's emotional state
 */
export function updateCharacterEmotion(
  memory: EnhancedCharacterMemory,
  emotion: string,
  sceneId: string
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  return {
    ...memory,
    emotional_state: {
      current: emotion,
      history: [
        ...memory.emotional_state.history,
        { emotion, scene_id: sceneId, timestamp: now }
      ]
    },
    last_updated: now
  };
}

/**
 * Update a character's appearance
 */
export function updateCharacterAppearance(
  memory: EnhancedCharacterMemory,
  sceneId: string,
  outfit: string,
  description: string
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  return {
    ...memory,
    appearance_history: [
      ...memory.appearance_history,
      { scene_id: sceneId, outfit, description, timestamp: now }
    ],
    last_updated: now
  };
}

/**
 * Add a personality trait that was exhibited
 */
export function addExhibitedBehavior(
  memory: EnhancedCharacterMemory,
  trait: string,
  sceneId: string,
  description: string
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  return {
    ...memory,
    personality: {
      ...memory.personality,
      exhibited_behaviors: [
        ...memory.personality.exhibited_behaviors,
        { trait, scene_id: sceneId, description }
      ]
    },
    last_updated: now
  };
}

/**
 * Set core personality traits
 */
export function setCorePersonalityTraits(
  memory: EnhancedCharacterMemory,
  traits: string[]
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  return {
    ...memory,
    personality: {
      ...memory.personality,
      core_traits: traits
    },
    last_updated: now
  };
}

/**
 * Update a character's relationship with another character
 */
export function updateCharacterRelationship(
  memory: EnhancedCharacterMemory,
  otherCharacterId: string,
  relationship: Partial<CharacterRelationship>,
  interactionDescription?: string,
  sceneId?: string
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  // Get existing relationship or create a new one
  const existingRelationship = memory.relationships[otherCharacterId] || {
    type: 'acquaintance',
    sentiment: 0,
    interactions: [],
    last_updated: now
  };
  
  // Create updated relationship
  const updatedRelationship: CharacterRelationship = {
    ...existingRelationship,
    ...(relationship.type !== undefined && { type: relationship.type }),
    ...(relationship.sentiment !== undefined && { sentiment: relationship.sentiment }),
    last_updated: now
  };
  
  // Add interaction if provided
  if (interactionDescription && sceneId) {
    updatedRelationship.interactions = [
      ...updatedRelationship.interactions,
      {
        scene_id: sceneId,
        description: interactionDescription,
        timestamp: now
      }
    ];
  }
  
  // Return updated memory
  return {
    ...memory,
    relationships: {
      ...memory.relationships,
      [otherCharacterId]: updatedRelationship
    },
    last_updated: now
  };
}

/**
 * Add a knowledge fact about the character
 */
export function addCharacterKnowledge(
  memory: EnhancedCharacterMemory,
  fact: string,
  sceneId: string,
  importance: 'high' | 'medium' | 'low' = 'medium'
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  return {
    ...memory,
    knowledge: [
      ...memory.knowledge,
      { fact, source_scene_id: sceneId, importance }
    ],
    last_updated: now
  };
}

/**
 * Add a memory element to be maintained in prompts
 */
export function addMemoryElement(
  memory: EnhancedCharacterMemory,
  key: string,
  value: string,
  importance: number = 5
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  // Check if element already exists
  const existingIndex = memory.memory_elements.findIndex(el => el.key === key);
  
  let updatedMemoryElements;
  if (existingIndex >= 0) {
    // Update existing element
    updatedMemoryElements = [...memory.memory_elements];
    updatedMemoryElements[existingIndex] = { key, value, importance };
  } else {
    // Add new element
    updatedMemoryElements = [...memory.memory_elements, { key, value, importance }];
  }
  
  return {
    ...memory,
    memory_elements: updatedMemoryElements,
    last_updated: now
  };
}

/**
 * Update reinforcement settings
 */
export function updateReinforcementSettings(
  memory: EnhancedCharacterMemory,
  settings: Partial<EnhancedCharacterMemory['reinforcement']>
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  return {
    ...memory,
    reinforcement: {
      ...memory.reinforcement,
      ...settings
    },
    last_updated: now
  };
}

/**
 * Get recent emotions for a character
 */
export function getRecentEmotions(
  memory: EnhancedCharacterMemory,
  limit: number = 5
): string[] {
  return memory.emotional_state.history
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
    .map(h => h.emotion);
}

/**
 * Get dominant personality traits based on exhibited behaviors
 */
export function getDominantTraits(
  memory: EnhancedCharacterMemory,
  limit: number = 3
): string[] {
  const traitCounts: Record<string, number> = {};
  
  // Count occurrences of each trait
  for (const behavior of memory.personality.exhibited_behaviors) {
    traitCounts[behavior.trait] = (traitCounts[behavior.trait] || 0) + 1;
  }
  
  // Sort traits by count
  return Object.entries(traitCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, limit)
    .map(([trait]) => trait);
}

/**
 * Get most important knowledge facts
 */
export function getImportantKnowledge(
  memory: EnhancedCharacterMemory,
  importanceLevel: 'high' | 'medium' | 'low' = 'high'
): string[] {
  return memory.knowledge
    .filter(k => k.importance === importanceLevel)
    .map(k => k.fact);
}

/**
 * Migrate from basic character memory to enhanced memory
 */
export function migrateToEnhancedMemory(
  basicMemory: BaseCharacterMemory
): EnhancedCharacterMemory {
  const now = new Date().toISOString();
  
  // Create enhanced memory with basic memory data
  const enhancedMemory: EnhancedCharacterMemory = {
    ...basicMemory,
    relationships: {},
    emotional_state: {
      current: basicMemory.scene_appearances.length > 0
        ? basicMemory.scene_appearances[basicMemory.scene_appearances.length - 1].emotion
        : 'neutral',
      history: basicMemory.scene_appearances.map(appearance => ({
        emotion: appearance.emotion,
        scene_id: appearance.scene_id,
        timestamp: now
      }))
    },
    appearance_history: [],
    personality: {
      core_traits: [],
      exhibited_behaviors: []
    },
    knowledge: [],
    reinforcement: {
      face_emphasis: 8,
      outfit_emphasis: 7,
      personality_emphasis: 6
    },
    memory_elements: [],
    last_updated: now
  };
  
  return enhancedMemory;
}