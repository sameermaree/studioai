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
}: {
  episodeId: string;
  sceneCount: number;
  characters: { id: string; name: string }[];
  onSave: (scene: Scene) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cameraAngle, setCameraAngle] = useState('');
  const [duration, setDuration] = useState('5');
  const [narration, setNarration] = useState('');
  const [selectedChars, setSelectedChars] = useState<string[]>([]);

  const toggleChar = (id: string) => {
    setSelectedChars((previous) =>
      previous.includes(id)
        ? previous.filter((characterId) => characterId !== id)
        : [...previous, id]
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    onSave({
      id: crypto.randomUUID(),
      episode_id: episodeId,
      order: sceneCount + 1,
      title,
      prompt_id: null,
      prompt_text: cameraAngle ? `${cameraAngle}, ${promptText}` : promptText,
      negative_prompt: negativePrompt,
      camera_angle: cameraAngle,
      motion_instructions: '',
      characters: selectedChars,
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
      image_references: [],
      video_references: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
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
                  <option key={angle} value={angle}>
                    {angle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">{t.scenes.prompt}</label>
            <textarea
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              className="input min-h-[80px] resize-y font-mono text-sm"
              required
            />
          </div>

          <div>
            <label className="label">{t.scenes.negativePrompt}</label>
            <input
              value={negativePrompt}
              onChange={(event) => setNegativePrompt(event.target.value)}
              className="input text-sm"
            />
          </div>

          <div>
            <label className="label">{t.scenes.narration}</label>
            <textarea
              value={narration}
              onChange={(event) => setNarration(event.target.value)}
              className="input min-h-[60px] resize-y text-sm"
              placeholder={t.workflow.sceneEditor.narrationPlaceholder}
            />
          </div>

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
                    onClick={() => toggleChar(character.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      selectedChars.includes(character.id)
                        ? 'bg-accent-600/20 text-accent-400 border-accent-700/30'
                        : 'bg-surface text-studio-400 border-surface-border hover:border-studio-600'
                    }`}
                  >
                    {character.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

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
