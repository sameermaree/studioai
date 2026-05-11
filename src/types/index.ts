export interface Character {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  reference_images: string[];
  tags: string[];
  emotions: string[];
  outfits: Outfit[];
  voice_id: string | null;
  style_preset_id: string | null;
  consistency_lock: boolean;
  consistency_settings: ConsistencySettings;
  personality_notes: string;
  cinematic_notes: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConsistencySettings {
  face: boolean;
  hairstyle: boolean;
  eye_color: boolean;
  clothing: boolean;
  body_proportions: boolean;
  animation_style: boolean;
  color_palette: boolean;
}

export interface Outfit {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
}

export interface StylePreset {
  id: string;
  name: string;
  category: StyleCategory;
  description: string;
  thumbnail_url: string | null;
  lighting_rules: string;
  camera_style: string;
  rendering_style: string;
  color_palette: string[];
  character_guidance: string;
  negative_prompts: string;
  cinematic_mood: string;
  sample_prompts: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export type StyleCategory =
  | 'pixar'
  | 'disney'
  | 'cinematic_3d'
  | 'anime'
  | 'realistic'
  | 'semi_realistic'
  | 'kids_educational'
  | 'fantasy'
  | 'arabic_kids'
  | 'french_kids'
  | 'watercolor'
  | 'clay'
  | 'stop_motion'
  | 'youtube_kids'
  | 'custom';

export type AspectRatio = '16:9' | '9:16' | '1:1';
export type MusicMood = 'epic' | 'calm' | 'tense' | 'playful' | 'mysterious' | 'emotional' | 'action' | 'none';
export type VoiceStyle = 'narration' | 'dialogue' | 'documentary' | 'storytelling' | 'energetic' | 'calm';
export type CameraStyle = 'cinematic' | 'dynamic' | 'static' | 'handheld' | 'aerial' | 'macro';
export type ConsistencyStrength = 'low' | 'medium' | 'high' | 'strict';

export interface EpisodeWorkflowConfig {
  title: string;
  story: string;
  target_language: Language;
  subtitle_languages: Language[];
  target_audience_age: string;
  style_preset_id: string;
  duration_seconds: number;
  estimated_scenes: number;
  character_ids: string[];
  narration_language: Language;
  voice_style: VoiceStyle;
  camera_style: CameraStyle;
  music_mood: MusicMood;
  consistency_strength: ConsistencyStrength;
  aspect_ratio: AspectRatio;
}

export interface Episode {
  id: string;
  title: string;
  description: string;
  status: EpisodeStatus;
  scenes: Scene[];
  thumbnail_url: string | null;
  duration_estimate: number | null;
  style_preset_id: string | null;
  workflow_config: EpisodeWorkflowConfig | null;
  created_at: string;
  updated_at: string;
}

export type EpisodeStatus = 'draft' | 'in_production' | 'rendering' | 'rendered' | 'published';

export interface Scene {
  id: string;
  episode_id: string;
  order: number;
  title: string;
  prompt_id: string | null;
  prompt_text: string;
  negative_prompt: string;
  camera_angle: string;
  motion_instructions: string;
  characters: string[];
  style_preset_id: string | null;
  voice_id: string | null;
  music_url: string | null;
  sound_effects: string;
  narration: string;
  subtitle_text: string;
  subtitles: Subtitle[];
  duration: number;
  seed: number | null;
  render_status: RenderStatus;
  render_url: string | null;
  image_references: string[];
  video_references: string[];
  created_at: string;
  updated_at: string;
}

export type RenderStatus = 'pending' | 'queued' | 'rendering' | 'completed' | 'failed';

export interface Subtitle {
  id: string;
  language: Language;
  text: string;
  start_time: number;
  end_time: number;
}

export interface Prompt {
  id: string;
  name: string;
  category: PromptCategory;
  template: string;
  negative_prompt: string;
  language: Language;
  tags: string[];
  is_preset: boolean;
  style_preset_id: string | null;
  seed: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PromptCategory = 'cinematic' | 'portrait' | 'landscape' | 'action' | 'dialogue' | 'custom';
export type Language = 'en' | 'ar' | 'fr';

export interface Voice {
  id: string;
  name: string;
  language: Language;
  provider: VoiceProvider;
  voice_key: string;
  is_cloned: boolean;
  sample_url: string | null;
  character_id: string | null;
  created_at: string;
}

export type VoiceProvider = 'elevenlabs' | 'openai' | 'azure' | 'local';

export interface RenderJob {
  id: string;
  episode_id: string | null;
  scene_id: string | null;
  type: 'scene' | 'episode' | 'stitch';
  status: RenderStatus;
  progress: number;
  output_url: string | null;
  settings: RenderSettings;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RenderSettings {
  resolution: string;
  fps: number;
  format: string;
  quality: 'draft' | 'standard' | 'high' | 'ultra';
  burn_subtitles: boolean;
  subtitle_language: Language | null;
}

export interface PublishTarget {
  id: string;
  platform: Platform;
  episode_id: string;
  status: PublishStatus;
  title: string;
  description: string;
  hashtags: string[];
  language: Language;
  scheduled_at: string | null;
  published_at: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  captions: PublishCaption[];
  created_at: string;
}

export interface PublishCaption {
  language: Language;
  text: string;
}

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';
export type PublishStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

export interface AIProvider {
  id: string;
  name: string;
  type: AIProviderType;
  is_enabled: boolean;
  api_key_configured: boolean;
}

export type AIProviderType = 'comfyui' | 'stable_diffusion' | 'wan' | 'kling' | 'runway' | 'openai' | 'ollama';

export interface MediaAsset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail_url: string;
  tags: string[];
  size: string;
  mime_type: string;
  created_at: string;
}

export interface SubtitleTrack {
  id: string;
  scene_id: string | null;
  episode_id: string | null;
  language: Language;
  entries: SubtitleEntry[];
  format: 'srt' | 'vtt';
  created_at: string;
  updated_at: string;
}

export interface SubtitleEntry {
  id: string;
  index: number;
  start_time: number;
  end_time: number;
  text: string;
}
