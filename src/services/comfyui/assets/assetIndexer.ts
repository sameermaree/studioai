import { Asset } from '../../../domain/assets/entities/Asset';
import { WorkflowTemplate } from '../../../infrastructure/ai/services/ComfyUIOrchestrator';

export interface IndexedAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  category: string;
  createdAt: string;
  metadata: any;
  tags: string[];
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  workflowId?: string;
  workflowName?: string;
  modelName?: string;
  generationType?: string;
  batchId?: string;
  jobId?: string;
}

export interface AssetQuery {
  type?: string | string[];
  category?: string | string[];
  tags?: string[];
  workflowId?: string;
  batchId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchText?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'name' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  assets: IndexedAsset[];
  total: number;
  query: AssetQuery;
}

/**
 * Service for indexing and searching generated assets
 */
export class AssetIndexer {
  private storageKey = 'comfyui_asset_index';
  private assets: Map<string, IndexedAsset> = new Map();
  private loaded = false;
  
  /**
   * Initialize the asset indexer
   */
  public initialize(): void {
    this.loadFromStorage();
  }
  
  /**
   * Index a new asset
   */
  public indexAsset(
    asset: Asset,
    options?: {
      prompt?: string;
      negativePrompt?: string;
      workflow?: WorkflowTemplate;
      modelName?: string;
      batchId?: string;
      jobId?: string;
    }
  ): IndexedAsset {
    // Create indexed asset
    const indexedAsset: IndexedAsset = {
      id: asset.id,
      url: asset.url,
      thumbnailUrl: asset.thumbnail_url,
      type: asset.type,
      category: asset.category,
      createdAt: asset.created_at,
      metadata: { ...asset.metadata },
      tags: [...asset.tags],
      prompt: options?.prompt,
      negativePrompt: options?.negativePrompt,
      width: asset.metadata.width,
      height: asset.metadata.height,
      duration: asset.metadata.duration,
      fps: asset.metadata.framerate,
      workflowId: options?.workflow?.id,
      workflowName: options?.workflow?.name,
      modelName: options?.modelName,
      generationType: options?.workflow?.type,
      batchId: options?.batchId,
      jobId: options?.jobId
    };
    
    // Store in memory
    this.assets.set(asset.id, indexedAsset);
    
    // Save to storage
    this.saveToStorage();
    
    return indexedAsset;
  }
  
  /**
   * Update an indexed asset
   */
  public updateAsset(id: string, updates: Partial<IndexedAsset>): IndexedAsset | null {
    const asset = this.assets.get(id);
    
    if (!asset) {
      return null;
    }
    
    // Update fields
    const updatedAsset = { ...asset, ...updates };
    
    // Store updated asset
    this.assets.set(id, updatedAsset);
    
    // Save to storage
    this.saveToStorage();
    
    return updatedAsset;
  }
  
  /**
   * Remove an asset from the index
   */
  public removeAsset(id: string): boolean {
    const exists = this.assets.has(id);
    
    if (!exists) {
      return false;
    }
    
    // Remove from memory
    this.assets.delete(id);
    
    // Save to storage
    this.saveToStorage();
    
    return true;
  }
  
  /**
   * Get an asset by ID
   */
  public getAsset(id: string): IndexedAsset | null {
    return this.assets.get(id) || null;
  }
  
  /**
   * Search for assets
   */
  public search(query: AssetQuery): SearchResult {
    // Ensure index is loaded
    if (!this.loaded) {
      this.loadFromStorage();
    }
    
    // Convert assets to array
    let assets = Array.from(this.assets.values());
    
    // Apply filters
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      assets = assets.filter(asset => types.includes(asset.type));
    }
    
    if (query.category) {
      const categories = Array.isArray(query.category) ? query.category : [query.category];
      assets = assets.filter(asset => categories.includes(asset.category));
    }
    
    if (query.tags && query.tags.length > 0) {
      assets = assets.filter(asset => 
        query.tags!.some(tag => asset.tags.includes(tag))
      );
    }
    
    if (query.workflowId) {
      assets = assets.filter(asset => asset.workflowId === query.workflowId);
    }
    
    if (query.batchId) {
      assets = assets.filter(asset => asset.batchId === query.batchId);
    }
    
    if (query.dateFrom) {
      const fromDate = query.dateFrom.getTime();
      assets = assets.filter(asset => 
        new Date(asset.createdAt).getTime() >= fromDate
      );
    }
    
    if (query.dateTo) {
      const toDate = query.dateTo.getTime();
      assets = assets.filter(asset => 
        new Date(asset.createdAt).getTime() <= toDate
      );
    }
    
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      assets = assets.filter(asset => 
        asset.prompt?.toLowerCase().includes(searchLower) ||
        asset.workflowName?.toLowerCase().includes(searchLower) ||
        asset.modelName?.toLowerCase().includes(searchLower) ||
        asset.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Count total before pagination
    const total = assets.length;
    
    // Apply sorting
    if (query.sortBy) {
      assets.sort((a, b) => {
        let compareResult = 0;
        
        switch (query.sortBy) {
          case 'date':
            compareResult = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'name':
            compareResult = (a.prompt || '').localeCompare(b.prompt || '');
            break;
          case 'type':
            compareResult = a.type.localeCompare(b.type);
            break;
          default:
            compareResult = 0;
        }
        
        return query.sortOrder === 'desc' ? -compareResult : compareResult;
      });
    } else {
      // Default sort by date, newest first
      assets.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    
    // Apply pagination
    if (query.offset || query.limit) {
      const offset = query.offset || 0;
      const limit = query.limit || assets.length;
      assets = assets.slice(offset, offset + limit);
    }
    
    return {
      assets,
      total,
      query
    };
  }
  
  /**
   * Get assets grouped by a field
   */
  public getGrouped(
    groupBy: 'type' | 'category' | 'workflow' | 'model' | 'batch' | 'date',
    filter?: AssetQuery
  ): Record<string, IndexedAsset[]> {
    // Get assets (potentially filtered)
    const searchResult = filter ? this.search(filter) : { assets: Array.from(this.assets.values()), total: this.assets.size, query: {} };
    
    // Group assets
    const grouped: Record<string, IndexedAsset[]> = {};
    
    for (const asset of searchResult.assets) {
      let key: string;
      
      switch (groupBy) {
        case 'type':
          key = asset.type;
          break;
        case 'category':
          key = asset.category;
          break;
        case 'workflow':
          key = asset.workflowName || 'Unknown';
          break;
        case 'model':
          key = asset.modelName || 'Unknown';
          break;
        case 'batch':
          key = asset.batchId || 'None';
          break;
        case 'date':
          // Group by date (YYYY-MM-DD)
          const date = new Date(asset.createdAt);
          key = date.toISOString().split('T')[0];
          break;
        default:
          key = 'all';
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      grouped[key].push(asset);
    }
    
    return grouped;
  }
  
  /**
   * Get asset statistics
   */
  public getStatistics(): {
    totalCount: number;
    typeBreakdown: Record<string, number>;
    categoryBreakdown: Record<string, number>;
    workflowBreakdown: Record<string, number>;
    modelBreakdown: Record<string, number>;
    batchBreakdown: Record<string, number>;
    tagsBreakdown: Record<string, number>;
  } {
    const assets = Array.from(this.assets.values());
    
    // Initialize statistics
    const statistics = {
      totalCount: assets.length,
      typeBreakdown: {} as Record<string, number>,
      categoryBreakdown: {} as Record<string, number>,
      workflowBreakdown: {} as Record<string, number>,
      modelBreakdown: {} as Record<string, number>,
      batchBreakdown: {} as Record<string, number>,
      tagsBreakdown: {} as Record<string, number>
    };
    
    // Calculate breakdowns
    for (const asset of assets) {
      // Type breakdown
      if (!statistics.typeBreakdown[asset.type]) {
        statistics.typeBreakdown[asset.type] = 0;
      }
      statistics.typeBreakdown[asset.type]++;
      
      // Category breakdown
      if (!statistics.categoryBreakdown[asset.category]) {
        statistics.categoryBreakdown[asset.category] = 0;
      }
      statistics.categoryBreakdown[asset.category]++;
      
      // Workflow breakdown
      const workflowName = asset.workflowName || 'Unknown';
      if (!statistics.workflowBreakdown[workflowName]) {
        statistics.workflowBreakdown[workflowName] = 0;
      }
      statistics.workflowBreakdown[workflowName]++;
      
      // Model breakdown
      const modelName = asset.modelName || 'Unknown';
      if (!statistics.modelBreakdown[modelName]) {
        statistics.modelBreakdown[modelName] = 0;
      }
      statistics.modelBreakdown[modelName]++;
      
      // Batch breakdown
      const batchId = asset.batchId || 'None';
      if (!statistics.batchBreakdown[batchId]) {
        statistics.batchBreakdown[batchId] = 0;
      }
      statistics.batchBreakdown[batchId]++;
      
      // Tags breakdown
      for (const tag of asset.tags) {
        if (!statistics.tagsBreakdown[tag]) {
          statistics.tagsBreakdown[tag] = 0;
        }
        statistics.tagsBreakdown[tag]++;
      }
    }
    
    return statistics;
  }
  
  /**
   * Clear all indexed assets
   */
  public clear(): void {
    this.assets.clear();
    this.saveToStorage();
  }
  
  /**
   * Load the asset index from local storage
   */
  private loadFromStorage(): void {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      
      if (serialized) {
        const parsed = JSON.parse(serialized) as IndexedAsset[];
        
        // Clear existing assets
        this.assets.clear();
        
        // Add to map
        for (const asset of parsed) {
          this.assets.set(asset.id, asset);
        }
      }
      
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load asset index from storage:', error);
      this.loaded = true;
    }
  }
  
  /**
   * Save the asset index to local storage
   */
  private saveToStorage(): void {
    try {
      const serialized = JSON.stringify(Array.from(this.assets.values()));
      localStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      console.error('Failed to save asset index to storage:', error);
    }
  }
}