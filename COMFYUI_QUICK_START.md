# ComfyUI Orchestration Quick Start Guide

## Overview

The ComfyUI Orchestration system in SERI AI STUDIO allows you to generate images and videos using ComfyUI, with advanced features like batch processing, model management, and workflow templates.

## Prerequisites

1. A running ComfyUI instance (default: http://localhost:8188)
2. Models installed in your ComfyUI instance
3. SERI AI STUDIO running

## Basic Usage

### Generating a Single Image/Video

1. Navigate to the ComfyUI Studio page from the sidebar
2. Select a workflow template (SDXL for images, AnimateDiff for videos)
3. Enter your prompt
4. Adjust settings (size, negative prompt, etc.)
5. Click "Generate"

### Advanced Features

For more advanced features, click the "Advanced Mode" button in ComfyUI Studio.

## Features

### Workflow Templates

Templates define how ComfyUI generates content. The system comes with several pre-configured templates:

- **SDXL Text to Image**: High-quality image generation using SDXL
- **SD 1.5 Image to Image**: Transform existing images with Stable Diffusion 1.5
- **AnimateDiff Text to Video**: Generate animated videos from text
- **Image to Video Motion**: Add motion to static images
- **SD Upscale**: Enhance and upscale images

Templates are stored in the `workflows/` directory as JSON files, with an index in `workflows/index.json`.

### Batch Generation

Batch generation allows you to queue multiple generations at once:

1. Go to ComfyUI Advanced > Batch Generation
2. Enter a batch name
3. Select generation type (image or video)
4. Choose a template
5. Add multiple prompts (one per line)
6. Click "Create Batch" or "Create & Start"

Batches will process in the background, and you can track their progress.

### Model Management

You can view and switch between different models:

1. Go to ComfyUI Advanced > Models
2. View available models grouped by type
3. Click "Switch to This Model" to change the active model for a type

### Stability Features

The system includes several stability features:

- **Health monitoring**: Continuous monitoring of ComfyUI connection
- **Automatic reconnection**: If ComfyUI goes down, the system will attempt to reconnect
- **Error recovery**: Jobs are retried automatically if they fail
- **Degraded mode**: The system can operate in degraded mode if some features fail

## Troubleshooting

### ComfyUI Not Available

If ComfyUI is not available:

1. Check that ComfyUI is running at the configured URL
2. Check the status in the ComfyUI Status component
3. Click "Check Status" to manually check the connection

### Generation Errors

If you encounter generation errors:

1. Check the error message in the UI
2. Verify that the selected model is compatible with the template
3. Check ComfyUI console for more detailed errors

### Models Not Loading

If models don't load:

1. Ensure models are properly installed in ComfyUI
2. Check that ComfyUI can access the model files
3. Restart ComfyUI and refresh the Models page

## Advanced Configuration

### Custom Templates

You can add custom templates by:

1. Creating a JSON file in the `workflows/` directory
2. Adding an entry to `workflows/index.json`
3. Following the template schema (see existing templates for reference)

### Connection Configuration

The ComfyUI connection can be configured when initializing the service:

```typescript
const comfyService = ComfyUIService.getInstance();
await comfyService.initialize({
  baseUrl: 'http://localhost:8188',  // Your ComfyUI URL
  connectionTimeout: 10000,          // Timeout in milliseconds
});
```

## API Usage

### Generate an Image

```typescript
const comfyService = ComfyUIService.getInstance();
const { job, asset } = await comfyService.generateImage(
  'A beautiful landscape with mountains and lakes',
  {
    negativePrompt: 'blurry, bad quality',
    width: 768,
    height: 512,
    callbacks: {
      onProgress: (progress) => console.log(`Progress: ${progress}%`),
      onSuccess: (result) => console.log('Generation complete!', result),
      onError: (error) => console.error('Generation failed:', error)
    }
  }
);
```

### Create a Batch

```typescript
const comfyService = ComfyUIService.getInstance();
const batch = comfyService.createBatch({
  name: 'Landscape Batch',
  prompts: [
    'A desert landscape at sunset',
    'A tropical beach with palm trees',
    'A mountain range with snow peaks'
  ],
  type: 'image',
  templateId: 'sdxl-txt2img-v1'
});

await comfyService.startBatch(batch.id);
```