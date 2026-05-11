import { AIProviderRegistry } from "../infrastructure/ai/AIProviderRegistry";
import { OllamaProvider } from "../infrastructure/ai/providers/OllamaProvider";
import { StoryGenerator } from "../application/storytelling/services/StoryGenerator";
import { testStoryIntelligenceEngine } from "../application/storytelling/tests/StoryIntelligenceEngineTest";

/**
 * This is a simple script to test the Story Intelligence Engine
 * Run with: npx ts-node src/tools/testStoryIntelligence.ts
 */
async function main() {
  try {
    console.log("Story Intelligence Engine Test");
    console.log("------------------------------");
    
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
    
    // Run test
    await testStoryIntelligenceEngine(registry);
    
    console.log("Test completed!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});