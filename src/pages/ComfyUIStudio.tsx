import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ComfyUIService } from '../services/comfyui';
import { WorkflowTemplate } from '../infrastructure/ai/services/ComfyUIOrchestrator';
import ComfyUIStatus from '../components/ComfyUIStatus';

/**
 * ComfyUI Studio page for testing and using the ComfyUI integration
 */
const ComfyUIStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [fps, setFps] = useState(12);
  const [duration, setDuration] = useState(3);

  // Initialize ComfyUI service
  useEffect(() => {
    const initComfyUI = async () => {
      try {
        const comfyService = ComfyUIService.getInstance();
        const initialized = await comfyService.initialize();
        
        if (initialized) {
          // Get available templates
          const availableTemplates = comfyService.getWorkflowTemplates();
          setTemplates(availableTemplates);
          
          // Set default template
          if (availableTemplates.length > 0) {
            const defaultTemplate = availableTemplates.find(t => t.type === 'txt2img');
            if (defaultTemplate) {
              setSelectedTemplate(defaultTemplate.id);
            } else {
              setSelectedTemplate(availableTemplates[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize ComfyUI:', error);
        setError('Failed to initialize ComfyUI service. See console for details.');
      }
    };
    
    initComfyUI();
  }, []);

  // Generate content based on mode
  const handleGenerate = async () => {
    if (!prompt) {
      setError('Please enter a prompt');
      return;
    }
    
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }
    
    setError(null);
    setIsGenerating(true);
    setProgress(0);
    setResult(null);
    
    try {
      const comfyService = ComfyUIService.getInstance();
      
      if (mode === 'image') {
        // Generate image
        const { job, asset } = await comfyService.generateImage(
          prompt,
          {
            negativePrompt,
            width,
            height,
            templateId: selectedTemplate,
            assetDisplayName: `Generated from: ${prompt.substring(0, 30)}...`,
            callbacks: {
              onProgress: (p) => setProgress(p),
              onSuccess: (result) => {
                setResult(result);
                setIsGenerating(false);
                setProgress(100);
              },
              onError: (error) => {
                setError(error.message);
                setIsGenerating(false);
              }
            }
          }
        );
        
        console.log('Image generation started:', job.id);
      } else {
        // Generate video
        const { job, asset } = await comfyService.generateVideo(
          prompt,
          {
            negativePrompt,
            width,
            height,
            durationSeconds: duration,
            fps,
            templateId: selectedTemplate,
            assetDisplayName: `Video from: ${prompt.substring(0, 30)}...`,
            callbacks: {
              onProgress: (p) => setProgress(p),
              onSuccess: (result) => {
                setResult(result);
                setIsGenerating(false);
                setProgress(100);
              },
              onError: (error) => {
                setError(error.message);
                setIsGenerating(false);
              }
            }
          }
        );
        
        console.log('Video generation started:', job.id);
      }
    } catch (error) {
      console.error('Generation error:', error);
      setError(error instanceof Error ? error.message : String(error));
      setIsGenerating(false);
    }
  };

  // Get filtered templates based on mode
  const getFilteredTemplates = () => {
    if (mode === 'image') {
      return templates.filter(t => t.type === 'txt2img' || t.type === 'img2img');
    } else {
      return templates.filter(t => t.type === 'txt2vid' || t.type === 'img2vid');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ComfyUI Studio</h1>
        <div className="flex space-x-2">
          <Link 
            to="/comfyui/assets"
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            Assets Gallery
          </Link>
          <Link 
            to="/comfyui/advanced"
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
          >
            Advanced Mode
          </Link>
        </div>
      </div>
      
      {/* ComfyUI Status Component */}
      <ComfyUIStatus />
      
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-4">
        {/* Mode Toggle */}
        <div className="mb-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setMode('image')}
              className={`px-4 py-2 rounded ${
                mode === 'image' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              Generate Image
            </button>
            <button
              onClick={() => setMode('video')}
              className={`px-4 py-2 rounded ${
                mode === 'video' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              Generate Video
            </button>
          </div>
        </div>
        
        {/* Template Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Workflow Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            disabled={isGenerating}
          >
            <option value="">Select a template</option>
            {getFilteredTemplates().map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
        </div>
        
        {/* Prompt Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            rows={3}
            placeholder="Enter your prompt here"
            disabled={isGenerating}
          />
        </div>
        
        {/* Negative Prompt Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Negative Prompt
          </label>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            rows={2}
            placeholder="What you don't want to see (optional)"
            disabled={isGenerating}
          />
        </div>
        
        {/* Size Controls */}
        <div className="grid grid-cols-2 gap-4 mb-4">
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
              disabled={isGenerating}
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
              disabled={isGenerating}
            />
          </div>
        </div>
        
        {/* Video-specific controls */}
        {mode === 'video' && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                FPS
              </label>
              <input
                type="number"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min={1}
                max={60}
                step={1}
                disabled={isGenerating}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md"
                min={1}
                max={30}
                step={1}
                disabled={isGenerating}
              />
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {/* Generate Button */}
        <div className="mt-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt || !selectedTemplate}
            className={`w-full px-4 py-2 rounded ${
              isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isGenerating 
              ? `Generating... ${progress}%` 
              : `Generate ${mode === 'image' ? 'Image' : 'Video'}`}
          </button>
        </div>
        
        {/* Progress Bar */}
        {isGenerating && (
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}
      </div>
      
      {/* Results Display */}
      {result && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <h2 className="text-xl font-bold mb-2">
            Generated {mode === 'image' ? 'Image' : 'Video'}
          </h2>
          
          <div className="flex justify-center">
            {mode === 'image' ? (
              <img
                src={result.asset?.url || result.url}
                alt={prompt}
                className="max-w-full max-h-[500px] rounded"
              />
            ) : (
              <video
                src={result.asset?.url || result.url}
                controls
                autoPlay
                loop
                className="max-w-full max-h-[500px] rounded"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
          
          <div className="mt-4 text-sm">
            <p className="font-medium">Prompt:</p>
            <p className="mb-2 text-gray-700 dark:text-gray-300">{prompt}</p>
            
            {negativePrompt && (
              <>
                <p className="font-medium">Negative Prompt:</p>
                <p className="mb-2 text-gray-700 dark:text-gray-300">{negativePrompt}</p>
              </>
            )}
            
            <p className="font-medium">Size:</p>
            <p className="mb-2 text-gray-700 dark:text-gray-300">
              {width} × {height}
            </p>
            
            {mode === 'video' && (
              <>
                <p className="font-medium">Video Settings:</p>
                <p className="mb-2 text-gray-700 dark:text-gray-300">
                  {duration} seconds at {fps} FPS
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComfyUIStudio;