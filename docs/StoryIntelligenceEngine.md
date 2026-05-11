# Story Intelligence Engine

## Overview

The Story Intelligence Engine is a collection of advanced AI services designed to enhance the cinematic storytelling capabilities of SERI AI STUDIO. It addresses several key challenges in automated storytelling:

1. Repetitive scenes and camera angles
2. Weak emotional pacing
3. Lack of cinematic flow
4. Poor scene transitions
5. Weak character continuity
6. Lack of narrative tension

The engine works by analyzing generated stories and applying professional cinematic techniques to elevate the storytelling quality.

## Architecture

The Story Intelligence Engine consists of several specialized components:

### Core Components

- **StoryIntelligenceEngine**: Central coordinator for all intelligence enhancements
- **CinematicIntelligenceEngine**: Focuses on cinematic qualities (camera work, visual flow)
- **EmotionalArcEngine**: Manages emotional resonance and tension
- **AntiRepetitionSystem**: Prevents repetitive elements in storytelling
- **NarrativeEnhancer**: Improves overall narrative structure
- **PromptEnhancer**: Enhances visual prompts for better image generation

### Analysis & Validation

- **StoryAnalyzer**: Analyzes storytelling quality and provides detailed feedback
- **ContinuityTracker**: Validates continuity across scenes (time, location, characters)
- **CameraPlanGenerator**: Creates professional camera plans for cinematic storytelling

### Supporting Services

- **CharacterContinuityService**: Maintains character consistency across scenes
- **WorkflowOrchestratorFactory**: Creates the appropriate workflow orchestrator based on AI capabilities
- **EnhancedWorkflowOrchestrator**: New orchestrator that leverages the full Story Intelligence Engine
- **StoryIntelligenceFactory**: Creates and configures Story Intelligence components

## Key Features

### Cinematic Intelligence

- Camera angle optimization for storytelling impact
- Scene dependency management for better visual flow
- Lighting continuity across scenes
- Cinematography that supports the narrative

### Emotional Arcs

- Analysis and enhancement of emotional beats
- Tension graphing and management
- Suspense generation
- Emotional rhythm in dialogue and narration

### Anti-Repetition

- Detection of repetitive scene elements
- Automatic correction of camera angle repetition
- Environment and mood variety
- Visual prompt diversity

### Story Enhancement

- Scene purpose validation and enhancement
- Narrative pacing improvements
- Transition engineering between scenes
- Enhanced visual storytelling techniques

## Usage

### Basic Usage

The StoryIntelligenceEngine can be used to enhance existing stories:

```typescript
// Use the factory to create a configured instance
const storyIntelligence = StoryIntelligenceFactory.create(aiRegistry, storyGenerator);

// Get enhancement options from configuration
const enhancementOptions = StoryIntelligenceFactory.getEnhancementOptions();

// Enhance an existing story
const enhancementResult = await storyIntelligence.enhanceStory(
  story,
  characters,
  enhancementOptions
);

// Access the enhanced story
const enhancedStory = enhancementResult.enhancedStory;

// Check enhancement statistics
console.log(enhancementResult.enhancementStats);
```

### Generating Enhanced Stories

The engine can also generate new stories with intelligence built-in:

```typescript
const enhancedStory = await storyIntelligence.generateEnhancedStory(
  "Story premise goes here",
  {
    title: "Optional title",
    targetAudienceAge: "8-12",
    // other options...
  },
  characters
);
```

### Using Advanced Analysis Components

```typescript
// Analyze story quality
const storyAnalyzer = new StoryAnalyzer(aiRegistry);
const analysis = await storyAnalyzer.analyzeStory(story, characters);
console.log(`Story quality: ${analysis.qualityScores.overall}/100`);

// Check story continuity
const continuityTracker = new ContinuityTracker();
const continuityResult = continuityTracker.validateContinuity(story, characters);
if (!continuityResult.isValid) {
  console.log(`Found ${continuityResult.issues.length} continuity issues.`);
}

// Generate professional camera sequence
const cameraPlanGenerator = new CameraPlanGenerator(aiRegistry);
const cameraPlan = await cameraPlanGenerator.generateCameraSequencePlan(story);
const enhancedStory = cameraPlanGenerator.applyCameraPlan(story, cameraPlan);
```

### Using Enhanced Workflow Orchestration

To use the enhanced workflow orchestration:

```typescript
// Get the appropriate workflow orchestrator
const orchestrator = WorkflowOrchestratorFactory.create(
  "enhanced", // or "auto" to detect capabilities
  aiRegistry,
  storyGenerator
);

// Generate a workflow with enhanced storytelling
const workflowResult = await orchestrator.generateEpisodeWorkflow(
  config,
  stylePresets,
  characters
);
```

## Configuration

The Story Intelligence Engine can be configured through the AIEnhancements configuration file:

```typescript
// src/config/AIEnhancements.ts
const AIEnhancementsConfig = {
  storyIntelligence: {
    enabled: true,
    enhancedStorytelling: true,
    cinematicIntelligence: true,
    emotionalArcs: true,
    antiRepetition: true,
    suspenseGeneration: true,
    narrativeRhythm: true
  },
  // other configurations...
};
```

## Testing & Visualization

To test the Story Intelligence Engine, you can use the provided test tools:

```bash
# Run the main intelligence engine test
npx ts-node src/tools/testStoryIntelligence.ts

# Test cinematic intelligence components
npx ts-node src/tools/testCinematicIntelligence.ts

# Generate a visual representation of story structure
npx ts-node src/tools/visualizeStoryStructure.ts ./my-story-visualization.html
```

The visualization tool creates an HTML file with interactive charts that show:
- Emotional tension graph
- Camera sequence visualization
- Scene breakdown with narrative types
- Cinematic details for each scene

## Integration Notes

- The Story Intelligence Engine is designed to work with the existing workflow orchestration system
- It maintains backward compatibility with the standard workflow
- Enhancement operations are designed to be safe and preserve original story integrity
- The engine gracefully falls back to simpler methods if advanced AI capabilities are unavailable

## Performance Considerations

- Full story enhancement can be computationally intensive
- Options are provided to enable/disable specific enhancement features
- The `workflow.orchestratorType` setting can be adjusted based on performance needs