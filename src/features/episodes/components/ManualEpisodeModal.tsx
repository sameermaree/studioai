/**
 * ManualEpisodeModal.tsx
 * Full manual episode creation — no AI.
 * Tabs: Info | Characters | Scenes
 * Features: localStorage draft, clone scene, inline character creation.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronRight, ChevronLeft, Plus, Trash2,
  Users, Layers, Info, UserPlus, Check, Copy,
  Save, Sparkles, Loader2, Image as ImageIcon,
} from 'lucide-react';
import { useStudioStore } from '../../../store/useStudioStore';
import { CreateSceneModal } from '../../../components/scene/CreateSceneModal';
import type { Character, Scene, Episode, CharacterBibleEntry, CharacterAppearanceTraits } from '../../../types';
import { buildMediaUrl, normalizeImageFilename } from '../../../lib/buildMediaUrl';
import { generateCharacterImage } from '../../../services/generation/CharacterImageGenerator';
import { generateSceneImage } from '../../../services/generation/sceneImageService';
import { useRenderQueueStore } from '../../../store/useRenderQueueStore';

// ── Draft persistence key ─────────────────────────────────────────────────────
const DRAFT_KEY = 'studioai_manual_episode_draft';

interface DraftState {
  episodeId: string;
  title: string;
  description: string;
  selectedCharIds: string[];
  scenes: Scene[];
  savedAt: string;
}

// ── Inline character form ─────────────────────────────────────────────────────
interface InlineCharForm {
  name: string;
  gender: 'male' | 'female' | 'unknown';
  character_type: string;
  visual_style: string;
  identity_mode: 'normal' | 'strong';
  description: string;
  hair: string;
  eyes: string;
  outfit: string;
}

const EMPTY_CHAR: InlineCharForm = {
  name: '', gender: 'unknown',
  character_type: 'child',
  visual_style: 'Pixar-style 3D animated',
  identity_mode: 'normal',
  description: '', hair: '', eyes: '', outfit: '',
};

// Character categories — inline to avoid missing module dependency
const CHARACTER_CATEGORIES: Record<string, string[]> = {
  Human: ['child','boy','girl','teenager','man','woman','father','mother',
    'teacher','student','hero','villain','friend','elder'],
  Animal: ['animal','bird','crow','cat','dog','rabbit','duck','fox','wolf',
    'horse','owl','eagle'],
  Creature: ['creature','dragon','magical creature','monster','fairy','spirit'],
};
const ALL_CHARACTER_TYPES = Object.values(CHARACTER_CATEGORIES).flat();

const VISUAL_STYLES = [
  'Pixar-style 3D animated',
  'Disney 2D animation',
  'Anime style',
  'Semi-realistic',
  'Watercolor illustrated',
  'Clay/stop-motion',
];

// ── Convert Character → CharacterBibleEntry for story_characters ────────────
function characterToMinimalBibleEntry(char: Character): CharacterBibleEntry {
  const meta = (char.metadata || {}) as Record<string, string>;
  return {
    id: char.id,
    name: char.name,
    role: 'character',
    character_type: meta.character_type || 'character',
    age: 0,
    gender: (meta.gender as any) || 'unknown',
    visual_description: char.description || '',
    outfit: char.outfits?.[0]?.name || meta.outfit || '',
    hair: meta.hair || char.cinematic_notes || '',
    eyes: meta.eyes || '',
    personality: char.personality_notes || '',
    art_style: meta.visual_style || 'Pixar-style 3D animated',
    character_prompt: '', character_prompt_manual: false,
    scene_injection_prompt: '', negative_prompt: '',
    // Normalize reference images — check metadata first for post-lock filenames
    reference_image_path: normalizeImageFilename(
      (meta.reference_image_path as string) || char.image_url
    ) || null,
    reference_image_for_ipadapter: char.consistency_lock
      ? (normalizeImageFilename(
          (meta.reference_image_for_ipadapter as string)
          || (meta.reference_image_path as string)
          || char.image_url
        ) || null)
      : null,
    seed: null, identityLocked: char.consistency_lock,
    workflow_path: null, checkpoint: null,
    generation_positive_prompt: null, generation_negative_prompt: null,
    style_preset_ids: char.style_preset_id ? [char.style_preset_id] : [],
    appearance_traits: {
      hairstyle: meta.hair || '',
      hair_color: meta.hair || '',
      eye_color: meta.eyes || '',
      outfit: char.outfits?.[0]?.name || meta.outfit || '',
      age_range: 'unknown' as const,
      facial_structure: char.description || '',
      body_proportions: '',
      style_type: meta.visual_style || 'Pixar-style 3D animated',
    } as CharacterAppearanceTraits,
    created_at: char.created_at,
    updated_at: char.updated_at,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
}

type Tab = 'info' | 'characters' | 'scenes';

// ── Component ─────────────────────────────────────────────────────────────────
export function ManualEpisodeModal({ onClose }: Props) {
  const navigate = useNavigate();
  const { characters: storeChars, addCharacter, updateCharacter, addEpisode } = useStudioStore();
  const { addJob, updateJob } = useRenderQueueStore();

  // Load draft or generate fresh ID
  const loadedDraft = (() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as DraftState) : null;
    } catch { return null; }
  })();

  const episodeId = useRef(loadedDraft?.episodeId ?? crypto.randomUUID()).current;

  const [tab, setTab] = useState<Tab>('info');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(
    loadedDraft?.savedAt ?? null
  );

  // ── Tab 1: Info ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(loadedDraft?.title ?? '');
  const [description, setDescription] = useState(loadedDraft?.description ?? '');

  // ── Tab 2: Characters ───────────────────────────────────────────────────────
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(
    loadedDraft?.selectedCharIds ?? []
  );
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [charForm, setCharForm] = useState<InlineCharForm>(EMPTY_CHAR);
  const [charError, setCharError] = useState('');

  // ── Tab 3: Scenes ───────────────────────────────────────────────────────────
  const [scenes, setScenes] = useState<Scene[]>(loadedDraft?.scenes ?? []);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [sceneModalDebug, setSceneModalDebug] = useState(false);
  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);

  // ── Auto-save draft ────────────────────────────────────────────────────────
  const saveDraft = useCallback(() => {
    const draft: DraftState = {
      episodeId,
      title,
      description,
      selectedCharIds,
      scenes,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
    } catch { /* storage full — ignore */ }
  }, [episodeId, title, description, selectedCharIds, scenes]);

  // Auto-save on every meaningful change (debounced via useEffect)
  useEffect(() => {
    const t = setTimeout(saveDraft, 800);
    return () => clearTimeout(t);
  }, [saveDraft]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /**/ }
  };

  // ── Character helpers ──────────────────────────────────────────────────────
  const toggleChar = (id: string) => {
    setSelectedCharIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddInlineChar = () => {
    if (!charForm.name.trim()) { setCharError('Name is required'); return; }
    setCharError('');

    const newChar: Character = {
      id: crypto.randomUUID(),
      name: charForm.name.trim(),
      description: [
        charForm.character_type,
        charForm.visual_style,
        charForm.description,
      ].filter(Boolean).join(', '),
      image_url: null,
      reference_images: [],
      tags: [charForm.character_type, charForm.visual_style].filter(Boolean),
      emotions: [],
      outfits: charForm.outfit
        ? [{ id: crypto.randomUUID(), name: charForm.outfit, description: '', image_url: null }]
        : [],
      voice_id: null,
      style_preset_id: null,
      consistency_lock: charForm.identity_mode === 'strong',
      consistency_settings: {
        face: true, hairstyle: true, eye_color: true,
        clothing: true, body_proportions: false,
        animation_style: false, color_palette: true,
      },
      personality_notes: '',
      cinematic_notes: [charForm.hair, charForm.eyes].filter(Boolean).join(', '),
      metadata: {
        gender: charForm.gender,
        character_type: charForm.character_type,
        visual_style: charForm.visual_style,
        identity_mode: charForm.identity_mode,
        hair: charForm.hair,
        eyes: charForm.eyes,
        outfit: charForm.outfit,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addCharacter(newChar);
    setSelectedCharIds(prev => [...prev, newChar.id]);
    setCharForm(EMPTY_CHAR);
    setShowInlineForm(false);
  };

  // ── Scene helpers ──────────────────────────────────────────────────────────
  const handleGenerateCharImage = async (char: Character) => {
    setGeneratingCharId(char.id);
    try {
      const entry = characterToMinimalBibleEntry(char);
      const result = await generateCharacterImage(entry, undefined,
        char.style_preset_id ? [char.style_preset_id] : []);
      if (result.success && result.referenceImagePath) {
        console.log('[IMAGE SAVE] image_url =', result.referenceImagePath);
        console.log('[IMAGE SAVE] reference_image_for_ipadapter =',
          result.entry.reference_image_for_ipadapter);
        updateCharacter(char.id, {
          image_url: result.referenceImagePath,
          consistency_lock: result.entry.identityLocked ?? false,
          metadata: {
            ...((char.metadata as Record<string, unknown>) || {}),
            reference_image_for_ipadapter: result.entry.reference_image_for_ipadapter,
            identity_generated_at: new Date().toISOString(),
            appearance_traits: result.entry.appearance_traits,
            seed: result.entry.seed,
          },
        });
      }
    } catch (e: any) {
      console.error('[MANUAL] char generate error:', e.message);
    } finally { setGeneratingCharId(null); }
  };

  const handleGenerateSceneImage = async (scene: Scene) => {
    setGeneratingSceneId(scene.id);
    const selectedChars = storeChars.filter(c => selectedCharIds.includes(c.id));
    const bibleChars = selectedChars.map(c => characterToMinimalBibleEntry(c));
    const jobId = addJob({ type: 'image', episode_id: episodeId,
      scene_id: scene.id, priority: 1, max_retries: 1 });
    try {
      await generateSceneImage({
        scene,
        characters: selectedChars,
        bibleCharacters: bibleChars,
        onUpdate: (updates) => {
          setScenes(prev => prev.map(s =>
            s.id === scene.id ? { ...s, ...updates } : s
          ));
        },
        addMediaAsset: () => {},
      });
      updateJob(jobId, { status: 'completed', progress: 100 });
    } catch (e: any) {
      updateJob(jobId, { status: 'failed', error: e.message });
    } finally { setGeneratingSceneId(null); }
  };

  const handleSceneSaved = (scene: Scene) => {
    setScenes(prev => [...prev, scene]);
    setShowSceneModal(false);
  };

  const handleDeleteScene = (id: string) =>
    setScenes(prev => prev.filter(s => s.id !== id));

  const handleCloneScene = (scene: Scene) => {
    const clone: Scene = {
      ...scene,
      id: crypto.randomUUID(),
      title: scene.title + ' (copy)',
      render_url: null,
      render_status: 'pending',
      audio_url: undefined,
      audio_status: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setScenes(prev => {
      const idx = prev.findIndex(s => s.id === scene.id);
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  // ── Create episode ─────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!title.trim() || scenes.length === 0) return;

    const episode = {
      id: episodeId,
      title: title.trim(),
      description: description.trim(),
      status: 'draft' as any,
      scenes: scenes.map((sc, i) => ({ ...sc, order: i })),
      story_characters: storeChars
        .filter(c => selectedCharIds.includes(c.id))
        .map(c => characterToMinimalBibleEntry(c)),
      duration_estimate: scenes.reduce((s, sc) => s + (sc.duration ?? 5), 0),
      workflow_config: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Episode;

    addEpisode(episode);
    clearDraft();
    navigate(`/workspace/${episodeId}`);
    onClose();
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const canCreate = title.trim().length > 0 && scenes.length > 0;
  const totalDuration = scenes.reduce((s, sc) => s + (sc.duration ?? 5), 0);
  const episodeCharOptions = storeChars
    .filter(c => selectedCharIds.includes(c.id))
    .map(c => ({ id: c.id, name: c.name }));

  const tabList: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'info', label: 'Info', icon: Info },
    { id: 'characters', label: 'Characters', icon: Users },
    { id: 'scenes', label: `Scenes (${scenes.length})`, icon: Layers },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">

          {/* Header */}
          <div className="flex items-center justify-between mb-1 shrink-0">
            <h2 className="text-lg font-semibold text-white">Manual Episode</h2>
            <div className="flex items-center gap-3">
              {draftSavedAt && (
                <span className="text-[10px] text-studio-600 flex items-center gap-1">
                  <Save className="w-2.5 h-2.5" />
                  Draft saved {new Date(draftSavedAt).toLocaleTimeString()}
                </span>
              )}
              <button onClick={onClose}
                className="p-1 text-studio-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-studio-800 mb-4 shrink-0">
            {tabList.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                  border-b-2 transition-colors ${tab === t.id
                    ? 'border-accent-500 text-accent-400'
                    : 'border-transparent text-studio-500 hover:text-studio-300'}`}>
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── INFO ──────────────────────────────────────────────────── */}
            {tab === 'info' && (
              <div className="space-y-4 px-1">
                <div>
                  <label className="label">Episode Title *</label>
                  <input className="input" placeholder="e.g. The Broken Pencil"
                    value={title} onChange={e => setTitle(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input min-h-[80px] resize-none text-sm"
                    placeholder="Brief synopsis or notes..."
                    value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => setTab('characters')}
                    className="btn-primary text-sm flex items-center gap-2">
                    Next: Characters <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── CHARACTERS ────────────────────────────────────────────── */}
            {tab === 'characters' && (
              <div className="space-y-4 px-1">

                {/* Existing characters */}
                {storeChars.length > 0 && (
                  <div>
                    <p className="label mb-2">Select Existing Characters</p>
                    <div className="space-y-1.5">
                      {storeChars.map(c => (
                        <div key={c.id} className={`rounded-lg border transition-colors ${
                          selectedCharIds.includes(c.id)
                            ? 'border-accent-600/30 bg-accent-600/5'
                            : 'border-studio-800 bg-studio-900'
                        }`}>
                          {/* Select row */}
                          <button onClick={() => toggleChar(c.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                            <div className="w-8 h-8 rounded-full bg-studio-700 overflow-hidden shrink-0">
                              {c.image_url
                                ? <img
                                    src={buildMediaUrl(c.image_url) ?? ''}
                                    alt="" className="w-full h-full object-cover"
                                    onError={() => console.warn('[IMAGE RENDER] 404:', c.image_url)}
                                  />
                                : <div className="w-full h-full flex items-center justify-center text-xs text-studio-400">
                                    {c.name[0]}
                                  </div>
                              }
                            </div>
                            <span className={`text-sm font-medium flex-1 ${
                              selectedCharIds.includes(c.id) ? 'text-accent-300' : 'text-studio-300'
                            }`}>{c.name}</span>
                            {c.image_url
                              ? <span className="text-[10px] text-emerald-400 mr-1">✓</span>
                              : <span className="text-[10px] text-red-400 mr-1">✗</span>
                            }
                            {selectedCharIds.includes(c.id) && (
                              <Check className="w-4 h-4 text-accent-400 shrink-0" />
                            )}
                          </button>
                          {/* Generate Identity — shown when character is selected */}
                          {selectedCharIds.includes(c.id) && (
                            <div className="px-3 pb-2">
                              <button
                                onClick={() => handleGenerateCharImage(c)}
                                disabled={generatingCharId === c.id}
                                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1
                                  rounded bg-accent-600/15 text-accent-400 border border-accent-700/25
                                  hover:bg-accent-600/25 disabled:opacity-40 transition-colors"
                              >
                                {generatingCharId === c.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Sparkles className="w-3 h-3" />
                                }
                                {generatingCharId === c.id
                                  ? 'Generating...'
                                  : c.image_url ? 'Regenerate Identity' : 'Generate Identity'
                                }
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline create */}
                <div className={storeChars.length > 0 ? 'border-t border-studio-800 pt-4' : ''}>
                  {!showInlineForm ? (
                    <button onClick={() => setShowInlineForm(true)}
                      className="flex items-center gap-2 text-sm text-studio-400
                        hover:text-white transition-colors">
                      <UserPlus className="w-4 h-4" />
                      Create new character
                    </button>
                  ) : (
                    <div className="space-y-3 p-4 rounded-xl bg-studio-900 border border-studio-700">
                      <p className="text-sm font-semibold text-white">New Character</p>

                      {/* Row 1: Name + Gender */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">Name *</label>
                          <input className="input text-sm" placeholder="Akram"
                            value={charForm.name}
                            onChange={e => setCharForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label text-xs">Gender</label>
                          <select className="input text-sm" value={charForm.gender}
                            onChange={e => setCharForm(f => ({ ...f, gender: e.target.value as any }))}>
                            <option value="unknown">Unknown</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Character Type + Visual Style */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">Character Type</label>
                          <select className="input text-sm" value={charForm.character_type}
                            onChange={e => setCharForm(f => ({ ...f, character_type: e.target.value }))}>
                            {Object.entries(CHARACTER_CATEGORIES).map(([group, types]) => (
                              <optgroup key={group} label={group}>
                                {types.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Visual Style</label>
                          <select className="input text-sm" value={charForm.visual_style}
                            onChange={e => setCharForm(f => ({ ...f, visual_style: e.target.value }))}>
                            {VISUAL_STYLES.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row 3: Description */}
                      <div>
                        <label className="label text-xs">Visual Description</label>
                        <input className="input text-sm"
                          placeholder="10-year-old boy, slim build, light olive skin..."
                          value={charForm.description}
                          onChange={e => setCharForm(f => ({ ...f, description: e.target.value }))} />
                      </div>

                      {/* Row 4: Hair + Eyes + Outfit */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="label text-xs">Hair</label>
                          <input className="input text-sm" placeholder="dark brown"
                            value={charForm.hair}
                            onChange={e => setCharForm(f => ({ ...f, hair: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label text-xs">Eyes</label>
                          <input className="input text-sm" placeholder="brown"
                            value={charForm.eyes}
                            onChange={e => setCharForm(f => ({ ...f, eyes: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label text-xs">Outfit</label>
                          <input className="input text-sm" placeholder="blue hoodie"
                            value={charForm.outfit}
                            onChange={e => setCharForm(f => ({ ...f, outfit: e.target.value }))} />
                        </div>
                      </div>

                      {/* Row 5: Identity Mode */}
                      <div>
                        <label className="label text-xs">Identity Mode</label>
                        <div className="flex gap-2 mt-1">
                          {(['normal', 'strong'] as const).map(mode => (
                            <button key={mode} type="button"
                              onClick={() => setCharForm(f => ({ ...f, identity_mode: mode }))}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                                ${charForm.identity_mode === mode
                                  ? 'bg-accent-600/20 text-accent-300 border-accent-600/40'
                                  : 'bg-studio-800 text-studio-500 border-studio-700 hover:border-studio-500'}`}>
                              {mode === 'normal' ? '🎬 Normal' : '🔒 Strong'}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-studio-600 mt-1">
                          Strong: forces VAEEncode identity workflow for this character.
                        </p>
                      </div>

                      {charError && <p className="text-xs text-red-400">{charError}</p>}

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setShowInlineForm(false); setCharForm(EMPTY_CHAR); setCharError(''); }}
                          className="btn-secondary text-xs py-1.5 px-3">
                          Cancel
                        </button>
                        <button onClick={handleAddInlineChar}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Character
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setTab('info')}
                    className="btn-secondary text-sm flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={() => setTab('scenes')}
                    className="btn-primary text-sm flex items-center gap-2">
                    Next: Scenes <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── SCENES ────────────────────────────────────────────────── */}
            {tab === 'scenes' && (
              <div className="space-y-3 px-1">

                {/* Scene list */}
                {scenes.length === 0 && (
                  <div className="text-center py-8 text-studio-600 text-sm">
                    No scenes yet. Add your first scene below.
                  </div>
                )}

                {scenes.map((sc, i) => (
                  <div key={sc.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg
                      bg-studio-900 border border-studio-800 group">
                    <span className="text-xs text-studio-600 w-5 shrink-0 text-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{sc.title}</p>
                      <p className="text-xs text-studio-500">
                        {sc.camera_angle || 'No camera'} · {sc.duration ?? 5}s
                        {(sc.prompt_id ?? '').startsWith('manual-debug') && (
                          <span className="ml-2 text-amber-500">🧪 debug</span>
                        )}
                        {sc.render_url && (
                          <span className="ml-2 text-emerald-400">✓ image</span>
                        )}
                      </p>
                    </div>
                    {/* Generate scene image */}
                    <button
                      onClick={() => handleGenerateSceneImage(sc)}
                      disabled={generatingSceneId === sc.id}
                      className="p-1.5 text-studio-500 hover:text-accent-400
                        disabled:opacity-40 transition-colors shrink-0"
                      title="Generate scene image"
                    >
                      {generatingSceneId === sc.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <ImageIcon className="w-3.5 h-3.5" />
                      }
                    </button>
                    {/* Clone */}
                    <button
                      onClick={() => handleCloneScene(sc)}
                      className="p-1.5 text-studio-700 hover:text-studio-300 transition-colors
                        opacity-0 group-hover:opacity-100"
                      title="Clone scene">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteScene(sc.id)}
                      className="p-1.5 text-studio-700 hover:text-red-400 transition-colors
                        opacity-0 group-hover:opacity-100"
                      title="Delete scene">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add scene buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setSceneModalDebug(false); setShowSceneModal(true); }}
                    className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2 py-2">
                    <Plus className="w-4 h-4" /> Normal Scene
                  </button>
                  <button
                    onClick={() => { setSceneModalDebug(true); setShowSceneModal(true); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                      border border-amber-700/30 bg-amber-900/10 text-amber-400
                      hover:bg-amber-900/20 transition-colors text-sm">
                    <Plus className="w-4 h-4" /> Manual Debug Scene
                  </button>
                </div>

                <div className="flex justify-start pt-1">
                  <button onClick={() => setTab('characters')}
                    className="btn-secondary text-sm flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-2
            border-t border-studio-800 shrink-0">
            <p className="text-xs text-studio-600">
              {!canCreate
                ? scenes.length === 0
                  ? 'Add at least one scene to create'
                  : 'Add a title to create'
                : `${scenes.length} scene${scenes.length !== 1 ? 's' : ''} · ${totalDuration}s total`}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={!canCreate}
                className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Create Episode →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scene modal (rendered outside card to avoid z-index conflict) */}
      {showSceneModal && (
        <CreateSceneModal
          episodeId={episodeId}
          sceneCount={scenes.length}
          characters={episodeCharOptions}
          defaultManualMode={sceneModalDebug}
          onSave={handleSceneSaved}
          onClose={() => setShowSceneModal(false)}
        />
      )}
    </>
  );
}
