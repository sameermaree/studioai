import React, { useState, useEffect } from 'react';
import { AssetIndexer, IndexedAsset, AssetQuery } from '../services/comfyui/assets/assetIndexer';
import { ComfyUIService } from '../services/comfyui';

interface GeneratedAssetGalleryProps {
  initialFilter?: AssetQuery;
  onAssetSelect?: (asset: IndexedAsset) => void;
  showFilters?: boolean;
  showGrouping?: boolean;
  maxItems?: number;
}

/**
 * Component for displaying and filtering generated assets
 */
const GeneratedAssetGallery: React.FC<GeneratedAssetGalleryProps> = ({
  initialFilter,
  onAssetSelect,
  showFilters = true,
  showGrouping = true,
  maxItems
}) => {
  const [assets, setAssets] = useState<IndexedAsset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<IndexedAsset | null>(null);
  const [filter, setFilter] = useState<AssetQuery>(initialFilter || {});
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'category' | 'workflow' | 'date'>('none');
  const [groupedAssets, setGroupedAssets] = useState<Record<string, IndexedAsset[]>>({});
  const [assetIndexer, setAssetIndexer] = useState<AssetIndexer | null>(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(maxItems || 24);
  
  // Initialize and load assets
  useEffect(() => {
    const initializeIndexer = async () => {
      try {
        // Get ComfyUI service
        const comfyService = ComfyUIService.getInstance();
        
        // Create asset indexer if we don't already have one
        // In a real implementation, this would come from a service or context
        let indexer = assetIndexer;
        if (!indexer) {
          indexer = new AssetIndexer();
          indexer.initialize();
          setAssetIndexer(indexer);
        }
        
        // Load assets
        loadAssets(indexer);
      } catch (error) {
        console.error('Failed to initialize asset gallery:', error);
        setError('Failed to load assets');
        setLoading(false);
      }
    };
    
    initializeIndexer();
  }, []);
  
  // Reload assets when filter or pagination changes
  useEffect(() => {
    if (assetIndexer) {
      loadAssets(assetIndexer);
    }
  }, [filter, page, itemsPerPage, groupBy]);
  
  // Load assets from the indexer
  const loadAssets = (indexer: AssetIndexer) => {
    setLoading(true);
    setError(null);
    
    try {
      // Calculate pagination
      const offset = (page - 1) * itemsPerPage;
      const limit = itemsPerPage;
      
      // Apply filter with pagination
      const queryFilter = {
        ...filter,
        offset,
        limit
      };
      
      if (groupBy !== 'none') {
        // Get grouped assets
        const grouped = indexer.getGrouped(groupBy, filter);
        setGroupedAssets(grouped);
        
        // Calculate total
        let total = 0;
        for (const group in grouped) {
          total += grouped[group].length;
        }
        setTotalAssets(total);
        
        // Flatten for alternative display
        const allAssets: IndexedAsset[] = [];
        for (const group in grouped) {
          allAssets.push(...grouped[group]);
        }
        setAssets(allAssets);
      } else {
        // Get assets normally
        const result = indexer.search(queryFilter);
        setAssets(result.assets);
        setTotalAssets(result.total);
        setGroupedAssets({});
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle asset selection
  const handleAssetClick = (asset: IndexedAsset) => {
    setSelectedAsset(asset);
    if (onAssetSelect) {
      onAssetSelect(asset);
    }
  };
  
  // Update filter
  const updateFilter = (updates: Partial<AssetQuery>) => {
    setFilter(prev => ({ ...prev, ...updates }));
    setPage(1); // Reset to first page when filter changes
  };
  
  // Handle type filter change
  const handleTypeFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilter({ type: value === 'all' ? undefined : value });
  };
  
  // Handle category filter change
  const handleCategoryFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilter({ category: value === 'all' ? undefined : value });
  };
  
  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateFilter({ searchText: value.length > 0 ? value : undefined });
  };
  
  // Handle tag click
  const handleTagClick = (tag: string) => {
    updateFilter({ 
      tags: filter.tags?.includes(tag) 
        ? filter.tags.filter(t => t !== tag)
        : [...(filter.tags || []), tag]
    });
  };
  
  // Handle group by change
  const handleGroupByChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as 'none' | 'type' | 'category' | 'workflow' | 'date';
    setGroupBy(value);
  };
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  // Render pagination controls
  const renderPagination = () => {
    const totalPages = Math.ceil(totalAssets / itemsPerPage);
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex justify-center mt-4 space-x-2">
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          className={`px-3 py-1 rounded ${
            page === 1 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Previous
        </button>
        
        <span className="px-3 py-1">
          Page {page} of {totalPages}
        </span>
        
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
          className={`px-3 py-1 rounded ${
            page >= totalPages 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Next
        </button>
      </div>
    );
  };
  
  return (
    <div className="w-full">
      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded shadow">
          <h3 className="text-lg font-medium mb-2">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={filter.type?.toString() || 'all'}
                onChange={handleTypeFilterChange}
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={filter.category?.toString() || 'all'}
                onChange={handleCategoryFilterChange}
              >
                <option value="all">All Categories</option>
                <option value="character">Characters</option>
                <option value="background">Backgrounds</option>
                <option value="scene">Scenes</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <input
                type="text"
                placeholder="Search prompts, tags..."
                className="w-full px-3 py-2 border rounded"
                value={filter.searchText || ''}
                onChange={handleSearchChange}
              />
            </div>
          </div>
          
          {showGrouping && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group By
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={groupBy}
                onChange={handleGroupByChange}
              >
                <option value="none">No Grouping</option>
                <option value="type">Type</option>
                <option value="category">Category</option>
                <option value="workflow">Workflow</option>
                <option value="date">Date</option>
              </select>
            </div>
          )}
          
          {filter.tags && filter.tags.length > 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Active Tags:
              </label>
              <div className="flex flex-wrap gap-2">
                {filter.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs cursor-pointer hover:bg-blue-200"
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag} &times;
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {/* Loading state */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Loading assets...</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded shadow">
          <p className="text-gray-500">No assets found matching your criteria.</p>
        </div>
      ) : (
        <>
          {/* Grouped display */}
          {groupBy !== 'none' && Object.keys(groupedAssets).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedAssets).map(([group, groupAssets]) => (
                <div key={group} className="bg-white dark:bg-gray-800 rounded shadow p-4">
                  <h3 className="text-lg font-medium mb-3">{group}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {groupAssets.map(asset => (
                      <div
                        key={asset.id}
                        className={`border rounded overflow-hidden cursor-pointer transition-transform hover:scale-105 ${
                          selectedAsset?.id === asset.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'
                        }`}
                        onClick={() => handleAssetClick(asset)}
                      >
                        {asset.type === 'image' ? (
                          <img
                            src={asset.thumbnailUrl || asset.url}
                            alt={asset.prompt || 'Generated asset'}
                            className="w-full h-32 object-cover"
                            loading="lazy"
                          />
                        ) : asset.type === 'video' ? (
                          <video
                            src={asset.url}
                            className="w-full h-32 object-cover"
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400">{asset.type}</span>
                          </div>
                        )}
                        <div className="p-2">
                          <div className="text-xs truncate" title={asset.prompt || ''}>
                            {asset.prompt ? asset.prompt.substring(0, 30) + '...' : 'No prompt'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(asset.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Standard grid display
            <div className="bg-white dark:bg-gray-800 rounded shadow p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {assets.map(asset => (
                  <div
                    key={asset.id}
                    className={`border rounded overflow-hidden cursor-pointer transition-transform hover:scale-105 ${
                      selectedAsset?.id === asset.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'
                    }`}
                    onClick={() => handleAssetClick(asset)}
                  >
                    {asset.type === 'image' ? (
                      <img
                        src={asset.thumbnailUrl || asset.url}
                        alt={asset.prompt || 'Generated asset'}
                        className="w-full h-32 object-cover"
                        loading="lazy"
                      />
                    ) : asset.type === 'video' ? (
                      <video
                        src={asset.url}
                        className="w-full h-32 object-cover"
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400">{asset.type}</span>
                      </div>
                    )}
                    <div className="p-2">
                      <div className="text-xs truncate" title={asset.prompt || ''}>
                        {asset.prompt ? asset.prompt.substring(0, 30) + '...' : 'No prompt'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(asset.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Pagination */}
          {renderPagination()}
        </>
      )}
      
      {/* Selected asset detail */}
      {selectedAsset && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded shadow p-4">
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/2">
              {selectedAsset.type === 'image' ? (
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.prompt || 'Generated asset'}
                  className="w-full h-auto max-h-96 object-contain rounded"
                />
              ) : selectedAsset.type === 'video' ? (
                <video
                  src={selectedAsset.url}
                  controls
                  className="w-full h-auto max-h-96 object-contain rounded"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded">
                  <span className="text-gray-400">{selectedAsset.type}</span>
                </div>
              )}
            </div>
            
            <div className="w-full md:w-1/2 md:pl-4 mt-4 md:mt-0">
              <h3 className="text-lg font-medium mb-2">Asset Details</h3>
              
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Prompt:</span>
                  <p className="text-sm">{selectedAsset.prompt || 'None'}</p>
                </div>
                
                {selectedAsset.negativePrompt && (
                  <div>
                    <span className="font-medium">Negative Prompt:</span>
                    <p className="text-sm">{selectedAsset.negativePrompt}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Type:</span>
                    <p className="text-sm">{selectedAsset.type}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium">Category:</span>
                    <p className="text-sm">{selectedAsset.category}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium">Created:</span>
                    <p className="text-sm">{formatDate(selectedAsset.createdAt)}</p>
                  </div>
                  
                  {selectedAsset.width && selectedAsset.height && (
                    <div>
                      <span className="font-medium">Size:</span>
                      <p className="text-sm">{selectedAsset.width} × {selectedAsset.height}</p>
                    </div>
                  )}
                  
                  {selectedAsset.duration && (
                    <div>
                      <span className="font-medium">Duration:</span>
                      <p className="text-sm">{selectedAsset.duration}s</p>
                    </div>
                  )}
                  
                  {selectedAsset.fps && (
                    <div>
                      <span className="font-medium">FPS:</span>
                      <p className="text-sm">{selectedAsset.fps}</p>
                    </div>
                  )}
                  
                  {selectedAsset.workflowName && (
                    <div>
                      <span className="font-medium">Workflow:</span>
                      <p className="text-sm">{selectedAsset.workflowName}</p>
                    </div>
                  )}
                  
                  {selectedAsset.modelName && (
                    <div>
                      <span className="font-medium">Model:</span>
                      <p className="text-sm">{selectedAsset.modelName}</p>
                    </div>
                  )}
                </div>
                
                {/* Tags */}
                {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                  <div>
                    <span className="font-medium">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedAsset.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs cursor-pointer hover:bg-blue-100"
                          onClick={() => handleTagClick(tag)}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex space-x-2 pt-2">
                  <a
                    href={selectedAsset.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneratedAssetGallery;