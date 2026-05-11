export interface ConsistencySettings {
  face: boolean;
  hairstyle: boolean;
  eye_color: boolean;
  clothing: boolean;
  body_proportions: boolean;
  animation_style: boolean;
  color_palette: boolean;
}

export interface CharacterConsistencyMetadata {
  facial_features: string;
  clothing_description: string;
  color_scheme: string;
  body_type: string;
  animation_style: string;
  seed?: number;
  lora_weights?: number;
}

export interface CharacterMemory {
  characterId: string;
  consistencySettings: ConsistencySettings;
  metadata: CharacterConsistencyMetadata;
  reference_images: string[];
  scene_appearances: {
    scene_id: string;
    image_url: string;
    emotion: string;
  }[];
}

// Factory function to create a new character memory
export function createCharacterMemory(characterId: string): CharacterMemory {
  return {
    characterId,
    consistencySettings: {
      face: true,
      hairstyle: true,
      eye_color: true,
      clothing: true,
      body_proportions: true,
      animation_style: true,
      color_palette: true,
    },
    metadata: {
      facial_features: '',
      clothing_description: '',
      color_scheme: '',
      body_type: '',
      animation_style: '',
    },
    reference_images: [],
    scene_appearances: [],
  };
}

// Helper function to update consistency settings
export function updateConsistencySettings(
  memory: CharacterMemory, 
  settings: Partial<ConsistencySettings>
): CharacterMemory {
  return {
    ...memory,
    consistencySettings: {
      ...memory.consistencySettings,
      ...settings
    }
  };
}

// Helper function to add a scene appearance
export function addSceneAppearance(
  memory: CharacterMemory,
  sceneId: string,
  imageUrl: string,
  emotion: string
): CharacterMemory {
  return {
    ...memory,
    scene_appearances: [
      ...memory.scene_appearances,
      { scene_id: sceneId, image_url: imageUrl, emotion }
    ]
  };
}

// Helper function to add a reference image
export function addReferenceImage(
  memory: CharacterMemory,
  imageUrl: string
): CharacterMemory {
  if (memory.reference_images.includes(imageUrl)) {
    return memory;
  }
  
  return {
    ...memory,
    reference_images: [...memory.reference_images, imageUrl]
  };
}