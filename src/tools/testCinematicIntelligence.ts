import { AIProviderRegistry } from "../infrastructure/ai/AIProviderRegistry";
import { OllamaProvider } from "../infrastructure/ai/providers/OllamaProvider";
import { StoryGenerator } from "../application/storytelling/services/StoryGenerator";
import { CinematicIntelligenceEngine } from "../application/storytelling/services/CinematicIntelligenceEngine";
import { EmotionalArcEngine } from "../application/storytelling/services/EmotionalArcEngine";
import { CameraPlanGenerator } from "../application/storytelling/services/CameraPlanGenerator";
import { StoryAnalyzer } from "../application/storytelling/services/StoryAnalyzer";

/**
 * This script tests various components of the Cinematic Intelligence system
 * Run with: npx ts-node src/tools/testCinematicIntelligence.ts
 */

// Sample story premise for testing
const STORY_PREMISE = "A shy young inventor creates a robot friend who helps them overcome their social anxiety and make real friends.";

// Sample characters for testing
const SAMPLE_CHARACTERS = [
  {
    id: "char-mia",
    name: "Mia",
    description: "A shy 12-year-old girl with curly brown hair and glasses. She's brilliant at robotics but struggles with social situations.",
    reference_images: [],
    style_preset_id: null,
    personality_notes: "Introverted, creative, intelligent, kind",
    cinematic_notes: "Often shown hunched over or looking down when around people",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "char-bot",
    name: "Buddy",
    description: "A small, friendly robot with expressive LED eyes and a rounded design. Has extendable arms and wheels for movement.",
    reference_images: [],
    style_preset_id: null,
    personality_notes: "Enthusiastic, loyal, curious, encouraging",
    cinematic_notes: "Animates with exaggerated movements and expressive eye displays",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

async function main() {
  try {
    console.log("Cinematic Intelligence Components Test");
    console.log("-------------------------------------");
    
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
    
    // Create services
    const storyGenerator = new StoryGenerator(registry);
    const cinematicEngine = new CinematicIntelligenceEngine(registry);
    const emotionalEngine = new EmotionalArcEngine(registry);
    const cameraPlanGenerator = new CameraPlanGenerator(registry);
    const storyAnalyzer = new StoryAnalyzer(registry);
    
    // Generate a test story
    console.log("\nGenerating test story...");
    const story = await storyGenerator.generateStory(STORY_PREMISE, {
      title: "Buddy Bot",
      targetAudienceAge: "8-12",
      estimatedSceneCount: 5,
      characters: SAMPLE_CHARACTERS
    });
    
    console.log(`Generated story: "${story.title}" with ${story.scenes.length} scenes`);
    
    // Test 1: Cinematic Intelligence Engine
    console.log("\nTEST 1: Cinematic Intelligence Engine");
    console.log("Analyzing cinematic qualities...");
    const cinematicAnalysis = await cinematicEngine.analyzeCinematic(story);
    
    console.log("Cinematic Issues:");
    console.log(`- Camera repetition: ${cinematicAnalysis.cinematicIssues.cameraRepetition}`);
    console.log(`- Scene visuals repetition: ${cinematicAnalysis.cinematicIssues.sceneVisualsRepetition}`);
    console.log(`- Poor cinematic flow: ${cinematicAnalysis.cinematicIssues.poorCinematicFlow}`);
    
    console.log("\nEnhancing cinematography...");
    const enhancedCinematicStory = await cinematicEngine.enhanceCinematography(story, SAMPLE_CHARACTERS);
    console.log("Cinematography enhanced.");
    
    // Test 2: Emotional Arc Engine
    console.log("\nTEST 2: Emotional Arc Engine");
    console.log("Analyzing emotional arcs...");
    const emotionalAnalysis = await emotionalEngine.analyzeEmotionalArcs(story, SAMPLE_CHARACTERS);
    
    console.log("Emotional Analysis:");
    console.log(`- Emotional gaps: ${emotionalAnalysis.emotionalGaps.length}`);
    console.log(`- Flat sequences: ${emotionalAnalysis.flatSequences.length}`);
    console.log(`- Tension graph: ${emotionalAnalysis.tensionGraph.join(', ')}`);
    
    console.log("\nEnhancing emotional arcs...");
    const enhancedEmotionalStory = await emotionalEngine.enhanceEmotionalArcs(story, SAMPLE_CHARACTERS);
    console.log("Emotional arcs enhanced.");
    
    // Test 3: Camera Plan Generator
    console.log("\nTEST 3: Camera Plan Generator");
    console.log("Generating camera sequence plan...");
    const cameraPlan = await cameraPlanGenerator.generateCameraSequencePlan(story);
    
    console.log("Camera Plan:");
    console.log(`- Shot sequence: ${cameraPlan.shotSequence.length} shots`);
    console.log(`- Transitions: ${cameraPlan.transitions.length} transitions`);
    console.log(`- Cinematic notes: ${cameraPlan.cinematicNotes.length} notes`);
    
    console.log("\nApplying camera plan...");
    const enhancedCameraPlanStory = cameraPlanGenerator.applyCameraPlan(story, cameraPlan);
    console.log("Camera plan applied.");
    
    // Test 4: Story Analyzer
    console.log("\nTEST 4: Story Analyzer");
    console.log("Analyzing story quality...");
    const storyAnalysis = await storyAnalyzer.analyzeStory(story, SAMPLE_CHARACTERS);
    
    console.log("Story Analysis:");
    console.log(`- Overall quality: ${storyAnalysis.qualityScores.overall}/100`);
    console.log(`- Narrative quality: ${storyAnalysis.qualityScores.narrative}/100`);
    console.log(`- Cinematic quality: ${storyAnalysis.qualityScores.cinematic}/100`);
    console.log(`- Emotional quality: ${storyAnalysis.qualityScores.emotional}/100`);
    
    console.log("\nStrengths:");
    storyAnalysis.strengths.forEach(strength => console.log(`- ${strength}`));
    
    console.log("\nWeaknesses:");
    storyAnalysis.weaknesses.forEach(weakness => console.log(`- ${weakness}`));
    
    console.log("\nRecommendations:");
    storyAnalysis.recommendations.forEach(rec => 
      console.log(`- ${rec.priority.toUpperCase()}: ${rec.suggestion}`)
    );
    
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