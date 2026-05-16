import { useState } from 'react';
import { ScenePromptInspector } from '../components/scene/ScenePromptInspector';
import {
  Plus,
  Play,
  Clock,
  Layers,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { generateEpisodeWorkflow } from '../services/workflow';
import { CAMERA_ANGLES } from '../lib/constants';
import type {
  Episode,
  Scene,
  EpisodeStatus,
  EpisodeWorkflowConfig,
} from '../types';
import { EpisodeStatusBadge } from '../components/episode/EpisodeStatusBadge';
import { RenderStatusDot } from '../components/episode/RenderStatusDot';
import { CreateSceneModal } from '../components/scene/CreateSceneModal';
import { EpisodeWorkflowModal } from '../features/episodes/components/EpisodeWorkflowModal';

export function Episodes() {
  const {
    episodes,
    addEpisode,
    updateEpisode,
    deleteEpisode,
    characters,
    stylePresets,
    addPrompt,
    addSubtitleTrack,
    addRenderJob,
  } = useStudioStore();

  const { t } = useLanguage();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedEp, setSelectedEp] = useState<string | null>(null);
  const [showSceneCreate, setShowSceneCreate] = useState(false);

  const selectedEpisode = episodes.find((episode) => episode.id === selectedEp);

  const handleGenerateWorkflow = async (config: EpisodeWorkflowConfig) => {
    try {
      const result = await generateEpisodeWorkflow(config, stylePresets, characters);

      // Add episode with completed status since generation finished
      const completedEpisode = {
        ...result.episode,
        status: 'rendered' as EpisodeStatus
      };
      
      addEpisode(completedEpisode);
      result.prompts.forEach((prompt) => addPrompt(prompt));
      result.subtitleTracks.forEach((subtitleTrack) => addSubtitleTrack(subtitleTrack));
      result.renderJobs.forEach((renderJob) => addRenderJob(renderJob));

      setSelectedEp(completedEpisode.id);
      setShowCreate(false);

      console.log('Workflow generated successfully');
    } catch (error) {
      console.error('Workflow generation failed:', error);
      alert('Failed to generate workflow');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.episodes.title}</h1>
          <p className="page-subtitle">{t.episodes.subtitle}</p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.episodes.newEpisode}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {episodes.map((episode) => (
            <button
              key={episode.id}
              onClick={() => setSelectedEp(episode.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
                selectedEp === episode.id
                  ? 'bg-surface-lighter border-accent-600/40'
                  : 'bg-surface-light border-surface-border hover:border-studio-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-20 h-12 rounded-md bg-studio-800 overflow-hidden shrink-0">
                  {episode.thumbnail_url && (
                    <img
                      src={episode.thumbnail_url}
                      alt={episode.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">
                    {episode.title}
                  </h3>

                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-studio-400">
                      <Layers className="w-3 h-3" />
                      {episode.scenes.length} {t.episodes.scenes.toLowerCase()}
                    </span>

                    <span className="flex items-center gap-1 text-xs text-studio-400">
                      <Clock className="w-3 h-3" />
                      {episode.duration_estimate ?? 0}s
                    </span>
                  </div>
                </div>

                <EpisodeStatusBadge status={episode.status} />
              </div>
            </button>
          ))}

          {episodes.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-studio-400">{t.episodes.noEpisodes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedEpisode ? (
            <EpisodeDetail
              episode={selectedEpisode}
              characters={characters}
              onUpdate={(updates) => updateEpisode(selectedEpisode.id, updates)}
              onDelete={() => {
                deleteEpisode(selectedEpisode.id);
                setSelectedEp(null);
              }}
              onAddScene={() => setShowSceneCreate(true)}
            />
          ) : (
            <div className="card h-full flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <Play className="w-12 h-12 text-studio-700 mx-auto mb-3" />
                <p className="text-studio-400">{t.episodes.selectEpisode}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <EpisodeWorkflowModal
          characters={characters}
          stylePresets={stylePresets}
          onGenerate={handleGenerateWorkflow}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showSceneCreate && selectedEpisode && (
        <CreateSceneModal
          episodeId={selectedEpisode.id}
          sceneCount={selectedEpisode.scenes.length}
          characters={characters}
          onSave={(scene) => {
            const updatedScenes = [...selectedEpisode.scenes, scene];

            updateEpisode(selectedEpisode.id, {
              scenes: updatedScenes,
              duration_estimate: updatedScenes.reduce(
                (sum, currentScene) => sum + currentScene.duration,
                0
              ),
            });

            setShowSceneCreate(false);
          }}
          onClose={() => setShowSceneCreate(false)}
        />
      )}
    </div>
  );
}

function EpisodeDetail({
  episode,
  characters,
  onUpdate,
  onDelete,
  onAddScene,
}: {
  episode: Episode;
  characters: { id: string; name: string; image_url: string | null }[];
  onUpdate: (updates: Partial<Episode>) => void;
  onDelete: () => void;
  onAddScene: () => void;
}) {
  const { t } = useLanguage();
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
    const scenes = episode.scenes.map((scene) =>
      scene.id === sceneId
        ? { ...scene, ...updates, updated_at: new Date().toISOString() }
        : scene
    );

    onUpdate({
      scenes,
      duration_estimate: scenes.reduce((sum, scene) => sum + scene.duration, 0),
    });
  };

  const deleteScene = (sceneId: string) => {
    const scenes = episode.scenes
      .filter((scene) => scene.id !== sceneId)
      .map((scene, index) => ({ ...scene, order: index + 1 }));

    onUpdate({
      scenes,
      duration_estimate: scenes.reduce((sum, scene) => sum + scene.duration, 0),
    });
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{episode.title}</h2>
            <p className="text-sm text-studio-400 mt-0.5 line-clamp-2">
              {episode.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={episode.status}
              onChange={(event) =>
                onUpdate({ status: event.target.value as EpisodeStatus })
              }
              className="input text-sm py-1.5 w-auto"
            >
              <option value="draft">{t.episodes.statuses.draft}</option>
              <option value="in_production">{t.episodes.statuses.generating}</option>
              <option value="rendering">{t.episodes.statuses.rendering}</option>
              <option value="rendered">{t.episodes.statuses.completed}</option>
              <option value="published">{t.episodes.statuses.published}</option>
            </select>

            <button onClick={onDelete} className="btn-danger py-1.5 text-sm">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {episode.workflow_config && (
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-surface-border">
            <span className="px-2 py-1 text-xs rounded-md bg-surface text-studio-300">
              {episode.workflow_config.aspect_ratio}
            </span>
            <span className="px-2 py-1 text-xs rounded-md bg-surface text-studio-300">
              {episode.workflow_config.camera_style}
            </span>
            <span className="px-2 py-1 text-xs rounded-md bg-surface text-studio-300">
              {episode.workflow_config.music_mood}
            </span>
            <span className="px-2 py-1 text-xs rounded-md bg-surface text-studio-300">
              {episode.workflow_config.voice_style}
            </span>
            <span className="px-2 py-1 text-xs rounded-md bg-accent-900/20 text-accent-400">
              {episode.workflow_config.consistency_strength} {t.workflow.consistencyLabel}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-studio-300">
            {t.episodes.timeline}
          </h3>

          <button
            onClick={onAddScene}
            className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {t.episodes.addScene}
          </button>
        </div>
      </div>

      {episode.scenes.length === 0 ? (
        <div className="card text-center py-8 border border-dashed border-surface-border">
          <p className="text-sm text-studio-500">{t.episodes.noEpisodes}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {episode.scenes
            .sort((a, b) => a.order - b.order)
            .map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                characters={characters}
                expanded={expandedScene === scene.id}
                onToggle={() =>
                  setExpandedScene(expandedScene === scene.id ? null : scene.id)
                }
                onUpdate={(updates) => updateScene(scene.id, updates)}
                onDelete={() => deleteScene(scene.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function SceneCard({
  scene,
  characters,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  scene: Scene;
  characters: { id: string; name: string; image_url: string | null }[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Scene>) => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="card p-0 overflow-hidden border border-surface-border">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-lighter transition-colors"
        onClick={onToggle}
      >
        <GripVertical className="w-4 h-4 text-studio-600 shrink-0" />

        <div className="w-8 h-8 rounded-md bg-studio-800 flex items-center justify-center text-xs font-mono text-studio-400 shrink-0">
          {scene.order}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{scene.title}</p>
          <p className="text-xs text-studio-400 truncate mt-0.5">
            {scene.narration || scene.prompt_text}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {scene.characters.slice(0, 2).map((characterId) => {
            const character = characters.find((item) => item.id === characterId);

            return character ? (
              <span
                key={characterId}
                className="px-2 py-0.5 text-xs rounded bg-studio-800 text-studio-300"
              >
                {character.name}
              </span>
            ) : null;
          })}

          <span className="text-xs text-studio-500 font-mono">
            {scene.duration}s
          </span>

          <RenderStatusDot status={scene.render_status} />

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-studio-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-studio-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-surface-border space-y-3 bg-surface/50">
          <ScenePromptInspector
            scene={scene}
            characters={characters}
            onUpdate={onUpdate}
          />
          
          <div className="border-t border-surface-border pt-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">
                {t.workflow.sceneEditor.sceneTitle}
              </label>
              <input
                value={scene.title}
                onChange={(event) => onUpdate({ title: event.target.value })}
                className="input text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-xs">
                  {t.workflow.sceneEditor.duration}
                </label>
                <input
                  type="number"
                  min="1"
                  value={scene.duration}
                  onChange={(event) =>
                    onUpdate({ duration: parseInt(event.target.value) || 5 })
                  }
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="label text-xs">
                  {t.workflow.sceneEditor.camera}
                </label>
                <select
                  value={scene.camera_angle}
                  onChange={(event) =>
                    onUpdate({ camera_angle: event.target.value })
                  }
                  className="input text-xs"
                >
                  <option value="">--</option>
                  {CAMERA_ANGLES.map((angle) => (
                    <option key={angle} value={angle}>
                      {angle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs">
                  {t.workflow.sceneEditor.status}
                </label>
                <select
                  value={scene.render_status}
                  onChange={(event) =>
                    onUpdate({
                      render_status: event.target.value as Scene['render_status'],
                    })
                  }
                  className="input text-xs"
                >
                  {(['pending', 'queued', 'rendering', 'completed', 'failed'] as const).map(
                    (renderStatus) => (
                      <option key={renderStatus} value={renderStatus}>
                        {t.workflow.renderStatuses[renderStatus]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="label text-xs">{t.workflow.sceneEditor.prompt}</label>
            <textarea
              value={scene.prompt_text}
              onChange={(event) => onUpdate({ prompt_text: event.target.value })}
              className="input text-sm min-h-[60px] resize-y font-mono"
            />
          </div>

          <div>
            <label className="label text-xs">
              {t.workflow.sceneEditor.narrationDialogue}
            </label>
            <textarea
              value={scene.narration}
              onChange={(event) =>
                onUpdate({
                  narration: event.target.value,
                  subtitle_text: event.target.value,
                })
              }
              className="input text-sm min-h-[50px] resize-y"
              placeholder={t.workflow.sceneEditor.narrationPlaceholder}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">
                {t.workflow.sceneEditor.negativePrompt}
              </label>
              <input
                value={scene.negative_prompt}
                onChange={(event) =>
                  onUpdate({ negative_prompt: event.target.value })
                }
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">
                {t.workflow.sceneEditor.motionInstructions}
              </label>
              <input
                value={scene.motion_instructions}
                onChange={(event) =>
                  onUpdate({ motion_instructions: event.target.value })
                }
                className="input text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-wrap gap-1">
              {scene.characters.map((characterId) => {
                const character = characters.find((item) => item.id === characterId);

                return character ? (
                  <span
                    key={characterId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-accent-900/20 text-accent-400"
                  >
                    <Users className="w-3 h-3" />
                    {character.name}
                  </span>
                ) : null;
              })}
            </div>

            <button
              onClick={onDelete}
              className="p-1.5 rounded-md hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
