import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Film, Sparkles, Mic2, MonitorPlay, Share2, Settings, ChevronLeft, ChevronRight, Clapperboard, FolderOpen, Palette, Files as SubtitlesIcon, Image as ImageIcon } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useStudioStore();
  const { t, isRTL } = useLanguage();

  const navItems = [
    { path: '/', label: t.nav.dashboard, icon: LayoutDashboard },
    { path: '/characters', label: t.nav.characters, icon: Users },
    { path: '/episodes', label: t.nav.episodes, icon: Film },
    { path: '/prompts', label: t.nav.prompts, icon: Sparkles },
    { path: '/styles', label: t.nav.styles, icon: Palette },
    { path: '/voice', label: t.nav.voice, icon: Mic2 },
    { path: '/subtitles', label: t.nav.subtitles, icon: SubtitlesIcon },
    { path: '/rendering', label: t.nav.rendering, icon: MonitorPlay },
    { path: '/comfyui', label: 'ComfyUI Studio', icon: ImageIcon },
    { path: '/media', label: t.nav.media, icon: FolderOpen },
    { path: '/publishing', label: t.nav.publishing, icon: Share2 },
    { path: '/settings', label: t.nav.settings, icon: Settings },
  ];

  const positionClass = isRTL ? 'right-0' : 'left-0';
  const CollapseIcon = isRTL
    ? (sidebarOpen ? ChevronRight : ChevronLeft)
    : (sidebarOpen ? ChevronLeft : ChevronRight);

  return (
    <aside
      className={`fixed ${positionClass} top-0 h-full bg-surface-light border-surface-border z-30
        flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}
        ${isRTL ? 'border-l' : 'border-r'}`}
    >
      <div className="flex items-center h-16 px-4 border-b border-surface-border">
        <Clapperboard className="w-7 h-7 text-accent-500 shrink-0" />
        {sidebarOpen && (
          <span className={`${isRTL ? 'mr-3' : 'ml-3'} font-semibold text-lg text-white tracking-tight animate-fade-in`}>
            StudioAI
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-accent-600/15 text-accent-400 border border-accent-700/30'
                    : 'text-studio-400 hover:text-studio-200 hover:bg-surface-lighter border border-transparent'
                  }
                  ${!sidebarOpen ? 'justify-center' : ''}`
                }
                title={item.label}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="animate-fade-in truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t border-surface-border
          text-studio-500 hover:text-studio-300 transition-colors"
      >
        <CollapseIcon className="w-5 h-5" />
      </button>
    </aside>
  );
}
