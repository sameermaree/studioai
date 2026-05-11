import { ComfyUIService } from '../services/comfyui';
import { ProjectFileManager } from '../infrastructure/filesystem/ProjectFileManager';
import { AssetManager } from '../application/assets/services/AssetManager';

/**
 * Test the ComfyUI orchestration system
 * 
 * This tool demonstrates how to use the ComfyUI service
 * to generate images and videos.
 */
export async function testComfyUIOrchestration(): Promise<void> {
  try {
    console.log('Testing ComfyUI Orchestration...');

    // Create necessary services
    const fileManager = new ProjectFileManager('./assets');
    const assetManager = new AssetManager(fileManager);

    // Get ComfyUI service
    const comfyService = ComfyUIService.getInstance();

    // Initialize the service
    await comfyService.initialize(
      {
        baseUrl: 'http://localhost:8188',  // Update this to your ComfyUI address
      },
      fileManager,
      assetManager,
      {
        maxConcurrent: 1,
        statusCheckIntervalMs: 30000,
        workflowTemplatesPath: './workflows'
      }
    );

    // Check if ComfyUI is available
    const status = await comfyService.getStatus();
    console.log('ComfyUI Status:', status);

    if (!status.available) {
      console.error('ComfyUI is not available. Make sure ComfyUI is running.');
      return;
    }

    // Get available workflow templates
    const templates = comfyService.getWorkflowTemplates();
    console.log(`Available templates (${templates.length}):`, 
      templates.map(t => `${t.id} - ${t.name}`).join('\n'));

    // Example: Generate an image
    console.log('Generating a test image...');
    const { job: imageJob, asset: imageAsset } = await comfyService.generateImage(
      'A majestic castle on a hill at sunset, fantasy style',
      {
        negativePrompt: 'blurry, bad quality, deformed',
        width: 768,
        height: 512,
        assetDisplayName: 'Test Castle Image',
        assetCategory: 'background',
        callbacks: {
          onProgress: (progress) => {
            console.log(`Image generation progress: ${progress}%`);
          },
          onSuccess: (result) => {
            console.log('Image generated successfully:', result.asset.url);
          },
          onError: (error) => {
            console.error('Image generation error:', error);
          }
        }
      }
    );

    console.log('Image generation job queued:', imageJob.id);

    // Example: Generate a video (if a video template is available)
    const videoTemplates = templates.filter(t => t.type.includes('vid'));
    
    if (videoTemplates.length > 0) {
      console.log('Generating a test video...');
      const { job: videoJob, asset: videoAsset } = await comfyService.generateVideo(
        'A boat sailing on a calm ocean, cinematic style',
        {
          negativePrompt: 'blurry, bad quality, deformed',
          width: 512,
          height: 512,
          durationSeconds: 3,
          fps: 12,
          assetDisplayName: 'Test Ocean Video',
          assetCategory: 'background',
          callbacks: {
            onProgress: (progress) => {
              console.log(`Video generation progress: ${progress}%`);
            },
            onSuccess: (result) => {
              console.log('Video generated successfully:', result.asset.url);
            },
            onError: (error) => {
              console.error('Video generation error:', error);
            }
          }
        }
      );

      console.log('Video generation job queued:', videoJob.id);
    } else {
      console.log('No video templates available, skipping video generation test.');
    }

    console.log('ComfyUI Orchestration test complete!');
  } catch (error) {
    console.error('Error testing ComfyUI orchestration:', error);
  }
}