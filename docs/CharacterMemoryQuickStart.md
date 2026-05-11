# Character Memory System - Quick Start Guide

This guide will help you get started with the Character Memory System in SERI AI STUDIO.

## What is Character Memory?

The Character Memory System ensures your characters remain visually and behaviorally consistent across scenes and episodes. It helps maintain:

- Consistent appearance (face, hair, eyes, clothing, etc.)
- Personality traits and emotional states
- Character relationships and interactions
- Scene-to-scene continuity

## Getting Started

### Enabling the System

1. The Character Memory System is enabled by default
2. To adjust settings, edit `src/config/AIEnhancements.ts`
3. Set `characterMemory.enabled` to `true` to enable the system

```typescript
// In src/config/AIEnhancements.ts
characterMemory: {
  enabled: true,
  persistentMemory: true,
  // other settings...
}
```

### Accessing the Memory Manager

1. Navigate to the Character Memory page
2. You'll see a list of all characters with memories on the left
3. Select a character to view their memory details
4. Use the tabs to navigate between different aspects of memory (Appearance, Personality, Relationships, Scenes)

## Key Features

### Viewing Character Memory

1. **Appearance Memory**: Shows facial features, clothing, body type, and appearance history
2. **Personality & Emotions**: Displays emotional state, personality traits, and exhibited behaviors
3. **Relationships**: Shows relationships with other characters, including sentiment and interaction history
4. **Scene Appearances**: Lists all scenes the character has appeared in

### Managing Memory Settings

1. **Reinforcement Settings**: Adjust how strongly different aspects of the character are reinforced
   - Face Emphasis: How strongly to maintain facial consistency
   - Outfit Emphasis: How strongly to maintain clothing consistency
   - Personality Emphasis: How strongly to maintain personality consistency

2. **Memory Elements**: Add custom elements to reinforce in character descriptions
   - Key: The attribute to remember (e.g., "eye_color", "hairstyle")
   - Value: The specific details to maintain
   - Importance: How important this element is (1-10)

### Exporting and Importing Memories

1. Use the "Export All Memories" button to save a backup of character memories
2. Use the "Import Memories" button to restore from a backup

## How It Works

1. When generating a story:
   - Character memories are initialized from character descriptions
   - Memory-enhanced descriptions are generated for each scene
   - After scene generation, memories are updated with new information

2. When a scene is rendered:
   - Character appearances are recorded in their memories
   - Emotional states are updated based on the scene
   - Relationships are updated based on interactions

3. In subsequent scenes:
   - Previous appearances influence new descriptions
   - Emotional history affects character portrayal
   - Relationships influence character interactions

## Using Memory in Your Workflow

### Creating Consistent Characters

1. Provide detailed character descriptions when creating characters
2. Include specific details about facial features, clothing, and personality
3. The system will extract and remember these details

### Enhancing Memory

1. Use the Memory Manager to add specific memory elements
2. Add key details that should be consistent across scenes
3. Set higher importance for critical elements (e.g., eye color, hairstyle)

### Managing Relationships

1. Character relationships are tracked automatically
2. The system records interactions between characters
3. Relationships influence how characters are portrayed together

## Troubleshooting

### Character Inconsistencies

If you notice character inconsistencies:

1. Check the character's memory in the Memory Manager
2. Verify the inconsistent attribute is being tracked
3. Add a custom memory element with high importance

### Missing Memories

If a character doesn't have memory:

1. Ensure the Character Memory System is enabled
2. Try initializing all character memories from the Memory Manager
3. Check if the character exists in the character repository

### Memory Not Applying

If memory doesn't seem to be applied:

1. Verify AI providers are properly configured
2. Check that the character is correctly identified in scenes
3. Ensure memory elements have sufficient importance (7-10)

## Next Steps

- Explore the Character Memory Viewer to understand what's being tracked
- Add custom memory elements for important character attributes
- Experiment with different reinforcement settings
- Export memories regularly as backups

## API Reference

See the full [Character Memory System Documentation](./CharacterMemorySystem.md) for detailed API information.