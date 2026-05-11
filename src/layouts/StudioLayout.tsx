import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';

export function StudioLayout() {
  const sidebarOpen = useStudioStore((s) => s.sidebarOpen);
  const { isRTL } = useLanguage();

  const marginClass = sidebarOpen
    ? isRTL ? 'mr-64' : 'ml-64'
    : isRTL ? 'mr-16' : 'ml-16';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${marginClass}`}>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
