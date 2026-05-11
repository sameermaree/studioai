import React from 'react';
import { RenderJob } from '../../services/video/RenderService';
import { 
  PlayCircle, CheckCircle2, AlertCircle, 
  Clock, Loader2, XCircle, Film, FileOutput
} from 'lucide-react';
// Import only the necessary components

interface RenderJobDetailProps {
  job: RenderJob;
  onStart?: () => void;
  onCancel?: () => void;
}

/**
 * Detailed view of a render job
 */
const RenderJobDetail: React.FC<RenderJobDetailProps> = ({
  job,
  onStart,
  onCancel
}) => {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <RenderStateIcon state={job.state} />
          <div>
            <h3 className="text-lg font-medium text-white">{getJobTitle(job)}</h3>
            <p className="text-sm text-studio-400">
              {job.settings.width}x{job.settings.height} • {job.settings.fps}fps • {job.settings.quality} quality
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {job.state === 'ready' && (
            <button
              className="px-3 py-1.5 bg-accent-600 text-white rounded-md hover:bg-accent-700 transition-colors flex items-center space-x-1"
              onClick={onStart}
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start Render</span>
            </button>
          )}
          
          {job.state === 'rendering' && (
            <button
              className="px-3 py-1.5 bg-danger-600 text-white rounded-md hover:bg-danger-700 transition-colors flex items-center space-x-1"
              onClick={onCancel}
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Render progress */}
      {job.state === 'rendering' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-studio-300">Rendering in progress...</span>
            <span className="text-studio-300">{job.progress}%</span>
          </div>
          <div className="h-2 bg-surface-dark rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent-600 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Output file */}
      <div className="flex items-center space-x-2 text-sm text-studio-300 bg-studio-900/40 p-2 rounded">
        <FileOutput className="w-4 h-4" />
        <span className="font-mono">{job.outputPath}</span>
      </div>
      
      {/* Readiness info */}
      <div className="p-4 bg-surface-dark rounded-md">
        <h4 className="text-sm font-medium text-white flex items-center space-x-1 mb-2">
          <Clock className="h-4 w-4 mr-1" />
          <span>Render Readiness</span>
        </h4>
        
        {job.readinessChecks?.missingAssets?.length ? (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-danger-400">Missing assets:</p>
            <ul className="text-xs text-danger-300 pl-4 space-y-0.5">
              {job.readinessChecks.missingAssets.slice(0, 3).map((msg, i) => (
                <li key={i}>• {msg}</li>
              ))}
              {job.readinessChecks.missingAssets.length > 3 && (
                <li>• ...and {job.readinessChecks.missingAssets.length - 3} more</li>
              )}
            </ul>
          </div>
        ) : null}
        
        {job.estimatedSize && job.estimatedDuration && (
          <div className="mt-3 flex items-center justify-between text-xs text-studio-300">
            <span>Estimated duration: {job.estimatedDuration.toFixed(1)}s</span>
            <span>Estimated size: {job.estimatedSize}</span>
          </div>
        )}
      </div>
      
      {/* Error message */}
      {job.error && (
        <div className="p-4 bg-danger-900/20 rounded-md text-sm text-danger-400">
          <p className="font-medium">Error:</p>
          <p>{job.error}</p>
        </div>
      )}
    </div>
  );
};

// Helper to get a nice title based on job state
function getJobTitle(job: RenderJob): string {
  switch (job.state) {
    case 'pending':
      return 'Preparing Render Job';
    case 'validating':
      return 'Validating Assets';
    case 'ready':
      return 'Ready to Render';
    case 'rendering':
      return 'Rendering in Progress';
    case 'completed':
      return 'Render Completed';
    case 'failed':
      return 'Render Failed';
  }
}

// Icon for render state
function RenderStateIcon({ state }: { state: RenderJob['state'] }) {
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
  }
}

export default RenderJobDetail;