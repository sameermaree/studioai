# Storytelling Module for SERI AI STUDIO

## Overview

The Storytelling Module is responsible for generating high-quality cinematic stories and scenes. It includes the Story Intelligence Engine which enhances storytelling quality with professional cinematic techniques.

## Key Components

### Core Components

- **StoryGenerator**: Creates basic story structures from premises
- **WorkflowOrchestrator**: Standard orchestrator for episode generation
- **EnhancedWorkflowOrchestrator**: Advanced orchestrator with intelligence features
- **WorkflowOrchestratorFactory**: Factory for creating the appropriate orchestrator

### Story Intelligence Engine

- **StoryIntelligenceEngine**: Central intelligence engine for storytelling enhancement
- **CinematicIntelligenceEngine**: Specializes in camera work and visual storytelling
- **EmotionalArcEngine**: Manages emotional pacing and suspense
- **AntiRepetitionSystem**: Prevents repetitive scenes, cameras, and environments
- **NarrativeEnhancer**: Improves overall narrative structure and quality
- **PromptEnhancer**: Enhances visual prompts for better image generation

### Analysis & Validation

- **StoryAnalyzer**: Analyzes storytelling quality and provides scores/feedback
- **ContinuityTracker**: Tracks and validates continuity across scenes
- **CameraPlanGenerator**: Creates professional camera sequences

### Character Components

- **CharacterContinuityService**: Ensures character consistency across scenes

## Usage Examples

### Basic Story Generation

```typescript
import { StoryGenerator } from '../../application/storytelling';
import { AIProviderRegistry } from '../../infrastructure/ai/AIProviderRegistry';

// Create dependencies
const aiRegistry = new AIProviderRegistry();
const storyGenerator = new StoryGenerator(aiRegistry);

// Generate a story
const story = await storyGenerator.generateStory(
  "A young explorer discovers a magical portal in their bedroom closet.",
  {
    title: "The Secret Portal",
    targetAudienceAge: "8-12",
    estimatedSceneCount: 7,
  }
);
```

### Enhanced Story Generation

```typescript
import { 
  StoryIntelligenceFactory,
  StoryGenerator 
} from '../../application/storytelling';
import { AIProviderRegistry } from '../../infrastructure/ai/AIProviderRegistry';

// Create dependencies
const aiRegistry = new AIProviderRegistry();
const storyGenerator = new StoryGenerator(aiRegistry);

// Create the Story Intelligence Engine
const storyIntelligence = StoryIntelligenceFactory.create(aiRegistry, storyGenerator);

// Generate an enhanced story
const enhancedStory = await storyIntelligence.generateEnhancedStory(
  "A young explorer discovers a magical portal in their bedroom closet.",
  {
    title: "The Secret Portal",
    targetAudienceAge: "8-12",
    estimatedSceneCount: 7,
  },
  characters // Array of Character objects
);
```

### Using the Enhanced Workflow Orchestrator

```typescript
import { 
  WorkflowOrchestratorFactory 
} from '../../application/storytelling';
import { AIProviderRegistry } from '../../infrastructure/ai/AIProviderRegistry';
import { StoryGenerator } from '../../application/storytelling';

// Create dependencies
const aiRegistry = new AIProviderRegistry();
const storyGenerator = new StoryGenerator(aiRegistry);

// Create the enhanced orchestrator
const orchestrator = WorkflowOrchestratorFactory.create(
  'enhanced', // or 'auto' to auto-detect capabilities
  aiRegistry,
  storyGenerator
);

// Generate a complete episode workflow
const workflowResult = await orchestrator.generateEpisodeWorkflow(
  episodeConfig,
  stylePresets,
  characters
);

// Access generated content
const { episode, prompts, subtitleTracks, renderJobs } = workflowResult;
```

### Analyzing Story Quality

```typescript
import { StoryAnalyzer } from '../../application/storytelling';
import { AIProviderRegistry } from '../../infrastructure/ai/AIProviderRegistry';

// Create analyzer
const aiRegistry = new AIProviderRegistry();
const storyAnalyzer = new StoryAnalyzer(aiRegistry);

// Analyze a story
const analysis = await storyAnalyzer.analyzeStory(story, characters);

// Access analysis results
console.log(`Overall quality: ${analysis.qualityScores.overall}/100`);
console.log('Strengths:', analysis.strengths);
console.log('Weaknesses:', analysis.weaknesses);

// Get recommendations for improvement
for (const recommendation of analysis.recommendations) {
  console.log(`${recommendation.priority} priority: ${recommendation.suggestion}`);
}
```

### Tracking Continuity

```typescript
import { ContinuityTracker } from '../../application/storytelling';

// Create tracker
const continuityTracker = new ContinuityTracker();

// Validate story continuity
const continuityResult = continuityTracker.validateContinuity(story, characters);

if (!continuityResult.isValid) {
  console.log('Continuity issues detected:');
  for (const issue of continuityResult.issues) {
    console.log(`Scene ${issue.sceneIndex + 1}: ${issue.description}`);
    console.log(`Suggestion: ${issue.suggestion}`);
  }
}
```

## Configuration

The Story Intelligence Engine can be configured through `src/config/AIEnhancements.ts`:

```typescript
// Enable/disable specific features
const AIEnhancementsConfig = {
  storyIntelligence: {
    enabled: true, // Master switch
    enhancedStorytelling: true,
    cinematicIntelligence: true,
    emotionalArcs: true,
    antiRepetition: true,
    suspenseGeneration: true,
    narrativeRhythm: true
  },
  // other settings...
};
```

## Testing

Run the Story Intelligence Engine test to verify functionality:

```bash
npx ts-node src/tools/testStoryIntelligence.ts
```