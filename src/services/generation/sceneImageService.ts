/**
 * sceneImageService.ts
 * Shared scene image generation logic used by both:
 *  - ScenePromptInspector (single scene)
 *  - Episodes.tsx "Generate All" button
 */
import type { Scene, CharacterBibleEntry, MediaAsset } from '../../types';
import { composeScenePrompt } from '../scene/ScenePromptComposer';
import { ComfyUIExecutor } from '../../infrastructure/ai/providers/ComfyUIExecutor';

const COMFY_BASE = 'http://127.0.0.1:8188';

export interface SceneImageServiceOptions {
  scene: Scene;
  characters: any[];            // EffectiveCharacter[] passed from parent
  bibleCharacters: CharacterBibleEntry[];
  stylePreset?: any;
  onUpdate: (updates: Partial<Scene>) => void;
  addMediaAsset: (asset: MediaAsset) => void;
}

export interface SceneImageResult {
  filename: string;
  displayUrl: string;
}

/**
 * Generate a single scene image.
 * Same logic as ScenePromptInspector.createRenderJob — extracted here
 * so Generate All can reuse without duplicating code.
 */
export async function generateSceneImage(
  opts: SceneImageServiceOptions
): Promise<SceneImageResult> {
  const { scene, characters, bibleCharacters, stylePreset, onUpdate, addMediaAsset } = opts;

  // ── 1. Compose prompt ──────────────────────────────────────────────
  const composed = composeScenePrompt(
    scene,
    characters,
    { stylePreset, quality: 'cinematic', includeCharacters: true },
    bibleCharacters
  );

  // ── 2. Generation Strategy ────────────────────────────────────────
  //
  // SceneGenerationStrategy decides workflow + IPAdapter + identity depth.
  // To add LoRA later: add 'lora' strategy and update resolveStrategy().
  //
  // Current strategies:
  //   'single_ipadapter_strong' — close-up, 1 char, forced strong identity
  //   'single_ipadapter'        — 1 char with reference image, standard shot
  //   'single_stable'           — 1 char without reference image
  //   'multi_stable'            — 2+ chars, stable workflow, prompt-driven
  //                               (future: swap to 'multi_lora' without changing callers)

  type SceneStrategy =
    | 'single_ipadapter_strong'
    | 'single_ipadapter'
    | 'single_stable'
    | 'multi_stable';

  const STRATEGY_WORKFLOWS: Record<SceneStrategy, string> = {
    single_ipadapter_strong: 'workflows/pixar_disney_scene_strong_identity.json',
    single_ipadapter:        'workflows/pixar_disney_scene_ipadapter.json',
    single_stable:           'workflows/pixar_disney_stable.json',
    multi_stable:            'workflows/pixar_disney_stable.json',
    // future: multi_lora: 'workflows/pixar_disney_multi_lora.json',
  };

  const STRATEGY_IPADAPTER: Record<SceneStrategy, boolean> = {
    single_ipadapter_strong: true,
    single_ipadapter:        true,
    single_stable:           false,
    multi_stable:            false,
    // future: multi_lora: false,
  };

  // ── Resolve inputs ─────────────────────────────────────────────────
  const sceneCharIds = scene.characters ?? [];
  const effectiveCharCount = sceneCharIds.length > 0
    ? sceneCharIds.length
    : bibleCharacters.length;

  const primaryChar =
    bibleCharacters.find(b =>
      sceneCharIds.includes(b.id) &&
      (b.reference_image_for_ipadapter || b.reference_image_path)
    ) ??
    bibleCharacters.find(b =>
      b.reference_image_for_ipadapter || b.reference_image_path
    );

  const primaryRefImage =
    primaryChar?.reference_image_for_ipadapter ??
    primaryChar?.reference_image_path ??
    null;

  const promptIdParts = (scene.prompt_id ?? '').split(':');
  const identityModeOverride = promptIdParts[1] ?? null;
  const forcedStrong = identityModeOverride === 'strong' && !!primaryRefImage;

  const STRONG_SHOT_TERMS = ['close-up', 'close up', 'closeup', 'portrait', 'bust', 'headshot'];
  const EXCLUDE_TERMS     = ['medium', 'wide', 'long shot', 'full shot', 'establishing', 'two shot', 'over the shoulder'];
  const cameraLower  = (scene.camera_angle ?? '').toLowerCase().replace(/[-_]/g, ' ');
  const isStrongShot = STRONG_SHOT_TERMS.some(t => cameraLower.includes(t));
  const isExcluded   = EXCLUDE_TERMS.some(t => cameraLower.includes(t));
  const hasReference = !!primaryRefImage;

  // ── Strategy resolver ──────────────────────────────────────────────
  // This is the ONLY place that decides which strategy to use.
  // To add LoRA: add conditions here. Nothing else changes.
  function resolveStrategy(): SceneStrategy {
    // Multi-character: stable prompt-driven (Phase B — pre-LoRA)
    // Future LoRA: change this to 'multi_lora' when lora_path exists on characters
    if (effectiveCharCount > 1) return 'multi_stable';

    // Single character — check reference availability
    if (!hasReference) return 'single_stable';

    // Single character with reference — camera-based routing
    if (forcedStrong || (isStrongShot && !isExcluded)) return 'single_ipadapter_strong';

    return 'single_ipadapter';
  }

  const strategy = resolveStrategy();
  const SCENE_WORKFLOW  = STRATEGY_WORKFLOWS[strategy];
  const useIPAdapter    = STRATEGY_IPADAPTER[strategy];
  const useStrongIdentity = strategy === 'single_ipadapter_strong';

  // ── Strategy log ───────────────────────────────────────────────────
  console.log('[GENERATION STRATEGY]', strategy);
  console.log('[GENERATION STRATEGY] character count =', effectiveCharCount);
  console.log('[GENERATION STRATEGY] workflow =', SCENE_WORKFLOW);
  console.log('[GENERATION STRATEGY] ipadapter =', useIPAdapter);
  console.log('[GENERATION STRATEGY] characters =',
    bibleCharacters.map(b => b.name).join(', ') || 'none');
  if (effectiveCharCount > 1) {
    console.log('[MULTI CHARACTER STRATEGY] character count =', effectiveCharCount);
    console.log('[MULTI CHARACTER STRATEGY] workflow = stable');
    console.log('[MULTI CHARACTER STRATEGY] ipadapter = disabled');
    console.log('[MULTI CHARACTER STRATEGY] identity depth = medium (enforced by composer)');
    console.log('[MULTI CHARACTER STRATEGY] characters =',
      bibleCharacters.map(b => b.name).join(', '));
  }
  console.log('[SCENE SERVICE] workflow:', SCENE_WORKFLOW);
  console.log('[SCENE SERVICE] primary character:', primaryChar?.name ?? 'none');
  console.log('[SCENE SERVICE] reference image:', primaryRefImage ?? 'none');

  // ── 3. Copy reference to ComfyUI input/ ───────────────────────────
  let workflowInputs: Record<string, any> | undefined;
  if (useIPAdapter && primaryRefImage) {
    let refReadyInInput = false;
    try {
      const check = await fetch(
        `${COMFY_BASE}/view?filename=${encodeURIComponent(primaryRefImage)}&type=input`,
        { method: 'HEAD' }
      );
      refReadyInInput = check.ok;
    } catch { /* HEAD not supported */ }

    if (!refReadyInInput) {
      try {
        const out = await fetch(
          `${COMFY_BASE}/view?filename=${encodeURIComponent(primaryRefImage)}&type=output`
        );
        if (out.ok) {
          const blob = await out.blob();
          const form = new FormData();
          form.append('image', blob, primaryRefImage);
          form.append('overwrite', 'true');
          const up = await fetch(`${COMFY_BASE}/upload/image`, { method: 'POST', body: form });
          if (up.ok) refReadyInInput = true;
        }
      } catch { /* copy failed — use stable fallback */ }
    }

    if (refReadyInInput) {
      workflowInputs = {
        '13': { class_type: 'LoadImage', inputs: { image: primaryRefImage } },
      };
    }
  }

  // ── LoRA workflowInputs — injected when strategy = single_lora ──
  if (strategy === 'single_lora' && loraFilename) {
    workflowInputs = {
      ...workflowInputs,
      '20': {
        class_type: 'LoraLoader',
        inputs: {
          lora_name: loraFilename,
          strength_model: loraWeight,
          strength_clip: loraWeight,
        },
      },
    };
    console.log('[LORA INJECT] node 20 →', loraFilename, '@ weight:', loraWeight);
  }

  // ── 4. ComfyUI generation ──────────────────────────────────────────
  const executor = new ComfyUIExecutor({
    baseUrl: COMFY_BASE,
    clientId: `seri-ai-scene-svc-${scene.id.slice(0, 8)}-${Date.now()}`,
    connectionTimeout: 30_000,
  });

  // Seed locking: reuse primary character's locked portrait seed for identity consistency
  const generationSeed = primaryChar?.seed ?? scene.seed ?? undefined;
  console.log('[SCENE SEED LOCK] primary character:', primaryChar?.name ?? 'none');
  console.log('[SCENE SEED LOCK] character seed:', primaryChar?.seed ?? 'none');
  console.log('[SCENE SEED LOCK] scene seed:', scene.seed ?? 'none');
  console.log('[SCENE SEED LOCK] final seed:', generationSeed ?? 'random');

  const imageResult = await executor.generateImage(composed.imagePrompt, {
    negativePrompt: composed.negativePrompt,
    seed: generationSeed,
    width: 1024,
    height: 576,
    workflowPath: SCENE_WORKFLOW,
    workflowInputs,
  });

  // ── 5. Normalize URL ───────────────────────────────────────────────
  const rawUrl = imageResult.url || '';
  let filename = rawUrl;
  if (rawUrl.includes('filename=')) {
    filename = decodeURIComponent(rawUrl.split('filename=')[1]?.split('&')[0] || rawUrl);
  } else if (rawUrl.includes('/')) {
    filename = rawUrl.split('/').pop() || rawUrl;
  }

  // ── 6. Persist ─────────────────────────────────────────────────────
  onUpdate({ render_status: 'completed', render_url: filename });

  const displayUrl = `${COMFY_BASE}/view?filename=${encodeURIComponent(filename)}&type=output`;
  addMediaAsset({
    id: crypto.randomUUID(),
    name: `Scene - ${scene.title}`,
    type: 'image',
    url: displayUrl,
    thumbnail_url: displayUrl,
    tags: ['scene-generation', `scene:${scene.id}`, `scene-title:${scene.title}`],
    size: 'unknown',
    mime_type: 'image/png',
    created_at: new Date().toISOString(),
  });

  return { filename, displayUrl };
}
