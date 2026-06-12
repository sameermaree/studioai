/**
 * Dashboard.tsx — Simple production studio home.
 * Three questions only: What am I working on? What's pending? What do I start?
 */
import { useNavigate } from 'react-router-dom';
import { Film, Plus, Loader2, ChevronRight, Clock } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useRenderQueueStore } from '../store/useRenderQueueStore';
import { WorkflowStateBadge } from '../components/shared/WorkflowStateBadge';
import { computeEpisodeWorkflowState, computeEpisodeStats } from '../lib/computeEpisodeState';

export function Dashboard() {
  const navigate = useNavigate();
  const { episodes } = useStudioStore();
  const productionJobs = useRenderQueueStore((s) => s.jobs);

  const validEpisodes = episodes
    .filter((ep) => ep?.id && ep?.title && ep?.scenes)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const lastEpisode = validEpisodes[0];
  const activeJobs = productionJobs.filter(
    (j) => j.status === 'running' || j.status === 'queued'
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pt-4">

      {/* Continue last episode */}
      {lastEpisode && (
        <div>
          <p className="text-xs text-studio-500 uppercase tracking-widest mb-3">Continue working</p>
          <button
            onClick={() => navigate(`/workspace/${lastEpisode.id}`)}
            className="w-full text-left p-4 rounded-xl bg-accent-600/10 border border-accent-600/20
              hover:bg-accent-600/15 hover:border-accent-600/30 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-white">{lastEpisode.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <WorkflowStateBadge
                    state={computeEpisodeWorkflowState(lastEpisode, productionJobs)}
                    size="sm"
                  />
                  <span className="text-xs text-studio-500">
                    {lastEpisode.scenes.length} scenes ·{' '}
                    {timeAgo(lastEpisode.updated_at)}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-studio-500 group-hover:text-accent-400 transition-colors" />
            </div>
          </button>
        </div>
      )}

      {/* Active render jobs */}
      {activeJobs.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-900/10 border border-amber-700/20">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-300 font-medium">
              {activeJobs.length} job{activeJobs.length > 1 ? 's' : ''} running
            </p>
            {activeJobs[0] && (
              <p className="text-xs text-amber-500 truncate">
                {activeJobs[0].type} · scene {activeJobs[0].scene_id?.slice(0, 8)}
              </p>
            )}
          </div>
          {activeJobs[0]?.progress > 0 && (
            <span className="text-xs text-amber-400 font-mono">{activeJobs[0].progress}%</span>
          )}
        </div>
      )}

      {/* Episodes list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-studio-500 uppercase tracking-widest">Episodes</p>
          <button
            onClick={() => navigate('/episodes')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
              bg-accent-600 text-white hover:bg-accent-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Episode
          </button>
        </div>

        <div className="space-y-2">
          {validEpisodes.length === 0 ? (
            <div className="text-center py-12">
              <Film className="w-10 h-10 text-studio-700 mx-auto mb-3" />
              <p className="text-studio-500 text-sm">No episodes yet.</p>
              <button
                onClick={() => navigate('/episodes')}
                className="mt-3 text-sm text-accent-400 hover:text-accent-300 transition-colors"
              >
                Create your first episode →
              </button>
            </div>
          ) : (
            validEpisodes.map((ep) => {
              const state = computeEpisodeWorkflowState(ep, productionJobs);
              const stats = computeEpisodeStats(ep, productionJobs);
              return (
                <button
                  key={ep.id}
                  onClick={() => navigate(`/workspace/${ep.id}`)}
                  className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-lg
                    bg-studio-900 border border-studio-800 hover:border-studio-600
                    hover:bg-studio-800/50 transition-all group"
                >
                  {/* Mini image or placeholder */}
                  <div className="w-12 h-8 rounded bg-studio-800 shrink-0 overflow-hidden">
                    {ep.scenes.find((s) => s.render_url) ? (
                      <img
                        src={`http://127.0.0.1:8188/view?filename=${encodeURIComponent(
                          ep.scenes.find((s) => s.render_url)!.render_url!
                        )}&type=output`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-4 h-4 text-studio-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ep.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <WorkflowStateBadge state={state} size="sm" />
                      <span className="text-xs text-studio-600">
                        {stats.scenes_with_image}/{stats.total_scenes} images
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-studio-600 group-hover:text-studio-400 transition-colors shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
