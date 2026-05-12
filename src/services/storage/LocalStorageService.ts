import type { Character, Episode, Prompt, RenderJob, MediaAsset, SubtitleTrack } from '../../types';

export interface AppData {
  version: number;
  characters: Character[];
  episodes: Episode[];
  prompts: Prompt[];
  renderJobs: RenderJob[];
  mediaAssets: MediaAsset[];
  subtitleTracks: SubtitleTrack[];
  settings?: Record<string, any>;
  lastSaved?: string;
}

const STORAGE_KEY = 'studio-ai-data';
const CURRENT_VERSION = 2;

export class LocalStorageService {
  /**
   * Load data from localStorage
   */
  load(): AppData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        console.log('No saved data found in localStorage');
        return null;
      }

      const data = JSON.parse(stored) as AppData;
      console.log(`Loaded data from localStorage. Episodes: ${data.episodes?.length || 0}, Characters: ${data.characters?.length || 0}`);
      
      // Validate and migrate if needed
      return this.validateAndMigrate(data);
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Save data to localStorage
   */
  save(data: Partial<AppData>): boolean {
    try {
      const fullData: AppData = {
        version: CURRENT_VERSION,
        characters: data.characters || [],
        episodes: data.episodes || [],
        prompts: data.prompts || [],
        renderJobs: data.renderJobs || [],
        mediaAssets: data.mediaAssets || [],
        subtitleTracks: data.subtitleTracks || [],
        settings: data.settings || {},
        lastSaved: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
      console.log(`Saved to localStorage. Episodes: ${fullData.episodes.length}, Characters: ${fullData.characters.length}`);
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  /**
   * Validate and migrate data if necessary
   */
  private validateAndMigrate(data: any): AppData {
    const validated: AppData = {
      version: data.version || 1,
      characters: Array.isArray(data.characters) ? data.characters : [],
      episodes: Array.isArray(data.episodes) ? data.episodes : [],
      prompts: Array.isArray(data.prompts) ? data.prompts : [],
      renderJobs: Array.isArray(data.renderJobs) ? data.renderJobs : [],
      mediaAssets: Array.isArray(data.mediaAssets) ? data.mediaAssets : [],
      subtitleTracks: Array.isArray(data.subtitleTracks) ? data.subtitleTracks : [],
      settings: data.settings || {},
      lastSaved: data.lastSaved || new Date().toISOString(),
    };

    // Migrate if needed
    if (validated.version < CURRENT_VERSION) {
      console.log(`Migrating data from version ${validated.version} to ${CURRENT_VERSION}`);
      validated.version = CURRENT_VERSION;
    }

    return validated;
  }

  /**
   * Clear all saved data
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('Cleared localStorage');
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Export data to downloadable JSON file
   */
  exportToFile(data: AppData): void {
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      console.log('Data exported to file');
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  }

  /**
   * Import data from uploaded JSON file
   */
  async importFromFile(file: File): Promise<AppData | null> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as AppData;
      
      const validated = this.validateAndMigrate(data);
      this.save(validated);
      
      console.log('Data imported from file');
      return validated;
    } catch (error) {
      console.error('Failed to import data:', error);
      return null;
    }
  }
}

export const localStorageService = new LocalStorageService();
