import fs from 'fs';
import path from 'path';
import { Story } from '../domain/storytelling/entities/Story';
import { AIProviderRegistry } from "../infrastructure/ai/AIProviderRegistry";
import { OllamaProvider } from "../infrastructure/ai/providers/OllamaProvider";
import { StoryGenerator } from "../application/storytelling/services/StoryGenerator";
import { StoryIntelligenceEngine } from "../application/storytelling/services/StoryIntelligenceEngine";
import { EmotionalArcEngine } from "../application/storytelling/services/EmotionalArcEngine";

/**
 * Visualize the structure of a story including narrative arcs, emotional pacing,
 * camera sequences and other cinematic elements.
 * 
 * This tool generates an HTML file with visualizations that can be viewed in a browser.
 * 
 * Run with: npx ts-node src/tools/visualizeStoryStructure.ts [optional-output-path]
 */

const SAMPLE_CHARACTERS = [
  {
    id: "char-alex",
    name: "Alex",
    description: "A 12-year-old adventurous child with wild curly hair and bright curious eyes.",
    reference_images: [],
    style_preset_id: null,
    personality_notes: "Brave, curious, impulsive, kind-hearted",
    cinematic_notes: "Often shown in dynamic poses, looking up with wonder",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "char-luna",
    name: "Luna",
    description: "A magical talking fox with silver-blue fur and glowing violet eyes.",
    reference_images: [],
    style_preset_id: null,
    personality_notes: "Wise, mysterious, protective, sometimes sarcastic",
    cinematic_notes: "Often shown with subtle glowing effects around her",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

/**
 * Generate an HTML visualization of a story's structure
 */
async function generateVisualization(
  story: Story, 
  outputPath: string = './story-visualization.html'
): Promise<void> {
  // Initialize AI components for analysis
  const registry = new AIProviderRegistry();
  
  try {
    // Try to register Ollama provider
    const ollamaProvider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      model: "llama3"
    });
    registry.registerProvider("ollama", ollamaProvider);
    console.log("Ollama provider registered.");
  } catch (error) {
    console.warn("Failed to register Ollama provider, using basic analysis:", error);
  }
  
  const emotionalEngine = new EmotionalArcEngine(registry);
  
  // Get emotional analysis if possible
  let emotionalAnalysis;
  try {
    emotionalAnalysis = await emotionalEngine.analyzeEmotionalArcs(story, SAMPLE_CHARACTERS);
  } catch (error) {
    console.warn("Could not perform emotional analysis:", error);
    // Create a basic tension graph if analysis fails
    emotionalAnalysis = {
      tensionGraph: story.scenes.map((_, i) => 
        // Generate a simple arc that rises and falls
        Math.round(5 + 3 * Math.sin(i / story.scenes.length * Math.PI))
      )
    };
  }
  
  // Create HTML content with story visualization
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Story Structure Visualization: ${story.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    header {
      background-color: #1a1a2e;
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1, h2, h3 {
      color: #16213e;
    }
    header h1 {
      color: white;
      margin: 0;
    }
    header p {
      margin: 5px 0 0;
      opacity: 0.8;
    }
    .card {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .scene-card {
      border-left: 5px solid #0066cc;
      padding-left: 15px;
      margin-bottom: 15px;
      transition: all 0.3s ease;
    }
    .scene-card:hover {
      transform: translateX(5px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .scene-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .scene-title h3 {
      margin: 0;
    }
    .tag {
      background-color: #e1e1e1;
      border-radius: 20px;
      padding: 2px 10px;
      font-size: 0.8rem;
      color: #555;
    }
    .tag.setup { background-color: #c8e6c9; color: #2e7d32; }
    .tag.conflict { background-color: #ffccbc; color: #e64a19; }
    .tag.climax { background-color: #ffecb3; color: #ff8f00; }
    .tag.resolution { background-color: #bbdefb; color: #1976d2; }
    .tag.transition { background-color: #e1bee7; color: #7b1fa2; }
    .camera-info {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .camera-tag {
      background-color: #f5f5f5;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 0.8rem;
      color: #555;
      border: 1px solid #ddd;
    }
    .chart-container {
      position: relative;
      height: 250px;
      margin: 20px 0;
    }
    .characters {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .character-tag {
      background-color: #e3f2fd;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 0.8rem;
      color: #0d47a1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    .scene-content {
      margin-top: 10px;
    }
    footer {
      text-align: center;
      margin-top: 30px;
      font-size: 0.8rem;
      color: #666;
    }
  </style>
</head>
<body>
  <header>
    <h1>${story.title}</h1>
    <p>${story.premise}</p>
  </header>
  
  <div class="card">
    <h2>Story Overview</h2>
    <p><strong>Scenes:</strong> ${story.scenes.length}</p>
    <p><strong>Description:</strong> ${story.description}</p>
    <p><strong>Narrative Arcs:</strong> ${story.narrativeArcs.map(arc => arc.name).join(', ')}</p>
  </div>
  
  <div class="card">
    <h2>Emotional Arc & Tension</h2>
    <div class="chart-container">
      <canvas id="tensionChart"></canvas>
    </div>
  </div>
  
  <div class="card">
    <h2>Camera Sequence</h2>
    <div class="chart-container">
      <canvas id="cameraChart"></canvas>
    </div>
  </div>
  
  <div class="card">
    <h2>Scene Breakdown</h2>
    ${story.scenes.map((scene, index) => `
      <div class="scene-card">
        <div class="scene-title">
          <h3>Scene ${index + 1}: ${scene.title}</h3>
          <span class="tag ${scene.narrative_type}">${scene.narrative_type}</span>
        </div>
        <div class="camera-info">
          <span class="camera-tag">Camera: ${scene.cinematography.camera_angle}</span>
          <span class="camera-tag">Movement: ${scene.cinematography.camera_movement}</span>
          <span class="camera-tag">Lighting: ${scene.cinematography.lighting}</span>
          <span class="camera-tag">Location: ${scene.environment.location}</span>
          <span class="camera-tag">Time: ${scene.environment.time}</span>
          <span class="camera-tag">Mood: ${scene.environment.mood}</span>
        </div>
        <div class="characters">
          ${scene.characters.map(char => `
            <span class="character-tag">${char.characterId}: ${char.emotion}</span>
          `).join('')}
        </div>
        <div class="scene-content">
          <p>${scene.description}</p>
          <details>
            <summary>Narration</summary>
            <p>${scene.narration}</p>
          </details>
        </div>
      </div>
    `).join('')}
  </div>
  
  <footer>
    Generated by SERI AI STUDIO Story Visualizer
  </footer>
  
  <script>
    // Tension chart
    const tensionCtx = document.getElementById('tensionChart').getContext('2d');
    new Chart(tensionCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(story.scenes.map((_, i) => `Scene ${i+1}`))},
        datasets: [{
          label: 'Emotional Tension',
          data: ${JSON.stringify(emotionalAnalysis.tensionGraph)},
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            title: {
              display: true,
              text: 'Tension Level'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Story Progression'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Emotional Tension Throughout Story'
          }
        }
      }
    });
    
    // Camera variation chart
    const cameraTypes = ${JSON.stringify(story.scenes.map(s => s.cinematography.camera_angle))};
    const cameraMovements = ${JSON.stringify(story.scenes.map(s => s.cinematography.camera_movement))};
    
    // Count camera types for pie chart
    const cameraTypeCounts = {};
    cameraTypes.forEach(type => {
      cameraTypeCounts[type] = (cameraTypeCounts[type] || 0) + 1;
    });
    
    const cameraCtx = document.getElementById('cameraChart').getContext('2d');
    new Chart(cameraCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(story.scenes.map((_, i) => `Scene ${i+1}`))},
        datasets: [
          {
            label: 'Camera Angle',
            data: ${JSON.stringify(story.scenes.map((_, i) => i + 1))},
            backgroundColor: ${JSON.stringify(story.scenes.map(s => {
              // Generate colors based on camera angle
              const angle = s.cinematography.camera_angle;
              if (angle.includes('Close-up')) return 'rgba(54, 162, 235, 0.5)';
              if (angle.includes('Medium')) return 'rgba(255, 206, 86, 0.5)';
              if (angle.includes('Wide')) return 'rgba(75, 192, 192, 0.5)';
              if (angle.includes('Establishing')) return 'rgba(153, 102, 255, 0.5)';
              if (angle.includes('Low')) return 'rgba(255, 159, 64, 0.5)';
              if (angle.includes('High')) return 'rgba(255, 99, 132, 0.5)';
              return 'rgba(201, 203, 207, 0.5)';
            }))},
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: 'Scenes'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const sceneIndex = context.dataIndex;
                return [
                  \`Camera: \${cameraTypes[sceneIndex]}\`,
                  \`Movement: \${cameraMovements[sceneIndex]}\`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'Camera Sequence Throughout Story'
          }
        }
      }
    });
  </script>
</body>
</html>
  `;
  
  // Write the visualization to the specified output path
  fs.writeFileSync(outputPath, html);
  console.log(`Visualization created at: ${outputPath}`);
}

/**
 * Main function to run the visualization tool
 */
async function main() {
  try {
    // Get output path from command line args or use default
    const outputPath = process.argv[2] || path.join(process.cwd(), 'story-visualization.html');
    
    // Initialize AI components
    const registry = new AIProviderRegistry();
    
    try {
      // Try to register Ollama provider
      const ollamaProvider = new OllamaProvider({
        baseUrl: "http://localhost:11434",
        model: "llama3"
      });
      registry.registerProvider("ollama", ollamaProvider);
      console.log("Ollama provider registered.");
    } catch (error) {
      console.warn("Failed to register Ollama provider:", error);
    }
    
    const storyGenerator = new StoryGenerator(registry);
    const storyIntelligence = new StoryIntelligenceEngine(registry, storyGenerator);
    
    console.log("Generating story for visualization...");
    
    // Generate story premise
    const premise = "A child discovers a magical door in their bedroom that leads to a world where animals can talk.";
    
    // First, try to generate an enhanced story
    let story;
    try {
      story = await storyIntelligence.generateEnhancedStory(
        premise,
        {
          title: "The Talking Kingdom",
          targetAudienceAge: "8-12",
          estimatedSceneCount: 7,
        },
        SAMPLE_CHARACTERS
      );
      console.log("Enhanced story generated successfully!");
    } catch (error) {
      console.warn("Enhanced story generation failed, falling back to basic generation:", error);
      
      // Fallback to basic story generation
      story = await storyGenerator.generateStory(premise, {
        title: "The Talking Kingdom",
        targetAudienceAge: "8-12",
        estimatedSceneCount: 7,
        characters: SAMPLE_CHARACTERS
      });
    }
    
    console.log(`Generated story "${story.title}" with ${story.scenes.length} scenes`);
    
    // Create visualization
    await generateVisualization(story, outputPath);
    
    console.log("Story visualization completed successfully!");
    console.log(`Open ${outputPath} in a web browser to view the visualization.`);
    
  } catch (error) {
    console.error("Error generating story visualization:", error);
    process.exit(1);
  }
}

// Run the visualization tool
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});