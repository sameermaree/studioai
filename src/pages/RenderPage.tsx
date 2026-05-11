import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Cog, Download, Film, PlayCircle, CheckCircle2, AlertCircle, Clock, Loader2, XCircle, FileOutput } from 'lucide-react';
import { TimelinePersistenceService } from '../services/timeline/TimelinePersistenceService';
import { RenderService, RenderJob } from '../services/video/RenderService';
// Using direct rendering instead of component import
import { CinematicTimeline } from '../services/video/TimelineEngine';

// Helper functions for render state display
function getJobTitle(state: string): string {
  switch (state) {
    case 'pending': return 'Preparing Render Job';
    case 'validating': return 'Validating Assets';
    case 'ready': return 'Ready to Render';
    case 'rendering': return 'Rendering in Progress';
    case 'completed': return 'Render Completed';
    case 'failed': return 'Render Failed';
    default: return 'Render Job';
  }
}

function RenderStateIcon({ state }: { state: string }) {
  switch (state) {
    case 'pending':
      return <Clock className="w-6 h-6 text-blue-400" />;
    case 'validating':
      return <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />;
    case 'ready':
      return <PlayCircle className="w-6 h-6 text-accent-400" />;
    case 'rendering':
      return <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-6 h-6 text-green-400" />;
    case 'failed':
      return <AlertCircle className="w-6 h-6 text-danger-400" />;
    default:
      return <Clock className="w-6 h-6 text-studio-400" />;
  }
}

export function RenderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [timeline, setTimeline] = React.useState<CinematicTimeline | null>(null);
  const [renderJob, setRenderJob] = React.useState<RenderJob | null>(null);
  
  // Create services
  const timelinePersistence = React.useMemo(() => new TimelinePersistenceService(), []);
  const renderService = React.useMemo(() => new RenderService({ useMockRender: true }), []);
  
  // Initialize render service
  React.useEffect(() => {
    renderService.initialize();
  }, [renderService]);
  
  // Load timeline
  React.useEffect(() => {
    if (id) {
      const loadedTimeline = timelinePersistence.loadTimeline(id);
      if (loadedTimeline) {
        setTimeline(loadedTimeline);
      }
    }
  }, [id, timelinePersistence]);
  
  // Create render job when timeline is loaded
  React.useEffect(() => {
    if (timeline && !renderJob) {
      // Generate default output path
      const outputPath = `output/${timeline.name.replace(/\\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.mp4`;
      
      // Create render job
      const job = renderService.createRenderJob(timeline, outputPath);
      setRenderJob(job);
      
      // Validate job
      renderService.validateJob(job.id, timeline).then(validatedJob => {
        setRenderJob(validatedJob);
      });
    }
  }, [timeline, renderJob, renderService]);
  
  // Handlers
  const handleStartRender = async () => {
    if (renderJob && timeline) {
      const updatedJob = await renderService.startRender(renderJob.id, timeline);
      setRenderJob(updatedJob);
      
      // Update job periodically to track progress
      const interval = setInterval(async () => {
        const job = renderService.getJob(renderJob.id);
        if (job) {
          setRenderJob({...job});
          
          // Stop checking when render is done
          if (job.state === 'completed' || job.state === 'failed') {
            clearInterval(interval);
          }
        }
      }, 500);
    }
  };
  
  const handleCancelRender = () => {
    if (renderJob) {
      const updatedJob = renderService.cancelRender(renderJob.id);
      if (updatedJob) {
        setRenderJob(updatedJob);
      }
    }
  };
  
  if (!timeline) {
    return (
      <div className="p-6 text-center text-studio-400">
        <p>Timeline not found</p>
        <button 
          className="mt-4 px-4 py-2 bg-accent-600 text-white rounded-md hover:bg-accent-700 transition-colors"
          onClick={() => navigate('/rendering')}
        >
          Return to Rendering
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div className="flex items-center space-x-3">
          <button 
            className="p-1.5 rounded-md hover:bg-studio-800 text-studio-400" 
            onClick={() => navigate('/rendering')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="page-title">Render Timeline</h1>
            <p className="page-subtitle">Prepare and execute render for {timeline.name}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button 
            className="flex items-center gap-1.5 px-4 py-2 bg-studio-700 text-white rounded-md hover:bg-studio-600 transition-colors"
            onClick={() => navigate(`/timeline/${timeline.id}`)}
          >
            <Film className="w-4 h-4" />
            Edit Timeline
          </button>
          <button 
            className="flex items-center gap-1.5 px-4 py-2 bg-studio-700 text-white rounded-md hover:bg-studio-600 transition-colors"
          >
            <Cog className="w-4 h-4" />
            Render Settings
          </button>
        </div>
      </div>
      
      <div className="card">
        {renderJob ? (
          <div className="space-y-4">
            {/* Job Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <RenderStateIcon state={renderJob.state} />
                <div>
                  <h3 className="text-lg font-medium text-white">{getJobTitle(renderJob.state)}</h3>
                  <p className="text-sm text-studio-400">
                    {renderJob.settings.width}x{renderJob.settings.height} • {renderJob.settings.fps}fps • {renderJob.settings.quality} quality
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {renderJob.state === 'ready' && (
                  <button
                    className="px-3 py-1.5 bg-accent-600 text-white rounded-md hover:bg-accent-700 transition-colors flex items-center space-x-1"
                    onClick={handleStartRender}
                  >
                    <PlayCircle className="w-4 h-4 mr-1" />
                    <span>Start Render</span>
                  </button>
                )}
                
                {renderJob.state === 'rendering' && (
                  <button
                    className="px-3 py-1.5 bg-danger-600 text-white rounded-md hover:bg-danger-700 transition-colors flex items-center space-x-1"
                    onClick={handleCancelRender}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Render progress */}
            {renderJob.state === 'rendering' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-studio-300">Rendering in progress...</span>
                  <span className="text-studio-300">{renderJob.progress}%</span>
                </div>
                <div className="h-2 bg-studio-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent-600 rounded-full transition-all duration-300"
                    style={{ width: `${renderJob.progress}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Output file */}
            <div className="flex items-center space-x-2 text-sm text-studio-300 bg-studio-900/40 p-2 rounded">
              <FileOutput className="w-4 h-4" />
              <span className="font-mono">{renderJob.outputPath}</span>
            </div>
            
            {/* Readiness info */}
            <div className="p-4 bg-surface rounded-md">
              <h4 className="text-sm font-medium text-white mb-2">Render Readiness</h4>
              
              {renderJob.readinessChecks?.missingAssets.length ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-danger-400">Missing assets:</p>
                  <ul className="text-xs text-danger-300 pl-4 mt-1">
                    {renderJob.readinessChecks.missingAssets.slice(0, 3).map((msg, i) => (
                      <li key={i}>• {msg}</li>
                    ))}
                    {renderJob.readinessChecks.missingAssets.length > 3 && (
                      <li>• ...and {renderJob.readinessChecks.missingAssets.length - 3} more</li>
                    )}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-accent-400">No issues detected</p>
              )}
              
              {renderJob.estimatedDuration && (
                <div className="mt-3 text-xs text-studio-400">
                  Estimated duration: {renderJob.estimatedDuration.toFixed(1)}s
                  {renderJob.estimatedSize && ` • Size: ${renderJob.estimatedSize}`}
                </div>
              )}
            </div>
            
            {/* Error message */}
            {renderJob.error && (
              <div className="p-4 bg-danger-900/20 rounded-md text-sm text-danger-400">
                <p className="font-medium">Error:</p>
                <p>{renderJob.error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-studio-400">Preparing render job...</p>
          </div>
        )}
      </div>
      
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Timeline Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-studio-400">Duration:</span>
            <span className="text-white">{timeline.duration.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-studio-400">Resolution:</span>
            <span className="text-white">{timeline.settings.width}x{timeline.settings.height}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-studio-400">Frame Rate:</span>
            <span className="text-white">{timeline.settings.frameRate}fps</span>
          </div>
          <div className="flex justify-between">
            <span className="text-studio-400">Audio:</span>
            <span className="text-white">
              {timeline.settings.audioChannels} channels, {timeline.settings.audioSampleRate}Hz
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-studio-400">Tracks:</span>
            <span className="text-white">{timeline.tracks.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}