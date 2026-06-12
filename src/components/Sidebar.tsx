/**
 * Sidebar.tsx — Simplified navigation.
 * Main: Dashboard, Episodes, Characters.
 * Advanced: collapsed section for power tools.
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Film, Settings,
  Clapperboard, ChevronLeft, ChevronRight,
  ChevronDown, Wrench, ImageIcon, Mic2, FolderOpen,
} from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';

const MAIN_NAV = [
  { path: '/',           label: 'Home',       icon: LayoutDashboard, end: true },
  { path: '/episodes',   label: 'Episodes',   icon: Film },
  { path: '/characters', label: 'Characters', icon: Users },
];

const ADVANCED_NAV = [
  { path: '/rendering',  label: 'Render Queue', icon: ImageIcon },
  { path: '/voice',      label: 'Voice Studio', icon: Mic2 },
  { path: '/media',      label: 'Media',        icon: FolderOpen },
  { path: '/comfyui',    label: 'ComfyUI',      icon: Wrench },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useStudioStore();
  const { isRTL } = useLanguage();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const positionClass = isRTL ? 'right-0' : 'left-0';
  const CollapseIcon = isRTL
    ? (sidebarOpen ? ChevronRight : ChevronLeft)
    : (sidebarOpen ? ChevronLeft : ChevronRight);

  return (
    <aside
      className={`fixed ${positionClass} top-0 h-full bg-surface-light z-30
        flex flex-col transition-all duration-300
        ${sidebarOpen ? 'w-56' : 'w-16'}
        ${isRTL ? 'border-l' : 'border-r'} border-surface-border`}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-surface-border shrink-0">
        <Clapperboard className="w-6 h-6 text-accent-500 shrink-0" />
        {sidebarOpen && (
          <span className={`${isRTL ? 'mr-3' : 'ml-3'} font-semibold text-white tracking-tight animate-fade-in`}>
            StudioAI
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-0.5 px-2">
          {MAIN_NAV.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-accent-600/15 text-accent-400 border border-accent-700/30'
                    : 'text-studio-400 hover:text-studio-200 hover:bg-surface-lighter border border-transparent'
                  }
                  ${!sidebarOpen ? 'justify-center' : ''}`
                }
                title={item.label}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="truncate animate-fade-in">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div className="my-3 mx-4 border-t border-studio-800" />

        {/* Advanced section */}
        {sidebarOpen ? (
          <div className="px-2">
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs
                text-studio-600 hover:text-studio-400 transition-colors"
            >
              <span className="uppercase tracking-widest">Advanced</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedOpen && (
              <ul className="space-y-0.5 mt-1">
                {ADVANCED_NAV.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all
                        ${isActive
                          ? 'bg-accent-600/10 text-accent-400'
                          : 'text-studio-600 hover:text-studio-300 hover:bg-surface-lighter'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          /* Collapsed: show wrench icon for advanced */
          <div className="px-2">
            <button
              onClick={() => { toggleSidebar(); setAdvancedOpen(true); }}
              className="w-full flex justify-center px-3 py-2.5 text-studio-700
                hover:text-studio-500 transition-colors"
              title="Advanced tools"
            >
              <Wrench className="w-4 h-4" />
            </button>
          </div>
        )}
      </nav>

      {/* Settings + collapse */}
      <div className="border-t border-surface-border shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 text-sm transition-colors
            ${isActive ? 'text-accent-400' : 'text-studio-500 hover:text-studio-300'}
            ${!sidebarOpen ? 'justify-center' : ''}`
          }
          title="Settings"
        >
          <Settings className="w-4 h-4 shrink-0" />
          {sidebarOpen && <span className="animate-fade-in">Settings</span>}
        </NavLink>
        <button
          onClick={toggleSidebar}
          className={`w-full flex items-center py-3 border-t border-surface-border
            text-studio-600 hover:text-studio-400 transition-colors
            ${sidebarOpen ? 'justify-end px-4' : 'justify-center'}`}
        >
          <CollapseIcon className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
