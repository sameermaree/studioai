import { useState } from 'react';
import type { ElementType, FormEvent } from 'react';
import {
  Plus,
  Play,
  Clock,
  Layers,
  GripVertical,
  Trash2,
  X,
  Wand2,
  ChevronDown,
  ChevronUp,
  Volume2,
  Globe,
  Palette,
  Users,
  Film,
  Camera,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { generateEpisodeWorkflow } from '../services/workflow';
import { LANGUAGES, CAMERA_ANGLES } from '../lib/constants';
import type {
  Episode,
  Scene,
  EpisodeStatus,
  Language,
  EpisodeWorkflowConfig,
  AspectRatio,
  MusicMood,
  VoiceStyle,
  CameraStyle,
  ConsistencyStrength,
} from '../types';

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

function EpisodeWorkflowModal({
  characters,
  stylePresets,
  onGenerate,
  onClose,
}: {
  characters: { id: string; name: string; image_url: string | null }[];
  stylePresets: { id: string; name: string; category: string }[];
  onGenerate: (config: EpisodeWorkflowConfig) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [targetLang, setTargetLang] = useState<Language>('en');
  const [subtitleLangs, setSubtitleLangs] = useState<Language[]>(['en']);
  const [audienceAge, setAudienceAge] = useState('8-12');
  const [stylePresetId, setStylePresetId] = useState(stylePresets[0]?.id || '');
  const [duration, setDuration] = useState(60);
  const [scenes, setScenes] = useState(5);
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [narrationLang, setNarrationLang] = useState<Language>('en');
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('narration');
  const [cameraStyle, setCameraStyle] = useState<CameraStyle>('cinematic');
  const [musicMood, setMusicMood] = useState<MusicMood>('epic');
  const [consistency, setConsistency] = useState<ConsistencyStrength>('high');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleChar = (id: string) => {
    setSelectedChars((previous) =>
      previous.includes(id)
        ? previous.filter((characterId) => characterId !== id)
        : [...previous, id]
    );
  };

  const toggleSubtitleLang = (lang: Language) => {
    setSubtitleLangs((previous) =>
      previous.includes(lang)
        ? previous.filter((language) => language !== lang)
        : [...previous, lang]
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isGenerating) {
      return;
    }

    setIsGenerating(true);

    try {
      await onGenerate({
        title,
        story,
        target_language: targetLang,
        subtitle_languages: subtitleLangs,
        target_audience_age: audienceAge,
        style_preset_id: stylePresetId,
        duration_seconds: duration,
        estimated_scenes: scenes,
        character_ids: selectedChars,
        narration_language: narrationLang,
        voice_style: voiceStyle,
        camera_style: cameraStyle,
        music_mood: musicMood,
        consistency_strength: consistency,
        aspect_ratio: aspectRatio,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const featuredStyles = stylePresets.filter((style) =>
    ['pixar', 'disney', 'anime', 'cinematic_3d', 'realistic', 'kids_educational'].includes(
      style.category
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="card w-full max-w-3xl my-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t.episodes.newEpisode}
            </h2>
            <p className="text-xs text-studio-400 mt-0.5">
              {t.workflow.pipelineConfig}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-studio-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section>
            <SectionLabel icon={Film} label={t.workflow.storySection} />

            <div className="space-y-3 mt-2">
              <div>
                <label className="label">{t.workflow.episodeTitle}</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="input"
                  placeholder={t.workflow.episodeTitlePlaceholder}
                  required
                />
              </div>

              <div>
                <label className="label">{t.workflow.storyLabel}</label>
                <textarea
                  value={story}
                  onChange={(event) => setStory(event.target.value)}
                  className="input min-h-[120px] resize-y"
                  placeholder={t.workflow.storyPlaceholder}
                  required
                />
              </div>
            </div>
          </section>

          <section>
            <SectionLabel icon={Globe} label={t.workflow.languageAudience} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div>
                <label className="label">{t.workflow.targetLanguage}</label>
                <select
                  value={targetLang}
                  onChange={(event) => setTargetLang(event.target.value as Language)}
                  className="input"
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t.workflow.narrationLanguage}</label>
                <select
                  value={narrationLang}
                  onChange={(event) => setNarrationLang(event.target.value as Language)}
                  className="input"
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t.workflow.audienceAge}</label>
                <select
                  value={audienceAge}
                  onChange={(event) => setAudienceAge(event.target.value)}
                  className="input"
                >
                  {(['3-5', '6-8', '8-12', '13-17', '18+'] as const).map((age) => (
                    <option key={age} value={age}>
                      {t.workflow.ages[age]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t.workflow.subtitleLanguages}</label>

                <div className="flex flex-wrap gap-1.5 mt-1">
                  {LANGUAGES.map((language) => (
                    <button
                      key={language.value}
                      type="button"
                      onClick={() => toggleSubtitleLang(language.value)}
                      className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                        subtitleLangs.includes(language.value)
                          ? 'bg-accent-600/20 text-accent-400 border-accent-700/30'
                          : 'bg-surface text-studio-400 border-surface-border hover:border-studio-600'
                      }`}
                    >
                      {language.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionLabel icon={Palette} label={t.workflow.visualStyle} />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {featuredStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setStylePresetId(style.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    stylePresetId === style.id
                      ? 'bg-accent-600/15 border-accent-600/40 ring-1 ring-accent-600/20'
                      : 'bg-surface border-surface-border hover:border-studio-600'
                  }`}
                >
                  <p className="text-sm font-medium text-white">{style.name}</p>
                  <p className="text-xs text-studio-400 mt-0.5 capitalize">
                    {style.category.replace('_', ' ')}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <SectionLabel icon={Camera} label={t.workflow.productionSettings} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div>
                <label className="label">{t.workflow.durationSeconds}</label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={duration}
                  onChange={(event) =>
                    setDuration(parseInt(event.target.value) || 60)
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t.workflow.estimatedScenes}</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={scenes}
                  onChange={(event) =>
                    setScenes(parseInt(event.target.value) || 5)
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t.workflow.cameraStyle}</label>
                <select
                  value={cameraStyle}
                  onChange={(event) => setCameraStyle(event.target.value as CameraStyle)}
                  className="input"
                >
                  {(['cinematic', 'dynamic', 'static', 'handheld', 'aerial', 'macro'] as const).map(
                    (cameraStyleOption) => (
                      <option key={cameraStyleOption} value={cameraStyleOption}>
                        {t.workflow.cameraStyles[cameraStyleOption]}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="label">{t.workflow.musicMood}</label>
                <select
                  value={musicMood}
                  onChange={(event) => setMusicMood(event.target.value as MusicMood)}
                  className="input"
                >
                  {(['epic', 'calm', 'tense', 'playful', 'mysterious', 'emotional', 'action', 'none'] as const).map(
                    (musicMoodOption) => (
                      <option key={musicMoodOption} value={musicMoodOption}>
                        {t.workflow.musicMoods[musicMoodOption]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </section>

          <section>
            <SectionLabel icon={Volume2} label={t.workflow.voiceRendering} />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              <div>
                <label className="label">{t.workflow.voiceStyle}</label>
                <select
                  value={voiceStyle}
                  onChange={(event) => setVoiceStyle(event.target.value as VoiceStyle)}
                  className="input"
                >
                  {(['narration', 'dialogue', 'documentary', 'storytelling', 'energetic', 'calm'] as const).map(
                    (voiceStyleOption) => (
                      <option key={voiceStyleOption} value={voiceStyleOption}>
                        {t.workflow.voiceStyles[voiceStyleOption]}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="label">{t.workflow.consistencyStrength}</label>
                <select
                  value={consistency}
                  onChange={(event) =>
                    setConsistency(event.target.value as ConsistencyStrength)
                  }
                  className="input"
                >
                  {(['low', 'medium', 'high', 'strict'] as const).map(
                    (consistencyLevel) => (
                      <option key={consistencyLevel} value={consistencyLevel}>
                        {t.workflow.consistencyLevels[consistencyLevel]}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="label">{t.workflow.aspectRatio}</label>

                <div className="flex gap-2 mt-1">
                  {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-all ${
                        aspectRatio === ratio
                          ? 'bg-accent-600/15 text-accent-400 border-accent-700/30'
                          : 'bg-surface text-studio-400 border-surface-border hover:border-studio-600'
                      }`}
                    >
                      <AspectRatioIcon ratio={ratio} />
                      <span className="block mt-1">{ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionLabel icon={Users} label={t.workflow.charactersSection} />

            <div className="flex flex-wrap gap-2 mt-2">
              {characters.length === 0 ? (
                <p className="text-xs text-studio-500">
                  {t.workflow.noCharactersHint}
                </p>
              ) : (
                characters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => toggleChar(character.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      selectedChars.includes(character.id)
                        ? 'bg-accent-600/15 text-accent-400 border-accent-700/30'
                        : 'bg-surface text-studio-400 border-surface-border hover:border-studio-600'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-studio-800 overflow-hidden shrink-0">
                      {character.image_url ? (
                        <img
                          src={character.image_url}
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-studio-500">
                          {character.name[0]}
                        </div>
                      )}
                    </div>

                    <span className="text-sm">{character.name}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <div className="flex items-center justify-between pt-4 border-t border-surface-border">
            <p className="text-xs text-studio-500">
              {t.workflow.generateHint
                .replace('{scenes}', String(scenes))
                .replace('{langs}', String(subtitleLangs.length))}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isGenerating}
              >
                {t.common.cancel}
              </button>

              <button
                type="submit"
                className="btn-primary flex items-center gap-2 px-5 py-2.5"
                disabled={isGenerating}
              >
                <Wand2 className="w-4 h-4" />
                {isGenerating ? 'Generating...' : t.workflow.generateButton}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-surface-border">
      <Icon className="w-4 h-4 text-accent-500" />
      <span className="text-sm font-medium text-white">{label}</span>
    </div>
  );
}

function AspectRatioIcon({ ratio }: { ratio: string }) {
  const dims: Record<string, { w: number; h: number }> = {
    '16:9': { w: 20, h: 12 },
    '9:16': { w: 12, h: 20 },
    '1:1': { w: 16, h: 16 },
  };

  const dimensions = dims[ratio] || dims['16:9'];

  return (
    <div className="flex justify-center">
      <div
        className="border border-current rounded-sm"
        style={{
          width: dimensions.w,
          height: dimensions.h,
        }}
      />
    </div>
  );
}

function RenderStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-studio-600',
    queued: 'bg-amber-500',
    rendering: 'bg-amber-500 animate-pulse',
    completed: 'bg-accent-500',
    failed: 'bg-danger-500',
  };

  return (
    <div
      className={`w-2.5 h-2.5 rounded-full ${colors[status] ?? 'bg-studio-600'}`}
      title={status}
    />
  );
}

function EpisodeStatusBadge({ status }: { status: EpisodeStatus }) {
  const { t } = useLanguage();

  const styles: Record<string, string> = {
    draft: 'text-studio-400',
    in_production: 'text-blue-400',
    rendering: 'text-amber-400',
    rendered: 'text-accent-400',
    published: 'text-emerald-400',
  };

  const statusLabels: Record<string, string> = {
    draft: t.episodes.statuses.draft,
    in_production: t.episodes.statuses.generating,
    rendering: t.episodes.statuses.rendering,
    rendered: t.episodes.statuses.completed,
    published: t.episodes.statuses.published,
  };

  return (
    <span className={`text-xs font-medium ${styles[status] ?? 'text-studio-400'}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function CreateSceneModal({
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
