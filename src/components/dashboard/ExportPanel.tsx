/**
 * ExportPanel.tsx
 * Export tab content inside Episode Workspace.
 * Handles: server health check, export trigger, progress, download.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Download, CheckCircle, XCircle, Loader2,
  Server, Film, AlertTriangle, ExternalLink,
} from 'lucide-react';
import type { Episode } from '../../types';
import { useStudioStore } from '../../store/useStudioStore';
import {
  checkExportServer,
  startExport,
  waitForExport,
  getDownloadUrl,
  type ExportJob,
  type ServerHealth,
} from '../../services/exportService';

interface Props {
  episode: Episode;
}

type ExportState = 'idle' | 'exporting' | 'done' | 'failed';

export function ExportPanel({ episode }: Props) {
  const { updateEpisode } = useStudioStore();

  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [currentJob, setCurrentJob] = useState<ExportJob | null>(null);
  const [resolution, setResolution] = useState<'1280x720' | '1920x1080'>('1280x720');
  const abortRef = useRef<AbortController | null>(null);

  const sortedScenes = [...episode.scenes].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  const scenesWithImage = sortedScenes.filter((s) => !!s.render_url);
  const missingImages = sortedScenes.length - scenesWithImage.length;
  const canExport = scenesWithImage.length > 0 && health?.ok && health?.ffmpeg;

  // Check server health on mount and when tab opens
  useEffect(() => {
    handleCheckHealth();
  }, []);

  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    const h = await checkExportServer();
    setHealth(h);
    setCheckingHealth(false);
  };

  const handleExport = async () => {
    if (!canExport) return;
    abortRef.current = new AbortController();
    setExportState('exporting');
    setCurrentJob(null);

    try {
      // Build scene list — only scenes with images
      const scenes = sortedScenes
        .filter((s) => !!s.render_url)
        .map((s) => {
          const scene = {
            image_filename: s.render_url!,
            duration: s.duration ?? 5,
            narration: s.narration || undefined,
            audio_url: s.audio_status === 'done' && s.audio_url ? s.audio_url : undefined,
          };
          console.log('[EXPORT PAYLOAD SCENE]', s.title,
            '| image:', scene.image_filename,
            '| duration:', scene.duration,
            '| audio_url:', scene.audio_url ?? 'NONE');
          return scene;
        });

      const jobId = await startExport({
        episode_id: episode.id,
        episode_title: episode.title,
        scenes,
        resolution,
        fps: 24,
      });

      const finalJob = await waitForExport(
        jobId,
        (job) => setCurrentJob(job),
        abortRef.current.signal
      );

      setExportState('done');
      setCurrentJob(finalJob);

      // Save export URL to episode
      if (finalJob.output_filename) {
        updateEpisode(episode.id, {
          export_url: getDownloadUrl(finalJob.output_filename),
          exported_at: new Date().toISOString(),
          export_ready_marked: true,
        } as any);
      }
    } catch (e: any) {
      if (e.message !== 'Cancelled') {
        setExportState('failed');
        setCurrentJob((prev) => prev ? {
          ...prev, status: 'failed', error: e.message
        } : null);
      }
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setExportState('idle');
  };

  const handleDownload = () => {
    if (!currentJob?.output_filename) return;
    window.open(getDownloadUrl(currentJob.output_filename), '_blank');
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-5">

      {/* Scene summary */}
      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-white">Episode Summary</h2>
        <div className="space-y-1.5 text-sm">
          <Row label="Total scenes" value={sortedScenes.length} />
          <Row
            label="Images ready"
            value={`${scenesWithImage.length}/${sortedScenes.length}`}
            valueClass={missingImages > 0 ? 'text-amber-400' : 'text-emerald-400'}
          />
          {missingImages > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {missingImages} scene{missingImages > 1 ? 's' : ''} without image will be skipped.
            </p>
          )}
          <Row
            label="Est. duration"
            value={`${sortedScenes.reduce((s, sc) => s + (sc.duration ?? 5), 0)}s`}
          />
        </div>
      </div>

      {/* Export settings */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-white">Settings</h2>
        <div className="flex items-center gap-3">
          <label className="text-xs text-studio-400 w-20 shrink-0">Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as any)}
            className="input text-sm flex-1"
            disabled={exportState === 'exporting'}
          >
            <option value="1280x720">720p (1280×720)</option>
            <option value="1920x1080">1080p (1920×1080)</option>
          </select>
        </div>
      </div>

      {/* Server status */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4" />
            Export Server
          </h2>
          <button
            onClick={handleCheckHealth}
            disabled={checkingHealth}
            className="text-xs text-studio-500 hover:text-studio-300 transition-colors"
          >
            {checkingHealth ? 'Checking...' : 'Refresh'}
          </button>
        </div>

        {health === null || checkingHealth ? (
          <div className="flex items-center gap-2 text-studio-500 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Checking server...
          </div>
        ) : health.ok ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              Connected — localhost:3333
            </div>
            {!health.ffmpeg && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <XCircle className="w-3.5 h-3.5" />
                FFmpeg not found in PATH
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <XCircle className="w-3.5 h-3.5" />
              Server not running
            </div>
            <div className="p-2.5 rounded-lg bg-studio-800/60 border border-studio-700 text-xs text-studio-400 space-y-1">
              <p className="font-medium text-studio-300">To start the server:</p>
              <p className="font-mono bg-studio-900 px-2 py-1 rounded">
                python export_server.py
              </p>
              <p className="text-studio-600">
                Run this in your project folder, then click Refresh.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Export button / progress */}
      {exportState === 'idle' && (
        <button
          onClick={handleExport}
          disabled={!canExport}
          className="w-full btn-primary flex items-center justify-center gap-2 py-2.5
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Film className="w-4 h-4" />
          Export MP4
        </button>
      )}

      {exportState === 'exporting' && currentJob && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white font-medium">
              {currentJob.message || 'Exporting...'}
            </p>
            <button
              onClick={handleCancel}
              className="text-xs text-studio-500 hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="h-2 bg-studio-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500 rounded-full transition-all duration-300"
              style={{ width: `${currentJob.progress}%` }}
            />
          </div>
          <p className="text-xs text-studio-500 text-right font-mono">
            {currentJob.progress}%
          </p>
        </div>
      )}

      {exportState === 'exporting' && !currentJob && (
        <div className="flex items-center gap-3 text-studio-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Starting export...
        </div>
      )}

      {exportState === 'done' && currentJob && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Export complete!
            {currentJob.file_size_mb && (
              <span className="text-studio-500 font-normal text-xs">
                ({currentJob.file_size_mb} MB)
              </span>
            )}
          </div>
          <button
            onClick={handleDownload}
            className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
          >
            <Download className="w-4 h-4" />
            Download {currentJob.output_filename}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setExportState('idle'); setCurrentJob(null); }}
            className="w-full btn-secondary text-sm py-2"
          >
            Export Again
          </button>
        </div>
      )}

      {exportState === 'failed' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <XCircle className="w-4 h-4" />
            Export failed
          </div>
          {currentJob?.error && (
            <p className="text-xs text-studio-500 bg-studio-900 p-2 rounded font-mono">
              {currentJob.error}
            </p>
          )}
          <button
            onClick={() => { setExportState('idle'); setCurrentJob(null); }}
            className="btn-secondary text-sm w-full"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, valueClass = 'text-white'
}: {
  label: string; value: string | number; valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-studio-400">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
