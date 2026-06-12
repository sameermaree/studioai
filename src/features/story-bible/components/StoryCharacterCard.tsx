import { classifyStyleIds } from "../../../services/style/StyleFamilyRouter";
import { useState, useCallback } from 'react';
import { Trash2, ChevronDown, ChevronUp, Sparkles, Save, Image as ImageIcon, Loader2, ExternalLink, X } from 'lucide-react';
import type { CharacterBibleEntry, Character } from '../../../types';
import type { GenerationStatus } from '../../../types/generation';
import { useGenerationStore } from '../../../store/useGenerationStore';
import { useStudioStore } from '../../../store/useStudioStore';
import { GenerationProgress } from '../../../components/ui/GenerationProgress';
import {
  buildCharacterPortraitPrompt,
  buildCharacterPortraitNegative,
  buildSceneInjectionPrompt as buildBibleSceneInjection,
} from '../../../services/character/CharacterPromptBuilder';

const CHARACTER_TYPES = [
  { value: '', label: 'Select type...' },
  { value: 'child', label: 'Child' },
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
  { value: 'teenager', label: 'Teenager' },
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'uncle', label: 'Uncle' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'villain', label: 'Villain' },
  { value: 'hero', label: 'Hero' },
  { value: 'friend', label: 'Friend' },
  { value: 'king', label: 'King' },
  { value: 'queen', label: 'Queen' },
  { value: 'prince', label: 'Prince' },
  { value: 'princess', label: 'Princess' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'narrator', label: 'Narrator' },
];

interface StoryCharacterCardProps {
  entry: CharacterBibleEntry;
  onUpdate: (updates: Partial<CharacterBibleEntry>) => void;
  onDelete: () => void;
  stylePresetIds?: string[];
}

// Display URL builder: converts stored plain filename -> full ComfyUI view URL for <img src>.
// reference_image_path in the store is intentionally kept as plain filename for LoadImage.
// This function handles all three formats that may exist in the store:
//   'X.png'                                             -> full ComfyUI URL
//   '/view?filename=X.png&type=output'                  -> prefixed with base
//   'http://127.0.0.1:8188/view?filename=X.png&...'    -> used as-is
const COMFYUI_BASE = 'http://127.0.0.1:8188';

function buildDisplayUrl(path: string | null | undefined): string | null {
  if (!path || !path.trim()) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/view')) return `${COMFYUI_BASE}${path}`;
  return `${COMFYUI_BASE}/view?filename=${encodeURIComponent(path)}&type=output`;
}

export function StoryCharacterCard({ entry, onUpdate, onDelete, stylePresetIds }: StoryCharacterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const addCharacter = useStudioStore((s) => s.addCharacter);
  const existingCharacters = useStudioStore((s) => s.characters);

    // Global generation progress
  const genProgress = useGenerationStore((s) => s.progress);
  const genSetProgress = useGenerationStore((s) => s.setProgress);
  const genResetProgress = useGenerationStore((s) => s.resetProgress);

  const promptKey: `generate-character-prompt-${string}` = `generate-character-prompt-${entry.id}`;
  const imageKey: `generate-character-image-${string}` = `generate-character-image-${entry.id}`;
  const genRunning = genProgress[promptKey]?.status === 'generating' || genProgress[promptKey]?.status === 'queued' || genProgress[promptKey]?.status === 'saving'
    || genProgress[imageKey]?.status === 'generating' || genProgress[imageKey]?.status === 'queued' || genProgress[imageKey]?.status === 'saving';

  const handleRegenerateIdentity = useCallback(() => {
    // Reset identity lock metadata to allow fresh generation.
    // reference_image_path and reference_image_for_ipadapter are intentionally preserved.
    // Clearing them sets hasReferenceImage=false in CharacterImageGenerator,
    // which silently routes to pixar_disney_stable.json (no IPAdapter nodes 10-15).
    onUpdate({
      identityLocked: false,
      seed: null,
      workflow_path: null,
      checkpoint: null,
      generation_positive_prompt: null,
      generation_negative_prompt: null,
      appearance_traits: {
        hairstyle: '',
        hair_color: '',
        eye_color: '',
        outfit: '',
        age_range: '',
        facial_structure: '',
        body_proportions: '',
        style_type: '',
      },
      // reference_image_path: NOT cleared - needed for IPAdapter routing
      // reference_image_for_ipadapter: NOT cleared - needed for LoadImage node 13
    });
    console.log('[IDENTITY] Regenerate triggered for:', entry.name);
    console.log('[IDENTITY] reference_image_path preserved:', entry.reference_image_path);
  }, [entry.name, entry.reference_image_path, onUpdate]);

    const handleGeneratePrompt = useCallback(() => {
    // If user typed manually, warn and skip — manual prompt takes priority
    if (entry.character_prompt_manual) {
      console.log('[PROMPT GEN] Skipping auto-generate — user has typed a manual prompt');
      genSetProgress(promptKey, { status: 'done', progress: 100, label: 'Manual prompt — skipped auto-generate' });
      setTimeout(() => genResetProgress(promptKey), 3000);
      return;
    }

    genSetProgress(promptKey, { status: 'generating', progress: 30, label: 'Generating character prompt...' });
    
    try {
      const styleFamily = (stylePresetIds && stylePresetIds.length > 0)
        ? classifyStyleIds(stylePresetIds).find(f => f !== 'cinematic' && f !== 'unknown') || 'unknown'
        : 'unknown';
      const prompt = buildCharacterPortraitPrompt(entry, styleFamily);
      const negPrompt = buildCharacterPortraitNegative(entry, styleFamily);
      const sceneInject = buildBibleSceneInjection(entry);

      genSetProgress(promptKey, { status: 'saving', progress: 85, label: 'Saving prompt...' });
      onUpdate({
        character_prompt: prompt,
        scene_injection_prompt: sceneInject,
        negative_prompt: negPrompt,
        character_prompt_manual: false, // generated prompt — not manual
      });
      genSetProgress(promptKey, { status: 'done', progress: 100, label: 'Prompt ready' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      genSetProgress(promptKey, { status: 'failed', progress: 0, label: 'Failed', error: errMsg });
    } finally {
      setTimeout(() => genResetProgress(promptKey), 3000);
    }
  }, [entry, onUpdate, promptKey, genSetProgress, genResetProgress]);

  const handleGenerateImage = useCallback(async () => {
    console.log('[GENERATE IMAGE] clicked — entry:', entry.name, '| genRunning:', genRunning, '| has ref:', !!entry.reference_image_path, '| identityLocked:', entry.identityLocked);
    genSetProgress(imageKey, { status: 'queued', progress: 10, label: 'Queuing image generation...' });

    try {
      const { generateCharacterImage } = await import('../../../services/generation/CharacterImageGenerator');

      const result = await generateCharacterImage(entry, (progressState) => {
        const { percentage, phase, error } = progressState;
        let status: GenerationStatus = 'generating';
        let label = phase;

        if (progressState.isDone) {
          status = 'done';
          label = 'Image ready';
        } else if (error) {
          status = 'failed';
          label = error;
        } else if (percentage <= 10) {
          status = 'queued';
          label = 'Queued...';
        } else if (percentage <= 40) {
          status = 'generating';
          label = 'Generating...';
        } else if (percentage <= 85) {
          status = 'saving';
          label = 'Saving...';
        }

        genSetProgress(imageKey, { status, progress: percentage, label, error: error ?? undefined });
      }, stylePresetIds);

            if (result.success && result.referenceImagePath) {
        // Update entry with all fields returned from generator (includes locked metadata)
        const updatedEntry = result.entry;
        onUpdate({
          // Patch: use normalized filename from updatedEntry (plain filename, not raw URL).
          // result.referenceImagePath carries the raw ComfyUI URL which breaks LoadImage on next generation.
          // updatedEntry.reference_image_path is already normalized by CharacterImageGenerator.
          reference_image_path: updatedEntry.reference_image_path,
          reference_image_for_ipadapter: updatedEntry.reference_image_for_ipadapter ?? updatedEntry.reference_image_path,
          identityLocked: updatedEntry.identityLocked,
          seed: updatedEntry.seed,
          workflow_path: updatedEntry.workflow_path,
          checkpoint: updatedEntry.checkpoint,
          generation_positive_prompt: updatedEntry.generation_positive_prompt,
          generation_negative_prompt: updatedEntry.generation_negative_prompt,
          style_preset_ids: updatedEntry.style_preset_ids,
          appearance_traits: updatedEntry.appearance_traits,
        });
        genSetProgress(imageKey, { status: 'done', progress: 100, label: 'Image ready' });
      } else {
        genSetProgress(imageKey, { status: 'failed', progress: 0, label: result.error || 'Generation failed', error: result.error });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      genSetProgress(imageKey, { status: 'failed', progress: 0, label: 'Failed', error: errMsg });
    } finally {
      setTimeout(() => genResetProgress(imageKey), 5000);
    }
  }, [entry, onUpdate, imageKey, genSetProgress, genResetProgress]);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    // Save character into the character library (Zustand store) so it persists across refreshes/navigation
    const charLibrary: Character = {
      id: crypto.randomUUID(),
      name: entry.name,
      description: entry.visual_description || entry.name,
      image_url: entry.reference_image_path,
      reference_images: entry.reference_image_path ? [entry.reference_image_path] : [],
      tags: [entry.role, entry.character_type, entry.gender].filter(Boolean),
      emotions: [],
      outfits: entry.outfit ? [{ id: crypto.randomUUID(), name: 'Default', description: entry.outfit, image_url: null }] : [],
      voice_id: null,
      style_preset_id: null,
      consistency_lock: true,
      consistency_settings: { face: true, hairstyle: true, eye_color: true, clothing: true, body_proportions: true, animation_style: false, color_palette: false },
      personality_notes: entry.personality || '',
      cinematic_notes: `Art style: ${entry.art_style || ''}. Character prompt: ${entry.character_prompt || ''}`,
      metadata: {
        bible_entry_id: entry.id,
        character_prompt: entry.character_prompt,
        negative_prompt: entry.negative_prompt,
        scene_injection_prompt: entry.scene_injection_prompt,
        seed: entry.seed,
        character_type: entry.character_type,
        age: entry.age,
        gender: entry.gender,
        hair: entry.hair,
        eyes: entry.eyes,
        art_style: entry.art_style,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addCharacter(charLibrary);
    console.log('[SAVE TO LIBRARY] Character saved:', entry.name, 'id:', charLibrary.id);
    setTimeout(() => setIsSaving(false), 1500);
  }, [entry, addCharacter]);

  return (
    <div className="border border-surface-border rounded-lg overflow-hidden bg-surface">
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-surface-lighter transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-full bg-studio-800 flex items-center justify-center text-xs font-bold text-studio-400 shrink-0 overflow-hidden">
          {entry.reference_image_path ? (
            <img
              src={buildDisplayUrl(entry.reference_image_path) ?? undefined}
              key={entry.reference_image_path ?? 'no-ref'}
              alt={entry.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            entry.name[0]
          )}
        </div>
                <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
            {entry.name}
            {entry.identityLocked && entry.reference_image_path && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-700/30 leading-none">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Identity Locked
              </span>
            )}
          </p>
          <p className="text-xs text-studio-400 truncate">
            {entry.role}{entry.character_type ? ` (${entry.character_type})` : ''}{entry.age > 0 ? `, ${entry.age}y` : ''}{entry.gender !== 'unknown' ? `, ${entry.gender}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-studio-500" /> : <ChevronDown className="w-3.5 h-3.5 text-studio-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-surface-border space-y-2">
          {/* Row 1: Name, Character Type, Role */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label text-[10px]">Name</label>
              <input value={entry.name} onChange={(e) => onUpdate({ name: e.target.value })} className="input text-xs py-1" />
            </div>
            <div>
              <label className="label text-[10px]">Character Type</label>
              <select value={entry.character_type} onChange={(e) => onUpdate({ character_type: e.target.value })} className="input text-xs py-1">
                {CHARACTER_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-[10px]">Role</label>
              <input value={entry.role} onChange={(e) => onUpdate({ role: e.target.value })} className="input text-xs py-1" />
            </div>
          </div>

          {/* Row 2: Age, Gender */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[10px]">Age</label>
              <input type="number" value={entry.age || ''} onChange={(e) => onUpdate({ age: parseInt(e.target.value) || 0 })} className="input text-xs py-1" min={0} />
            </div>
            <div>
              <label className="label text-[10px]">Gender</label>
              <select value={entry.gender} onChange={(e) => onUpdate({ gender: e.target.value as 'male' | 'female' | 'non-binary' | 'unknown' })} className="input text-xs py-1">
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
              </select>
            </div>
          </div>

          {/* Visual Description */}
          <div>
            <label className="label text-[10px]">Visual Description</label>
            <textarea value={entry.visual_description} onChange={(e) => onUpdate({ visual_description: e.target.value })} className="input text-xs min-h-[40px] resize-y" />
          </div>

          {/* Row 3: Outfit, Hair, Eyes */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label text-[10px]">Outfit</label>
              <input value={entry.outfit} onChange={(e) => onUpdate({ outfit: e.target.value })} className="input text-xs py-1" placeholder="e.g. blue dress" />
            </div>
            <div>
              <label className="label text-[10px]">Hair</label>
              <input value={entry.hair} onChange={(e) => onUpdate({ hair: e.target.value })} className="input text-xs py-1" placeholder="e.g. long brown" />
            </div>
            <div>
              <label className="label text-[10px]">Eyes</label>
              <input value={entry.eyes} onChange={(e) => onUpdate({ eyes: e.target.value })} className="input text-xs py-1" placeholder="e.g. green" />
            </div>
          </div>

          {/* Personality & Art Style */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[10px]">Personality</label>
              <textarea value={entry.personality} onChange={(e) => onUpdate({ personality: e.target.value })} className="input text-xs min-h-[30px] resize-y" />
            </div>
            <div>
              <label className="label text-[10px]">Art Style</label>
              <input value={entry.art_style} onChange={(e) => onUpdate({ art_style: e.target.value })} className="input text-xs py-1" placeholder="e.g. pixar, anime, realistic" />
            </div>
          </div>

          {/* Reference Image Preview â€” clickable lightbox (Bug 1 fix) */}
          {entry.reference_image_path && (
            <div>
              <label className="label text-[10px]">Reference Image</label>
              <div className="mt-1">
                <img
                  src={buildDisplayUrl(entry.reference_image_path) ?? undefined}
                  key={entry.reference_image_path ?? 'no-ref'}
                  alt={entry.name}
                  className="w-20 h-20 object-cover rounded-lg border border-surface-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setLightboxOpen(true)}
                />
              </div>
            </div>
          )}
          {/* Lightbox modal for full preview */}
          {lightboxOpen && entry.reference_image_path && (
            <div
              className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
              onClick={() => setLightboxOpen(false)}
            >
              <div
                className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="absolute -top-10 right-0 p-1 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <img
                  src={buildDisplayUrl(entry.reference_image_path) ?? undefined}
                  key={entry.reference_image_path ?? 'no-ref-lightbox'}
                  alt={entry.name}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                />
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-sm text-white/70">{entry.name}</p>
                  <a
                    href={buildDisplayUrl(entry.reference_image_path) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent-600/30 text-accent-300 hover:bg-accent-600/50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in new tab
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Generation Progress Indicators */}
          {genProgress[`generate-character-prompt-${entry.id}`] && (
            <div className="px-1">
              <GenerationProgress progress={genProgress[`generate-character-prompt-${entry.id}`]} compact />
            </div>
          )}
          {genProgress[`generate-character-image-${entry.id}`] && (
            <div className="px-1">
              <GenerationProgress progress={genProgress[`generate-character-image-${entry.id}`]} compact />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-surface-border">
            <button
              type="button"
              onClick={handleGeneratePrompt}
              disabled={genRunning}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-accent-600/20 text-accent-400 hover:bg-accent-600/30 transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <Sparkles className="w-3 h-3" />
              Generate Prompt
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                isSaving ? 'bg-emerald-600/20 text-emerald-400' : 'bg-surface-light text-studio-300 hover:bg-surface-border'
              }`}
            >
              <Save className="w-3 h-3" />
              {isSaving ? 'Saved!' : 'Save Character'}
            </button>
                        <button
              type="button"
              disabled={genRunning}
              onClick={handleGenerateImage}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-light text-studio-300 hover:bg-surface-border transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <ImageIcon className="w-3 h-3" />
              Generate Image
            </button>
            {entry.identityLocked && entry.reference_image_path && (
              <button
                type="button"
                onClick={handleRegenerateIdentity}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Regenerate Identity
              </button>
            )}
          </div>

                    {/* Prompts */}
          <div>
            <label className="label text-[10px]">Character Prompt (portrait)</label>
            <textarea 
              value={entry.character_prompt} 
              onChange={(e) => onUpdate({ 
                character_prompt: e.target.value,
                character_prompt_manual: true // user typed manually — bypass ALL auto transformations
              })} 
              className="input text-xs min-h-[30px] resize-y font-mono" 
            />
            {entry.character_prompt_manual && (
              <span className="text-[9px] text-emerald-500/70 font-semibold flex items-center gap-0.5 mt-0.5">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Manual prompt — will be sent to ComfyUI exactly as typed
              </span>
            )}
          </div>
          <div>
            <label className="label text-[10px]">Scene Injection Prompt</label>
            <textarea value={entry.scene_injection_prompt} onChange={(e) => onUpdate({ scene_injection_prompt: e.target.value })} className="input text-xs min-h-[30px] resize-y font-mono" />
          </div>
          <div>
            <label className="label text-[10px]">Negative Prompt</label>
            <textarea value={entry.negative_prompt} onChange={(e) => onUpdate({ negative_prompt: e.target.value })} className="input text-xs min-h-[30px] resize-y font-mono" />
          </div>

          {/* Seed */}
          <div>
            <label className="label text-[10px]">Seed</label>
            <input type="number" value={entry.seed || ''} onChange={(e) => onUpdate({ seed: e.target.value ? parseInt(e.target.value) : null })} className="input text-xs py-1 font-mono" />
          </div>

          {/* ===== DEBUG RAW PROMPT VIEWER ===== */}
          <details className="mt-2 border border-amber-900/20 rounded overflow-hidden">
            <summary className="text-[10px] text-amber-500 font-semibold cursor-pointer hover:text-amber-400 px-2 py-1 bg-amber-900/10 flex items-center gap-1">
              <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              Debug: Raw Prompt Viewer
            </summary>
            <div className="p-2 space-y-1.5 bg-studio-900/80">
              <div>
                <label className="text-[9px] font-mono text-amber-500/70 block">Raw User Prompt</label>
                <textarea readOnly value={entry.character_prompt || "(empty)"} className="input text-[10px] min-h-[20px] resize-y font-mono text-amber-300 bg-studio-900 w-full" rows={2} />
              </div>
              <div>
                <label className="text-[9px] font-mono text-amber-500/70 block">Final ComfyUI Prompt (saved after generation)</label>
                <textarea readOnly value={entry.generation_positive_prompt || "(not generated yet)"} className="input text-[10px] min-h-[20px] resize-y font-mono text-emerald-300 bg-studio-900 w-full" rows={2} />
              </div>
              <div>
                <label className="text-[9px] font-mono text-amber-500/70 block">Final Negative Prompt</label>
                <textarea readOnly value={entry.generation_negative_prompt || "(not generated yet)"} className="input text-[10px] min-h-[20px] resize-y font-mono text-red-300 bg-studio-900 w-full" rows={2} />
              </div>
              <div>
                <label className="text-[9px] font-mono text-amber-500/70 block">Injected Style Presets</label>
                <div className="text-[10px] font-mono text-amber-300 bg-studio-900 rounded px-1.5 py-1">{(stylePresetIds && stylePresetIds.length > 0) ? JSON.stringify(stylePresetIds, null, 2) : "(none)"}</div>
              </div>
              <div>
                <label className="text-[9px] font-mono text-amber-500/70 block">Injected Character Attributes</label>
                <div className="text-[10px] font-mono text-amber-300 bg-studio-900 rounded px-1.5 py-1">{JSON.stringify({ visual_description: entry.visual_description, outfit: entry.outfit, hair: entry.hair, eyes: entry.eyes, art_style: entry.art_style, appearance_traits: entry.appearance_traits }, null, 2)}</div>
              </div>
              <div className="text-[9px] text-amber-600/60 mt-1">
                Check browser console (F12) for full prompt trace during generation.
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
