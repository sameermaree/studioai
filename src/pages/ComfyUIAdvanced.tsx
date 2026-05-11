import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ComfyUIService } from '../services/comfyui';
import ComfyUIStatus from '../components/ComfyUIStatus';
import BatchGenerationPanel from '../components/BatchGenerationPanel';
import { ModelInfo } from '../services/comfyui/modelManager';

/**
 * Advanced ComfyUI management page
 */
const ComfyUIAdvanced: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batch' | 'models' | 'templates' | 'queue'>('batch');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeModels, setActiveModels] = useState<Map<string, string>>(new Map());
  
  useEffect(() => {
    // Load data based on active tab
    if (activeTab === 'models') {
      loadModels();
    } else if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab]);
  
  const loadModels = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const comfyService = ComfyUIService.getInstance();
      const modelManager = comfyService.getModelManager();
      
      const allModels = await modelManager.loadModels();
      setModels(allModels);
      
      const activeModelMap = modelManager.getActiveModels();
      setActiveModels(activeModelMap);
    } catch (error) {
      console.error('Failed to load models:', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const comfyService = ComfyUIService.getInstance();
      const allTemplates = comfyService.getWorkflowTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };
  
  const switchModel = async (type: string, modelName: string) => {
    try {
      const comfyService = ComfyUIService.getInstance();
      const modelManager = comfyService.getModelManager();
      
      const result = await modelManager.switchModel(type, modelName);
      
      if (result.success) {
        // Update active models
        setActiveModels(prev => {
          const newMap = new Map(prev);
          newMap.set(type, modelName);
          return newMap;
        });
      } else {
        setError(`Failed to switch model: ${result.error}`);
      }
    } catch (error) {
      console.error('Error switching model:', error);
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ComfyUI Advanced Management</h1>
        <div className="flex space-x-2">
          <Link to="/comfyui" className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
            ComfyUI Studio
          </Link>
          <Link to="/comfyui/assets" className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
            Assets Gallery
          </Link>
        </div>
      </div>
      
      {/* ComfyUI Status Component */}
      <ComfyUIStatus />
      
      {/* Tab Navigation */}
      <div className="mb-4 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${
                activeTab === 'batch'
                  ? 'text-blue-600 border-b-2 border-blue-600 active'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('batch')}
            >
              Batch Generation
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${
                activeTab === 'models'
                  ? 'text-blue-600 border-b-2 border-blue-600 active'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('models')}
            >
              Models
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${
                activeTab === 'templates'
                  ? 'text-blue-600 border-b-2 border-blue-600 active'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('templates')}
            >
              Templates
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${
                activeTab === 'queue'
                  ? 'text-blue-600 border-b-2 border-blue-600 active'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('queue')}
            >
              Render Queue
            </button>
          </li>
        </ul>
      </div>
      
      {/* Tab Content */}
      <div className="mt-4">
        {/* Batch Generation Tab */}
        {activeTab === 'batch' && (
          <BatchGenerationPanel 
            onBatchCreated={(id) => console.log(`Batch created: ${id}`)}
            onBatchStarted={(id) => console.log(`Batch started: ${id}`)}
            onBatchCompleted={(id) => console.log(`Batch completed: ${id}`)}
          />
        )}
        
        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Available Models
              </h3>
              <button
                onClick={loadModels}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh Models'}
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            {isLoading ? (
              <div className="text-center py-4">Loading models...</div>
            ) : (
              <div>
                {models.length === 0 ? (
                  <p className="text-gray-500">No models found or ComfyUI is not connected.</p>
                ) : (
                  <div>
                    {/* Group models by type */}
                    {Array.from(new Set(models.map(m => m.type))).map(type => (
                      <div key={type} className="mb-6">
                        <h4 className="text-md font-medium mb-2 border-b pb-1">{type.charAt(0).toUpperCase() + type.slice(1)} Models</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {models.filter(m => m.type === type).map(model => {
                            const isActive = activeModels.get(type) === model.name;
                            return (
                              <div 
                                key={model.name}
                                className={`border ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'} rounded-lg p-3`}
                              >
                                <div className="font-medium mb-1 truncate" title={model.name}>
                                  {model.name}
                                </div>
                                <div className="text-xs text-gray-500 mb-2">
                                  Path: {model.path}
                                </div>
                                {isActive ? (
                                  <div className="text-sm text-blue-600 font-medium mb-2">
                                    Currently Active
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => switchModel(type, model.name)}
                                    className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                  >
                                    Switch to This Model
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Workflow Templates
              </h3>
              <button
                onClick={loadTemplates}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh Templates'}
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            {isLoading ? (
              <div className="text-center py-4">Loading templates...</div>
            ) : (
              <div>
                {templates.length === 0 ? (
                  <p className="text-gray-500">No templates found.</p>
                ) : (
                  <div>
                    {/* Group templates by type */}
                    {Array.from(new Set(templates.map((t: any) => t.type))).map(type => (
                      <div key={type} className="mb-6">
                        <h4 className="text-md font-medium mb-2 border-b pb-1">
                          {type === 'txt2img' ? 'Text to Image' :
                           type === 'img2img' ? 'Image to Image' :
                           type === 'txt2vid' ? 'Text to Video' :
                           type === 'img2vid' ? 'Image to Video' :
                           type === 'upscale' ? 'Upscaling' :
                           String(type).charAt(0).toUpperCase() + String(type).slice(1)}
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {templates.filter((t: any) => t.type === type).map((template: any) => (
                            <div 
                              key={template.id}
                              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                            >
                              <div className="font-medium mb-1">{template.name}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                {template.description}
                              </div>
                              <div className="text-xs text-gray-500 mb-1">
                                Version: {template.version || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 mb-1">
                                Path: {template.path}
                              </div>
                              <div className="text-xs text-gray-500 mb-2">
                                ID: {template.id}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {template.metadata && Object.entries(template.metadata).map(([key, value]) => (
                                  <span key={key} className="text-xs bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Render Queue
            </h3>
            
            <p className="text-gray-500 italic">
              Queue management interface coming soon...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComfyUIAdvanced;