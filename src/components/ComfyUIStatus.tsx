import React, { useEffect, useState, useCallback } from 'react';
import { ComfyUIService } from '../services/comfyui';
import { ExecutionQueue, QueueStats } from '../services/comfyui/executionQueue';
import { StabilityStatus } from '../services/comfyui/stabilityLayer';

/**
 * Component for displaying ComfyUI status and queue information
 */
const ComfyUIStatus: React.FC = () => {
  const [status, setStatus] = useState<any>({
    available: false,
    checking: true,
    message: 'Checking ComfyUI status...',
    latency: undefined,
    status: StabilityStatus.OFFLINE
  });
  
  const [queueStats, setQueueStats] = useState<QueueStats>({
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    totalProcessed: 0,
    averageProcessingTime: 0
  });
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState<{count: number, types: string[]}>({ count: 0, types: [] });
  const [workflowsLoaded, setWorkflowsLoaded] = useState(0);
  
  useEffect(() => {
    const comfyService = ComfyUIService.getInstance();
    
    // Initialize the service if not already initialized
    const initService = async () => {
      try {
        const initialized = await comfyService.initialize();
        setIsInitialized(initialized);
        
        if (initialized) {
          // Check initial status
          checkStatus();
          
          // Set up a timer to check status periodically
          const intervalId = setInterval(checkStatus, 30000);
          
          // Clean up interval on component unmount
          return () => clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Failed to initialize ComfyUI service:', error);
        setStatus({
          available: false,
          checking: false,
          message: 'Failed to initialize ComfyUI service',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };
    
    // Check ComfyUI status
    const checkStatus = async () => {
      setStatus(prev => ({ ...prev, checking: true }));
      
      try {
        const serviceStatus = await comfyService.getStatus();
        
        // Get stability layer diagnostics if available
        let stabilityStatus = StabilityStatus.OFFLINE;
        let systemInfoData = null;
        
        try {
          const stabilityLayer = comfyService.getStabilityLayer();
          const diagnostics = stabilityLayer.getDiagnostics();
          stabilityStatus = diagnostics.status;
          systemInfoData = {
            gpuInfo: diagnostics.gpu_info,
            queueSize: diagnostics.queue_size,
            connectedSince: diagnostics.connected_since,
            reconnectAttempts: diagnostics.reconnect_attempts,
            nodeErrors: diagnostics.node_errors
          };
        } catch (e) {
          // Stability layer not initialized yet
        }
        
        setStatus({
          available: serviceStatus.available,
          checking: false,
          message: serviceStatus.message,
          latency: serviceStatus.latency,
          status: stabilityStatus
        });
        
        setSystemInfo(systemInfoData);
        
        // Try to get model information
        try {
          const modelManager = comfyService.getModelManager();
          const models = await modelManager.loadModels();
          
          // Group models by type
          const types = Array.from(new Set(models.map(m => m.type)));
          setModelsLoaded({ count: models.length, types });
        } catch (modelError) {
          console.warn('Failed to load model information:', modelError);
        }
        
        // Get workflow templates
        try {
          const templates = comfyService.getWorkflowTemplates();
          setWorkflowsLoaded(templates.length);
        } catch (templateError) {
          console.warn('Failed to get workflow templates:', templateError);
        }
      } catch (error) {
        setStatus({
          available: false,
          checking: false,
          message: 'Error checking ComfyUI status',
          error: error instanceof Error ? error.message : String(error),
          status: StabilityStatus.ERROR
        });
      }
    };
    
    // Initialize service
    initService();
    
    // Set up queue stats listener if possible
    // This is a mock implementation since we don't have direct access to the ExecutionQueue instance
    // In a real implementation, you would get this from the ComfyUIService
    const mockQueueStatsUpdate = setInterval(() => {
      // This would typically come from a real listener on the ExecutionQueue
      const executionQueue = {
        pending: Math.floor(Math.random() * 5),
        running: Math.floor(Math.random() * 2),
        completed: queueStats.completed + (Math.random() > 0.7 ? 1 : 0),
        failed: queueStats.failed + (Math.random() > 0.9 ? 1 : 0),
      };
      
      setQueueStats({
        ...executionQueue,
        totalProcessed: executionQueue.completed + executionQueue.failed,
        averageProcessingTime: Math.floor(5000 + Math.random() * 10000)
      });
    }, 5000);
    
    // Clean up
    return () => {
      clearInterval(mockQueueStatsUpdate);
    };
  }, []);
  
  // Format time in milliseconds to a human-readable string
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 my-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        ComfyUI Status
      </h3>
      
      {/* Status indicator */}
      <div className="flex items-center mb-4">
        <div 
          className={`w-3 h-3 rounded-full mr-2 ${
            status.checking 
              ? 'bg-yellow-400' 
              : status.status === StabilityStatus.ONLINE
                ? 'bg-green-500'
                : status.status === StabilityStatus.DEGRADED
                  ? 'bg-yellow-500'
                  : status.status === StabilityStatus.RECONNECTING
                    ? 'bg-blue-500'
                    : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {status.checking 
            ? 'Checking...' 
            : status.status === StabilityStatus.ONLINE
              ? 'Online'
              : status.status === StabilityStatus.DEGRADED
                ? 'Degraded'
                : status.status === StabilityStatus.RECONNECTING
                  ? 'Reconnecting'
                  : status.status === StabilityStatus.ERROR
                    ? 'Error'
                    : 'Offline'}
        </span>
        
        {status.latency && (
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({formatTime(status.latency)})
          </span>
        )}
      </div>
      
      {/* Status message */}
      {status.message && (
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {status.message}
        </div>
      )}
      
      {/* Queue stats */}
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Generation Queue
        </h4>
        
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-blue-50 dark:bg-blue-900 rounded p-2">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-300">
              {queueStats.pending}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Pending
            </div>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900 rounded p-2">
            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-300">
              {queueStats.running}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Running
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900 rounded p-2">
            <div className="text-lg font-bold text-green-600 dark:text-green-300">
              {queueStats.completed}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Completed
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900 rounded p-2">
            <div className="text-lg font-bold text-red-600 dark:text-red-300">
              {queueStats.failed}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Failed
            </div>
          </div>
        </div>
        
        {/* Processing time */}
        {queueStats.averageProcessingTime > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Avg. processing time: {formatTime(queueStats.averageProcessingTime)}
          </div>
        )}
      </div>
      
      {/* System Information */}
      {systemInfo && status.available && (
        <div className="mt-4 text-sm">
          <h4 className="font-medium mb-1 text-gray-700 dark:text-gray-300">System Information</h4>
          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-xs">
            {systemInfo.gpuInfo && (
              <div className="mb-1">
                <span className="font-medium">GPU:</span> {systemInfo.gpuInfo.map((gpu: any) => gpu.name).join(', ')}
              </div>
            )}
            {systemInfo.connectedSince && (
              <div className="mb-1">
                <span className="font-medium">Connected since:</span> {new Date(systemInfo.connectedSince).toLocaleString()}
              </div>
            )}
            {modelsLoaded.count > 0 && (
              <div className="mb-1">
                <span className="font-medium">Models loaded:</span> {modelsLoaded.count} ({modelsLoaded.types.join(', ')})
              </div>
            )}
            {workflowsLoaded > 0 && (
              <div>
                <span className="font-medium">Workflow templates:</span> {workflowsLoaded}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="mt-4 flex space-x-2">
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Refresh
        </button>
        
        <button
          onClick={async () => {
            setStatus(prev => ({ ...prev, checking: true }));
            const comfyService = ComfyUIService.getInstance();
            await checkStatus();
          }}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
        >
          Check Status
        </button>
        
        {status.status === StabilityStatus.DEGRADED && (
          <button
            onClick={async () => {
              try {
                const comfyService = ComfyUIService.getInstance();
                const stabilityLayer = comfyService.getStabilityLayer();
                stabilityLayer.resetErrorCounts();
                await checkStatus();
              } catch (error) {
                console.error('Failed to reset error counts:', error);
              }
            }}
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
          >
            Reset Errors
          </button>
        )}
      </div>
    </div>
  );
};

export default ComfyUIStatus;