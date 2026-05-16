/**
 * Legacy Ollama workflow generator — FALLBACK ONLY.
 *
 * Primary narrative provider is now DeepSeek API.
 * This module is kept as a local fallback when DeepSeek is unavailable.
 * Do NOT use as primary — see src/infrastructure/ai/providers/DeepSeekProvider.ts
 *
 * @deprecated Use AIProviderRegistry + DeepSeek as primary instead.
 *             This file is only for backward-compatible fallback in
 *             src/services/workflow/index.ts and index.new.ts
 */

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
    }));

  const prompt = `Convert story to ${config.estimated_scenes} cinematic scenes. Language:${config.target_language}. Title:${config.title}. Story:${config.story}. Audience:${config.target_audience_age}. Style:${stylePreset?.name||'cinematic'}. Camera:${config.camera_style}. Ratio:${config.aspect_ratio}. Characters:${JSON.stringify(selectedCharacters)}. ${config.target_language==='ar'?'Use Arabic only. لا تستخدم الإنجليزية.':''} Return valid JSON: { "scenes": [{ "title": "", "narration": "", "visual_prompt": "", "negative_prompt": "", "camera_angle": "", "motion_instructions": "", "duration": 8 }] }`;

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