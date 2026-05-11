import React from 'react';
import { AlertCircle, CheckCircle, Clock, FileWarning, Music, FileText } from 'lucide-react';
// Using a generic type to avoid dependency issues
interface RenderJobWithReadiness {
  readinessChecks?: {
    missingAssets: string[];
    invalidAssets: string[];
    durationMismatches: string[];
    unsupportedFiles: string[];
    subtitleWarnings: string[];
    audioWarnings: string[];
  };
  estimatedDuration?: number;
  estimatedSize?: string;
}

interface RenderReadinessChecklistProps {
  job: RenderJobWithReadiness;
  compact?: boolean;
}

/**
 * Displays a readiness checklist for render jobs
 * showing missing assets, warnings, and other render preparation issues
 */
const RenderReadinessChecklist: React.FC<RenderReadinessChecklistProps> = ({ job, compact = false }) => {
  if (!job.readinessChecks) {
    return (
      <div className="p-4 bg-surface-dark/40 rounded-md flex items-center space-x-2 text-studio-400">
        <Clock className="h-5 w-5 text-blue-400" />
        <span>Render readiness check not performed</span>
      </div>
    );
  }
  
  const {
    missingAssets,
    invalidAssets,
    durationMismatches,
    unsupportedFiles,
    subtitleWarnings,
    audioWarnings
  } = job.readinessChecks;
  
  const hasIssues = 
    missingAssets.length > 0 ||
    invalidAssets.length > 0 ||
    durationMismatches.length > 0 ||
    unsupportedFiles.length > 0 ||
    subtitleWarnings.length > 0 ||
    audioWarnings.length > 0;
  
  if (!hasIssues) {
    return (
      <div className="p-4 bg-accent-900/20 rounded-md flex items-center space-x-2 text-accent-400">
        <CheckCircle className="h-5 w-5" />
        <span>Render ready! No issues detected.</span>
        {job.estimatedSize && job.estimatedDuration && (
          <span className="ml-auto text-sm">
            Est. {job.estimatedDuration.toFixed(1)}s | {job.estimatedSize}
          </span>
        )}
      </div>
    );
  }
  
  // Compact view just shows a summary
  if (compact) {
    return (
      <div className="p-4 bg-amber-900/20 rounded-md flex items-center space-x-2 text-amber-400">
        <AlertCircle className="h-5 w-5" />
        <span>
          {missingAssets.length + invalidAssets.length > 0 ? 
            `${missingAssets.length + invalidAssets.length} asset issues` : ''}
          {durationMismatches.length > 0 ? 
            ` ${durationMismatches.length} duration mismatches` : ''}
          {(audioWarnings.length > 0 || subtitleWarnings.length > 0) ? 
            ` ${audioWarnings.length + subtitleWarnings.length} track warnings` : ''}
        </span>
        {job.estimatedSize && job.estimatedDuration && (
          <span className="ml-auto text-xs">
            Est. {job.estimatedDuration.toFixed(1)}s | {job.estimatedSize}
          </span>
        )}
      </div>
    );
  }
  
  // Full detailed view
  return (
    <div className="bg-surface-dark/40 rounded-md">
      <div className="p-3 border-b border-surface-border flex items-center space-x-2">
        <AlertCircle className="h-5 w-5 text-amber-400" />
        <span className="font-medium">Render Readiness Issues</span>
        {job.estimatedSize && job.estimatedDuration && (
          <span className="ml-auto text-sm text-studio-400">
            Est. {job.estimatedDuration.toFixed(1)}s | {job.estimatedSize}
          </span>
        )}
      </div>
      
      <div className="p-4 space-y-4">
        {/* Asset Issues */}
        {(missingAssets.length > 0 || invalidAssets.length > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-danger-400 flex items-center space-x-1">
              <FileWarning className="h-4 w-4" />
              <span>Missing or Invalid Assets</span>
            </h4>
            <ul className="text-xs space-y-1 text-danger-300">
              {missingAssets.map((msg, i) => (
                <li key={`missing-${i}`} className="pl-4">• {msg}</li>
              ))}
              {invalidAssets.map((msg, i) => (
                <li key={`invalid-${i}`} className="pl-4">• {msg}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Duration Mismatches */}
        {durationMismatches.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-amber-400 flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Duration Mismatches</span>
            </h4>
            <ul className="text-xs space-y-1 text-amber-300">
              {durationMismatches.map((msg, i) => (
                <li key={`duration-${i}`} className="pl-4">• {msg}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Audio Warnings */}
        {audioWarnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-amber-400 flex items-center space-x-1">
              <Music className="h-4 w-4" />
              <span>Audio Issues</span>
            </h4>
            <ul className="text-xs space-y-1 text-amber-300">
              {audioWarnings.map((msg, i) => (
                <li key={`audio-${i}`} className="pl-4">• {msg}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Subtitle Warnings */}
        {subtitleWarnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-amber-400 flex items-center space-x-1">
              <FileText className="h-4 w-4" />
              <span>Subtitle Issues</span>
            </h4>
            <ul className="text-xs space-y-1 text-amber-300">
              {subtitleWarnings.map((msg, i) => (
                <li key={`subtitle-${i}`} className="pl-4">• {msg}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Unsupported Files */}
        {unsupportedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-danger-400 flex items-center space-x-1">
              <FileWarning className="h-4 w-4" />
              <span>Unsupported Files</span>
            </h4>
            <ul className="text-xs space-y-1 text-danger-300">
              {unsupportedFiles.map((msg, i) => (
                <li key={`unsupported-${i}`} className="pl-4">• {msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default RenderReadinessChecklist;