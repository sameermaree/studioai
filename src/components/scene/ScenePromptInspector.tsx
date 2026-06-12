import { useEffect } from 'react';
import { Copy, Download, Lock, Unlock, RefreshCw, Image, Video, ExternalLink, Loader2 } from 'lucide-react';
import type { Scene, Character, StylePreset, RenderJob, CharacterBibleEntry, CharacterAppearanceTraits } from '../../types';
import { composeScenePrompt } from '../../services/scene/ScenePromptComposer';
import { 
  lockScene, 
  unlockScene, 
  canRegenerateScene, 
  copyScenePromptToClipboard,
  downloadScenePrompt,
  type LockedScene 
} from '../../services/scene/SceneLockService';
import { useStudioStore } from '../../store/useStudioStore';
import { useGenerationStore } from '../../store/useGenerationStore';
import { GenerationProgress } from '../ui/GenerationProgress';
import { ComfyUIExecutor } from '../../infrastructure/ai/providers/ComfyUIExecutor';
import { generateSceneImage } from '../../services/generation/sceneImageService';

interface ScenePromptInspectorProps {
  scene: Scene;
  characters: Character[];
  stylePreset?: StylePreset;
  onUpdate: (updates: Partial<Scene>) => void;
  onRegenerate?: () => void;
}

export function ScenePromptInspector({
  scene,
  characters,
  stylePreset,
  onUpdate,
  onRegenerate
}: ScenePromptInspectorProps) {
  const lockedScene = scene as LockedScene;
  const isLocked = lockedScene.locked || false;
  
  // Bible characters — look up directly by scene.episode_id
  const episodeStoryCharacters = useStudioStore((s) => {
    const ep = s.episodes.find((e) => e.id === scene.episode_id);
    console.log('[BIBLE DEBUG] scene.episode_id:', scene.episode_id);
    console.log('[BIBLE DEBUG] episodes count:', s.episodes.length);
    const sc = ep?.story_characters ?? [];
    console.log('[BIBLE VERIFY] episode.story_characters =', sc.length);
    if (sc.length > 0) {
      console.log('[BIBLE VERIFY] character names =', sc.map(c => c.name).join(', '));
      console.log('[BIBLE VERIFY] reference images =',
        sc.map(c => c.reference_image_for_ipadapter || c.reference_image_path || 'NONE').join(', '));
    }
    return sc;
  });

  // Fallback: if episode has no story_characters, build temporary BibleEntries from store.characters
  // This supports manual scenes/episodes created without the workflow modal.
  const storeCharacters = useStudioStore((s) => s.characters);
  const bibleCharacters: CharacterBibleEntry[] = (() => {
    if (episodeStoryCharacters.length > 0) return episodeStoryCharacters;

    // Fallback: match scene.characters IDs against store.characters
    const sceneCharIds = scene.characters ?? [];
    // Match scene.characters → store; if scene.characters is empty, use ALL store characters
    const matched = sceneCharIds.length > 0
      ? storeCharacters.filter(c => sceneCharIds.includes(c.id))
      : storeCharacters;   // fallback: no IDs saved → use every character in store
    console.log('[BIBLE FALLBACK] episode story_characters empty — using store.characters fallback');
    console.log('[BIBLE FALLBACK] scene.characters:', sceneCharIds);
    console.log('[BIBLE FALLBACK] matched store characters:', matched.length,
      sceneCharIds.length === 0 ? '(all store chars — scene.characters was empty)' : '');

    const built: CharacterBibleEntry[] = matched.map(c => {
      const traits: CharacterAppearanceTraits = (c.consistency_settings as any)?.appearance_traits ?? {
        hairstyle: c.hair || '',
        hair_color: '',
        eye_color: c.eyes || '',
        outfit: c.outfit || '',
        age_range: c.age ? (c.age >= 18 ? 'adult' : 'child') : 'unknown',
        facial_structure: c.visual_description || '',
        body_proportions: '',
        style_type: 'Pixar-style 3D',
      };
      return {
        id: c.id,
        name: c.name,
        age: c.age ?? 0,
        gender: c.gender || 'unknown',
        hair: c.hair || '',
        eyes: c.eyes || '',
        outfit: c.outfit || '',
        visual_description: c.visual_description || '',
        appearance_traits: traits,
        reference_image_path: c.image_url || null,
        reference_image_for_ipadapter: (c.consistency_settings as any)?.reference_image_for_ipadapter
          ?? c.image_url ?? null,
        seed: (c.consistency_settings as any)?.seed ?? null,
        identityLocked: c.locked ?? false,
        role: 'character',
        character_type: c.gender === 'male' ? 'boy' : 'girl',
        personality: '',
        art_style: '',
        character_prompt: '',
        scene_injection_prompt: '',
        negative_prompt: '',
        workflow_path: null,
        checkpoint: null,
        generation_positive_prompt: null,
        generation_negative_prompt: null,
        style_preset_ids: [],
        character_prompt_manual: false,
        created_at: '',
        updated_at: '',
      } as CharacterBibleEntry;
    });
    console.log('[BIBLE FALLBACK] built bibleCharacters:', built.map(b => `${b.name}:${b.id}`));
    return built;
  })();
  console.log('[BIBLE DEBUG] final bibleCharacters length:', bibleCharacters.length);

  // Manual debug mode: bypass ScenePromptComposer entirely.
  // Scene was created with prompt_id='manual-debug' → prompt_text IS the imagePrompt.
  const isManualDebug = scene.prompt_id === 'manual-debug';
  if (isManualDebug) {
    console.log('[MANUAL DEBUG] scene prompt used verbatim — ScenePromptComposer bypassed');
    console.log('[MANUAL DEBUG] imagePrompt:', scene.prompt_text.slice(0, 200));
    console.log('[MANUAL DEBUG] negativePrompt:', scene.negative_prompt?.slice(0, 100));
  }

  const composed = isManualDebug
    ? {
        imagePrompt: scene.prompt_text,
        negativePrompt: scene.negative_prompt || '',
        cameraPrompt: scene.camera_angle || '',
        lightingPrompt: '',
        motionPrompt: '',
        referenceImages: [],
        debugValidationWarnings: ['⚠️ Manual Debug Mode — ScenePromptComposer bypassed'],
      }
    : composeScenePrompt(scene, characters, {
        stylePreset,
        quality: 'cinematic',
        includeCharacters: true
      }, bibleCharacters);
  
  // Auto-save composed prompt to scene.prompt_text when it changes
  // This ensures sceneImageService always has the English prompt
  useEffect(() => {
    if (isManualDebug) return; // manual scenes manage their own prompt
    if (!composed.imagePrompt) return;
    if (composed.imagePrompt === scene.prompt_text) return; // already saved
    // Debounce: only save after 800ms of stability
    const timer = setTimeout(() => {
      console.log('[PROMPT SYNC] Saving composed prompt to scene.prompt_text');
      console.log('[PROMPT SYNC] length:', composed.imagePrompt.length, 'chars');
      onUpdate({
        prompt_text: composed.imagePrompt,
        negative_prompt: composed.negativePrompt || scene.negative_prompt || '',
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [composed.imagePrompt, composed.negativePrompt, isManualDebug]);

  const handleLock = () => {
    const updated = isLocked ? unlockScene(lockedScene) : lockScene(scene);
    onUpdate(updated);
  };
  
  const handleRegenerate = () => {
    const check = canRegenerateScene(scene);
    if (!check.allowed) {
      alert(check.reason);
      return;
    }
    onRegenerate?.();
  };
  
  const addRenderJob = useStudioStore((s) => s.addRenderJob);
  const updateRenderJob = useStudioStore((s) => s.updateRenderJob);
  const addMediaAsset = useStudioStore((s) => s.addMediaAsset);
  
  // Global generation progress
  const genProgress = useGenerationStore((s) => s.progress);
  const genSetProgress = useGenerationStore((s) => s.setProgress);
  const genResetProgress = useGenerationStore((s) => s.resetProgress);
  // Fixed: use correct GenerationKey prefix matching useGenerationStore type
  const sceneGenKey: `generate-scene-image-${string}` = `generate-scene-image-${scene.id}`;
  
  const createRenderJob = async (type: 'image' | 'video') => {
    console.log('[SCENE GEN BTN] createRenderJob called:', type, '| scene:', scene.id, scene.title);
    genSetProgress(sceneGenKey, { status: 'generating', progress: 15, label: `Generating ${type}...` });
    const jobId = crypto.randomUUID();
    const job: RenderJob = {
      id: jobId,
      scene_id: scene.id,
      episode_id: null,
      type: 'scene',
      status: 'queued',
      progress: 0,
      output_url: null,
      settings: {
        resolution: '1920x1080',
        fps: 30,
        format: type === 'image' ? 'png' : 'mp4',
        quality: 'standard',
        burn_subtitles: false,
        subtitle_language: null
      },
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString()
    };
    
    addRenderJob(job);
    onUpdate({ render_status: 'queued' });
    console.log(`[RENDER JOB CREATED] ${jobId} ${type} for scene:`, scene.title);
    
    if (type === 'image') {
      try {
        genSetProgress(sceneGenKey, { status: 'generating', progress: 30, label: 'Rendering image...' });
        updateRenderJob(jobId, { status: 'rendering', progress: 10, started_at: new Date().toISOString() });
        onUpdate({ render_status: 'rendering' });
        
        // Delegate to shared service (same logic used by Generate All)
        genSetProgress(sceneGenKey, { status: 'generating', progress: 60, label: 'ComfyUI processing...' });
        const { filename: sceneImagePath, displayUrl } = await generateSceneImage({
          scene,
          characters,
          bibleCharacters,
          stylePreset,
          onUpdate,
          addMediaAsset,
        });
        console.log('[SCENE PROMPT INSPECTOR] generated image:', sceneImagePath);

        genSetProgress(sceneGenKey, { status: 'saving', progress: 90, label: 'Finalizing...' });
        updateRenderJob(jobId, { status: 'completed', progress: 100, output_url: sceneImagePath, completed_at: new Date().toISOString() });

        const displayUrl2 = displayUrl;
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
        console.log(`[RENDER COMPLETED] ${jobId}`, sceneImagePath);
        genSetProgress(sceneGenKey, { status: 'done', progress: 100, label: 'Image generated' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        updateRenderJob(jobId, { status: 'failed', error_message: msg });
        onUpdate({ render_status: 'failed' });
        genSetProgress(sceneGenKey, { status: 'failed', progress: 0, label: 'Failed', error: msg });
        console.error(`[RENDER FAILED] ${jobId}`, msg);
      } finally {
        setTimeout(() => genResetProgress(sceneGenKey), 5000);
      }
    } else {
      genSetProgress(sceneGenKey, { status: 'generating', progress: 25, label: 'Video request queued...' });
      // Video not connected yet
      setTimeout(() => {
        genSetProgress(sceneGenKey, { status: 'failed', progress: 0, label: 'Video not connected' });
        updateRenderJob(jobId, { status: 'failed', error_message: 'Video generation not yet connected' });
        onUpdate({ render_status: 'failed' });
        console.log('[RENDER FAILED] Video generation not connected');
        setTimeout(() => genResetProgress(sceneGenKey), 3000);
      }, 1000);
    }
  };
  
  return (
    <div className="space-y-3 p-4 bg-surface rounded-lg border border-surface-border">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Prompt Inspector</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => copyScenePromptToClipboard(scene, 'visual')}
            className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
            title="Copy Visual Prompt"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => downloadScenePrompt(scene, 'txt')}
            className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
            title="Export Prompt"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleLock}
            className={`p-1.5 rounded-md transition-colors ${
              isLocked
                ? 'bg-amber-900/20 text-amber-400 hover:bg-amber-900/30'
                : 'hover:bg-accent-900/20 text-studio-400 hover:text-accent-400'
            }`}
            title={isLocked ? 'Unlock Scene' : 'Lock Scene'}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          {onRegenerate && (
            <button
              onClick={handleRegenerate}
              className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
              title="Regenerate Prompt"
              disabled={isLocked}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <PromptField label="Camera" value={composed.cameraPrompt} />
        <PromptField label="Lighting" value={composed.lightingPrompt} />
        <PromptField label="Motion" value={composed.motionPrompt} />
        <div className="p-2 bg-studio-900/50 rounded">
          <p className="text-[10px] text-studio-500 uppercase mb-0.5">Seed</p>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={scene.seed ?? ''}
              onChange={(e) => onUpdate({ seed: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full bg-transparent text-xs text-studio-300 border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Auto (changes each time)"
            />
            {scene.seed !== null && scene.seed !== undefined && (
              <button
                onClick={() => onUpdate({ seed: null })}
                className="text-[10px] text-studio-500 hover:text-studio-300 whitespace-nowrap"
                title="Clear seed (allow Auto)"
              >
                Auto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Character Outfit + Reference Images */}
      {characters.length > 0 && scene.characters.length > 0 && (
        <div className="space-y-3 pt-1">
          <p className="text-[10px] text-studio-500 uppercase tracking-wider">Characters in Scene</p>
          <div className="flex flex-wrap gap-2">
            {scene.characters.map((charId) => {
              const ch = characters.find((c) => c.id === charId);
              if (!ch) return null;
              const currentOutfitId = (scene as any).character_outfits?.[charId] || '';
              return (
                <div key={charId} 
                  className="p-2 rounded-lg bg-studio-900/50 border border-surface-border text-xs min-w-[180px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-studio-800 overflow-hidden shrink-0">
                      {ch.image_url ? (
                        <img src={ch.image_url} alt={ch.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-studio-500">
                          {ch.name[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-studio-200 font-medium block">{ch.name}</span>
                      {ch.consistency_lock && (
                        <span className="text-[10px] text-amber-400">🔒 Locked</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Outfit selector (only if character has outfits) */}
                  {ch.outfits?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-studio-500">Outfit:</span>
                      <select
                        value={currentOutfitId}
                        onChange={(e) => {
                          onUpdate({
                            character_outfits: {
                              ...(scene as any).character_outfits,
                              [charId]: e.target.value
                            }
                          });
                        }}
                        className="bg-studio-800 text-studio-200 border border-surface-border rounded px-1.5 py-0.5 text-xs outline-none cursor-pointer flex-1"
                      >
                        <option value="">Default</option>
                        {ch.outfits.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* Reference image count */}
                  {ch.reference_images?.length > 0 && (
                    <p className="text-[10px] text-studio-500 mt-1">
                      📸 {ch.reference_images.length} reference image(s)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-studio-500 italic">
            Tip: Describe custom clothing in the prompt (e.g. "wears a blue shirt") to override outfits.
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <PromptPreview
          label="Visual Prompt"
          value={scene.prompt_text}
          onCopy={() => navigator.clipboard.writeText(scene.prompt_text)}
          isLocked={isLocked}
          onChange={(val) => onUpdate({ prompt_text: val })}
        />
        <PromptPreview
          label="Negative Prompt"
          value={scene.negative_prompt}
          onCopy={() => navigator.clipboard.writeText(scene.negative_prompt)}
          isNegative
          isLocked={isLocked}
          onChange={(val) => onUpdate({ negative_prompt: val })}
        />
        
        {/* SDXL Prompt — shows sync status */}
        {composed.imagePrompt && (
          <div className="space-y-1 mt-2 p-2 bg-emerald-900/10 border border-emerald-700/30 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider">
                📤 SDXL Image Prompt
                {composed.imagePrompt === scene.prompt_text
                  ? <span className="ml-2 text-emerald-500">✓ Synced</span>
                  : <span className="ml-2 text-amber-400">⟳ Syncing...</span>
                }
              </p>
              <div className="flex items-center gap-1">
                {/* Manual apply button */}
                {composed.imagePrompt !== scene.prompt_text && (
                  <button
                    onClick={() => {
                      console.log('[PROMPT SYNC] Manual apply');
                      onUpdate({
                        prompt_text: composed.imagePrompt,
                        negative_prompt: composed.negativePrompt || scene.negative_prompt || '',
                      });
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/30
                      text-emerald-400 border border-emerald-700/30
                      hover:bg-emerald-900/50 transition-colors"
                  >
                    Apply
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(composed.imagePrompt)}
                  className="p-1 rounded hover:bg-emerald-900/20 text-emerald-500
                    hover:text-emerald-400 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-emerald-300 font-mono leading-relaxed
              whitespace-pre-wrap break-words">
              {composed.imagePrompt}
            </p>
          </div>
        )}
        
        {composed.negativePrompt && composed.negativePrompt !== scene.negative_prompt && (
          <div className="space-y-1 p-2 bg-rose-900/10 border border-rose-700/30 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-rose-400 uppercase tracking-wider">
                ⛔ SDXL Negative Prompt (optimized)
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(composed.negativePrompt)}
                className="p-1 rounded hover:bg-rose-900/20 text-rose-500 hover:text-rose-400 transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-rose-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
              {composed.negativePrompt}
            </p>
          </div>
        )}

        {composed.debugValidationWarnings && composed.debugValidationWarnings.length > 0 && (
          <div className="space-y-1 p-2 bg-amber-900/20 border border-amber-700/30 rounded-md">
            <p className="text-[10px] text-amber-400 uppercase tracking-wider">⚠️ Character Warnings</p>
            {composed.debugValidationWarnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-300">{w}</p>
            ))}
          </div>
        )}
      </div>
      
      {/* Generated scene image — shown when render_url is set */}
      {scene.render_url && (
        <div className="mt-2 rounded-lg overflow-hidden border border-surface-border">
          <img
            key={scene.render_url}
            src={`http://127.0.0.1:8188/view?filename=${encodeURIComponent(scene.render_url)}&type=output`}
            alt={scene.title}
            className="w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Generation Progress */}
      {genProgress[sceneGenKey] && (
        <div>
          <GenerationProgress progress={genProgress[sceneGenKey]} compact />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => { console.log('[BTN CLICK] Generate Image TEST123 pressed'); createRenderJob('image'); }}
          disabled={genProgress[sceneGenKey]?.status === 'generating' || genProgress[sceneGenKey]?.status === 'queued' || genProgress[sceneGenKey]?.status === 'saving'}
          className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Image className="w-3.5 h-3.5" />
          Generate Image
        </button>
        <button
          onClick={() => createRenderJob('video')}
          disabled={genProgress[sceneGenKey]?.status === 'generating' || genProgress[sceneGenKey]?.status === 'queued' || genProgress[sceneGenKey]?.status === 'saving'}
          className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Video className="w-3.5 h-3.5" />
          Generate Video
        </button>
        <a
          href="/comfyui"
          className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in Studio
        </a>
      </div>
      
      {isLocked && (
        <div className="p-2 bg-amber-900/20 border border-amber-700/30 rounded-md">
          <p className="text-xs text-amber-400">
            🔒 Scene locked - prompts and seed are protected from changes
          </p>
        </div>
      )}
      
      {/* Fixed seed hint */}
      {!scene.seed && !isLocked && (
        <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-md">
          <p className="text-[10px] text-blue-400">
            💡 Set a fixed <strong>Seed</strong> above to keep characters consistent every time you generate. "Auto" changes the seed each time, changing details.
          </p>
        </div>
      )}
    </div>
  );
}

function PromptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-studio-900/50 rounded">
      <p className="text-[10px] text-studio-500 uppercase mb-0.5">{label}</p>
      <p className="text-xs text-studio-300 truncate">{value}</p>
    </div>
  );
}

function PromptPreview({ 
  label, 
  value, 
  onCopy,
  isNegative,
  isLocked,
  onChange
}: { 
  label: string; 
  value: string;
  onCopy: () => void;
  isNegative?: boolean;
  isLocked?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-studio-500 uppercase">{label}</p>
        <button
          onClick={onCopy}
          className="p-1 rounded hover:bg-accent-900/20 text-studio-500 hover:text-accent-400 transition-colors"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={isLocked}
        className={`w-full p-2 rounded text-xs font-mono leading-relaxed min-h-[60px] max-h-24 resize-y ${
          isNegative ? 'bg-danger-900/10 text-danger-300' : 'bg-studio-900/50 text-studio-300'
        } ${isLocked ? 'cursor-not-allowed opacity-60' : 'focus:ring-1 focus:ring-accent-600/40'} border-0 outline-none`}
      />
    </div>
  );
}