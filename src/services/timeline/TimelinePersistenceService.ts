import { CinematicTimeline } from '../video/TimelineEngine';

/**
 * Service for managing timeline persistence
 */
export class TimelinePersistenceService {
  private readonly storageKeyPrefix: string = 'timeline_';
  private readonly metaStorageKey: string = 'timeline_metadata';
  
  /**
   * Save a timeline to local storage
   */
  public saveTimeline(timeline: CinematicTimeline): boolean {
    try {
      // Update the timestamp
      const updatedTimeline: CinematicTimeline = {
        ...timeline,
        updated: new Date().toISOString()
      };
      
      // Serialize and store
      const serialized = JSON.stringify(updatedTimeline);
      localStorage.setItem(this.getStorageKey(timeline.id), serialized);
      
      // Update metadata index
      this.updateTimelineIndex(updatedTimeline);
      
      return true;
    } catch (error) {
      console.error('Failed to save timeline:', error);
      return false;
    }
  }
  
  /**
   * Load a timeline from local storage
   */
  public loadTimeline(id: string): CinematicTimeline | null {
    try {
      const serialized = localStorage.getItem(this.getStorageKey(id));
      
      if (!serialized) {
        return null;
      }
      
      return JSON.parse(serialized) as CinematicTimeline;
    } catch (error) {
      console.error('Failed to load timeline:', error);
      return null;
    }
  }
  
  /**
   * Delete a timeline from local storage
   */
  public deleteTimeline(id: string): boolean {
    try {
      localStorage.removeItem(this.getStorageKey(id));
      this.removeFromTimelineIndex(id);
      return true;
    } catch (error) {
      console.error('Failed to delete timeline:', error);
      return false;
    }
  }
  
  /**
   * Get all timeline metadata
   */
  public getTimelineList(): Array<{
    id: string;
    name: string;
    description?: string;
    duration: number;
    created: string;
    updated: string;
  }> {
    try {
      const serialized = localStorage.getItem(this.metaStorageKey);
      
      if (!serialized) {
        return [];
      }
      
      return JSON.parse(serialized);
    } catch (error) {
      console.error('Failed to get timeline list:', error);
      return [];
    }
  }
  
  /**
   * Export a timeline to a file
   */
  public exportTimelineToFile(timeline: CinematicTimeline): void {
    try {
      const serialized = JSON.stringify(timeline, null, 2);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and click it
      const a = document.createElement('a');
      a.href = url;
      a.download = `${timeline.name.replace(/\s+/g, '_')}_${timeline.id}.timeline.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      console.error('Failed to export timeline:', error);
      throw error;
    }
  }
  
  /**
   * Import a timeline from a file
   */
  public importTimelineFromJson(json: string): CinematicTimeline {
    try {
      const imported = JSON.parse(json) as CinematicTimeline;
      
      // Generate a new ID to avoid conflicts
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Create a new timeline with the imported data but new ID
      const timeline: CinematicTimeline = {
        ...imported,
        id: newId,
        name: `${imported.name} (Imported)`,
        created: now,
        updated: now
      };
      
      // Save the imported timeline
      this.saveTimeline(timeline);
      
      return timeline;
    } catch (error) {
      console.error('Failed to import timeline:', error);
      throw new Error(`Invalid timeline file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Update the timeline index with metadata
   */
  private updateTimelineIndex(timeline: CinematicTimeline): void {
    try {
      const metadata = {
        id: timeline.id,
        name: timeline.name,
        description: timeline.description,
        duration: timeline.duration,
        created: timeline.created,
        updated: timeline.updated
      };
      
      // Get existing index
      const existingIndex = this.getTimelineList();
      
      // Find if this timeline already exists in the index
      const existingEntryIndex = existingIndex.findIndex(entry => entry.id === timeline.id);
      
      if (existingEntryIndex !== -1) {
        // Update existing entry
        existingIndex[existingEntryIndex] = metadata;
      } else {
        // Add new entry
        existingIndex.push(metadata);
      }
      
      // Save updated index
      localStorage.setItem(this.metaStorageKey, JSON.stringify(existingIndex));
    } catch (error) {
      console.error('Failed to update timeline index:', error);
    }
  }
  
  /**
   * Remove a timeline from the index
   */
  private removeFromTimelineIndex(id: string): void {
    try {
      // Get existing index
      const existingIndex = this.getTimelineList();
      
      // Filter out the timeline
      const updatedIndex = existingIndex.filter(entry => entry.id !== id);
      
      // Save updated index
      localStorage.setItem(this.metaStorageKey, JSON.stringify(updatedIndex));
    } catch (error) {
      console.error('Failed to remove timeline from index:', error);
    }
  }
  
  /**
   * Get the storage key for a timeline
   */
  private getStorageKey(id: string): string {
    return this.storageKeyPrefix + id;
  }
}