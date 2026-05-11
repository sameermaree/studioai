import { Bell, Search, User, Globe } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { LANGUAGE_CONFIG } from '../translations';
import type { Language } from '../translations';

export function TopBar() {
  const renderJobs = useStudioStore((s) => s.renderJobs);
  const activeJobs = renderJobs.filter((j) => j.status === 'rendering' || j.status === 'queued');
  const { t, language, setLanguage } = useLanguage();

  return (
    <header className="h-16 border-b border-surface-border bg-surface-light/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-studio-500" />
          <input
            type="text"
            placeholder={`${t.common.search}...`}
            className="input ps-10 py-1.5 text-sm bg-surface"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {activeJobs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-900/20 border border-accent-700/30 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
            <span className="text-xs font-medium text-accent-400">
              {activeJobs.length} {t.rendering.active.toLowerCase()}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-lighter border border-surface-border">
          <Globe className="w-3.5 h-3.5 text-studio-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-xs text-studio-300 border-none focus:outline-none cursor-pointer pr-1"
          >
            {(Object.entries(LANGUAGE_CONFIG) as [Language, typeof LANGUAGE_CONFIG.en][]).map(([key, cfg]) => (
              <option key={key} value={key} className="bg-surface-light text-studio-200">
                {cfg.nativeLabel}
              </option>
            ))}
          </select>
        </div>

        <button className="relative p-2 text-studio-400 hover:text-studio-200 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-500" />
        </button>

        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-lighter transition-colors">
          <div className="w-8 h-8 rounded-full bg-studio-700 flex items-center justify-center">
            <User className="w-4 h-4 text-studio-300" />
          </div>
        </button>
      </div>
    </header>
  );
}
