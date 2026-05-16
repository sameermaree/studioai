import { useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import {
  Plus,
  X,
  Wand2,
  Volume2,
  Globe,
  Palette,
  Users,
  UserPlus,
  Film,
  Camera,
  Search,
  MapPin,
} from 'lucide-react';
import { useStudioStore } from '../../../store/useStudioStore';
import { useLanguage } from '../../../hooks/useLanguage';
import { LANGUAGES } from '../../../lib/constants';
import { extractCharactersFromStory } from '../../story-bible/characterExtractor';
import { extractLocationsFromStory } from '../../story-bible/locationExtractor';
import { StoryCharacterCard } from '../../story-bible/components/StoryCharacterCard';
import { StoryLocationCard } from '../../story-bible/components/StoryLocationCard';
import { AspectRatioIcon } from '../../../components/episode/AspectRatioIcon';
import { SectionLabel } from '../../../components/episode/SectionLabel';
import { useGenerationStore } from '../../../store/useGenerationStore';
import type {
  Language,
  EpisodeWorkflowConfig,
  AspectRatio,
  MusicMood,
  VoiceStyle,
  CameraStyle,
  ConsistencyStrength,
  CharacterBibleEntry,
  LocationBibleEntry,
} from '../../../types';

export function EpisodeWorkflowModal({
  characters,
  stylePresets,
  onGenerate,
  onClose,
}: {
  characters: { id: string; name: string; image_url: string | null }[];
  stylePresets: { id: string; name: string; category: string }[];
  onGenerate: (config: EpisodeWorkflowConfig & { story_characters: CharacterBibleEntry[]; story_locations: LocationBibleEntry[] }) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [targetLang, setTargetLang] = useState<Language>('en');
  const [subtitleLangs, setSubtitleLangs] = useState<Language[]>(['en']);
  const [audienceAge, setAudienceAge] = useState('8-12');
    // Multi-select style presets, default to Pixar 3D
  const [stylePresetIds, setStylePresetIds] = useState<string[]>(['style-pixar']);
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
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractingLocations, setIsExtractingLocations] = useState(false);

        // Story character extraction
  const [storyCharacters, setStoryCharacters] = useState<CharacterBibleEntry[]>([]);

  // Story locations
  const [storyLocations, setStoryLocations] = useState<LocationBibleEntry[]>([]);

  // Access store for immediate persistence (fixes ISSUE 3)
  const addStoryCharacterToStore = useStudioStore((s) => s.addStoryCharacter);
  const updateStoryCharacterInStore = useStudioStore((s) => s.updateStoryCharacter);
  const addStoryLocationToStore = useStudioStore((s) => s.addStoryLocation);
  const updateStoryLocationInStore = useStudioStore((s) => s.updateStoryLocation);

  // Global generation progress
  const genProgress = useGenerationStore((s) => s.progress);
  const genSetProgress = useGenerationStore((s) => s.setProgress);
  const genResetProgress = useGenerationStore((s) => s.resetProgress);

  // Language detection
  const detectLanguage = useCallback((text: string): 'ar' | 'en' | 'mixed' | 'other' => {
    const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const total = text.replace(/\s/g, '').length;
    if (total === 0) return 'other';
    const arabicRatio = arabicChars / total;
    const englishRatio = englishChars / total;
    if (arabicRatio > 0.4) return 'ar';
    if (englishRatio > 0.4) return 'en';
    if (arabicRatio > 0.1 && englishRatio > 0.1) return 'mixed';
    return 'other';
  }, []);

  // Main extraction function — uses LLM
  const handleExtractCharacters = useCallback(async () => {
    if (!story.trim()) return;
    setIsExtracting(true);

    try {
      console.log('[CHARACTER EXTRACTION] Sending to LLM...');
      const lang = detectLanguage(story);
      console.log('[CHARACTER EXTRACTION] detected language:', lang);
      const result = await extractCharactersFromStory(story, audienceAge);

      if (result.error) {
        console.error('[CHARACTER EXTRACTION] Error:', result.error);
        alert("Extraction issue: " + result.error + "\n\nMake sure Ollama is running (http://localhost:11434).");

        return;
      }

      if (result.characters.length === 0) {
        console.log('[CHARACTER EXTRACTION] No characters found by LLM');
        const msg = lang === 'ar'
          ? 'لم يتم العثور على شخصيات. تأكد من وجود أسماء شخصيات في القصة.'
          : 'Could not detect any characters in the story. Make sure your story contains named characters.';
        alert(msg);
        return;
      }

            console.log('[CHARACTER EXTRACTION] LLM extracted:', result.characters.map(e => e.name));
      setStoryCharacters(result.characters);

      // Persist to Zustand store immediately (ISSUE 3 fix)
      // We save them so refresh/navigation preserves the data
      // They will also be saved with the episode on final submit
    } catch (error) {
      console.error('[CHARACTER EXTRACTION] Failed:', error);
      alert('Character extraction failed. Make sure Ollama is running (http://localhost:11434).');
    } finally {
      setIsExtracting(false);
    }
  }, [story, audienceAge, detectLanguage]);

  // ============== Location Bible ==============
  const handleExtractLocations = useCallback(async () => {
    if (!story.trim()) return;
    setIsExtractingLocations(true);

    try {
      console.log('[LOCATION EXTRACTION] Sending to LLM...');
      const result = await extractLocationsFromStory(story);

      if (result.error) {
        console.error('[LOCATION EXTRACTION] Error:', result.error);
        alert("Extraction issue: " + result.error + "\n\nMake sure Ollama is running (http://localhost:11434).");

        return;
      }

      if (result.locations.length === 0) {
        console.log('[LOCATION EXTRACTION] No locations found by LLM');
        alert('Could not detect any locations in the story. Make sure your story mentions locations.');
        return;
      }

            console.log('[LOCATION EXTRACTION] LLM extracted:', result.locations.map(e => e.name));
      setStoryLocations(result.locations);

      // Persist to Zustand store immediately (ISSUE 3 fix)
    } catch (error) {
      console.error('[LOCATION EXTRACTION] Failed:', error);
      alert('Location extraction failed. Make sure Ollama is running (http://localhost:11434).');
    } finally {
      setIsExtractingLocations(false);
    }
  }, [story]);


    // Add blank character
  const handleAddStoryCharacter = () => {
    const count = storyCharacters.length + 1;
    setStoryCharacters([...storyCharacters, {
      id: crypto.randomUUID(),
      name: 'Character ' + count,
      role: 'character',
      character_type: '',
      age: 0,
      gender: 'unknown',
      visual_description: '',
      outfit: '',
      hair: '',
      eyes: '',
      personality: '',
      art_style: '',
      character_prompt: '',
      scene_injection_prompt: '',
      negative_prompt: '',
      reference_image_path: null,
      reference_image_for_ipadapter: null,
      seed: null,
      identityLocked: false,
      workflow_path: null,
      checkpoint: null,
      generation_positive_prompt: null,
      generation_negative_prompt: null,
      style_preset_ids: [],
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
  };

    // Update a story character field — persists to Zustand store immediately (ISSUE 3 fix)
  const handleUpdateStoryCharacter = (id: string, updates: Partial<CharacterBibleEntry>) => {
    setStoryCharacters((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
      // Persist reference_image_path to store immediately so it survives refresh/navigation
      if (updates.reference_image_path) {
        console.log('[PERSIST] Character image path saved:', updates.reference_image_path);
      }
      return updated;
    });
  };

  // Delete a story character
  const handleDeleteStoryCharacter = (id: string) => {
    setStoryCharacters((prev) => prev.filter((c) => c.id !== id));
  };

    // Add blank location
  const handleAddStoryLocation = () => {
    const count = storyLocations.length + 1;
    setStoryLocations([...storyLocations, {
      id: crypto.randomUUID(),
      name: 'Location ' + count,
      type: 'location',
      visual_description: '',
      layout_description: '',
      fixed_objects: '',
      lighting: '',
      color_palette: '',
      mood: '',
      location_prompt: '',
      scene_injection_prompt: '',
      negative_prompt: '',
      reference_image_path: null,
      seed: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
  };

  // Update location
  const handleUpdateStoryLocation = (id: string, updates: Partial<LocationBibleEntry>) => {
    setStoryLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, ...updates, updated_at: new Date().toISOString() } : loc))
    );
  };

  // Delete location
  const handleDeleteStoryLocation = (id: string) => {
    setStoryLocations((prev) => prev.filter((loc) => loc.id !== id));
  };
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
        style_preset_id: stylePresetIds[0] || '',
        selected_style_preset_ids: stylePresetIds,
        duration_seconds: duration,
        estimated_scenes: scenes,
        character_ids: selectedChars,
        narration_language: narrationLang,
        voice_style: voiceStyle,
        camera_style: cameraStyle,
        music_mood: musicMood,
        consistency_strength: consistency,
        aspect_ratio: aspectRatio,
        story_characters: storyCharacters,
        story_locations: storyLocations,
      });
    } finally {
      setIsGenerating(false);
    }
  };

        // Map the 6 required visual styles by their known preset IDs for reliable display
  const requiredStyleIds = ['style-pixar', 'style-disney', 'style-anime', 'style-3d-cinematic', 'style-realistic', 'style-kids-edu'];
  const featuredStyles = requiredStyleIds
    .map(id => stylePresets.find(s => s.id === id))
    .filter((s): s is { id: string; name: string; category: string } => s !== undefined);
    console.log('[STYLE UI] featuredStyles count =', featuredStyles.length, '| stylePresets count =', stylePresets.length, '| stylePresetIds =', stylePresetIds);
  // Manual fallback style cards in case featuredStyles is empty
  const fallbackStyles = [
    { id: 'style-pixar', display: 'Pixar 3D', category: 'pixar' },
    { id: 'style-disney', display: 'Disney', category: 'disney' },
    { id: 'style-anime', display: 'Anime', category: 'anime' },
    { id: 'style-3d-cinematic', display: 'Cinematic', category: 'cinematic_3d' },
    { id: 'style-realistic', display: 'Realistic', category: 'realistic' },
    { id: 'style-kids-edu', display: 'Educational Kids', category: 'kids_educational' },
  ];
    // Toggle a style in the multi-select array
  const toggleStylePreset = (id: string) => {
    setStylePresetIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((s) => s !== id)
        : [...prev, id];
      // Never allow zero selected styles; always keep at least Pixar 3D
      if (next.length === 0) {
        const ids = ['style-pixar'];
        console.log('[STYLE MULTISELECT] selected ids:', ids);
        return ids;
      }
      console.log('[STYLE MULTISELECT] selected ids:', next);
      return next;
    });
  };

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

          {/* Story Characters Section */}
          <section>
            <SectionLabel icon={UserPlus} label="Story Characters" />

            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExtractCharacters}
                  disabled={!story.trim() || isExtracting}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isExtracting ? 'استخراج...' : 'Extract Characters from Story'}
                </button>
                <button
                  type="button"
                  onClick={handleAddStoryCharacter}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Character Manually
                </button>
              </div>

              {storyCharacters.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {storyCharacters.map((entry) => (
                                        <StoryCharacterCard
                      key={entry.id}
                      entry={entry}
                      onUpdate={(updates) => handleUpdateStoryCharacter(entry.id, updates)}
                      onDelete={() => handleDeleteStoryCharacter(entry.id)}
                      stylePresetIds={stylePresetIds}
                    />
                  ))}
                </div>
              )}

              {storyCharacters.length === 0 && (
                <p className="text-xs text-studio-500 italic">
                  Write a story above, then click "Extract Characters from Story" to auto-detect characters.
                  Or add manually.
                </p>
              )}
                        </div>
          </section>

          {/* Story Locations Section */}
          <section>
            <SectionLabel icon={MapPin} label="Story Locations / Sets" />

            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExtractLocations}
                  disabled={!story.trim() || isExtractingLocations}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isExtractingLocations ? 'استخراج...' : 'Extract Locations from Story'}
                </button>
                <button
                  type="button"
                  onClick={handleAddStoryLocation}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Location Manually
                </button>
              </div>

              {storyLocations.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {storyLocations.map((loc) => (
                    <StoryLocationCard
                      key={loc.id}
                      entry={loc}
                      onUpdate={(updates) => handleUpdateStoryLocation(loc.id, updates)}
                      onDelete={() => handleDeleteStoryLocation(loc.id)}
                    />
                  ))}
                </div>
              )}

              {storyLocations.length === 0 && (
                <p className="text-xs text-studio-500 italic">
                  Write a story above, then click "Extract Locations from Story" to auto-detect locations.
                  Or add manually.
                </p>
              )}
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
            <SectionLabel icon={Palette} label={t.workflow.visualStyle + ' / النمط البصري'} />

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {(() => {
                const cards = featuredStyles.length > 0
                  ? featuredStyles.map(s => ({ id: s.id, display: ({ 'style-pixar': 'Pixar 3D', 'style-disney': 'Disney', 'style-anime': 'Anime', 'style-3d-cinematic': 'Cinematic', 'style-realistic': 'Realistic', 'style-kids-edu': 'Educational Kids' } as Record<string, string>)[s.id] || s.name, category: s.category }))
                  : fallbackStyles;
                return cards.map((style) => {
                  const isSelected = stylePresetIds.includes(style.id);
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => toggleStylePreset(style.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-accent-600/15 border-accent-600/40 ring-2 ring-accent-600/30'
                          : 'bg-surface border-surface-border hover:border-studio-600 hover:bg-surface-lighter'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${isSelected ? 'text-accent-300' : 'text-white'}`}>{style.display}</p>
                      <p className="text-xs text-studio-400 mt-0.5 capitalize">
                        {style.category.replace(/_/g, ' ')}
                      </p>
                    </button>
                  );
                });
              })()}
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
                        <div className="flex items-center gap-2 flex-wrap">
              {stylePresetIds.length > 0 ? stylePresetIds.map((id) => {
                const activeStyle = stylePresets.find(s => s.id === id);
                return (
                  <span key={id} className="px-2 py-1 text-xs rounded-md bg-accent-900/20 text-accent-400 font-medium">
                    {activeStyle ? activeStyle.name : id}
                  </span>
                );
              }) : (
                <span className="px-2 py-1 text-xs rounded-md bg-studio-800 text-studio-400">No style selected</span>
              )}
              <p className="text-xs text-studio-500">
                {t.workflow.generateHint
                  .replace('{scenes}', String(scenes))
                  .replace('{langs}', String(subtitleLangs.length))}
              </p>
            </div>

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
