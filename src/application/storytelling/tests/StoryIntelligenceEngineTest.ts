import { AIProviderRegistry } from "../../../infrastructure/ai/AIProviderRegistry";
import { StoryGenerator } from "../services/StoryGenerator";
import { StoryIntelligenceEngine } from "../services/StoryIntelligenceEngine";
import { Story, createStory } from "../../../domain/storytelling/entities/Story";
import { Scene, createScene } from "../../../domain/storytelling/entities/Scene";
import { Character } from "../../../types";

/**
 * Test function for the Story Intelligence Engine
 * This can be run to validate the engine's functionality
 */
export async function testStoryIntelligenceEngine(
  aiRegistry: AIProviderRegistry,
  testStory?: Story,
  testCharacters?: Character[]
): Promise<void> {
  console.log('Running Story Intelligence Engine test...');
  
  // Create test dependencies
  const storyGenerator = new StoryGenerator(aiRegistry);
  const storyIntelligence = new StoryIntelligenceEngine(aiRegistry, storyGenerator);
  
  // Use provided test story or create a sample one
  const story = testStory || createSampleStory();
  
  // Use provided test characters or create sample ones
  const characters = testCharacters || createSampleCharacters();
  
  console.log(`Testing with story "${story.title}" (${story.scenes.length} scenes)`);
  
  try {
    // Test 1: Basic enhancement
    console.log('Test 1: Basic enhancement with all features');
    const enhancementResult = await storyIntelligence.enhanceStory(story, characters);
    
    console.log('Enhancement stats:', enhancementResult.enhancementStats);
    console.log(`Duration: ${enhancementResult.duration / 1000} seconds`);
    console.log(`Enhanced scenes: ${enhancementResult.enhancementStats.scenesEnhanced} of ${story.scenes.length}`);
    
    // Test 2: Camera variety only
    console.log('\nTest 2: Camera variety only');
    const cameraResult = await storyIntelligence.enhanceStory(story, characters, {
      enhanceNarrative: false,
      enhanceCinematic: false,
      enhanceEmotional: false,
      enhanceVariety: false,
      enhanceSuspense: false,
      enhanceNarrativeRhythm: false,
      enhanceScenePurpose: false,
      applyCameraVariety: true
    });
    
    console.log('Camera enhancement stats:', cameraResult.enhancementStats);
    console.log(`Duration: ${cameraResult.duration / 1000} seconds`);
    
    // Test 3: Generate enhanced story from premise
    console.log('\nTest 3: Generate enhanced story from premise');
    const premise = "A curious child discovers a magical doorway leading to a world where emotions take physical form.";
    
    const generationStartTime = Date.now();
    const generatedStory = await storyIntelligence.generateEnhancedStory(
      premise,
      {
        targetAudienceAge: '8-12',
        estimatedSceneCount: 5,
        durationSeconds: 120
      },
      characters
    );
    
    console.log(`Generated story: "${generatedStory.title}"`);
    console.log(`Scenes: ${generatedStory.scenes.length}`);
    console.log(`Generation time: ${(Date.now() - generationStartTime) / 1000} seconds`);
    
    console.log('\nStory Intelligence Engine test complete!');
    return Promise.resolve();
    
  } catch (error) {
    console.error('Story Intelligence Engine test failed:', error);
    return Promise.reject(error);
  }
}

/**
 * Create a sample story for testing
 */
function createSampleStory(): Story {
  const storyId = crypto.randomUUID();
  
  // Create a basic story
  const story = createStory(
    "The Lost Starship",
    "A young explorer discovers a crashed alien spacecraft in their backyard and befriends the stranded alien pilot."
  );
  
  // Add sample scenes
  const scenes: Scene[] = [
    createScene(storyId, 1, "Discovery", "Mia discovers a mysterious crashed object in the woods behind her house."),
    createScene(storyId, 2, "First Contact", "Mia cautiously approaches the spacecraft and meets Zorb, the alien pilot."),
    createScene(storyId, 3, "Hiding the Alien", "Mia sneaks Zorb into her bedroom to hide him from her parents."),
    createScene(storyId, 4, "The Search Party", "Government agents arrive in the neighborhood looking for the crashed ship."),
    createScene(storyId, 5, "Escape Plan", "Mia and Zorb work together to repair the spacecraft before it's discovered."),
    createScene(storyId, 6, "Farewell", "Zorb's ship is repaired, and it's time to say goodbye."),
    createScene(storyId, 7, "A New Friend", "Zorb leaves Mia with a special alien device to communicate across the stars."),
  ];
  
  // Set environment, cinematography, and narrative types for testing
  scenes[0].environment = { location: "Forest", time: "Afternoon", mood: "Mysterious" };
  scenes[0].cinematography = { camera_angle: "Wide shot", camera_movement: "Slow pan", lighting: "Dappled sunlight" };
  scenes[0].narrative_type = "setup";
  scenes[0].prompt_text = "A young girl discovers a crashed spaceship in a forest. Afternoon light filters through trees.";
  
  scenes[1].environment = { location: "Crashed spaceship", time: "Sunset", mood: "Tense" };
  scenes[1].cinematography = { camera_angle: "Medium shot", camera_movement: "Handheld", lighting: "Dim with spaceship lights" };
  scenes[1].narrative_type = "conflict";
  scenes[1].prompt_text = "Girl meets alien pilot near crashed spaceship at sunset. Tense atmosphere.";
  
  scenes[2].environment = { location: "Girl's bedroom", time: "Night", mood: "Secretive" };
  scenes[2].cinematography = { camera_angle: "Medium shot", camera_movement: "Static", lighting: "Low-key" };
  scenes[2].narrative_type = "conflict";
  scenes[2].prompt_text = "Girl hiding alien in her bedroom at night. Secretive mood with low lighting.";
  
  scenes[3].environment = { location: "Suburban neighborhood", time: "Day", mood: "Suspenseful" };
  scenes[3].cinematography = { camera_angle: "Wide shot", camera_movement: "Slow dolly", lighting: "Harsh daylight" };
  scenes[3].narrative_type = "conflict";
  scenes[3].prompt_text = "Government agents searching neighborhood in daylight. Suspenseful atmosphere.";
  
  scenes[4].environment = { location: "Crashed spaceship", time: "Night", mood: "Urgent" };
  scenes[4].cinematography = { camera_angle: "Medium shot", camera_movement: "Handheld", lighting: "Flashlights and spaceship lights" };
  scenes[4].narrative_type = "climax";
  scenes[4].prompt_text = "Girl and alien repairing spaceship at night. Urgent mood with flashlights.";
  
  scenes[5].environment = { location: "Forest clearing", time: "Dawn", mood: "Bittersweet" };
  scenes[5].cinematography = { camera_angle: "Wide shot", camera_movement: "Crane shot", lighting: "Golden hour" };
  scenes[5].narrative_type = "resolution";
  scenes[5].prompt_text = "Alien saying goodbye to girl in forest clearing at dawn. Bittersweet mood with golden light.";
  
  scenes[6].environment = { location: "Girl's bedroom", time: "Night", mood: "Hopeful" };
  scenes[6].cinematography = { camera_angle: "Close-up", camera_movement: "Slow zoom out", lighting: "Soft blue glow" };
  scenes[6].narrative_type = "resolution";
  scenes[6].prompt_text = "Girl in bedroom at night with alien communication device glowing blue. Hopeful mood.";
  
  // Add sample characters to scenes
  scenes.forEach(scene => {
    scene.characters = [
      { characterId: "char-mia", emotion: "curious", action: "exploring" },
      { characterId: "char-zorb", emotion: "nervous", action: "hiding" }
    ];
    
    // Add narration
    scene.narration = scene.description;
    scene.subtitle_text = scene.description;
  });
  
  return {
    ...story,
    scenes: scenes,
  };
}

/**
 * Create sample characters for testing
 */
function createSampleCharacters(): Character[] {
  return [
    {
      id: "char-mia",
      name: "Mia",
      description: "A curious 10-year-old girl with curly brown hair and bright green eyes. She wears overalls and loves science.",
      reference_images: [],
      style_preset_id: null,
      personality_notes: "Brave, curious, intelligent, kind-hearted",
      cinematic_notes: "Often shown in dynamic poses, with a determined expression",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "char-zorb",
      name: "Zorb",
      description: "A small blue alien with four arms, big expressive eyes, and antenna. Wears a silver space suit with blinking lights.",
      reference_images: [],
      style_preset_id: null,
      personality_notes: "Nervous, intelligent, homesick, gradually becomes brave",
      cinematic_notes: "Often shown with glowing elements, especially in dark scenes",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
}