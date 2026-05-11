import { useState } from 'react';
import { Plus, Lock, Unlock, Tag, Trash2, CreditCard as Edit2, X, Image, Mic2, Palette } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import type { Character, Outfit, ConsistencySettings } from '../types';

export function Characters() {
  const { characters, addCharacter, updateCharacter, deleteCharacter, voices, stylePresets } = useStudioStore();
  const { t } = useLanguage();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
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
  );
}

function CharacterCard({
  character,
  voice,
  onEdit,
  onToggleLock,
  onDelete,
}: {
  character: Character;
  voice?: { name: string; language: string };
  onEdit: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="card-hover group">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-xl bg-studio-800 overflow-hidden shrink-0">
          {character.image_url ? (
            <img src={character.image_url} alt={character.name} className="w-full h-full object-cover" />
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

      <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-surface-lighter text-studio-400 hover:text-white transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
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
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" placeholder="https://..." />
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
