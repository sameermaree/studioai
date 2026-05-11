import React, { useState, useEffect } from 'react';
import { ComfyUIService } from '../services/comfyui';
import { BatchJob, BatchProgress } from '../services/comfyui/batchGenerator';
import { WorkflowTemplate } from '../infrastructure/ai/services/ComfyUIOrchestrator';

interface BatchGenerationPanelProps {
  onBatchCreated?: (batchId: string) => void;
  onBatchStarted?: (batchId: string) => void;
  onBatchCompleted?: (batchId: string) => void;
}

/**
 * Panel for creating and managing batch generation jobs
 */
const BatchGenerationPanel: React.FC<BatchGenerationPanelProps> = ({
  onBatchCreated,
  onBatchStarted,
  onBatchCompleted
}) => {
  const [name, setName] = useState('Batch generation');
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [generationType, setGenerationType] = useState<'image' | 'video'>('image');
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load templates and existing batches
  useEffect(() => {
    const loadData = async () => {
      try {
        const comfyService = ComfyUIService.getInstance();
        const allTemplates = comfyService.getWorkflowTemplates();
        
        // Filter templates by type
        const filteredTemplates = allTemplates.filter(t => 
          generationType === 'image' 
            ? (t.type === 'txt2img' || t.type === 'img2img')
            : (t.type === 'txt2vid' || t.type === 'img2vid')
        );
        
        setTemplates(filteredTemplates);
        
        // Set default template if available
        if (filteredTemplates.length > 0 && !selectedTemplate) {
          setSelectedTemplate(filteredTemplates[0].id);
        }
        
        // Get existing batches
        const batchGenerator = comfyService.getBatchGenerator();
        const existingBatches = batchGenerator.getAllBatches();
        setBatches(existingBatches);
        
        // Set up event listeners for batch updates
        batchGenerator.on('batchProgress', handleBatchProgress);
        batchGenerator.on('batchCompleted', handleBatchCompleted);
        
        return () => {
          // Clean up event listeners
          batchGenerator.removeListener('batchProgress', handleBatchProgress);
          batchGenerator.removeListener('batchCompleted', handleBatchCompleted);
        };
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load templates and batches');
      }
    };
    
    loadData();
  }, [generationType, selectedTemplate]);
  
  // Handle batch progress updates
  const handleBatchProgress = (data: any) => {
    setBatches(prev => {
      return prev.map(batch => {
        if (batch.id === data.id) {
          return {
            ...batch,
            progress: {
              ...batch.progress,
              overallProgress: data.progress
            }
          };
        }
        return batch;
      });
    });
  };
  
  // Handle batch completion
  const handleBatchCompleted = (data: any) => {
    setBatches(prev => {
      return prev.map(batch => {
        if (batch.id === data.id) {
          const updatedBatch = {
            ...batch,
            progress: {
              ...batch.progress,
              isComplete: true,
              overallProgress: 100,
              endTime: new Date()
            }
          };
          
          if (onBatchCompleted) {
            onBatchCompleted(batch.id);
          }
          
          return updatedBatch;
        }
        return batch;
      });
    });
  };
  
  // Add a new prompt field
  const addPrompt = () => {
    setPrompts([...prompts, '']);
  };
  
  // Remove a prompt field
  const removePrompt = (index: number) => {
    if (prompts.length <= 1) return;
    const newPrompts = [...prompts];
    newPrompts.splice(index, 1);
    setPrompts(newPrompts);
  };
  
  // Update a prompt
  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    setPrompts(newPrompts);
  };
  
  // Create a new batch
  const createBatch = async () => {
    if (prompts.filter(p => p.trim()).length === 0) {
      setError('At least one prompt is required');
      return;
    }
    
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      const comfyService = ComfyUIService.getInstance();
      const filteredPrompts = prompts.filter(p => p.trim());
      
      // Create batch configuration
      const batchConfig = {
        name,
        description: `Batch of ${filteredPrompts.length} ${generationType === 'image' ? 'images' : 'videos'}`,
        prompts: filteredPrompts,
        type: generationType === 'image' ? 'txt2img' : 'txt2vid',
        templateId: selectedTemplate,
        common: {
          negativePrompt,
          width,
          height
        },
        assetOptions: {
          displayNamePrefix: name,
          category: 'scene',
          tags: ['batch', generationType]
        }
      };
      
      // Create the batch
      const batch = comfyService.createBatch(batchConfig);
      
      // Update state
      setBatches(prev => [batch, ...prev]);
      
      if (onBatchCreated) {
        onBatchCreated(batch.id);
      }
      
      setIsLoading(false);
      
      // Reset form for next batch
      setPrompts(['']);
      
      return batch;
    } catch (error) {
      console.error('Failed to create batch:', error);
      setError(error instanceof Error ? error.message : String(error));
      setIsLoading(false);
      return null;
    }
  };
  
  // Start a batch
  const startBatch = async (batchId: string) => {
    try {
      const comfyService = ComfyUIService.getInstance();
      await comfyService.startBatch(batchId);
      
      if (onBatchStarted) {
        onBatchStarted(batchId);
      }
      
      // Update state
      setBatches(prev => {
        return prev.map(batch => {
          if (batch.id === batchId) {
            return {
              ...batch,
              progress: {
                ...batch.progress,
                startTime: new Date()
              }
            };
          }
          return batch;
        });
      });
    } catch (error) {
      console.error('Failed to start batch:', error);
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  
  // Create and start a batch in one go
  const createAndStartBatch = async () => {
    const batch = await createBatch();
    if (batch) {
      await startBatch(batch.id);
    }
  };
  
  // Cancel a batch
  const cancelBatch = (batchId: string) => {
    try {
      const comfyService = ComfyUIService.getInstance();
      const batchGenerator = comfyService.getBatchGenerator();
      batchGenerator.cancelBatch(batchId);
      
      // Update state
      setBatches(prev => {
        return prev.map(batch => {
          if (batch.id === batchId) {
            return {
              ...batch,
              progress: {
                ...batch.progress,
                isCancelled: true
              }
            };
          }
          return batch;
        });
      });
    } catch (error) {
      console.error('Failed to cancel batch:', error);
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  
  // Format time
  const formatTime = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString();
  };
  
  // Get a batch status class
  const getBatchStatusClass = (progress: BatchProgress) => {
    if (progress.isCancelled) return 'bg-gray-200 text-gray-500';
    if (progress.error) return 'bg-red-100 text-red-700';
    if (progress.isComplete) return 'bg-green-100 text-green-700';
    if (progress.startTime) return 'bg-blue-100 text-blue-700';
    return 'bg-yellow-100 text-yellow-700';
  };
  
  // Get a batch status text
  const getBatchStatusText = (progress: BatchProgress) => {
    if (progress.isCancelled) return 'Cancelled';
    if (progress.error) return 'Error';
    if (progress.isComplete) return 'Completed';
    if (progress.startTime) return 'Running';
    return 'Queued';
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Batch Generation
      </h3>
      
      {/* Batch Creation Form */}
      <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded">
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Create New Batch</h4>
        
        {/* Batch Name */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Batch Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter batch name"
          />
        </div>
        
        {/* Generation Type */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Generation Type
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={generationType === 'image'}
                onChange={() => setGenerationType('image')}
                className="mr-2"
              />
              <span>Images</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={generationType === 'video'}
                onChange={() => setGenerationType('video')}
                className="mr-2"
              />
              <span>Videos</span>
            </label>
          </div>
        </div>
        
        {/* Template Selection */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            disabled={templates.length === 0}
          >
            <option value="">Select a template</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
        </div>
        
        {/* Size Controls */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Width
            </label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              min={64}
              max={2048}
              step={64}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Height
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              min={64}
              max={2048}
              step={64}
            />
          </div>
        </div>
        
        {/* Negative Prompt */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Negative Prompt (applies to all)
          </label>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            rows={2}
            placeholder="What to exclude from all generations"
          />
        </div>
        
        {/* Prompts */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Prompts
            </label>
            <button
              onClick={addPrompt}
              className="text-sm px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
            >
              + Add Prompt
            </button>
          </div>
          
          {prompts.map((prompt, index) => (
            <div key={index} className="flex mb-2">
              <textarea
                value={prompt}
                onChange={(e) => updatePrompt(index, e.target.value)}
                className="flex-1 px-3 py-2 border rounded-l-md"
                rows={2}
                placeholder={`Enter prompt ${index + 1}`}
              />
              <button
                onClick={() => removePrompt(index)}
                disabled={prompts.length <= 1}
                className={`px-3 rounded-r-md ${
                  prompts.length <= 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {/* Batch Creation Controls */}
        <div className="flex space-x-3">
          <button
            onClick={createBatch}
            disabled={isLoading}
            className={`px-4 py-2 rounded ${
              isLoading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isLoading ? 'Creating...' : 'Create Batch'}
          </button>
          
          <button
            onClick={createAndStartBatch}
            disabled={isLoading}
            className={`px-4 py-2 rounded ${
              isLoading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isLoading ? 'Processing...' : 'Create & Start'}
          </button>
        </div>
      </div>
      
      {/* Batches List */}
      <div>
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Recent Batches</h4>
        
        {batches.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No batches created yet</p>
        ) : (
          <div className="space-y-3">
            {batches.map(batch => (
              <div 
                key={batch.id}
                className="border border-gray-200 dark:border-gray-700 rounded p-3"
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h5 className="font-medium">{batch.name}</h5>
                    <div className="text-sm text-gray-500">
                      {batch.config.prompts.length} {batch.config.type === 'txt2img' || batch.config.type === 'img2img' ? 'image' : 'video'}{batch.config.prompts.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div className={`px-2 py-1 rounded text-xs ${getBatchStatusClass(batch.progress)}`}>
                    {getBatchStatusText(batch.progress)}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div
                    className={`h-2.5 rounded-full ${
                      batch.progress.isComplete
                        ? 'bg-green-600'
                        : batch.progress.isCancelled
                          ? 'bg-gray-400'
                          : batch.progress.error
                            ? 'bg-red-500'
                            : 'bg-blue-600'
                    }`}
                    style={{ width: `${batch.progress.overallProgress}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 mb-3">
                  <div>Progress: {batch.progress.overallProgress}%</div>
                  {batch.progress.startTime && (
                    <div>
                      Started: {formatTime(batch.progress.startTime)}
                      {batch.progress.endTime && ` • Ended: ${formatTime(batch.progress.endTime)}`}
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex space-x-2">
                  {!batch.progress.startTime && !batch.progress.isCancelled && (
                    <button
                      onClick={() => startBatch(batch.id)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      Start
                    </button>
                  )}
                  
                  {batch.progress.startTime && !batch.progress.isComplete && !batch.progress.isCancelled && (
                    <button
                      onClick={() => cancelBatch(batch.id)}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                    >
                      Cancel
                    </button>
                  )}
                  
                  {batch.progress.isComplete && batch.assets && batch.assets.length > 0 && (
                    <button
                      onClick={() => {
                        // View results logic
                      }}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                      View Results
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchGenerationPanel;