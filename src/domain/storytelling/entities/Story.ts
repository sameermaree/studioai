import { Character } from '../../../types';
import { Scene } from './Scene';
import { NarrativeArc } from './NarrativeArc';

export interface StoryMetadata {
  target_audience_age: string;
  style_id: string | null;
  language: string;
  music_mood?: string;
  consistency_strength?: 'low' | 'medium' | 'high' | 'strict';
  aspect_ratio?: string;
}

export interface Story {
  id: string;
  title: string;
  premise: string;
  description: string;
  narrativeArcs: NarrativeArc[];
  scenes: Scene[];
  characters: string[]; // Character IDs
  metadata: StoryMetadata;
  status: 'draft' | 'in_progress' | 'completed' | 'published';
  created_at: string;
  updated_at: string;
}

// Factory function to create a new story
export function createStory(
  title: string,
  premise: string,
  metadata: Partial<StoryMetadata> = {}
): Story {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    title,
    premise,
    description: premise.slice(0, 200),
    narrativeArcs: [],
    scenes: [],
    characters: [],
    metadata: {
      target_audience_age: metadata.target_audience_age || '8-12',
      style_id: metadata.style_id || null,
      language: metadata.language || 'en',
      music_mood: metadata.music_mood,
      consistency_strength: metadata.consistency_strength || 'medium',
      aspect_ratio: metadata.aspect_ratio || '16:9',
    },
    status: 'draft',
    created_at: now,
    updated_at: now,
  };
}

// Helper function to add a narrative arc to a story
export function addNarrativeArc(
  story: Story, 
  narrativeArc: NarrativeArc
): Story {
  return {
    ...story,
    narrativeArcs: [...story.narrativeArcs, narrativeArc],
    updated_at: new Date().toISOString(),
  };
}

// Helper function to add a scene to a story
export function addScene(
  story: Story,
  scene: Scene
): Story {
  return {
    ...story,
    scenes: [...story.scenes, scene],
    updated_at: new Date().toISOString(),
  };
}

// Helper function to update a story's status
export function updateStoryStatus(
  story: Story,
  status: Story['status']
): Story {
  return {
    ...story,
    status,
    updated_at: new Date().toISOString(),
  };
}