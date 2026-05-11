import { RenderStatus } from '../../../types';

export interface SceneEnvironment {
  location: string;
  time: string;
  weather?: string;
  mood: string;
}

export interface SceneCinematography {
  camera_angle: string;
  camera_movement: string;
  lighting: string;
  composition?: string;
}

export interface SceneCharacter {
  characterId: string;
  emotion: string;
  action?: string;
}

export interface Scene {
  id: string;
  story_id: string;
  order: number;
  title: string;
  description: string;
  narrative_type: 'setup' | 'conflict' | 'climax' | 'resolution' | 'transition';
  environment: SceneEnvironment;
  cinematography: SceneCinematography;
  characters: SceneCharacter[];
  prompt_text: string;
  negative_prompt: string;
  narration: string;
  subtitle_text: string;
  duration: number;
  style_preset_id: string | null;
  render_status: RenderStatus;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

// Factory function to create a new scene
export function createScene(
  storyId: string,
  order: number,
  title: string,
  description: string
): Scene {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    story_id: storyId,
    order,
    title,
    description,
    narrative_type: 'setup',
    environment: {
      location: '',
      time: '',
      mood: '',
    },
    cinematography: {
      camera_angle: 'Medium shot',
      camera_movement: 'Static',
      lighting: 'Natural',
    },
    characters: [],
    prompt_text: '',
    negative_prompt: '',
    narration: '',
    subtitle_text: '',
    duration: 5,
    style_preset_id: null,
    render_status: 'pending',
    image_url: null,
    video_url: null,
    audio_url: null,
    created_at: now,
    updated_at: now,
  };
}

// Helper function to update a scene's prompt
export function updateScenePrompt(
  scene: Scene,
  prompt: string,
  negativePrompt: string = ''
): Scene {
  return {
    ...scene,
    prompt_text: prompt,
    negative_prompt: negativePrompt || scene.negative_prompt,
    updated_at: new Date().toISOString(),
  };
}

// Helper function to update a scene's narration
export function updateSceneNarration(
  scene: Scene,
  narration: string
): Scene {
  return {
    ...scene,
    narration,
    subtitle_text: narration, // Default subtitle is same as narration
    updated_at: new Date().toISOString(),
  };
}

// Helper function to add a character to a scene
export function addCharacterToScene(
  scene: Scene,
  characterId: string,
  emotion: string,
  action?: string
): Scene {
  // Check if character is already in the scene
  if (scene.characters.some(c => c.characterId === characterId)) {
    // Update the existing character
    return {
      ...scene,
      characters: scene.characters.map(c => 
        c.characterId === characterId 
          ? { ...c, emotion, action: action || c.action }
          : c
      ),
      updated_at: new Date().toISOString(),
    };
  }
  
  // Add the character
  return {
    ...scene,
    characters: [
      ...scene.characters,
      { characterId, emotion, action }
    ],
    updated_at: new Date().toISOString(),
  };
}