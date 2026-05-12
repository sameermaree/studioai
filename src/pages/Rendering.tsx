import React from 'react';
import { MonitorPlay, CheckCircle2, AlertCircle, Clock, Loader2, RotateCcw, XCircle, Film, Plus, Download, Play } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { RENDER_RESOLUTIONS } from '../lib/constants';
import { FFmpegService } from '../services/video/FFmpegService';
import { TimelinePersistenceService } from '../services/timeline/TimelinePersistenceService';
import { RenderService } from '../services/video/RenderService';

// Define types locally to avoid conflicts
type RenderStatus = 'pending' | 'queued' | 'rendering' | 'completed' | 'failed';

interface RenderJob {
  id: string;
  status: RenderStatus;
  progress: number;
  type: string;
  settings: {
    resolution: string;
    fps: number;
    quality: string;
  };
  episode_id?: string;
  error_message?: string | null;
}
import RenderReadinessChecklist from '../components/render/RenderReadinessChecklist';

export function Rendering() {
  const { renderJobs, episodes, updateRenderJob, timelines } = useStudioStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const active = renderJobs.filter((j) => j.status === 'rendering' || j.status === 'queued');
  const completed = renderJobs.filter((j) => j.status === 'completed');
  const failed = renderJobs.filter((j) => j.status === 'failed');
  
  // Create services
  const timelinePersistence = new TimelinePersistenceService();
  const renderService = new RenderService({ useMockRender: true });
  
  // State for render jobs
  const [renderJobsMap, setRenderJobsMap] = React.useState<Map<string, RenderJob>>(new Map());
  
  // Initialize render service
  React.useEffect(() => {
    renderService.initialize();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.rendering.title}</h1>
          <p className="page-subtitle">{t.rendering.subtitle}</p>
        </div>
        <div className="flex space-x-2">
          <Link
            to="/timeline/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-md hover:bg-accent-700 transition-colors"
          >
            <Film className="w-4 h-4" />
            New Timeline
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label={t.rendering.active} value={active.length} icon={Loader2} color="text-amber-400" bg="bg-amber-900/20" />
        <StatCard label={t.rendering.queued} value={renderJobs.filter((j) => j.status === 'queued').length} icon={Clock} color="text-blue-400" bg="bg-blue-900/20" />
        <StatCard label={t.rendering.completed} value={completed.length} icon={CheckCircle2} color="text-accent-400" bg="bg-accent-900/20" />
        <StatCard label={t.rendering.failed} value={failed.length} icon={AlertCircle} color="text-danger-400" bg="bg-danger-900/20" />
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Timelines</h3>
        {timelinePersistence.getTimelineList().length === 0 ? (
          <div className="text-center py-12">
            <Film className="w-12 h-12 text-studio-700 mx-auto mb-3" />
            <p className="text-studio-400">No timelines available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {timelinePersistence.getTimelineList().map((timeline) => {
              const timelineData = timelinePersistence.loadTimeline(timeline.id);
              const renderJob = renderJobsMap.get(timeline.id);
              
              // Create render job if not exists
              React.useEffect(() => {
                if (timelineData && !renderJobsMap.has(timeline.id)) {
                  // Create a render job for this timeline
                  const job = renderService.createRenderJob(
                    timelineData,
                    `output/${timelineData.name.replace(/\s+/g, '_')}.mp4`
                  );
                  
                  // Validate the job
                  renderService.validateJob(job.id, timelineData).then(validatedJob => {
                    setRenderJobsMap(prev => {
                      const updated = new Map(prev);
                      updated.set(timeline.id, validatedJob);
                      return updated;
                    });
                  });
              }
              }, [timelineData, timeline.id]);
              
              return (
                <div key={timeline.id} className="p-4 rounded-lg bg-surface border border-surface-border hover:border-accent-600/30 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-accent-400 transition-colors">{timeline.name}</p>
                      <p className="text-xs text-studio-500 mt-1">{timeline.duration.toFixed(1)}s • Updated {new Date(timeline.updated).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
                        title="Edit Timeline"
                        onClick={() => navigate(`/timeline/${timeline.id}`)}
                      >
                        <Film className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors"
                        title="Export Timeline"
                        onClick={() => timelineData && timelinePersistence.exportTimelineToFile(timelineData)}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-green-900/20 text-studio-400 hover:text-green-400 transition-colors"
                        title="Prepare For Render"
                        onClick={() => timelineData && navigate(`/render/${timeline.id}`)}
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {renderJob && (
                    <div className="mt-3">
                      <div className="p-3 bg-amber-900/20 rounded-md">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-amber-400 mr-2" />
                          <span className="text-sm text-amber-400">Render validation: {renderJob.state}</span>
                        </div>
                        {renderJob.estimatedDuration && (
                          <p className="text-xs text-studio-400 mt-1">Est. duration: {renderJob.estimatedDuration.toFixed(1)}s</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">{t.rendering.renderQueue}</h3>
        {renderJobs.length === 0 ? (
          <div className="text-center py-12">
            <MonitorPlay className="w-12 h-12 text-studio-700 mx-auto mb-3" />
            <p className="text-studio-400">{t.rendering.noJobs}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {renderJobs.map((job) => {
              const ep = episodes.find((e) => e.id === job.episode_id);
              return (
                <RenderJobRow
                  key={job.id}
                  job={job}
                  episodeTitle={ep?.title}
                  onRetry={() => updateRenderJob(job.id, { status: 'queued', progress: 0, error_message: null })}
                  onCancel={() => updateRenderJob(job.id, { status: 'failed', error_message: 'Cancelled by user' })}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">{t.rendering.exportPresets}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {RENDER_RESOLUTIONS.map((res) => (
            <div key={res.value} className="p-4 rounded-lg bg-surface border border-surface-border hover:border-accent-600/30 transition-colors cursor-pointer group">
              <p className="text-sm font-medium text-white group-hover:text-accent-400 transition-colors">{res.label}</p>
              <p className="text-xs text-studio-500 font-mono mt-1">{res.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="card-hover">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-studio-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function RenderJobRow({ job, episodeTitle, onRetry, onCancel }: { job: RenderJob; episodeTitle?: string; onRetry: () => void; onCancel: () => void }) {
  const { t } = useLanguage();

  const typeLabel = job.type === 'episode'
    ? t.rendering.episodeAssembly
    : job.type === 'stitch'
      ? t.rendering.videoStitch
      : t.rendering.sceneRender;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-surface border border-surface-border">
      <RenderStatusIcon status={job.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">{typeLabel}</p>
          {episodeTitle && <span className="text-xs text-studio-400">- {episodeTitle}</span>}
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-studio-500">{job.settings.resolution}</span>
          <span className="text-xs text-studio-500">{job.settings.fps}fps</span>
          <span className="text-xs text-studio-500">{job.settings.quality}</span>
        </div>
        {(job.status === 'rendering' || job.status === 'queued') && (
          <div className="mt-2 h-1.5 w-full bg-studio-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                job.status === 'rendering' ? 'bg-accent-500' : 'bg-studio-600'
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
        {job.error_message && (
          <p className="text-xs text-danger-400 mt-1">{job.error_message}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/timeline/${job.id}`}
          className="p-1.5 rounded-md hover:bg-blue-900/20 text-studio-400 hover:text-blue-400 transition-colors"
          title="Edit in Timeline"
        >
          <Film className="w-4 h-4" />
        </Link>
        {job.status === 'failed' && (
          <button onClick={onRetry} className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors" title={t.rendering.retryJob}>
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {(job.status === 'rendering' || job.status === 'queued') && (
          <button onClick={onCancel} className="p-1.5 rounded-md hover:bg-danger-900/20 text-studio-400 hover:text-danger-400 transition-colors" title={t.rendering.cancelJob}>
            <XCircle className="w-4 h-4" />
          </button>
        )}
        <div className="text-end">
          <span className={`text-xs font-medium ${statusColor(job.status)}`}>
            {job.status}
          </span>
          {job.status === 'rendering' && (
            <p className="text-xs text-studio-500 font-mono mt-0.5">{job.progress}%</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RenderStatusIcon({ status }: { status: RenderStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-accent-500 shrink-0" />;
    case 'failed':
      return <AlertCircle className="w-5 h-5 text-danger-500 shrink-0" />;
    case 'rendering':
      return <Loader2 className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />;
    default:
      return <Clock className="w-5 h-5 text-studio-500 shrink-0" />;
  }
}

function statusColor(status: RenderStatus): string {
  const map: Record<RenderStatus, string> = {
    pending: 'text-studio-400',
    queued: 'text-blue-400',
    rendering: 'text-amber-400',
    completed: 'text-accent-400',
    failed: 'text-danger-400',
  };
  return map[status];
}
