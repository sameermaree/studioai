import { useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { CAMERA_ANGLES } from '../../lib/constants';
import type { Scene } from '../../types';

export function CreateSceneModal({
  episodeId,
  sceneCount,
  characters,
  onSave,
  onClose,
  defaultManualMode = false,
}: {
  episodeId: string;
  sceneCount: number;
  characters: { id: string; name: string }[];
  onSave: (scene: Scene) => void;
  onClose: () => void;
  defaultManualMode?: boolean;
}) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cameraAngle, setCameraAngle] = useState('');
  const [duration, setDuration] = useState('5');
  const [narration, setNarration] = useState('');
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [manualMode, setManualMode] = useState(defaultManualMode);
  const [imagePrompt, setImagePrompt] = useState('');
  const [identityMode, setIdentityMode] = useState<'normal' | 'strong'>('normal');

  const toggleChar = (id: string, name: string) => {
    console.log('[CREATE SCENE MODAL] clicked character:', name, '|', id);
    setSelectedChars((previous) => {
      const next = previous.includes(id)
        ? previous.filter((characterId) => characterId !== id)
        : [...previous, id];
      console.log('[CREATE SCENE MODAL] selectedChars after click:', next);
      return next;
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    console.log('[CREATE SCENE MODAL] submit clicked');
    console.log('[CREATE SCENE MODAL] manualDebug:', manualMode);
    console.log('[CREATE SCENE MODAL] imagePrompt:', imagePrompt.slice(0, 120));
    console.log('[CREATE SCENE MODAL] available characters:', characters.map(c => `${c.name}:${c.id}`));
    console.log('[CREATE SCENE MODAL] selectedChars before fallback:', selectedChars);

    const finalCharacters =
      selectedChars.length > 0
        ? selectedChars
        : characters.length === 1
          ? [characters[0].id]
          : [];
    console.log('[CREATE SCENE MODAL] finalCharacters after fallback:', finalCharacters);

    const scenePayload: Scene = {
      id: crypto.randomUUID(),
      episode_id: episodeId,
      order: sceneCount + 1,
      title,
      prompt_id: manualMode ? `manual-debug:${identityMode}` : null,
      prompt_text: manualMode && imagePrompt.trim()
        ? imagePrompt.trim()
        : (cameraAngle ? `${cameraAngle}, ${promptText}` : promptText),
      negative_prompt: negativePrompt,
      camera_angle: cameraAngle,
      motion_instructions: '',
      characters: finalCharacters,
      style_preset_id: null,
      voice_id: null,
      music_url: null,
      sound_effects: '',
      narration,
      subtitle_text: narration,
      subtitles: [],
      duration: parseInt(duration) || 5,
      seed: null,
      render_status: 'pending',
      render_url: null,
      character_outfits: {},
      image_references: [],
      video_references: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[CREATE SCENE MODAL] scene payload:', JSON.stringify({
      id: scenePayload.id,
      title: scenePayload.title,
      prompt_id: scenePayload.prompt_id,
      prompt_text: scenePayload.prompt_text?.slice(0, 100),
      camera_angle: scenePayload.camera_angle,
      characters: scenePayload.characters,
    }));
    console.log('[CREATE SCENE MODAL] scene payload characters:', scenePayload.characters);
    console.log('[CREATE SCENE MODAL] onCreate called:', scenePayload.title);
    onSave(scenePayload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            {t.episodes.addScene}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-studio-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Title + Camera */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.episodes.sceneTitle}</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">{t.scenes.cameraAngle}</label>
              <select
                value={cameraAngle}
                onChange={(event) => setCameraAngle(event.target.value)}
                className="input"
              >
                <option value="">--</option>
                {CAMERA_ANGLES.map((angle) => (
                  <option key={angle} value={angle}>{angle}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Scene prompt */}
          <div>
            <label className="label">{t.scenes.prompt}</label>
            <textarea
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              className="input min-h-[80px] resize-y font-mono text-sm"
              required={!manualMode}
            />
          </div>

          {/* Negative prompt */}
          <div>
            <label className="label">{t.scenes.negativePrompt}</label>
            <input
              value={negativePrompt}
              onChange={(event) => setNegativePrompt(event.target.value)}
              className="input text-sm"
            />
          </div>

          {/* Narration */}
          <div>
            <label className="label">{t.scenes.narration}</label>
            <textarea
              value={narration}
              onChange={(event) => setNarration(event.target.value)}
              className="input min-h-[60px] resize-y text-sm"
              placeholder={t.workflow.sceneEditor.narrationPlaceholder}
            />
          </div>

          {/* Manual Debug Mode toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <input
              type="checkbox"
              id="manualMode"
              checked={manualMode}
              onChange={(e) => setManualMode(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <label htmlFor="manualMode" className="text-sm text-amber-400 font-medium cursor-pointer">
              🧪 Manual Debug Mode — bypass ScenePromptComposer, use imagePrompt verbatim
            </label>
          </div>

          {/* Manual debug fields — wrapped in fragment to avoid JSX root error */}
          {manualMode && (
            <>
              <div>
                <label className="label text-amber-400">Image Prompt (sent verbatim to ComfyUI)</label>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="input min-h-[100px] resize-y font-mono text-xs border-amber-500/30"
                  placeholder="Enter the exact positive prompt to send to ComfyUI..."
                  required={manualMode}
                />
                <p className="text-xs text-studio-500 mt-1">
                  No LLM, no story, no ScenePromptComposer. This prompt goes directly to the image generation pipeline.
                </p>
              </div>

              <div>
                <label className="label text-amber-400">Identity Mode</label>
                <div className="flex gap-3 mt-1">
                  {(['normal', 'strong'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdentityMode(mode); }}
                      className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${
                        identityMode === mode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-studio-900 text-studio-400 border-studio-600 hover:border-amber-500/30'
                      }`}
                    >
                      {mode === 'normal' ? '🎬 Normal (IPAdapter)' : '🔒 Strong (VAEEncode)'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-studio-500 mt-1">
                  Strong: forces pixar_disney_scene_strong_identity.json regardless of camera angle.
                </p>
              </div>
            </>
          )}

          {/* Duration + Characters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.scenes.duration}</label>
              <input
                type="number"
                min="1"
                max="120"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">{t.scenes.characters}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {characters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleChar(character.id, character.name); }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      selectedChars.includes(character.id)
                        ? 'bg-accent-600/20 text-accent-400 border-accent-700/30'
                        : 'bg-surface text-studio-400 border-surface-border hover:border-studio-600'
                    }`}
                  >
                    {selectedChars.includes(character.id) ? '✓ ' : ''}{character.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              {t.common.cancel}
            </button>
            <button type="submit" className="btn-primary">
              {t.common.create}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
