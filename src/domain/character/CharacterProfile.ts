/**
 * Character Profile for Consistent Visual Generation
 */

export interface CharacterProfile {
  id: string;
  name: string;
  
  // Visual identity
  visual: {
    age: number;
    gender: 'male' | 'female' | 'non-binary' | 'other';
    ethnicity?: string;
    height?: 'short' | 'average' | 'tall';
    build?: 'slim' | 'average' | 'athletic' | 'heavy';
  };
  
  // Appearance details
  appearance: {
    hair: {
      style: string;
      color: string;
      length?: string;
    };
    eyes: {
      color: string;
      shape?: string;
    };
    skin: {
      tone: string;
      features?: string;
    };
    clothing: {
      style: string;
      colors: string[];
      description: string;
    };
    accessories?: string[];
    distinctive_features?: string[];
  };
  
  // Personality & behavior
  personality: {
    traits: string[];
    voice_style?: string;
    emotional_range?: string[];
    mannerisms?: string[];
  };
  
  // Generation settings
  generation: {
    base_description: string; // Compact visual prompt
    negative_prompt?: string;
    consistency_seed?: number;
    style_preset_id?: string;
    reference_image?: string;
  };
  
  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Character Continuity Context for Scene Generation
 */
export interface CharacterContinuity {
  character_id: string;
  last_scene_id?: string;
  last_emotion?: string;
  last_location?: string;
  last_action?: string;
  visual_state?: string; // e.g., "wearing red jacket, tired expression"
  story_context?: string; // Brief summary of character's story arc
}

/**
 * Create compact character prompt for image generation
 */
export function createCharacterPrompt(profile: CharacterProfile): string {
  const parts: string[] = [];
  
  // Base description
  parts.push(profile.generation.base_description);
  
  // Key visual features
  parts.push(`${profile.visual.age} year old ${profile.visual.gender}`);
  parts.push(`${profile.appearance.hair.color} ${profile.appearance.hair.style} hair`);
  parts.push(`${profile.appearance.eyes.color} eyes`);
  parts.push(`${profile.appearance.skin.tone} skin`);
  
  // Clothing
  parts.push(profile.appearance.clothing.description);
  
  // Distinctive features
  if (profile.appearance.distinctive_features && profile.appearance.distinctive_features.length > 0) {
    parts.push(profile.appearance.distinctive_features.join(', '));
  }
  
  return parts.join(', ');
}

/**
 * Create character continuity prompt for next scene
 */
export function createContinuityPrompt(
  profile: CharacterProfile,
  continuity?: CharacterContinuity
): string {
  const base = createCharacterPrompt(profile);
  
  if (!continuity || !continuity.visual_state) {
    return base;
  }
  
  // Add current visual state
  return `${base}, ${continuity.visual_state}`;
}

/**
 * Update character continuity after a scene
 */
export function updateContinuity(
  continuity: CharacterContinuity,
  sceneId: string,
  updates: {
    emotion?: string;
    location?: string;
    action?: string;
    visual_state?: string;
  }
): CharacterContinuity {
  return {
    ...continuity,
    last_scene_id: sceneId,
    last_emotion: updates.emotion || continuity.last_emotion,
    last_location: updates.location || continuity.last_location,
    last_action: updates.action || continuity.last_action,
    visual_state: updates.visual_state || continuity.visual_state,
  };
}

/**
 * Create negative prompt for character
 */
export function createCharacterNegativePrompt(profile: CharacterProfile): string {
  const base = profile.generation.negative_prompt || 'blurry, low quality, deformed';
  
  // Add character-specific negative prompts
  const negatives: string[] = [base];
  
  // Prevent wrong gender
  if (profile.visual.gender === 'male') {
    negatives.push('feminine features');
  } else if (profile.visual.gender === 'female') {
    negatives.push('masculine features');
  }
  
  // Prevent wrong hair color
  negatives.push(`wrong hair color, not ${profile.appearance.hair.color} hair`);
  
  return negatives.join(', ');
}
