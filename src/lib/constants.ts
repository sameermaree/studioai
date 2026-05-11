import type { Language, Platform, PromptCategory, AIProviderType } from '../types';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
];

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

export const PROMPT_CATEGORIES: { value: PromptCategory; label: string }[] = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'action', label: 'Action' },
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'custom', label: 'Custom' },
];

export const AI_PROVIDERS: { value: AIProviderType; label: string; description: string }[] = [
  { value: 'comfyui', label: 'ComfyUI', description: 'Node-based image generation workflows' },
  { value: 'stable_diffusion', label: 'Stable Diffusion', description: 'Open-source image generation' },
  { value: 'wan', label: 'WAN', description: 'Video generation model' },
  { value: 'kling', label: 'Kling', description: 'AI video generation' },
  { value: 'runway', label: 'Runway', description: 'Professional AI video tools' },
  { value: 'openai', label: 'OpenAI', description: 'GPT, DALL-E, Sora APIs' },
  { value: 'ollama', label: 'Ollama', description: 'Local AI models' },
];

export const RENDER_RESOLUTIONS = [
  { value: '1920x1080', label: '1080p (Full HD)' },
  { value: '3840x2160', label: '4K (Ultra HD)' },
  { value: '1080x1920', label: '1080p Vertical (Stories/Reels)' },
  { value: '1080x1080', label: '1080x1080 (Square)' },
  { value: '2560x1440', label: '1440p (2K)' },
];

export const CAMERA_ANGLES = [
  'Wide shot',
  'Close-up',
  'Extreme close-up',
  'Medium shot',
  'Bird\'s eye view',
  'Low angle',
  'High angle',
  'Over-the-shoulder',
  'Dutch angle',
  'Tracking shot',
  'Dolly zoom',
  'POV shot',
];
