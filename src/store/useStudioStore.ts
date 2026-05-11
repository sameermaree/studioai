import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Character, Episode, Prompt, Voice, RenderJob, PublishTarget, StylePreset, MediaAsset, SubtitleTrack } from '../types';
import { mockCharacters, mockEpisodes, mockPrompts, mockVoices, mockRenderJobs, mockPublishTargets, mockMediaAssets, mockSubtitleTracks } from '../data/mock';
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

const STORE_VERSION = 1;

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      characters: mockCharacters,
      episodes: mockEpisodes,
      prompts: mockPrompts,
      voices: mockVoices,
      renderJobs: mockRenderJobs,
      publishTargets: mockPublishTargets,
      stylePresets: systemStylePresets,
      mediaAssets: mockMediaAssets,
      subtitleTracks: mockSubtitleTracks,
      sidebarOpen: true,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      addCharacter: (character) => set((s) => ({ characters: [...s.characters, character] })),
      updateCharacter: (id, updates) =>
        set((s) => ({ characters: s.characters.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c)) })),
      deleteCharacter: (id) => set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),

      addEpisode: (episode) => set((s) => ({ episodes: [...s.episodes, episode] })),
      updateEpisode: (id, updates) =>
        set((s) => ({ episodes: s.episodes.map((e) => (e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e)) })),
      deleteEpisode: (id) => set((s) => ({ episodes: s.episodes.filter((e) => e.id !== id) })),

      addPrompt: (prompt) => set((s) => ({ prompts: [...s.prompts, prompt] })),
      updatePrompt: (id, updates) =>
        set((s) => ({ prompts: s.prompts.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p)) })),
      deletePrompt: (id) => set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) })),

      addVoice: (voice) => set((s) => ({ voices: [...s.voices, voice] })),
      updateVoice: (id, updates) =>
        set((s) => ({ voices: s.voices.map((v) => (v.id === id ? { ...v, ...updates } : v)) })),
      deleteVoice: (id) => set((s) => ({ voices: s.voices.filter((v) => v.id !== id) })),

      addRenderJob: (job) => set((s) => ({ renderJobs: [job, ...s.renderJobs] })),
      updateRenderJob: (id, updates) =>
        set((s) => ({ renderJobs: s.renderJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)) })),
      deleteRenderJob: (id) => set((s) => ({ renderJobs: s.renderJobs.filter((j) => j.id !== id) })),

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

      addSubtitleTrack: (track) => set((s) => ({ subtitleTracks: [...s.subtitleTracks, track] })),
      updateSubtitleTrack: (id, updates) =>
        set((s) => ({ subtitleTracks: s.subtitleTracks.map((t) => (t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t)) })),
      deleteSubtitleTrack: (id) => set((s) => ({ subtitleTracks: s.subtitleTracks.filter((t) => t.id !== id) })),
    }),
    {
      name: 'ai-studio-store',
      version: STORE_VERSION,
      storage: createJSONStorage(() => {
        return {
          getItem: (name: string) => {
            try {
              return localStorage.getItem(name);
            } catch {
              return null;
            }
          },
          setItem: (name: string, value: string) => {
            try {
              localStorage.setItem(name, value);
            } catch {
              // Storage full or unavailable - fail silently
            }
          },
          removeItem: (name: string) => {
            try {
              localStorage.removeItem(name);
            } catch {
              // fail silently
            }
          },
        };
      }),
      partialize: (state) => ({
        characters: state.characters,
        episodes: state.episodes,
        prompts: state.prompts,
        voices: state.voices,
        renderJobs: state.renderJobs,
        publishTargets: state.publishTargets,
        stylePresets: state.stylePresets,
        mediaAssets: state.mediaAssets,
        subtitleTracks: state.subtitleTracks,
        sidebarOpen: state.sidebarOpen,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0 || !persistedState) {
          return {};
        }
        return persistedState as Record<string, unknown>;
      },
    }
  )
);
