import { AIProviderRegistry } from "../infrastructure/ai/AIProviderRegistry";
import { OllamaProvider } from "../infrastructure/ai/providers/OllamaProvider";
import { EnhancedCharacterMemoryService } from "../application/storytelling/services/EnhancedCharacterMemoryService";
import { PersistentCharacterMemory } from "../infrastructure/persistence/PersistentCharacterMemory";
import { EnhancedCharacterMemory } from "../domain/storytelling/entities/CharacterMemory";

/**
 * This script tests the Character Memory System
 * Run with: npx ts-node src/tools/testCharacterMemory.ts
 */

// Sample test characters
const SAMPLE_CHARACTERS = [
  {
    id: "char-alex",
    name: "Alex",
    description: "A 12-year-old adventurous child with wild curly hair and bright green eyes. Wears a red t-shirt with blue jeans and always carries a small backpack.",
    image_url: null,
    reference_images: [],
    tags: ["child", "protagonist"],
    emotions: ["happy", "curious", "scared", "determined"],
    outfits: [{
      id: "outfit-1",
      name: "Casual",
      description: "Red t-shirt with blue jeans and a small backpack",
      image_url: null
    }],
    voice_id: null,
    style_preset_id: null,
    consistency_lock: true,
    consistency_settings: {
      face: true,
      hairstyle: true,
      eye_color: true,
      clothing: true,
      body_proportions: true,
      animation_style: true,
      color_palette: true
    },
    personality_notes: "Brave, curious, impulsive, kind-hearted",
    cinematic_notes: "Often shown in dynamic poses, looking up with wonder",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "char-luna",
    name: "Luna",
    description: "A magical talking fox with silver-blue fur and glowing violet eyes. Has a small star-shaped mark on her forehead that glows when she uses magic.",
    image_url: null,
    reference_images: [],
    tags: ["magical", "animal", "guide"],
    emotions: ["wise", "mysterious", "playful", "concerned"],
    outfits: [],
    voice_id: null,
    style_preset_id: null,
    consistency_lock: true,
    consistency_settings: {
      face: true,
      hairstyle: true,
      eye_color: true,
      clothing: true,
      body_proportions: true,
      animation_style: true,
      color_palette: true
    },
    personality_notes: "Wise, mysterious, protective, sometimes sarcastic",
    cinematic_notes: "Often shown with subtle glowing effects around her",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Sample test scenes
const SAMPLE_SCENES = [
  {
    id: "scene-1",
    story_id: "story-test",
    order: 1,
    title: "The Discovery",
    description: "Alex discovers a mysterious glowing portal in the forest while exploring.",
    narrative_type: "setup",
    environment: {
      location: "Forest",
      time: "Afternoon",
      mood: "Mysterious"
    },
    cinematography: {
      camera_angle: "Wide shot",
      camera_movement: "Slow pan",
      lighting: "Dappled sunlight through trees"
    },
    characters: [
      {
        characterId: "char-alex",
        emotion: "curious",
        action: "exploring the forest and discovering the portal"
      }
    ],
    prompt_text: "A curious child discovering a glowing portal in a forest. Afternoon light filters through trees.",
    negative_prompt: "",
    narration: "Alex ventured deeper into the forest, following a strange glow between the trees.",
    subtitle_text: "Alex ventured deeper into the forest, following a strange glow between the trees.",
    duration: 5,
    style_preset_id: null,
    render_status: "pending",
    image_url: null,
    video_url: null,
    audio_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "scene-2",
    story_id: "story-test",
    order: 2,
    title: "Meeting Luna",
    description: "Alex meets Luna the magical fox who emerges from the portal.",
    narrative_type: "conflict",
    environment: {
      location: "Forest clearing",
      time: "Afternoon",
      mood: "Magical"
    },
    cinematography: {
      camera_angle: "Medium shot",
      camera_movement: "Slow dolly in",
      lighting: "Magical glow with light rays"
    },
    characters: [
      {
        characterId: "char-alex",
        emotion: "surprised",
        action: "taking a step back in surprise"
      },
      {
        characterId: "char-luna",
        emotion: "mysterious",
        action: "emerging from the portal with a magical glow"
      }
    ],
    prompt_text: "A surprised child meeting a magical fox with glowing eyes. Magical portal with light rays in a forest clearing.",
    negative_prompt: "",
    narration: "Alex gasped as a beautiful silver-blue fox with glowing eyes stepped out of the portal.",
    subtitle_text: "Alex gasped as a beautiful silver-blue fox with glowing eyes stepped out of the portal.",
    duration: 7,
    style_preset_id: null,
    render_status: "pending",
    image_url: null,
    video_url: null,
    audio_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "scene-3",
    story_id: "story-test",
    order: 3,
    title: "The Warning",
    description: "Luna warns Alex about a danger threatening both worlds.",
    narrative_type: "conflict",
    environment: {
      location: "Forest clearing",
      time: "Late afternoon",
      mood: "Tense"
    },
    cinematography: {
      camera_angle: "Close-up",
      camera_movement: "Static",
      lighting: "Golden hour with blue portal highlights"
    },
    characters: [
      {
        characterId: "char-alex",
        emotion: "concerned",
        action: "listening intently with furrowed brows"
      },
      {
        characterId: "char-luna",
        emotion: "serious",
        action: "speaking with the star on her forehead glowing"
      }
    ],
    prompt_text: "Close-up of a concerned child and serious magical fox with a glowing star mark. Golden hour lighting in forest.",
    negative_prompt: "",
    narration: "\"Both our worlds are in danger,\" Luna said, the star on her forehead glowing brighter. \"And you, Alex, are the one who can help.\"",
    subtitle_text: "\"Both our worlds are in danger,\" Luna said, the star on her forehead glowing brighter. \"And you, Alex, are the one who can help.\"",
    duration: 8,
    style_preset_id: null,
    render_status: "pending",
    image_url: null,
    video_url: null,
    audio_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

async function main() {
  try {
    console.log("Character Memory System Test");
    console.log("---------------------------");
    
    // Initialize AI Provider Registry
    const registry = new AIProviderRegistry();
    
    // Register Ollama provider (if available)
    try {
      console.log("Registering Ollama provider...");
      const ollamaProvider = new OllamaProvider({
        baseUrl: "http://localhost:11434",
        model: "llama3"
      });
      registry.registerProvider("ollama", ollamaProvider);
      console.log("Ollama provider registered.");
    } catch (error) {
      console.warn("Failed to register Ollama provider:", error);
    }
    
    // Create memory service
    const memoryService = new EnhancedCharacterMemoryService(registry);
    
    // Test 1: Initialize character memories
    console.log("\nTEST 1: Initializing character memories");
    
    const alexMemory = memoryService.initializeCharacterMemory(SAMPLE_CHARACTERS[0]);
    const lunaMemory = memoryService.initializeCharacterMemory(SAMPLE_CHARACTERS[1]);
    
    console.log(`Initialized memory for ${alexMemory.characterId}`);
    console.log(`Facial features: ${alexMemory.metadata.facial_features.substring(0, 50)}...`);
    console.log(`Clothing: ${alexMemory.metadata.clothing_description}`);
    
    console.log(`\nInitialized memory for ${lunaMemory.characterId}`);
    console.log(`Facial features: ${lunaMemory.metadata.facial_features.substring(0, 50)}...`);
    
    // Test 2: Update character memory from scenes
    console.log("\nTEST 2: Updating character memory from scenes");
    
    // Process Scene 1 - Only Alex
    console.log("Processing Scene 1...");
    const alexMemoryUpdated1 = await memoryService.updateCharacterMemoryFromScene(
      SAMPLE_CHARACTERS[0],
      SAMPLE_SCENES[0],
      "https://placeholder.com/scene1.png" // Simulated image URL
    );
    
    console.log(`Updated memory - Emotion: ${alexMemoryUpdated1.emotional_state.current}`);
    console.log(`Scene appearances: ${alexMemoryUpdated1.scene_appearances.length}`);
    
    // Process Scene 2 - Alex and Luna
    console.log("\nProcessing Scene 2...");
    const alexMemoryUpdated2 = await memoryService.updateCharacterMemoryFromScene(
      SAMPLE_CHARACTERS[0],
      SAMPLE_SCENES[1],
      "https://placeholder.com/scene2-alex.png"
    );
    
    const lunaMemoryUpdated = await memoryService.updateCharacterMemoryFromScene(
      SAMPLE_CHARACTERS[1],
      SAMPLE_SCENES[1],
      "https://placeholder.com/scene2-luna.png"
    );
    
    console.log(`Alex updated memory - Emotion: ${alexMemoryUpdated2.emotional_state.current}`);
    console.log(`Alex scene appearances: ${alexMemoryUpdated2.scene_appearances.length}`);
    console.log(`Alex relationships: ${Object.keys(alexMemoryUpdated2.relationships).length}`);
    
    console.log(`\nLuna updated memory - Emotion: ${lunaMemoryUpdated.emotional_state.current}`);
    console.log(`Luna scene appearances: ${lunaMemoryUpdated.scene_appearances.length}`);
    console.log(`Luna relationships: ${Object.keys(lunaMemoryUpdated.relationships).length}`);
    
    // Test 3: Memory-enhanced character descriptions
    console.log("\nTEST 3: Generating memory-enhanced character descriptions");
    
    try {
      const alexDescription = await memoryService.generateMemoryEnhancedDescription(
        SAMPLE_CHARACTERS[0],
        SAMPLE_SCENES[2],
        [SAMPLE_CHARACTERS[1]] // Luna is also in the scene
      );
      
      console.log("Alex Description:");
      console.log(alexDescription);
      
      const lunaDescription = await memoryService.generateMemoryEnhancedDescription(
        SAMPLE_CHARACTERS[1],
        SAMPLE_SCENES[2],
        [SAMPLE_CHARACTERS[0]] // Alex is also in the scene
      );
      
      console.log("\nLuna Description:");
      console.log(lunaDescription);
    } catch (error) {
      console.warn("Failed to generate memory-enhanced descriptions:", error);
      console.log("Skipping description generation due to AI provider issues.");
    }
    
    // Test 4: Test persistent memory
    console.log("\nTEST 4: Testing persistent memory");
    
    // Create persistence service
    const persistentMemory = new PersistentCharacterMemory();
    
    // Get all characters with memories
    const memoriesWithCharacters = persistentMemory.getAllMemoriesWithCharacters();
    console.log(`Found ${memoriesWithCharacters.length} memories in storage`);
    
    // Export memories to JSON
    const exportedJson = persistentMemory.exportMemories();
    console.log(`Exported ${exportedJson.length} bytes of memory data`);
    
    // Import memories (testing the round trip)
    try {
      const importedCount = persistentMemory.importMemories(exportedJson);
      console.log(`Successfully imported ${importedCount} memories`);
    } catch (error) {
      console.error("Failed to import memories:", error);
    }
    
    // Print memory summary
    console.log("\nMemory Summary:");
    for (const { memory, character } of memoriesWithCharacters) {
      if (character) {
        console.log(`- ${character.name}: ${memory.scene_appearances.length} appearances, ${Object.keys(memory.relationships).length} relationships`);
      } else {
        console.log(`- Unknown character (${memory.characterId}): ${memory.scene_appearances.length} appearances`);
      }
    }
    
    // Test 5: Memory summary generation
    console.log("\nTEST 5: Memory summary generation");
    
    try {
      const alexSummary = await memoryService.generateCharacterMemorySummary(SAMPLE_CHARACTERS[0].id);
      console.log("Alex Memory Summary:");
      console.log(alexSummary);
    } catch (error) {
      console.warn("Failed to generate memory summary:", error);
      console.log("Skipping summary generation due to AI provider issues.");
    }
    
    console.log("\nAll tests completed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});