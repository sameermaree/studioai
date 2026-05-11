# Character Memory System

## Overview

The Character Memory System is a sophisticated component of SERI AI STUDIO that ensures characters maintain visual, personality, and relationship consistency across scenes and episodes. It provides persistent memory for characters, allowing them to "remember" their appearance, emotions, behaviors, and interactions with other characters.

## Key Features

### Persistent Appearance Memory
- Facial features consistency (eyes, hair, face shape)
- Outfit/clothing continuity
- Color scheme consistency
- Body proportions maintenance

### Emotional & Personality Memory
- Emotional state tracking across scenes
- Personality trait reinforcement
- Exhibited behavior recording
- Consistent character development

### Relationship Tracking
- Character-to-character relationships
- Interaction history
- Sentiment tracking (positive/negative)
- Relationship type classification

### Memory Reinforcement
- Configurable emphasis settings
- Custom memory elements
- Importance-based prioritization
- Scene-aware adaptations

## Architecture

### Domain Models
- `EnhancedCharacterMemory`: Core memory structure with relationship, emotional, and appearance tracking
- `CharacterRelationship`: Tracks relationships between characters
- Helper functions for memory manipulation

### Services
- `EnhancedCharacterMemoryService`: Primary service for generating consistent descriptions and updating memories
- `PersistentCharacterMemory`: Infrastructure service for memory persistence across application sessions

### UI Components
- `CharacterMemoryViewer`: Component for viewing character memory details
- `CharacterMemoryManager`: Management interface for memory settings and export/import

### Integration
- Integrated with `EnhancedWorkflowOrchestrator` for scene generation
- Memory-enhanced character descriptions in prompt generation
- Post-scene memory updates

## Usage Examples

### Initializing Character Memory

```typescript
const memoryService = new EnhancedCharacterMemoryService(aiRegistry);

// Initialize memory for a character
const characterMemory = memoryService.initializeCharacterMemory(character);
```

### Generating Memory-Enhanced Descriptions

```typescript
// Generate a description that maintains consistency with previous appearances
const enhancedDescription = await memoryService.generateMemoryEnhancedDescription(
  character,
  currentScene,
  otherCharactersInScene
);
```

### Updating Memory After a Scene

```typescript
// Update memory with new scene information
const updatedMemory = await memoryService.updateCharacterMemoryFromScene(
  character,
  scene,
  generatedImageUrl // optional
);
```

### Adding Custom Memory Elements

```typescript
// Add a specific memory element to maintain
const memory = memoryService.getCharacterMemory(characterId);
if (memory) {
  const updatedMemory = addMemoryElement(
    memory,
    'eye_color',
    'bright blue eyes with golden flecks',
    9 // importance 1-10
  );
}
```

### Managing Relationships

```typescript
// Update a character's relationship with another character
const memory = memoryService.getCharacterMemory(characterId);
if (memory) {
  const updatedMemory = updateCharacterRelationship(
    memory,
    otherCharacterId,
    {
      type: 'friend',
      sentiment: 7 // -10 to 10 scale
    },
    'Had a heartfelt conversation', // interaction description
    sceneId
  );
}
```

## Configuration

Character Memory System can be configured in `src/config/AIEnhancements.ts`:

```typescript
characterMemory: {
  enabled: true, // Master switch
  persistentMemory: true, // Remember across scenes
  visualConsistency: true, // Maintain appearance
  personalityConsistency: true, // Maintain personality
  relationshipTracking: true, // Track relationships
  emotionalMemory: true, // Track emotions
  appearanceLocking: true, // Lock appearance traits
  sceneAwareContinuity: true // Adapt to scene context
}
```

## UI Components

### Character Memory Manager

The Character Memory Manager provides a user interface for:

1. Viewing character memories
2. Adjusting reinforcement settings
3. Adding custom memory elements
4. Exporting/importing memories
5. Viewing relationship data

### Character Memory Viewer

The Character Memory Viewer shows:

1. Appearance memory details
2. Personality and emotional history
3. Relationship network
4. Scene appearances
5. Memory elements

## Implementation Details

### Memory Persistence

Character memories are persisted using LocalStorage with the following structure:

```typescript
interface EnhancedCharacterMemory {
  characterId: string;
  consistencySettings: ConsistencySettings;
  metadata: CharacterConsistencyMetadata;
  reference_images: string[];
  scene_appearances: {
    scene_id: string;
    image_url: string;
    emotion: string;
  }[];
  relationships: Record<string, CharacterRelationship>;
  emotional_state: {
    current: string;
    history: { emotion: string; scene_id: string; timestamp: string; }[];
  };
  appearance_history: {
    scene_id: string;
    outfit: string;
    description: string;
    timestamp: string;
  }[];
  personality: {
    core_traits: string[];
    exhibited_behaviors: {
      trait: string;
      scene_id: string;
      description: string;
    }[];
  };
  knowledge: {
    fact: string;
    source_scene_id: string;
    importance: 'high' | 'medium' | 'low';
  }[];
  reinforcement: {
    face_emphasis: number;
    outfit_emphasis: number;
    personality_emphasis: number;
  };
  memory_elements: {
    key: string;
    value: string;
    importance: number;
  }[];
  last_updated: string;
}
```

### Prompt Enhancement

The system enhances character prompts with:

1. Consistent facial features
2. Consistent clothing descriptions
3. Appropriate emotional expressions
4. Relationship context
5. Personality-consistent behaviors
6. Custom memory elements

## Testing

A test script is provided at `src/tools/testCharacterMemory.ts` for verifying system functionality:

```bash
npx ts-node src/tools/testCharacterMemory.ts
```

This script tests:
1. Memory initialization
2. Scene-based memory updates
3. Memory-enhanced description generation
4. Persistence and export/import

## Integration with Workflow

The Character Memory System is integrated into the workflow orchestration process:

1. Characters are initialized at the start of episode generation
2. During scene generation, memory-enhanced descriptions are applied
3. After scene generation, character memories are updated with new information
4. Character memories persist across episodes for long-term consistency