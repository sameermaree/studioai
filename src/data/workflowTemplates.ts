import { WorkflowTemplate } from "../infrastructure/ai/services/ComfyUIOrchestrator";

/**
 * Default workflow templates for ComfyUI
 * 
 * This provides a set of standard workflow templates that can be
 * used with the ComfyUI orchestration system.
 */
export function getDefaultWorkflowTemplates(): WorkflowTemplate[] {
  const now = new Date().toISOString();
  
  const templates: WorkflowTemplate[] = [
    // SDXL Text to Image
    {
      id: 'sdxl-txt2img',
      name: 'SDXL Text to Image',
      description: 'Generate high-quality images using SDXL',
      path: 'workflows/sdxl_txt2img.json',
      type: 'txt2img',
      inputNodes: {
        promptNode: 'positive_prompt',
        negativePromptNode: 'negative_prompt',
        sizeNode: 'empty_latent',
        seedNode: 'seed'
      },
      outputNodes: {
        imageNode: 'save_image'
      },
      parameterMapping: {
        'prompt': 'text',
        'negative_prompt': 'negative_text',
        'width': 'width',
        'height': 'height',
        'seed': 'seed',
        'steps': 'steps',
        'cfg_scale': 'cfg'
      },
      metadata: {
        model: 'SDXL',
        default_steps: 30,
        default_cfg: 7.5
      },
      created_at: now,
      updated_at: now
    },
    
    // SD 1.5 Text to Image
    {
      id: 'sd15-txt2img',
      name: 'SD 1.5 Text to Image',
      description: 'Fast image generation using Stable Diffusion 1.5',
      path: 'workflows/sd15_txt2img.json',
      type: 'txt2img',
      inputNodes: {
        promptNode: 'positive_prompt',
        negativePromptNode: 'negative_prompt',
        sizeNode: 'empty_latent',
        seedNode: 'seed'
      },
      outputNodes: {
        imageNode: 'save_image'
      },
      parameterMapping: {
        'prompt': 'text',
        'negative_prompt': 'negative_text',
        'width': 'width',
        'height': 'height',
        'seed': 'seed',
        'steps': 'steps',
        'cfg_scale': 'cfg'
      },
      metadata: {
        model: 'SD 1.5',
        default_steps: 20,
        default_cfg: 7.0
      },
      created_at: now,
      updated_at: now
    },
    
    // AnimateDiff Text to Video
    {
      id: 'animatediff-txt2vid',
      name: 'AnimateDiff Text to Video',
      description: 'Generate short video clips using AnimateDiff',
      path: 'workflows/animatediff_txt2vid.json',
      type: 'txt2vid',
      inputNodes: {
        promptNode: 'positive_prompt',
        negativePromptNode: 'negative_prompt',
        sizeNode: 'empty_latent',
        seedNode: 'seed'
      },
      outputNodes: {
        videoNode: 'save_video'
      },
      parameterMapping: {
        'prompt': 'text',
        'negative_prompt': 'negative_text',
        'width': 'width',
        'height': 'height',
        'seed': 'seed',
        'fps': 'fps',
        'duration': 'motion_length',
        'steps': 'steps',
        'cfg_scale': 'cfg'
      },
      metadata: {
        model: 'AnimateDiff',
        default_fps: 12,
        default_duration: 3,
        default_steps: 25
      },
      created_at: now,
      updated_at: now
    },
    
    // SD Upscale
    {
      id: 'sd-upscale',
      name: 'SD Upscale',
      description: 'Upscale images with Stable Diffusion',
      path: 'workflows/sd_upscale.json',
      type: 'img2img',
      inputNodes: {
        promptNode: 'positive_prompt',
        negativePromptNode: 'negative_prompt',
        imageNode: 'load_image',
        sizeNode: 'upscale_settings',
        seedNode: 'seed'
      },
      outputNodes: {
        imageNode: 'save_image'
      },
      parameterMapping: {
        'prompt': 'text',
        'negative_prompt': 'negative_text',
        'image_url': 'image',
        'scale_factor': 'scale_factor',
        'seed': 'seed',
        'denoise': 'denoise'
      },
      metadata: {
        model: 'SD 1.5',
        default_scale_factor: 2,
        default_denoise: 0.4
      },
      created_at: now,
      updated_at: now
    }
  ];
  
  return templates;
}