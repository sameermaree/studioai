import type { Scene } from '../../types';

/**
 * Scene Lock Service
 * Prevents accidental prompt/seed changes for locked scenes
 */

export interface LockedScene extends Scene {
  locked: boolean;
  locked_at?: string;
  prompt_version?: number;
  generated_at?: string;
}

/**
 * Lock a scene to prevent regeneration
 */
export function lockScene(scene: Scene): LockedScene {
  console.log('[SCENE LOCKED]', scene.title);
  
  return {
    ...scene,
    locked: true,
    locked_at: new Date().toISOString(),
    prompt_version: 1,
    updated_at: new Date().toISOString()
  };
}

/**
 * Unlock a scene to allow regeneration
 */
export function unlockScene(scene: LockedScene): LockedScene {
  console.log('[SCENE UNLOCKED]', scene.title);
  
  return {
    ...scene,
    locked: false,
    updated_at: new Date().toISOString()
  };
}

/**
 * Check if scene can be regenerated
 */
export function canRegenerateScene(scene: Scene): { allowed: boolean; reason?: string } {
  const locked = (scene as LockedScene).locked;
  
  if (locked) {
    console.log('[REGENERATION BLOCKED]', scene.title, '- Scene is locked');
    return {
      allowed: false,
      reason: 'Scene is locked. Unlock before regenerating.'
    };
  }
  
  return { allowed: true };
}

/**
 * Export scene prompt to file formats
 */
export function exportScenePrompt(
  scene: Scene,
  format: 'json' | 'txt' | 'both' = 'both'
): { json?: string; txt?: string } {
  console.log('[PROMPT EXPORTED]', scene.title, 'Format:', format);
  
  const promptData = {
    scene_id: scene.id,
    scene_title: scene.title,
    prompt: scene.prompt_text,
    negative_prompt: scene.negative_prompt,
    camera_angle: scene.camera_angle,
    motion_instructions: scene.motion_instructions,
    narration: scene.narration,
    duration: scene.duration,
    seed: scene.seed,
    characters: scene.characters,
    environment: (scene as any).environment,
    cinematography: (scene as any).cinematography,
    exported_at: new Date().toISOString()
  };
  
  const result: { json?: string; txt?: string } = {};
  
  if (format === 'json' || format === 'both') {
    result.json = JSON.stringify(promptData, null, 2);
  }
  
  if (format === 'txt' || format === 'both') {
    const txtLines = [
      `Scene: ${scene.title}`,
      '',
      'VISUAL PROMPT:',
      scene.prompt_text,
      '',
      'NEGATIVE PROMPT:',
      scene.negative_prompt,
      '',
      'CAMERA:',
      scene.camera_angle,
      '',
      'MOTION:',
      scene.motion_instructions || 'None',
      '',
      'NARRATION:',
      scene.narration || 'None',
      '',
      `DURATION: ${scene.duration}s`,
      scene.seed ? `SEED: ${scene.seed}` : '',
      '',
      `Exported: ${new Date().toISOString()}`
    ].filter(Boolean);
    
    result.txt = txtLines.join('\n');
  }
  
  return result;
}

/**
 * Download exported prompt as file
 */
export function downloadScenePrompt(
  scene: Scene,
  format: 'json' | 'txt' = 'txt'
): void {
  const exported = exportScenePrompt(scene, format);
  const content = format === 'json' ? exported.json : exported.txt;
  
  if (!content) return;
  
  const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scene-${scene.order}-${sanitizeFilename(scene.title)}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('[PROMPT DOWNLOADED]', a.download);
}

/**
 * Copy prompt to clipboard
 */
export function copyScenePromptToClipboard(scene: Scene, promptType: 'full' | 'visual' | 'negative' = 'visual'): void {
  let textToCopy = '';
  
  switch (promptType) {
    case 'visual':
      textToCopy = scene.prompt_text;
      break;
    case 'negative':
      textToCopy = scene.negative_prompt;
      break;
    case 'full':
      const exported = exportScenePrompt(scene, 'txt');
      textToCopy = exported.txt || '';
      break;
  }
  
  navigator.clipboard.writeText(textToCopy).then(() => {
    console.log('[PROMPT COPIED]', scene.title, promptType);
  });
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

/**
 * Increment prompt version
 */
export function incrementPromptVersion(scene: LockedScene): LockedScene {
  return {
    ...scene,
    prompt_version: (scene.prompt_version || 0) + 1,
    updated_at: new Date().toISOString()
  };
}

/**
 * Mark scene as generated
 */
export function markSceneGenerated(scene: Scene): Scene {
  return {
    ...scene,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as any;
}

console.log('[SCENE LOCK SERVICE READY]');
