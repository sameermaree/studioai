/**
 * Generic local storage repository for persisting data
 */
export class LocalStorageRepository<T extends { id: string }> {
  private readonly storageKey: string;
  
  constructor(entityName: string) {
    this.storageKey = `seri-ai-studio:${entityName}`;
  }
  
  /**
   * Get all items
   */
  getAll(): T[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      return JSON.parse(data) as T[];
    } catch (error) {
      console.error(`Failed to get items from local storage: ${error}`);
      return [];
    }
  }
  
  /**
   * Get item by ID
   */
  getById(id: string): T | undefined {
    const items = this.getAll();
    return items.find(item => item.id === id);
  }
  
  /**
   * Save an item
   */
  save(item: T): T {
    try {
      const items = this.getAll();
      const existingIndex = items.findIndex(existing => existing.id === item.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        items[existingIndex] = item;
      } else {
        // Add new item
        items.push(item);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(items));
      return item;
    } catch (error) {
      console.error(`Failed to save item to local storage: ${error}`);
      return item;
    }
  }
  
  /**
   * Save multiple items
   */
  saveMany(items: T[]): T[] {
    try {
      const existingItems = this.getAll();
      const itemsById = new Map(existingItems.map(item => [item.id, item]));
      
      // Update existing items and add new ones
      for (const item of items) {
        itemsById.set(item.id, item);
      }
      
      const updatedItems = Array.from(itemsById.values());
      localStorage.setItem(this.storageKey, JSON.stringify(updatedItems));
      
      return items;
    } catch (error) {
      console.error(`Failed to save multiple items to local storage: ${error}`);
      return items;
    }
  }
  
  /**
   * Delete an item
   */
  delete(id: string): boolean {
    try {
      const items = this.getAll();
      const updatedItems = items.filter(item => item.id !== id);
      
      if (updatedItems.length === items.length) {
        return false; // Item not found
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(updatedItems));
      return true;
    } catch (error) {
      console.error(`Failed to delete item from local storage: ${error}`);
      return false;
    }
  }
  
  /**
   * Delete all items
   */
  deleteAll(): boolean {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error(`Failed to delete all items from local storage: ${error}`);
      return false;
    }
  }
  
  /**
   * Query items with a predicate function
   */
  query(predicate: (item: T) => boolean): T[] {
    const items = this.getAll();
    return items.filter(predicate);
  }
}