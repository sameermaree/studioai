import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GeneratedAssetGallery from '../components/GeneratedAssetGallery';
import { AssetIndexer, IndexedAsset, SearchResult } from '../services/comfyui/assets/assetIndexer';
import { ComfyUIService } from '../services/comfyui';
import ComfyUIStatus from '../components/ComfyUIStatus';

/**
 * Page for managing assets generated with ComfyUI
 */
const ComfyUIAssets: React.FC = () => {
  const [assetIndexer, setAssetIndexer] = useState<AssetIndexer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [assetStats, setAssetStats] = useState<any>({
    totalCount: 0,
    typeBreakdown: {},
    categoryBreakdown: {}
  });
  const [activeView, setActiveView] = useState<'gallery' | 'stats'>('gallery');
  const [error, setError] = useState<string | null>(null);
  
  // Initialize asset indexer
  useEffect(() => {
    const initialize = async () => {
      try {
        // Get ComfyUI service
        const comfyService = ComfyUIService.getInstance();
        await comfyService.initialize();
        
        // Create asset indexer
        const indexer = new AssetIndexer();
        indexer.initialize();
        setAssetIndexer(indexer);
        
        // Load statistics
        const stats = indexer.getStatistics();
        setAssetStats(stats);
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize ComfyUI Assets page:', error);
        setError(error instanceof Error ? error.message : String(error));
      }
    };
    
    initialize();
  }, []);
  
  // Mock asset indexing for demo purposes
  // In a real app, assets would be indexed when they're created
  useEffect(() => {
    if (assetIndexer && isInitialized) {
      // Only add mock assets if none exist
      if (assetStats.totalCount === 0) {
        createMockAssets();
      }
    }
  }, [assetIndexer, isInitialized]);
  
  // Create mock assets for demonstration
  const createMockAssets = () => {
    if (!assetIndexer) return;
    
    const mockTypes = ['image', 'video'];
    const mockCategories = ['character', 'background', 'scene'];
    const mockTags = ['fantasy', 'portrait', 'landscape', 'scifi', 'dramatic', 'colorful'];
    const mockWorkflows = ['SDXL Text to Image', 'AnimateDiff Text to Video', 'SD 1.5 Image to Image'];
    const mockModels = ['SDXL 1.0', 'Stable Diffusion 1.5', 'Realistic Vision V4'];
    
    const mockPrompts = [
      'A beautiful mountain landscape at sunset with dramatic clouds',
      'A futuristic city with flying cars and neon lights',
      'Portrait of a fantasy character with glowing magical elements',
      'Underwater scene with colorful coral and exotic fish',
      'Serene forest pathway with sunlight filtering through trees',
      'A medieval castle on a hill overlooking a village'
    ];
    
    // Create 20 mock assets
    for (let i = 0; i < 20; i++) {
      const type = mockTypes[Math.floor(Math.random() * mockTypes.length)];
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
      
      // Create mock asset
      const asset = {
        id: `mock-asset-${i + 1}`,
        url: `https://picsum.photos/seed/${i + 1}/800/600`, // Placeholder image URL
        thumbnailUrl: `https://picsum.photos/seed/${i + 1}/400/300`,
        type,
        category: mockCategories[Math.floor(Math.random() * mockCategories.length)],
        createdAt: date.toISOString(),
        metadata: {
          width: type === 'image' ? 800 : 512,
          height: type === 'image' ? 600 : 512,
          duration: type === 'video' ? 5 : undefined,
          fps: type === 'video' ? 24 : undefined
        },
        tags: Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map(() => 
          mockTags[Math.floor(Math.random() * mockTags.length)]
        ),
        prompt: mockPrompts[Math.floor(Math.random() * mockPrompts.length)],
        negativePrompt: 'blurry, bad quality, deformed',
        width: type === 'image' ? 800 : 512,
        height: type === 'image' ? 600 : 512,
        duration: type === 'video' ? 5 : undefined,
        fps: type === 'video' ? 24 : undefined,
        workflowId: `workflow-${i % 3 + 1}`,
        workflowName: mockWorkflows[i % mockWorkflows.length],
        modelName: mockModels[Math.floor(Math.random() * mockModels.length)],
        generationType: type === 'image' ? 'txt2img' : 'txt2vid',
        batchId: `batch-${Math.floor(i / 4) + 1}`,
        jobId: `job-${i + 1}`
      };
      
      assetIndexer.indexAsset({
        id: asset.id,
        filename: `asset-${i + 1}.${type === 'image' ? 'png' : 'mp4'}`,
        display_name: asset.prompt || 'Generated asset',
        type,
        category: asset.category,
        mime_type: type === 'image' ? 'image/png' : 'video/mp4',
        status: 'complete',
        path: '',
        url: asset.url,
        thumbnail_url: asset.thumbnailUrl,
        metadata: asset.metadata,
        tags: asset.tags,
        created_at: asset.createdAt,
        updated_at: asset.createdAt
      }, {
        prompt: asset.prompt,
        negativePrompt: asset.negativePrompt,
        workflow: {
          id: asset.workflowId!,
          name: asset.workflowName!,
          type: asset.generationType,
          path: '',
          inputNodes: {},
          outputNodes: {},
          parameterMapping: {},
          created_at: '',
          updated_at: ''
        },
        modelName: asset.modelName,
        batchId: asset.batchId,
        jobId: asset.jobId
      });
    }
    
    // Update statistics
    const stats = assetIndexer.getStatistics();
    setAssetStats(stats);
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ComfyUI Assets</h1>
        <div className="flex space-x-2">
          <Link to="/comfyui" className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
            ComfyUI Studio
          </Link>
          <Link to="/comfyui/advanced" className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm">
            Advanced Mode
          </Link>
        </div>
      </div>
      
      {/* ComfyUI Status Component */}
      <ComfyUIStatus />
      
      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button 
            className="ml-2 px-2 py-1 bg-red-200 text-red-700 rounded hover:bg-red-300"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* View toggle */}
      <div className="mb-4">
        <div className="flex border-b border-gray-200">
          <button
            className={`py-2 px-4 border-b-2 ${
              activeView === 'gallery' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveView('gallery')}
          >
            Gallery
          </button>
          <button
            className={`py-2 px-4 border-b-2 ${
              activeView === 'stats' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveView('stats')}
          >
            Statistics
          </button>
        </div>
      </div>
      
      {isInitialized ? (
        activeView === 'gallery' ? (
          <GeneratedAssetGallery
            showFilters={true}
            showGrouping={true}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Asset Statistics</h3>
            
            {/* Overall stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                  {assetStats.totalCount}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Assets
                </div>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-300">
                  {Object.keys(assetStats.workflowBreakdown).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Workflows Used
                </div>
              </div>
              
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                  {Object.keys(assetStats.tagsBreakdown).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Unique Tags
                </div>
              </div>
            </div>
            
            {/* Detailed breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type breakdown */}
              <div>
                <h4 className="font-medium mb-2">Assets by Type</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                  {Object.entries(assetStats.typeBreakdown).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center mb-2">
                      <span className="capitalize">{type}</span>
                      <div className="flex items-center">
                        <div className="h-2 bg-blue-500 rounded mr-2" style={{ 
                          width: `${(Number(count) / assetStats.totalCount) * 100}px` 
                        }}></div>
                        <span>{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Category breakdown */}
              <div>
                <h4 className="font-medium mb-2">Assets by Category</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                  {Object.entries(assetStats.categoryBreakdown).map(([category, count]) => (
                    <div key={category} className="flex justify-between items-center mb-2">
                      <span className="capitalize">{category}</span>
                      <div className="flex items-center">
                        <div className="h-2 bg-green-500 rounded mr-2" style={{ 
                          width: `${(Number(count) / assetStats.totalCount) * 100}px` 
                        }}></div>
                        <span>{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Workflow breakdown */}
              <div>
                <h4 className="font-medium mb-2">Assets by Workflow</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                  {Object.entries(assetStats.workflowBreakdown).map(([workflow, count]) => (
                    <div key={workflow} className="flex justify-between items-center mb-2">
                      <span className="truncate max-w-xs">{workflow}</span>
                      <div className="flex items-center">
                        <div className="h-2 bg-purple-500 rounded mr-2" style={{ 
                          width: `${(Number(count) / assetStats.totalCount) * 100}px` 
                        }}></div>
                        <span>{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Model breakdown */}
              <div>
                <h4 className="font-medium mb-2">Assets by Model</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
                  {Object.entries(assetStats.modelBreakdown).map(([model, count]) => (
                    <div key={model} className="flex justify-between items-center mb-2">
                      <span className="truncate max-w-xs">{model}</span>
                      <div className="flex items-center">
                        <div className="h-2 bg-yellow-500 rounded mr-2" style={{ 
                          width: `${(Number(count) / assetStats.totalCount) * 100}px` 
                        }}></div>
                        <span>{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Tags */}
              <div className="md:col-span-2">
                <h4 className="font-medium mb-2">Popular Tags</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded flex flex-wrap gap-2">
                  {Object.entries(assetStats.tagsBreakdown)
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .slice(0, 15)
                    .map(([tag, count]) => (
                      <div key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 rounded">
                        {tag} ({count})
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Initializing asset management...</p>
        </div>
      )}
    </div>
  );
};

export default ComfyUIAssets;