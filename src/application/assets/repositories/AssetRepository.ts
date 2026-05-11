import { Asset, AssetType, AssetCategory } from "../../../domain/assets/entities/Asset";

/**
 * Interface for asset repository implementations
 */
export interface AssetRepository {
  getAll(): Promise<Asset[]>;
  getById(id: string): Promise<Asset | undefined>;
  save(asset: Asset): Promise<Asset>;
  update(asset: Asset): Promise<Asset>;
  delete(id: string): Promise<boolean>;
  
  // Specialized query methods
  getByType(type: AssetType): Promise<Asset[]>;
  getByCategory(category: AssetCategory): Promise<Asset[]>;
  getByRelatedEntity(entityType: string, entityId: string): Promise<Asset[]>;
  getByTag(tag: string): Promise<Asset[]>;
  search(query: string): Promise<Asset[]>;
}

/**
 * Implementation of AssetRepository using local storage
 */
export class LocalStorageAssetRepository implements AssetRepository {
  private storageKey = 'seri-ai-studio:assets';
  
  /**
   * Get all assets
   */
  async getAll(): Promise<Asset[]> {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      return JSON.parse(data) as Asset[];
    } catch (error) {
      console.error('Failed to get assets from storage:', error);
      return [];
    }
  }
  
  /**
   * Get an asset by ID
   */
  async getById(id: string): Promise<Asset | undefined> {
    const assets = await this.getAll();
    return assets.find(asset => asset.id === id);
  }
  
  /**
   * Save a new asset or update an existing one
   */
  async save(asset: Asset): Promise<Asset> {
    try {
      const assets = await this.getAll();
      const index = assets.findIndex(a => a.id === asset.id);
      
      if (index !== -1) {
        // Update existing asset
        assets[index] = asset;
      } else {
        // Add new asset
        assets.push(asset);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(assets));
      return asset;
    } catch (error) {
      console.error('Failed to save asset to storage:', error);
      return asset;
    }
  }
  
  /**
   * Update an existing asset
   */
  async update(asset: Asset): Promise<Asset> {
    try {
      const assets = await this.getAll();
      const index = assets.findIndex(a => a.id === asset.id);
      
      if (index === -1) {
        throw new Error(`Asset with ID ${asset.id} not found`);
      }
      
      assets[index] = asset;
      localStorage.setItem(this.storageKey, JSON.stringify(assets));
      return asset;
    } catch (error) {
      console.error('Failed to update asset in storage:', error);
      return asset;
    }
  }
  
  /**
   * Delete an asset by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const assets = await this.getAll();
      const filteredAssets = assets.filter(asset => asset.id !== id);
      
      if (filteredAssets.length === assets.length) {
        return false; // Asset not found
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(filteredAssets));
      return true;
    } catch (error) {
      console.error('Failed to delete asset from storage:', error);
      return false;
    }
  }
  
  /**
   * Get assets by type
   */
  async getByType(type: AssetType): Promise<Asset[]> {
    const assets = await this.getAll();
    return assets.filter(asset => asset.type === type);
  }
  
  /**
   * Get assets by category
   */
  async getByCategory(category: AssetCategory): Promise<Asset[]> {
    const assets = await this.getAll();
    return assets.filter(asset => asset.category === category);
  }
  
  /**
   * Get assets by related entity
   */
  async getByRelatedEntity(entityType: string, entityId: string): Promise<Asset[]> {
    const assets = await this.getAll();
    return assets.filter(
      asset => 
        asset.related_entity_type === entityType && 
        asset.related_entity_id === entityId
    );
  }
  
  /**
   * Get assets by tag
   */
  async getByTag(tag: string): Promise<Asset[]> {
    const assets = await this.getAll();
    return assets.filter(asset => asset.tags.includes(tag));
  }
  
  /**
   * Search assets by query string
   */
  async search(query: string): Promise<Asset[]> {
    const assets = await this.getAll();
    const lowercaseQuery = query.toLowerCase();
    
    return assets.filter(asset => {
      // Search in display name
      if (asset.display_name.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }
      
      // Search in filename
      if (asset.filename.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }
      
      // Search in tags
      if (asset.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))) {
        return true;
      }
      
      return false;
    });
  }
}