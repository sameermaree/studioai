/**
 * EpisodeWorkspace.tsx
 * Route: /workspace/:episodeId
 * The main production hub for a single episode.
 * Tabs: Overview | Scenes | Timeline | Audio | Export
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, LayoutGrid, Layers, Film, Volume2, Download,
  Plus, Image, RefreshCw, Loader2, X, Save, Camera,
  Users, FileText, Trash2, ChevronRight, Play,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useRenderQueueStore } from '../store/useRenderQueueStore';
import { useTimelineStore } from '../store/useTimelineStore';
import { WorkflowStateBadge } from '../components/shared/WorkflowStateBadge';
import { SceneTrack } from '../components/timeline/SceneTrack';
import { ExportPanel } from '../components/dashboard/ExportPanel';
import { AudioTabContent } from '../components/timeline/AudioTabContent';
import { AudioTrack } from '../components/timeline/AudioTrack';
import { speakText } from '../services/sceneAudioService';
import { PreviewPanel } from '../components/timeline/PreviewPanel';
import { computeEpisodeWorkflowState, computeEpisodeStats } from '../lib/computeEpisodeState';
import { buildComfyUrl } from '../lib/buildMediaUrl';
import { ScenePromptInspector } from '../components/scene/ScenePromptInspector';
import type { Scene } from '../types';

type Tab = 'overview' | 'scenes' | 'timeline' | 'audio' | 'export';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: LayoutGrid },
  { id: 'scenes',    label: 'Scenes',    icon: Layers },
  { id: 'timeline',  label: 'Timeline',  icon: Film },
  { id: 'audio',     label: 'Audio',     icon: Volume2 },
  { id: 'export',    label: 'Export',    icon: Download },
];

export function EpisodeWorkspace() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('scenes');
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Scene>>({});


  const { episodes, characters, updateEpisode, updateSceneDuration, updateSceneAudio } = useStudioStore();
  const productionJobs = useRenderQueueStore((s) => s.jobs);
  const { openEpisode } = useTimelineStore();

  const episode = episodes.find((e) => e.id === episodeId);

  useEffect(() => {
    if (episode && activeTab === 'timeline') {
      openEpisode(episode.id, episode.scenes);
    }
  }, [activeTab, episode?.id]);

  if (!episode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-studio-400 mb-3">Episode not found.</p>
          <button onClick={() => navigate('/')} className="btn-secondary text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const workflowState = computeEpisodeWorkflowState(episode, productionJobs);
  const stats = computeEpisodeStats(episode, productionJobs);
  const sortedScenes = [...episode.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── Scene Edit Panel ──────────────────────────────────────────────
  const openEditPanel = (scene: Scene) => {
    setEditingScene(scene);
    setEditDraft({ title: scene.title, narration: scene.narration, camera_angle: scene.camera_angle, duration: scene.duration });
  };

  const closeEditPanel = () => { setEditingScene(null); setEditDraft({}); };

  const saveEdit = () => {
    if (!editingScene) return;
    const updatedScenes = episode.scenes.map((s) =>
      s.id === editingScene.id ? { ...s, ...editDraft, updated_at: new Date().toISOString() } : s
    );
    updateEpisode(episode.id, { scenes: updatedScenes });
    closeEditPanel();
  };

  return (
    <>
    <div className="flex flex-col h-full -m-6 overflow-hidden">

      {/* ── Workspace Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-studio-800 bg-studio-950 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-studio-500 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{episode.title}</h1>
        </div>

        <WorkflowStateBadge state={workflowState} size="sm" />

        <span className="text-xs text-studio-600 hidden sm:block">
          {stats.scenes_with_image}/{stats.total_scenes} images
        </span>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────── */}
      <div className="flex border-b border-studio-800 bg-studio-950 shrink-0 px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-accent-500 text-accent-400'
                : 'border-transparent text-studio-500 hover:text-studio-300'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="max-w-2xl mx-auto p-6 space-y-6">
              <div className="card space-y-4">
                <h2 className="text-sm font-semibold text-white">Episode Info</h2>
                <div>
                  <label className="label text-xs">Title</label>
                  <input
                    className="input text-sm"
                    defaultValue={episode.title}
                    onBlur={(e) => updateEpisode(episode.id, { title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label text-xs">Description</label>
                  <textarea
                    className="input text-sm min-h-[80px] resize-none"
                    defaultValue={episode.description}
                    onBlur={(e) => updateEpisode(episode.id, { description: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Scenes', value: stats.total_scenes },
                  { label: 'Images', value: `${stats.scenes_with_image}/${stats.total_scenes}` },
                  { label: 'Audio', value: `${stats.scenes_with_audio}/${stats.total_scenes}` },
                ].map((s) => (
                  <div key={s.label} className="card text-center py-4">
                    <p className="text-2xl font-bold text-white">{s.value}</p>
                    <p className="text-xs text-studio-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setActiveTab('scenes')} className="btn-primary flex-1 text-sm">
                  Go to Scenes →
                </button>
                <button onClick={() => setActiveTab('timeline')} className="btn-secondary flex-1 text-sm">
                  Open Timeline →
                </button>
              </div>
            </div>
          )}

          {/* SCENES */}
          {activeTab === 'scenes' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-studio-400">
                  {sortedScenes.length} scene{sortedScenes.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => navigate('/episodes')}
                  className="flex items-center gap-1.5 text-xs btn-secondary py-1 px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Scene
                </button>
              </div>

              <div className="space-y-2">
                {sortedScenes.map((scene, idx) => {
                  const thumb = buildComfyUrl(scene.render_url);
                  const hasImage = !!scene.render_url;
                  return (
                    <div
                      key={scene.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-studio-900 border border-studio-800
                        hover:border-studio-700 transition-colors group"
                    >
                      {/* Index */}
                      <span className="text-xs text-studio-600 w-5 text-center shrink-0">{idx + 1}</span>

                      {/* Thumbnail */}
                      <div className="w-16 h-10 rounded bg-studio-800 shrink-0 overflow-hidden">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image className="w-4 h-4 text-studio-600" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{scene.title}</p>
                        <p className="text-xs text-studio-500 truncate">
                          {scene.camera_angle || 'No camera'} · {scene.duration ?? 5}s
                        </p>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${hasImage ? 'bg-emerald-500' : 'bg-studio-700'}`}
                          title={hasImage ? 'Image ready' : 'No image'} />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEditPanel(scene)}
                          className="text-xs px-2 py-1 rounded bg-studio-800 text-studio-300
                            hover:bg-studio-700 hover:text-white transition-colors"
                        >
                          Edit
                        </button>
                      </div>

                      <button
                        onClick={() => openEditPanel(scene)}
                        className="shrink-0 text-studio-600 hover:text-studio-300 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {sortedScenes.length === 0 && (
                  <div className="text-center py-12">
                    <Layers className="w-8 h-8 text-studio-700 mx-auto mb-3" />
                    <p className="text-studio-500 text-sm mb-3">No scenes yet.</p>
                    <button
                      onClick={() => navigate('/episodes')}
                      className="btn-primary text-sm"
                    >
                      Add scenes in Episodes →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="flex h-full overflow-hidden">
              {/* Preview */}
              <div className="w-72 shrink-0 flex flex-col">
                <PreviewPanel />
              </div>
              {/* Track */}
              <div className="flex-1 overflow-auto p-4">
                <div className="mb-3 p-2 rounded-lg bg-studio-800/40 border border-studio-700/40
                  text-xs text-studio-500 text-center">
                  ↑↓ to reorder · click duration to edit · click scene for details
                </div>
                <SceneTrack />
              </div>
            </div>
          )}

          {/* AUDIO — Phase 5 */}
          {activeTab === 'audio' && (
            <AudioTabContent
              episode={episode}
              sortedScenes={sortedScenes}
              updateSceneAudio={updateSceneAudio}
            />
          )}

          {/* EXPORT — Phase 4 */}
          {activeTab === 'export' && (
            <ExportPanel episode={episode} />
          )}

        </div>
      </div>

    {/* ── Scene Edit Modal ─────────────────────────────────── */}
    {editingScene && createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9000,
              background: 'rgba(0,0,0,0.75)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={closeEditPanel}
          >
            <div
              style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                background: '#0f1117', borderRadius: '12px',
                border: '1px solid #2a2d3a', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '16px 20px',
                borderBottom: '1px solid #2a2d3a', flexShrink: 0 }}>
                <div>
                  <p style={{ color: 'white', fontWeight: 600, margin: 0 }}>
                    Edit Scene: {editingScene.title}
                  </p>
                  {(editingScene.prompt_id ?? '').startsWith('manual-debug') && (
                    <span style={{ fontSize: '11px', color: '#f59e0b',
                      background: 'rgba(245,158,11,0.1)', padding: '2px 6px',
                      borderRadius: '4px', border: '1px solid rgba(245,158,11,0.3)' }}>
                      🧪 Manual Debug
                    </span>
                  )}
                </div>
                <button onClick={closeEditPanel}
                  style={{ color: '#6b7280', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>✕</button>
              </div>

              {/* Modal body — scrollable */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Left column: scene fields */}
                <div style={{ width: '320px', flexShrink: 0, padding: '20px',
                  borderRight: '1px solid #2a2d3a', overflowY: 'auto', display: 'flex',
                  flexDirection: 'column', gap: '16px' }}>

                  {/* Thumbnail */}
                  {editingScene.render_url && (
                    <div style={{ width: '100%', aspectRatio: '16/9',
                      borderRadius: '8px', overflow: 'hidden', background: '#1a1d2e' }}>
                      <img src={buildComfyUrl(editingScene.render_url) ?? ''}
                        alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  <div>
                    <label className="label text-xs">Title</label>
                    <input className="input text-sm"
                      value={editDraft.title ?? ''}
                      onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))} />
                  </div>

                  <div>
                    <label className="label text-xs">Narration</label>
                    <textarea className="input text-sm resize-none"
                      style={{ minHeight: '100px' }}
                      value={editDraft.narration ?? ''}
                      onChange={e => setEditDraft(d => ({ ...d, narration: e.target.value }))} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="label text-xs">Camera</label>
                      <input className="input text-sm"
                        value={editDraft.camera_angle ?? ''}
                        onChange={e => setEditDraft(d => ({ ...d, camera_angle: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label text-xs">Duration (s)</label>
                      <input type="number" min={1} max={300} className="input text-sm"
                        value={editDraft.duration ?? 5}
                        onChange={e => setEditDraft(d => ({ ...d, duration: Number(e.target.value) }))} />
                    </div>
                  </div>

                  {editingScene.characters.length > 0 && (
                    <div>
                      <label className="label text-xs">Characters</label>
                      <p className="text-xs text-studio-400">
                        {editingScene.characters.length} assigned
                      </p>
                    </div>
                  )}
                </div>

                {/* Right column: Prompt Inspector */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                  <ScenePromptInspector
                    scene={editingScene}
                    characters={characters}
                    onUpdate={(updates) => {
                      // Save to store — always, even if modal closed
                      const sceneId = editingScene.id;
                      updateEpisode(episode.id, {
                        scenes: episode.scenes.map(s =>
                          s.id === sceneId
                            ? { ...s, ...updates, updated_at: new Date().toISOString() }
                            : s
                        ),
                      });
                      // Update local state only if modal still open
                      setEditingScene(prev =>
                        prev && prev.id === sceneId
                          ? { ...prev, ...updates }
                          : prev
                      );
                    }}
                  />
                </div>
              </div>

              {/* Modal footer — always visible */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                gap: '8px', padding: '12px 20px',
                borderTop: '1px solid #2a2d3a', flexShrink: 0,
                background: '#0d1018' }}>
                <button onClick={closeEditPanel}
                  className="btn-secondary text-sm px-4 py-2">
                  Cancel
                </button>
                <button onClick={saveEdit}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
    </>
  );
}
