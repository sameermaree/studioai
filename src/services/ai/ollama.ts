import type {
  EpisodeWorkflowConfig,
  Character,
  StylePreset,
} from '../../types';

export interface OllamaSceneResult {
  title: string;
  narration: string;
  visual_prompt: string;
  negative_prompt: string;
  camera_angle: string;
  motion_instructions: string;
  duration: number;
}

export interface OllamaWorkflowResult {
  scenes: OllamaSceneResult[];
}

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'qwen2.5-coder:14b';

function extractJson(raw: string): string {
  const cleaned = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in Ollama response');
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function normalizeScene(scene: Partial<OllamaSceneResult>, index: number): OllamaSceneResult {
  return {
    title: scene.title || `Scene ${index + 1}`,
    narration: scene.narration || '',
    visual_prompt: scene.visual_prompt || '',
    negative_prompt:
      scene.negative_prompt ||
      'blurry, low quality, deformed, bad anatomy, inconsistent character, distorted face',
    camera_angle: scene.camera_angle || 'Medium cinematic shot',
    motion_instructions: scene.motion_instructions || 'Slow cinematic camera movement',
    duration:
      typeof scene.duration === 'number' && scene.duration > 0
        ? scene.duration
        : 8,
  };
}

export async function generateWorkflowWithOllama(
  config: EpisodeWorkflowConfig,
  characters: Character[],
  stylePreset?: StylePreset
): Promise<OllamaWorkflowResult> {
  const selectedCharacters = characters
    .filter((character) => config.character_ids.includes(character.id))
    .map((character) => ({
      name: character.name,
      description: character.description,
      personality: character.personality_notes,
      cinematic_notes: character.cinematic_notes,
      consistency_lock: character.consistency_lock,
      consistency_settings: character.consistency_settings,
    }));

  const prompt = `
You are an expert cinematic AI storyboard generator for children's animated videos.

Your task:
Convert the user's story into a structured production workflow for an AI animation studio.

Output language:
${config.target_language}

Episode title:
${config.title}

Story:
${config.story}

Target audience:
${config.target_audience_age}

Visual style:
${stylePreset?.name || 'cinematic animated style'}

Style description:
${stylePreset?.description || ''}

Rendering style:
${stylePreset?.rendering_style || ''}

Lighting rules:
${stylePreset?.lighting_rules || ''}

Color palette:
${stylePreset?.color_palette?.join(', ') || ''}

Character guidance:
${stylePreset?.character_guidance || ''}

Camera style:
${config.camera_style}

Music mood:
${config.music_mood}

Voice style:
${config.voice_style}

Aspect ratio:
${config.aspect_ratio}

Consistency strength:
${config.consistency_strength}

Characters:
${JSON.stringify(selectedCharacters, null, 2)}

Generate exactly ${config.estimated_scenes} scenes.

Each scene must include:
- short title
- narration text
- detailed visual prompt for image/video generation
- negative prompt
- camera angle
- motion instructions
- duration in seconds

Important rules:
- Return ONLY valid JSON.
- Do NOT use markdown.
- Do NOT add explanations.
- Do NOT copy copyrighted characters.
- Create original characters only.
- Keep character identity consistent across all scenes.
- Make prompts cinematic, clear, and useful for future ComfyUI/WAN/Kling video generation.
- CRITICAL: If target language is Arabic (ar), generate ALL scene content (title, narration, visual_prompt, camera_angle, motion_instructions) in Arabic language ONLY. لا تستخدم الإنجليزية أبداً في أي حقل عندما تكون اللغة عربية.
- CRITICAL: If target language is English (en), generate ALL scene content in English language ONLY.

Return exactly this JSON structure:

{
  "scenes": [
    {
      "title": "Scene title",
      "narration": "Narration text",
      "visual_prompt": "Detailed cinematic visual prompt",
      "negative_prompt": "Negative prompt",
      "camera_angle": "Camera angle",
      "motion_instructions": "Motion instructions",
      "duration": 8
    }
  ]
}
`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.4,
        top_p: 0.9,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to connect to Ollama. Status: ${response.status}`);
  }

  const data = await response.json();

  if (!data?.response || typeof data.response !== 'string') {
    throw new Error('Invalid Ollama response format');
  }

  const jsonText = extractJson(data.response);
  const parsed = JSON.parse(jsonText) as Partial<OllamaWorkflowResult>;

  if (!Array.isArray(parsed.scenes)) {
    throw new Error('Ollama response does not contain a scenes array');
  }

  return {
    scenes: parsed.scenes
      .slice(0, config.estimated_scenes)
      .map((scene, index) => normalizeScene(scene, index)),
  };
}