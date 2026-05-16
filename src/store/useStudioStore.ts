import { create } from 'zustand';
import type { Character, Episode, Prompt, Voice, RenderJob, PublishTarget, StylePreset, MediaAsset, SubtitleTrack } from '../types';
import { mockVoices, mockPublishTargets, mockMediaAssets } from '../data/mock';
import { systemStylePresets } from '../data/stylePresets';

interface StudioState {
  characters: Character[];
  episodes: Episode[];
  prompts: Prompt[];
  voices: Voice[];
  renderJobs: RenderJob[];
  publishTargets: PublishTarget[];
  stylePresets: StylePreset[];
  mediaAssets: MediaAsset[];
  subtitleTracks: SubtitleTrack[];
  sidebarOpen: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  addCharacter: (character: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;

  addEpisode: (episode: Episode) => void;
  updateEpisode: (id: string, updates: Partial<Episode>) => void;
  deleteEpisode: (id: string) => void;

  // Character Bible (story characters per episode)
  addStoryCharacter: (episodeId: string, entry: import('../types').CharacterBibleEntry) => void;
  updateStoryCharacter: (episodeId: string, entryId: string, updates: Partial<import('../types').CharacterBibleEntry>) => void;
  deleteStoryCharacter: (episodeId: string, entryId: string) => void;

  // Location Bible (story locations per episode)
  addStoryLocation: (episodeId: string, entry: import('../types').LocationBibleEntry) => void;
  updateStoryLocation: (episodeId: string, entryId: string, updates: Partial<import('../types').LocationBibleEntry>) => void;
  deleteStoryLocation: (episodeId: string, entryId: string) => void;

  addPrompt: (prompt: Prompt) => void;
  updatePrompt: (id: string, updates: Partial<Prompt>) => void;
  deletePrompt: (id: string) => void;

  addVoice: (voice: Voice) => void;
  updateVoice: (id: string, updates: Partial<Voice>) => void;
  deleteVoice: (id: string) => void;

  addRenderJob: (job: RenderJob) => void;
  updateRenderJob: (id: string, updates: Partial<RenderJob>) => void;
  deleteRenderJob: (id: string) => void;

  addPublishTarget: (target: PublishTarget) => void;
  updatePublishTarget: (id: string, updates: Partial<PublishTarget>) => void;
  deletePublishTarget: (id: string) => void;

  addStylePreset: (preset: StylePreset) => void;
  updateStylePreset: (id: string, updates: Partial<StylePreset>) => void;
  deleteStylePreset: (id: string) => void;

  addMediaAsset: (asset: MediaAsset) => void;
  deleteMediaAsset: (id: string) => void;

  addSubtitleTrack: (track: SubtitleTrack) => void;
  updateSubtitleTrack: (id: string, updates: Partial<SubtitleTrack>) => void;
  deleteSubtitleTrack: (id: string) => void;
}

const STORE_VERSION = 2;

// Save to backend file API
const saveProjectNow = async (getState: () => StudioState) => {
  try {
    const state = getState();
    const payload = {
      episodes: state.episodes || [],
      characters: state.characters || [],
      prompts: state.prompts || [],
      voices: state.voices || [],
      renderJobs: state.renderJobs || [],
      mediaAssets: state.mediaAssets || [],
      subtitleTracks: state.subtitleTracks || [],
      stylePresets: state.stylePresets || [],
      publishTargets: state.publishTargets || [],
      sidebarOpen: state.sidebarOpen,
      savedAt: new Date().toISOString()
    };
    
    // Save to file via backend (relative path - Vite serves both frontend and API)
    await fetch('/api/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log(`✓ SAVED to file: Episodes=${payload.episodes.length}, Characters=${payload.characters.length}`);
  } catch (error) {
    console.error('Save failed:', error);
  }
};

// Load from backend on startup - use relative path so vite proxy works
let initialData: Partial<StudioState> = {};

if (typeof window !== 'undefined') {
  fetch('/api/project')
    .then(res => {
      if (!res.ok) throw new Error('API not ready');
      return res.json();
    })
    .then(data => {
      console.log(`✓ LOADED from file: Episodes=${data.episodes?.length || 0}, Characters=${data.characters?.length || 0}`);
      // Reload store with loaded data
      if (data.episodes?.length || data.characters?.length) {
        // Merge loaded data with defaults — NEVER allow stylePresets to be empty
        const mergedData = {
          ...data,
          stylePresets: (data.stylePresets && data.stylePresets.length > 0)
            ? data.stylePresets
            : systemStylePresets,
        };
        useStudioStore.setState(mergedData);
        console.log('[STYLE PRESETS HYDRATED] count:', mergedData.stylePresets.length);
        console.log('[STYLE PRESET IDS AVAILABLE]', mergedData.stylePresets.map((p: any) => p.id).join(', '));
      }
    })
    .catch(() => console.log('Backend not available - starting fresh'));
}

export const useStudioStore = create<StudioState>()((set, get) => ({
      characters: (initialData.characters as Character[]) || [],
      episodes: (initialData.episodes as Episode[]) || [],
      prompts: (initialData.prompts as Prompt[]) || [],
      voices: mockVoices,
      renderJobs: (initialData.renderJobs as RenderJob[]) || [],
      publishTargets: mockPublishTargets,
      stylePresets: systemStylePresets,
      mediaAssets: (initialData.mediaAssets as MediaAsset[]) || [],
      subtitleTracks: (initialData.subtitleTracks as SubtitleTrack[]) || [],
      sidebarOpen: true,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      addCharacter: (character) => {
        set((s) => ({ characters: [...s.characters, character] }));
        saveProjectNow(get);
        console.log('[CHARACTER CONSISTENCY READY]', character.name);
      },
      updateCharacter: (id, updates) => {
        set((s) => ({ characters: s.characters.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c)) }));
        saveProjectNow(get);
      },
      deleteCharacter: (id) => {
        set((s) => ({ characters: s.characters.filter((c) => c.id !== id) }));
        saveProjectNow(get);
      },

      addEpisode: (episode) => {
        set((s) => ({ episodes: [...s.episodes, { ...episode, story_characters: episode.story_characters || [] }] }));
        saveProjectNow(get);
        console.log('[PROJECT SAVED] Episode added:', episode.title);
      },
      updateEpisode: (id, updates) => {
        set((s) => ({ episodes: s.episodes.map((e) => (e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e)) }));
        saveProjectNow(get);
      },
      deleteEpisode: (id) => {
        set((s) => ({ episodes: s.episodes.filter((e) => e.id !== id) }));
        saveProjectNow(get);
      },

      addStoryCharacter: (episodeId, entry) => {
        set((s) => ({
          episodes: s.episodes.map((e) =>
            e.id === episodeId
              ? { ...e, story_characters: [...(e.story_characters || []), entry], updated_at: new Date().toISOString() }
              : e
          ),
        }));
        saveProjectNow(get);
      },
      updateStoryCharacter: (episodeId, entryId, updates) => {
        set((s) => ({
          episodes: s.episodes.map((e) =>
            e.id === episodeId
              ? {
                  ...e,
                  story_characters: (e.story_characters || []).map((c) =>
                    c.id === entryId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
                  ),
                  updated_at: new Date().toISOString(),
                }
              : e
          ),
        }));
        saveProjectNow(get);
      },
      deleteStoryCharacter: (episodeId, entryId) => {
        set((s) => ({
          episodes: s.episodes.map((e) =>
            e.id === episodeId
              ? {
                  ...e,
                  story_characters: (e.story_characters || []).filter((c) => c.id !== entryId),
                  updated_at: new Date().toISOString(),
                }
              : e
          ),
        }));
        saveProjectNow(get);
      },

      addStoryLocation: (episodeId, entry) => {
        set((s) => ({
          episodes: s.episodes.map((e) =>
            e.id === episodeId
              ? { ...e, story_locations: [...(e.story_locations || []), entry], updated_at: new Date().toISOString() }
              : e
          ),
        }));
        saveProjectNow(get);
      },
      updateStoryLocation: (episodeId, entryId, updates) => {
        set((s) => ({
          episodes: s.episodes.map((e) =>
            e.id === episodeId
              ? {
                  ...e,
                  story_locations: (e.story_locations || []).map((loc) =>
                    loc.id === entryId ? { ...loc, ...updates, updated_at: new Date().toISOString() } : loc
                  ),
                  updated_at: new Date().toISOString(),
                }
              : e
          ),
        }));
        saveProjectNow(get);
      },
      deleteStoryLocation: (episodeId, entryId) => {
        set((s) => ({
          episodes: s.episodes.map((e) =>
            e.id === episodeId
              ? {
                  ...e,
                  story_locations: (e.story_locations || []).filter((loc) => loc.id !== entryId),
                  updated_at: new Date().toISOString(),
                }
              : e
          ),
        }));
        saveProjectNow(get);
      },

      addPrompt: (prompt) => {
        set((s) => ({ prompts: [...s.prompts, prompt] }));
        saveProjectNow(get);
      },
      updatePrompt: (id, updates) => {
        set((s) => ({ prompts: s.prompts.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p)) }));
        saveProjectNow(get);
      },
      deletePrompt: (id) => {
        set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }));
        saveProjectNow(get);
      },

      addVoice: (voice) => set((s) => ({ voices: [...s.voices, voice] })),
      updateVoice: (id, updates) =>
        set((s) => ({ voices: s.voices.map((v) => (v.id === id ? { ...v, ...updates } : v)) })),
      deleteVoice: (id) => set((s) => ({ voices: s.voices.filter((v) => v.id !== id) })),

      addRenderJob: (job) => {
        set((s) => ({ renderJobs: [job, ...s.renderJobs] }));
        saveProjectNow(get);
      },
      updateRenderJob: (id, updates) => {
        set((s) => ({ renderJobs: s.renderJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)) }));
        saveProjectNow(get);
      },
      deleteRenderJob: (id) => {
        set((s) => ({ renderJobs: s.renderJobs.filter((j) => j.id !== id) }));
        saveProjectNow(get);
      },

      addPublishTarget: (target) => set((s) => ({ publishTargets: [...s.publishTargets, target] })),
      updatePublishTarget: (id, updates) =>
        set((s) => ({ publishTargets: s.publishTargets.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
      deletePublishTarget: (id) => set((s) => ({ publishTargets: s.publishTargets.filter((t) => t.id !== id) })),

      addStylePreset: (preset) => set((s) => ({ stylePresets: [...s.stylePresets, preset] })),
      updateStylePreset: (id, updates) =>
        set((s) => ({ stylePresets: s.stylePresets.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p)) })),
      deleteStylePreset: (id) => set((s) => ({ stylePresets: s.stylePresets.filter((p) => p.id !== id) })),

      addMediaAsset: (asset) => set((s) => ({ mediaAssets: [...s.mediaAssets, asset] })),
      deleteMediaAsset: (id) => set((s) => ({ mediaAssets: s.mediaAssets.filter((a) => a.id !== id) })),

      addSubtitleTrack: (track) => {
        set((s) => ({ subtitleTracks: [...s.subtitleTracks, track] }));
        saveProjectNow(get);
      },
      updateSubtitleTrack: (id, updates) => {
        set((s) => ({ subtitleTracks: s.subtitleTracks.map((t) => (t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t)) }));
        saveProjectNow(get);
      },
      deleteSubtitleTrack: (id) => {
        set((s) => ({ subtitleTracks: s.subtitleTracks.filter((t) => t.id !== id) }));
        saveProjectNow(get);
      },
    }));

// Hydration fallback: ensure stylePresets are NEVER empty
const currentState = useStudioStore.getState();
if (!currentState.stylePresets || currentState.stylePresets.length === 0) {
  useStudioStore.setState({ stylePresets: systemStylePresets });
  console.log('[STYLE PRESETS HYDRATED] fallback - count:', systemStylePresets.length);
  console.log('[STYLE PRESET IDS AVAILABLE]', systemStylePresets.map(p => p.id).join(', '));
} else {
  console.log('[STYLE PRESETS HYDRATED] count:', currentState.stylePresets.length);
  console.log('[STYLE PRESET IDS AVAILABLE]', currentState.stylePresets.map(p => p.id).join(', '));
}
