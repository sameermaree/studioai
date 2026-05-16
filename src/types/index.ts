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
  selected_style_preset_ids: string[];
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

export interface CharacterBibleEntry {
  id: string;
  name: string;
  role: string; // e.g. "protagonist", "love interest", "father"
  character_type: string; // e.g. "child", "boy", "girl", "teenager", "man", "woman", "father", "mother", "uncle", "aunt", "teacher", "student", "villain", "hero", "friend"
  age: number;
  gender: 'male' | 'female' | 'non-binary' | 'unknown';
  visual_description: string;
  outfit: string;
  hair: string;
  eyes: string;
  personality: string;
  art_style: string;
  character_prompt: string; // prompt for generating the character reference image
  character_prompt_manual?: boolean; // true when user explicitly typed/edited the character_prompt textarea
  scene_injection_prompt: string; // prompt snippet injected into scene prompts
  negative_prompt: string;
  reference_image_path: string | null;
  seed: number | null;
  /** Locked generation metadata — saved after first successful generation */
  identityLocked?: boolean; // true after a successful character image generation — locks seed/workflow/prompts/traits
  workflow_path: string | null; // workflow JSON path used for generation
  checkpoint: string | null; // checkpoint .safetensors used
  generation_positive_prompt: string | null; // exact positive prompt that produced the reference image
  generation_negative_prompt: string | null; // exact negative prompt that produced the reference image
  style_preset_ids: string[]; // style IDs active during generation
  /** Locked appearance traits extracted from character data */
  appearance_traits: CharacterAppearanceTraits;
  /** Exposed for future IPAdapter integration */
  reference_image_for_ipadapter: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterAppearanceTraits {
  hairstyle: string;
  hair_color: string;
  eye_color: string;
  outfit: string;
  age_range: string;
  facial_structure: string;
  body_proportions: string;
  style_type: string;
}

export interface LocationBibleEntry {
  id: string;
  name: string;
  type: string; // e.g. "classroom", "school", "playground", "home", "street", "market"
  visual_description: string;
  layout_description: string;
  fixed_objects: string;
  lighting: string;
  color_palette: string;
  mood: string;
  location_prompt: string;
  scene_injection_prompt: string;
  negative_prompt: string;
  reference_image_path: string | null;
  seed: number | null;
  created_at: string;
  updated_at: string;
}

export interface Episode {
  id: string;
  title: string;
  description: string;
  status: EpisodeStatus;
  scenes: Scene[];
  story_characters: CharacterBibleEntry[];
  story_locations: LocationBibleEntry[];
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
  character_outfits: Record<string, string>; // characterId -> outfitId (which outfit each char wears in this scene)
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
