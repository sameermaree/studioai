import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cinematicPresets } from '../config/presets/cinematicPresets';
import { voicePresets } from '../config/presets/voicePresets';
import { Plus, Lock, Unlock, Tag, Trash2, CreditCard as Edit2, X, Image, Mic2, Palette, Sparkles, Loader2, CheckCircle2, AlertCircle, ZoomIn, Download } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { buildMediaUrl, normalizeImageFilename } from '../lib/buildMediaUrl';
// Character type utilities — inline to avoid missing module dependency
const _NON_HUMAN = new Set(['animal','bird','crow','cat','dog','rabbit','duck',
  'fox','wolf','horse','owl','eagle','creature','dragon','magical creature',
  'monster','fairy','spirit']);
const isNonHumanType = (t: string) => _NON_HUMAN.has(t.toLowerCase());
import { generateCharacterImage } from '../services/generation/CharacterImageGenerator';
import type { CharacterBibleEntry, CharacterAppearanceTraits } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import type { Character, Outfit, ConsistencySettings } from '../types';

// Convert store Character → minimal CharacterBibleEntry for generateCharacterImage()
function characterToBibleEntry(char: Character): CharacterBibleEntry {
  const meta = (char.metadata || {}) as Record<string, string>;
  const traits: CharacterAppearanceTraits = {
    hairstyle: meta.hair || char.cinematic_notes || '',
    hair_color: meta.hair || '',
    eye_color: meta.eyes || '',
    outfit: char.outfits?.[0]?.name || meta.outfit || '',
    age_range: 'unknown',
    facial_structure: char.description || '',
    body_proportions: '',
    style_type: meta.visual_style || 'Pixar-style 3D animated',
  };
  return {
    id: char.id,
    name: char.name,
    role: 'character',
    character_type: meta.character_type || 'character',
    age: 0,
    gender: (meta.gender as CharacterBibleEntry['gender']) || 'unknown',
    visual_description: char.description || '',
    outfit: char.outfits?.[0]?.name || meta.outfit || '',
    hair: meta.hair || char.cinematic_notes || '',
    eyes: meta.eyes || '',
    personality: char.personality_notes || '',
    art_style: meta.visual_style || 'Pixar-style 3D animated',
    character_prompt: '',
    character_prompt_manual: false,
    scene_injection_prompt: '',
    negative_prompt: '',
    // Only use reference image for IPAdapter when identity is truly locked
    // When regenerating, we want a fresh result — no IPAdapter constraint
    reference_image_path: char.consistency_lock
      ? (normalizeImageFilename(
          (meta.reference_image_path as string) || char.image_url
        ) || null)
      : null,
    seed: null,   // always null → always new seed for Generate/Regenerate
    identityLocked: char.consistency_lock,
    workflow_path: null,
    checkpoint: null,
    generation_positive_prompt: null,
    generation_negative_prompt: null,
    style_preset_ids: char.style_preset_id ? [char.style_preset_id] : [],
    appearance_traits: traits,
    reference_image_for_ipadapter: char.consistency_lock
      ? (normalizeImageFilename(meta.reference_image_for_ipadapter as string || char.image_url) || null)
      : null,
    created_at: char.created_at,
    updated_at: char.updated_at,
  };
}

export function Characters() {
  const { characters, addCharacter, updateCharacter, deleteCharacter, voices, stylePresets } = useStudioStore();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [lightboxChar, setLightboxChar] = useState<Character | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // ESC to close lightbox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxChar) {
        console.log('[LIGHTBOX] close via ESC');
        setLightboxChar(null); setZoom(1); setPanX(0); setPanY(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxChar]);

  const closeLightbox = useCallback(() => {
    console.log('[LIGHTBOX] close');
    setLightboxChar(null); setZoom(1); setPanX(0); setPanY(0);
  }, []);

  const openLightbox = useCallback((char: Character) => {
    console.log('[LIGHTBOX] open | image =', char.image_url);
    setLightboxChar(char); setZoom(1); setPanX(0); setPanY(0);
  }, []);
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});
  const { t } = useLanguage();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleGenerateIdentity = async (char: Character) => {
    setGeneratingId(char.id);
    setGenerateErrors(prev => ({ ...prev, [char.id]: '' }));
    try {
      const entry = characterToBibleEntry(char);
      console.log('[REGENERATE] character:', char.name);
      console.log('[REGENERATE] consistency_lock:', char.consistency_lock);
      console.log('[REGENERATE] entry.seed:', entry.seed, '(null = new seed will be generated)');
      console.log('[REGENERATE] entry.reference_image_path:', entry.reference_image_path);
      console.log('[REGENERATE] entry.identityLocked:', entry.identityLocked);
      const result = await generateCharacterImage(entry, undefined,
        char.style_preset_id ? [char.style_preset_id] : []);

      if (result.success && result.referenceImagePath) {
        const u = result.entry;
        // Always normalize to filename — never store full URL
        const filename = normalizeImageFilename(result.referenceImagePath)
          || normalizeImageFilename(u.reference_image_path)
          || result.referenceImagePath;
        console.log('[IMAGE URL RAW]', result.referenceImagePath);
        console.log('[IMAGE URL NORMALIZED]', filename);
        console.log('[IPADAPTER REFERENCE]', u.reference_image_for_ipadapter);
        // Save image but do NOT lock — user must click Use As Identity
        updateCharacter(char.id, {
          image_url: filename,
          consistency_lock: false,   // never auto-lock
          metadata: {
            ...((char.metadata as Record<string, unknown>) || {}),
            reference_image_for_ipadapter: normalizeImageFilename(u.reference_image_for_ipadapter),
            reference_image_path: filename,
            identity_generated_at: new Date().toISOString(),
            identity_locked: false,
            appearance_traits: u.appearance_traits,
            seed: u.seed,
            generation_positive_prompt: u.generation_positive_prompt,
          },
        });
      } else {
        setGenerateErrors(prev => ({ ...prev, [char.id]: result.error || 'Generation failed' }));
      }
    } catch (e: any) {
      setGenerateErrors(prev => ({ ...prev, [char.id]: e.message || 'Error' }));
    } finally {
      setGeneratingId(null);
    }
  };

  const handleLockIdentity = (char: Character) => {
    const meta = (char.metadata as Record<string, unknown>) || {};
    updateCharacter(char.id, {
      consistency_lock: true,
      metadata: { ...meta, identity_locked: true },
    });
  };

  return (
    <>
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.characters.title}</h1>
          <p className="page-subtitle">{t.characters.subtitle}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t.characters.newCharacter}
        </button>
      </div>

      {characters.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-studio-400">{t.characters.noCharacters}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              voice={voices.find((v) => v.id === char.voice_id)}
              onEdit={() => setEditingId(char.id)}
              onToggleLock={() => updateCharacter(char.id, { consistency_lock: !char.consistency_lock })}
              onDelete={() => deleteCharacter(char.id)}
              isGenerating={generatingId === char.id}
              generateError={generateErrors[char.id] || ''}
              onGenerate={() => handleGenerateIdentity(char)}
              onLockIdentity={() => handleLockIdentity(char)}
              onOpenLightbox={() => char.image_url && openLightbox(char)}
              onLoraUpdate={(updates) => {
                const current = char.lora ?? { status: 'none', filename: null, trigger_word: null, weight: 0.8 };
                updateCharacter(char.id, { lora: { ...current, ...updates } });
              }}
            />
          ))}
        </div>
      )}

            {(showCreate || editingId) && (
        <CharacterModal
          character={editingId ? characters.find((c) => c.id === editingId) : undefined}
          voices={voices}
          stylePresets={stylePresets}
          onSave={(data) => {
            if (editingId) {
              updateCharacter(editingId, data);
            } else {
              addCharacter({
                ...data,
                id: crypto.randomUUID(),
                reference_images: [],
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as Character);
            }
            setShowCreate(false);
            setEditingId(null);
          }}
          onClose={() => { setShowCreate(false); setEditingId(null); }}
        />
      )}
    </div>

    {/* LIGHTBOX — rendered via portal to avoid z-index and overflow issues */}
    {lightboxChar && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.92)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        onClick={closeLightbox}
      >
        <div
          style={{ width: '100%', maxWidth: '900px', position: 'relative' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <p style={{ color: 'white', fontWeight: 600, margin: 0 }}>{lightboxChar.name}</p>
              <p style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', margin: 0 }}>
                {normalizeImageFilename(lightboxChar.image_url)}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Zoom */}
              <button onClick={() => { const z = Math.max(0.5, zoom - 0.25); setZoom(z); console.log('[LIGHTBOX] zoom=', z); }}
                disabled={zoom <= 0.5}
                style={{ padding: '4px 10px', background: '#333', color: 'white',
                  border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>−</button>
              <span style={{ color: '#aaa', fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => { const z = Math.min(4, zoom + 0.25); setZoom(z); console.log('[LIGHTBOX] zoom=', z); }}
                disabled={zoom >= 4}
                style={{ padding: '4px 10px', background: '#333', color: 'white',
                  border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>+</button>
              <button onClick={() => { setZoom(1); console.log('[LIGHTBOX] zoom= 1'); }}
                style={{ padding: '4px 8px', background: 'transparent', color: '#888',
                  border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>1:1</button>
              {/* Download */}
              <a href={buildMediaUrl(lightboxChar.image_url) ?? '#'}
                download={lightboxChar.name + '.png'}
                style={{ padding: '4px 10px', background: '#333', color: 'white',
                  border: '1px solid #555', borderRadius: '6px', textDecoration: 'none',
                  fontSize: '12px' }}>
                ⬇ Download
              </a>
              {/* Use As Identity */}
              {!lightboxChar.consistency_lock && (
                <button
                  onClick={() => { handleLockIdentity(lightboxChar); closeLightbox(); }}
                  style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.15)',
                    color: '#34d399', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >✓ Use As Identity</button>
              )}
              {/* Close */}
              <button onClick={closeLightbox}
                style={{ padding: '4px 10px', background: 'transparent', color: '#aaa',
                  border: '1px solid #555', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '16px' }}>✕</button>
            </div>
          </div>
          {/* Image — scrollable when zoomed */}
          <div style={{ overflow: 'auto', maxHeight: '82vh', borderRadius: '8px',
            background: 'rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <img
              src={buildMediaUrl(lightboxChar.image_url) ?? ''}
              alt={lightboxChar.name}
              style={{ width: zoom === 1 ? '100%' : `${zoom * 100}%`,
                maxWidth: zoom === 1 ? '100%' : 'none',
                display: 'block', transition: 'width 0.15s ease' }}
            />
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

function CharacterCard({
  character,
  voice,
  onEdit,
  onToggleLock,
  onDelete,
  isGenerating = false,
  generateError = '',
  onGenerate,
  onLockIdentity,
  onOpenLightbox,
  onLoraUpdate,
}: {
  character: Character;
  voice?: { name: string; language: string };
  onEdit: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  isGenerating?: boolean;
  generateError?: string;
  onGenerate?: () => void;
  onLockIdentity?: () => void;
  onOpenLightbox?: () => void;
  onLoraUpdate?: (updates: { filename?: string|null; trigger_word?: string|null; weight?: number; status?: 'none'|'active' }) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="card-hover group">
      <div className="flex items-start gap-4">
        <div
          onClick={() => character.image_url && onOpenLightbox?.()}
          className="w-16 h-16 rounded-xl bg-studio-800 overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-accent-500 transition-all"
          title={character.image_url ? 'Click to view' : ''}
        >
          {character.image_url ? (
            <img src={buildMediaUrl(character.image_url) ?? ''}
              alt={character.name} className="w-full h-full object-cover"
              onError={e => { console.warn('[IMAGE RENDER] 404 for:', character.image_url); }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-studio-600 text-xl font-bold">
              {character.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white truncate">{character.name}</h3>
            <button onClick={onToggleLock} className="text-studio-500 hover:text-studio-300 transition-colors" title={t.characters.consistencyLock}>
              {character.consistency_lock ? (
                <Lock className="w-3.5 h-3.5 text-accent-500" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <p className="text-sm text-studio-400 mt-0.5 line-clamp-2">{character.description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {character.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-surface text-studio-400">
            <Tag className="w-3 h-3" />
            {tag}
          </span>
        ))}
      </div>

      {character.emotions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-studio-500 mb-1">{t.characters.emotions}</p>
          <div className="flex flex-wrap gap-1">
            {character.emotions.map((emo) => (
              <span key={emo} className="px-2 py-0.5 text-xs rounded bg-studio-800 text-studio-300">{emo}</span>
            ))}
          </div>
        </div>
      )}

      {character.outfits.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-studio-500 mb-1">{t.characters.outfits}</p>
          <div className="flex flex-wrap gap-1">
            {character.outfits.map((outfit) => (
              <span key={outfit.id} className="px-2 py-0.5 text-xs rounded bg-blue-900/20 text-blue-400 border border-blue-700/30">
                {outfit.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center flex-wrap gap-3">
        {voice && (
          <div className="flex items-center gap-1.5 text-xs text-studio-400">
            <Mic2 className="w-3 h-3 text-accent-500" />
            {voice.name} ({voice.language})
          </div>
        )}
        {character.style_preset_id && (
          <div className="flex items-center gap-1.5 text-xs text-studio-400">
            <Palette className="w-3 h-3 text-blue-400" />
            Style assigned
          </div>
        )}
        {character.reference_images.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-studio-400">
            <Image className="w-3 h-3" />
            {character.reference_images.length} refs
          </div>
        )}
      </div>

      {character.consistency_lock && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(character.consistency_settings).filter(([, v]) => v).map(([key]) => (
            <span key={key} className="px-1.5 py-0.5 text-[10px] rounded bg-accent-900/20 text-accent-400 border border-accent-700/20">
              {key.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Identity status */}
      <div className="mt-3 flex items-center gap-2 min-h-[20px]">
        {isGenerating ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating identity...
          </span>
        ) : character.image_url ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {character.consistency_lock ? 'Identity Locked' : 'Identity Ready'}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" /> No Identity Image
          </span>
        )}
        {generateError && (
          <span className="text-xs text-red-400 truncate ml-2" title={generateError}>
            {generateError.slice(0, 35)}
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="mt-3 pt-3 border-t border-surface-border flex flex-wrap items-center gap-2">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg
            bg-accent-600/15 text-accent-400 border border-accent-700/30
            hover:bg-accent-600/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />
          }
          {isGenerating ? 'Generating...' : character.image_url ? 'Regenerate' : 'Generate'}
        </button>
        {character.image_url && !character.consistency_lock && (
          <button
            onClick={onLockIdentity}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg
              bg-emerald-900/20 text-emerald-400 border border-emerald-700/30
              hover:bg-emerald-900/30 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Use As Identity
          </button>
        )}
        {character.consistency_lock && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
        <div className="flex-1" />
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-surface-lighter text-studio-400 hover:text-white transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

      {/* LoRA Config */}
      <div className="mt-2 pt-2 border-t border-studio-800/40 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-studio-600">⚡ LoRA</span>
          {character.lora?.status === 'active' && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-900/30
              text-purple-400 border border-purple-700/30">
              {character.lora.trigger_word ?? character.lora.filename}
            </span>
          )}
        </div>
        <input className="input text-xs py-1 w-full" placeholder="filename.safetensors"
          defaultValue={character.lora?.filename ?? ''}
          onBlur={e => onLoraUpdate?.({ filename: e.target.value.trim() || null })} />
        <input className="input text-xs py-1 w-full" placeholder="trigger word"
          defaultValue={character.lora?.trigger_word ?? ''}
          onBlur={e => onLoraUpdate?.({ trigger_word: e.target.value.trim() || null })} />
        <div className="flex gap-2 items-center">
          <input type="number" min={0.1} max={1.5} step={0.05}
            className="input text-xs py-1 w-20" placeholder="weight"
            defaultValue={character.lora?.weight ?? 0.8}
            onBlur={e => onLoraUpdate?.({ weight: Number(e.target.value) })} />
          <button
            onClick={() => onLoraUpdate?.({ status: character.lora?.status === 'active' ? 'none' : 'active' })}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
              character.lora?.status === 'active'
                ? 'bg-purple-900/30 text-purple-400 border-purple-700/30'
                : 'text-studio-500 border-studio-700 hover:text-purple-400 hover:border-purple-700/50'
            }`}>
            {character.lora?.status === 'active' ? '⚡ Active' : 'Enable LoRA'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

function CharacterModal({
  character,
  voices,
  stylePresets,
  onSave,
  onClose,
}: {
  character?: Character;
  voices: { id: string; name: string; language: string }[];
  stylePresets: { id: string; name: string }[];
  onSave: (data: Partial<Character>) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(character?.name ?? '');
  const [description, setDescription] = useState(character?.description ?? '');
  const [tags, setTags] = useState(character?.tags.join(', ') ?? '');
  const [emotions, setEmotions] = useState(character?.emotions.join(', ') ?? '');
  const [imageUrl, setImageUrl] = useState(character?.image_url ?? '');
  const [voiceId, setVoiceId] = useState(character?.voice_id ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stylePresetId, setStylePresetId] = useState(character?.style_preset_id ?? '');
  const [personalityNotes, setPersonalityNotes] = useState(character?.personality_notes ?? '');
  const [cinematicNotes, setCinematicNotes] = useState(character?.cinematic_notes ?? '');
  const [consistencySettings, setConsistencySettings] = useState<ConsistencySettings>(
    character?.consistency_settings ?? { face: true, hairstyle: true, eye_color: true, clothing: false, body_proportions: true, animation_style: false, color_palette: false }
  );
  const [outfits, setOutfits] = useState<Outfit[]>(character?.outfits ?? []);
  const [newOutfitName, setNewOutfitName] = useState('');
  const [newOutfitDesc, setNewOutfitDesc] = useState('');

  const addOutfit = () => {
    if (!newOutfitName.trim()) return;
    setOutfits([...outfits, { id: crypto.randomUUID(), name: newOutfitName, description: newOutfitDesc, image_url: null }]);
    setNewOutfitName('');
    setNewOutfitDesc('');
  };

  const toggleConsistency = (key: keyof ConsistencySettings) => {
    setConsistencySettings({ ...consistencySettings, [key]: !consistencySettings[key] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      image_url: imageUrl || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      emotions: emotions.split(',').map((e) => e.trim()).filter(Boolean),
      outfits,
      consistency_lock: Object.values(consistencySettings).some(Boolean),
      consistency_settings: consistencySettings,
      voice_id: voiceId || null,
      style_preset_id: stylePresetId || null,
      personality_notes: personalityNotes,
      cinematic_notes: cinematicNotes,
      reference_images: character?.reference_images ?? [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            {character ? t.characters.editCharacter : t.characters.newCharacter}
          </h2>
          <button onClick={onClose} className="p-1 text-studio-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t.common.name}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">{t.characters.imageUrl}</label>
              <div className="flex gap-2">
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input flex-1" placeholder="https://..." />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const localPath = `assets/characters/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
                      setImageUrl(localPath);
                    }
                  }}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary whitespace-nowrap px-3">Upload</button>
              </div>
              {imageUrl && (
                <div className="mt-2 w-20 h-20 rounded-lg bg-studio-800 overflow-hidden">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
            <div>
              <label className="label">Voice</label>
              <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="input">
                <option value="">--</option>
                {voicePresets.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t.common.description}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-[80px] resize-y" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t.characters.tags} (comma-separated)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="hero, warrior, sci-fi" />
            </div>
            <div>
              <label className="label">{t.characters.emotions} (comma-separated)</label>
              <input value={emotions} onChange={(e) => setEmotions(e.target.value)} className="input" placeholder="happy, sad, angry" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t.characters.voice}</label>
              <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="input">
                <option value="">--</option>
                {voices.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.language})</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.characters.cinematicStyle}</label>
              <select value={stylePresetId} onChange={(e) => setStylePresetId(e.target.value)} className="input">
                <option value="">--</option>
                {cinematicPresets.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                {stylePresets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t.characters.personality}</label>
              <textarea value={personalityNotes} onChange={(e) => setPersonalityNotes(e.target.value)} className="input min-h-[60px] resize-y text-sm" placeholder="Character personality..." />
            </div>
            <div>
              <label className="label">Cinematic Notes</label>
              <textarea value={cinematicNotes} onChange={(e) => setCinematicNotes(e.target.value)} className="input min-h-[60px] resize-y text-sm" placeholder="Camera, lighting preferences..." />
            </div>
          </div>

          <div className="border-t border-surface-border pt-4">
            <label className="label mb-3">{t.characters.consistencyLock}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(consistencySettings) as (keyof ConsistencySettings)[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleConsistency(key)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                    consistencySettings[key]
                      ? 'bg-accent-600/15 text-accent-400 border-accent-700/30'
                      : 'bg-surface text-studio-400 border-surface-border hover:border-studio-600'
                  }`}
                >
                  {key.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-surface-border pt-4">
            <label className="label mb-3">{t.characters.outfits}</label>
            {outfits.length > 0 && (
              <div className="space-y-2 mb-3">
                {outfits.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface">
                    <span className="text-sm text-white flex-1">{o.name} - <span className="text-studio-400">{o.description}</span></span>
                    <button type="button" onClick={() => setOutfits(outfits.filter((_, idx) => idx !== i))} className="text-studio-500 hover:text-danger-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={newOutfitName} onChange={(e) => setNewOutfitName(e.target.value)} className="input flex-1" placeholder={t.characters.outfitName} />
              <input value={newOutfitDesc} onChange={(e) => setNewOutfitDesc(e.target.value)} className="input flex-1" placeholder={t.characters.outfitDescription} />
              <button type="button" onClick={addOutfit} className="btn-secondary whitespace-nowrap">{t.characters.addOutfit}</button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t.common.cancel}</button>
            <button type="submit" className="btn-primary">
              {character ? t.common.save : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
