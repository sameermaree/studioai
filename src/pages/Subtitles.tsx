import { useState } from 'react';
import { Plus, Download, Clock, Type, Trash2, Languages, FileText } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { exportSRT, exportVTT, generateSubtitlesFromNarration } from '../services/subtitles';
import { LANGUAGES } from '../lib/constants';
import type { SubtitleEntry, SubtitleTrack, Language as LangType } from '../types';

export function Subtitles() {
  const { episodes, subtitleTracks, addSubtitleTrack, updateSubtitleTrack, deleteSubtitleTrack } = useStudioStore();
  const { t } = useLanguage();
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const activeTrack = subtitleTracks.find((tr) => tr.id === selectedTrack);

  const handleExport = (track: SubtitleTrack) => {
    const content = track.format === 'srt'
      ? exportSRT(track.entries)
      : exportVTT(track.entries);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitle-${track.language}.${track.format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.subtitlesPage.title}</h1>
          <p className="page-subtitle">{t.subtitlesPage.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGenerate(true)} className="btn-secondary flex items-center gap-2">
            <Languages className="w-4 h-4" />
            {t.subtitlesPage.generate}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t.subtitlesPage.newTrack}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {subtitleTracks.length === 0 && (
            <div className="card text-center py-12">
              <Type className="w-10 h-10 text-studio-700 mx-auto mb-3" />
              <p className="text-sm text-studio-400">{t.subtitlesPage.noTracks}</p>
            </div>
          )}
          {subtitleTracks.map((track) => {
            const ep = episodes.find((e) => e.id === track.episode_id);
            return (
              <button
                key={track.id}
                onClick={() => setSelectedTrack(track.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedTrack === track.id
                    ? 'bg-surface-lighter border-accent-600/40'
                    : 'bg-surface-light border-surface-border hover:border-studio-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-studio-400" />
                    <div>
                      <p className="text-sm font-medium text-white">{ep?.title || t.subtitlesPage.standalone} - {track.language.toUpperCase()}</p>
                      <p className="text-xs text-studio-400 mt-0.5">{track.format.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-accent text-[10px]">{track.language.toUpperCase()}</span>
                    <span className="text-xs text-studio-500">{track.entries.length} {t.subtitlesPage.entries}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {activeTrack ? (
            <SubtitleEditor
              track={activeTrack}
              onUpdate={(entries) => updateSubtitleTrack(activeTrack.id, { entries })}
              onExport={() => handleExport(activeTrack)}
              onFormatChange={(format) => updateSubtitleTrack(activeTrack.id, { format })}
              onDelete={() => {
                deleteSubtitleTrack(activeTrack.id);
                setSelectedTrack(null);
              }}
            />
          ) : (
            <div className="card h-full flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <Type className="w-12 h-12 text-studio-700 mx-auto mb-3" />
                <p className="text-studio-400">{t.subtitlesPage.selectTrack}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showGenerate && (
        <GenerateModal
          episodes={episodes}
          onGenerate={(episodeId, language) => {
            const ep = episodes.find((e) => e.id === episodeId);
            if (!ep) return;
            const allEntries: SubtitleEntry[] = [];
            let timeOffset = 0;
            ep.scenes.forEach((scene) => {
              const entries = generateSubtitlesFromNarration(scene.subtitle_text || scene.narration, scene.duration);
              entries.forEach((e) => {
                allEntries.push({ ...e, start_time: e.start_time + timeOffset, end_time: e.end_time + timeOffset, index: allEntries.length + 1 });
              });
              timeOffset += scene.duration;
            });
            addSubtitleTrack({
              id: crypto.randomUUID(),
              scene_id: null,
              episode_id: episodeId,
              language,
              entries: allEntries,
              format: 'srt',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            setShowGenerate(false);
          }}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {showCreate && (
        <CreateTrackModal
          episodes={episodes}
          onSave={(track) => {
            addSubtitleTrack(track);
            setShowCreate(false);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function SubtitleEditor({
  track,
  onUpdate,
  onExport,
  onFormatChange,
  onDelete,
}: {
  track: SubtitleTrack;
  onUpdate: (entries: SubtitleEntry[]) => void;
  onExport: () => void;
  onFormatChange: (format: 'srt' | 'vtt') => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const updateEntry = (id: string, updates: Partial<SubtitleEntry>) => {
    onUpdate(track.entries.map((e) => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteEntry = (id: string) => {
    onUpdate(track.entries.filter((e) => e.id !== id).map((e, i) => ({ ...e, index: i + 1 })));
  };

  const addEntry = () => {
    const lastEntry = track.entries[track.entries.length - 1];
    const startTime = lastEntry ? lastEntry.end_time + 0.5 : 0;
    onUpdate([...track.entries, {
      id: crypto.randomUUID(),
      index: track.entries.length + 1,
      start_time: startTime,
      end_time: startTime + 3,
      text: '',
    }]);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">{track.language.toUpperCase()} {t.subtitlesPage.track}</h3>
          <span className="badge-accent">{track.language.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={track.format}
            onChange={(e) => onFormatChange(e.target.value as 'srt' | 'vtt')}
            className="input text-xs py-1 w-auto"
          >
            <option value="srt">SRT</option>
            <option value="vtt">VTT</option>
          </select>
          <button onClick={onExport} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" />
            {t.subtitlesPage.export}
          </button>
          <button onClick={onDelete} className="btn-danger text-xs py-1.5 flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {track.entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-surface-border group">
            <span className="text-xs text-studio-500 font-mono w-6 pt-2 shrink-0">{entry.index}</span>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-studio-500" />
                  <input
                    type="number"
                    step="0.1"
                    value={entry.start_time}
                    onChange={(e) => updateEntry(entry.id, { start_time: parseFloat(e.target.value) || 0 })}
                    className="input text-xs py-1 w-20 text-center"
                  />
                  <span className="text-xs text-studio-500">-</span>
                  <input
                    type="number"
                    step="0.1"
                    value={entry.end_time}
                    onChange={(e) => updateEntry(entry.id, { end_time: parseFloat(e.target.value) || 0 })}
                    className="input text-xs py-1 w-20 text-center"
                  />
                </div>
                <span className="text-[10px] text-studio-500">{(entry.end_time - entry.start_time).toFixed(1)}s</span>
              </div>
              <input
                value={entry.text}
                onChange={(e) => updateEntry(entry.id, { text: e.target.value })}
                className="input text-sm py-1.5"
                placeholder={t.subtitlesPage.subtitlePlaceholder}
                dir={track.language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
            <button
              onClick={() => deleteEntry(entry.id)}
              className="p-1 text-studio-500 hover:text-danger-400 opacity-0 group-hover:opacity-100 transition-all mt-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addEntry} className="mt-3 w-full py-2 border border-dashed border-surface-border rounded-lg text-sm text-studio-400 hover:text-accent-400 hover:border-accent-600/40 transition-colors">
        {t.subtitlesPage.addEntry}
      </button>
    </div>
  );
}

function GenerateModal({
  episodes,
  onGenerate,
  onClose,
}: {
  episodes: { id: string; title: string; scenes: { subtitle_text: string; narration: string; duration: number }[] }[];
  onGenerate: (episodeId: string, language: LangType) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [episodeId, setEpisodeId] = useState('');
  const [language, setLanguage] = useState<LangType>('en');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md animate-slide-up">
        <h2 className="text-lg font-semibold text-white mb-4">{t.subtitlesPage.generateTitle}</h2>
        <div className="space-y-4">
          <div>
            <label className="label">{t.subtitlesPage.episode}</label>
            <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} className="input">
              <option value="">{t.subtitlesPage.selectEpisode}</option>
              {episodes.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.common.language}</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as LangType)} className="input">
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">{t.common.cancel}</button>
            <button onClick={() => episodeId && onGenerate(episodeId, language)} className="btn-primary" disabled={!episodeId}>
              {t.subtitlesPage.generate}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTrackModal({
  episodes,
  onSave,
  onClose,
}: {
  episodes: { id: string; title: string }[];
  onSave: (track: SubtitleTrack) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [episodeId, setEpisodeId] = useState('');
  const [language, setLanguage] = useState<LangType>('en');
  const [format, setFormat] = useState<'srt' | 'vtt'>('srt');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: crypto.randomUUID(),
      scene_id: null,
      episode_id: episodeId || null,
      language,
      entries: [],
      format,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md animate-slide-up">
        <h2 className="text-lg font-semibold text-white mb-4">{t.subtitlesPage.newTrackTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t.subtitlesPage.episodeOptional}</label>
            <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} className="input">
              <option value="">{t.subtitlesPage.standaloneTrack}</option>
              {episodes.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.common.language}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value as LangType)} className="input">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.subtitlesPage.format}</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as 'srt' | 'vtt')} className="input">
                <option value="srt">SRT</option>
                <option value="vtt">VTT</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">{t.common.cancel}</button>
            <button type="submit" className="btn-primary">{t.common.create}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
