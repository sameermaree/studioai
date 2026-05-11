import { Film, Users, Sparkles, MonitorPlay, TrendingUp, Clock } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { characters, episodes, prompts, renderJobs } = useStudioStore();
  const { t } = useLanguage();

  const activeRenders = renderJobs.filter((j) => j.status === 'rendering' || j.status === 'queued');
  const completedRenders = renderJobs.filter((j) => j.status === 'completed');

  const stats = [
    { label: t.dashboard.characters, value: characters.length, icon: Users, color: 'text-accent-400', bg: 'bg-accent-900/20' },
    { label: t.dashboard.episodes, value: episodes.length, icon: Film, color: 'text-blue-400', bg: 'bg-blue-900/20' },
    { label: t.dashboard.prompts, value: prompts.length, icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-900/20' },
    { label: t.dashboard.activeRenders, value: activeRenders.length, icon: MonitorPlay, color: 'text-rose-400', bg: 'bg-rose-900/20' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-title">{t.dashboard.title}</h1>
        <p className="page-subtitle">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-studio-400">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t.dashboard.recentEpisodes}</h2>
            <Link to="/episodes" className="text-sm text-accent-400 hover:text-accent-300 transition-colors">
              {t.dashboard.viewAll}
            </Link>
          </div>
          <div className="space-y-3">
            {episodes.slice(0, 3).map((ep) => (
              <div key={ep.id} className="flex items-center gap-4 p-3 rounded-lg bg-surface hover:bg-surface-lighter transition-colors">
                <div className="w-16 h-10 rounded-md bg-studio-800 overflow-hidden shrink-0">
                  {ep?.thumbnail_url && (
                    <img src={ep.thumbnail_url} alt={ep.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{ep.title}</p>
                  <p className="text-xs text-studio-400">
                    {ep.scenes.length} {t.episodes.scenes.toLowerCase()}
                  </p>
                </div>
                <StatusBadge status={ep.status} />
              </div>
            ))}
            {episodes.length === 0 && (
              <p className="text-sm text-studio-500 text-center py-4">{t.episodes.noEpisodes}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t.dashboard.renderQueue}</h2>
            <Link to="/rendering" className="text-sm text-accent-400 hover:text-accent-300 transition-colors">
              {t.dashboard.viewAll}
            </Link>
          </div>
          <div className="space-y-3">
            {renderJobs.slice(0, 4).map((job) => (
              <div key={job.id} className="flex items-center gap-4 p-3 rounded-lg bg-surface">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  job.status === 'rendering' ? 'bg-accent-900/20' : 'bg-studio-800'
                }`}>
                  {job.status === 'rendering' ? (
                    <TrendingUp className="w-5 h-5 text-accent-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-studio-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {job.type === 'episode' ? t.dashboard.episodeStitch : t.dashboard.sceneRender}
                  </p>
                  <div className="mt-1 h-1.5 w-full bg-studio-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full transition-all duration-500"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-studio-400 font-mono">{job.progress}%</span>
              </div>
            ))}
            {renderJobs.length === 0 && (
              <p className="text-sm text-studio-500 text-center py-4">{t.rendering.noJobs}</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">{t.dashboard.productionStats}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-surface">
            <p className="text-2xl font-bold text-accent-400">{completedRenders.length}</p>
            <p className="text-xs text-studio-400 mt-1">{t.dashboard.rendersComplete}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-surface">
            <p className="text-2xl font-bold text-blue-400">
              {episodes.reduce((sum, ep) => sum + ep.scenes.length, 0)}
            </p>
            <p className="text-xs text-studio-400 mt-1">{t.dashboard.totalScenes}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-surface">
            <p className="text-2xl font-bold text-amber-400">
              {episodes.reduce((sum, ep) => sum + (ep.duration_estimate ?? 0), 0)}s
            </p>
            <p className="text-xs text-studio-400 mt-1">{t.dashboard.totalDuration}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-surface">
            <p className="text-2xl font-bold text-emerald-400">{prompts.filter((p) => p.is_preset).length}</p>
            <p className="text-xs text-studio-400 mt-1">{t.dashboard.promptPresets}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-studio-800 text-studio-400 border-studio-700',
    in_production: 'bg-blue-900/30 text-blue-400 border-blue-700/30',
    rendering: 'bg-amber-900/30 text-amber-400 border-amber-700/30',
    rendered: 'bg-accent-900/30 text-accent-400 border-accent-700/30',
    published: 'bg-emerald-900/30 text-emerald-400 border-emerald-700/30',
  };

  return (
    <span className={`badge border ${styles[status] ?? styles.draft}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
