import { useState } from 'react';
import { Key, Cpu, Shield, Globe, Sliders, Download, Upload, RotateCcw, Database } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useStudioStore } from '../store/useStudioStore';
import { AI_PROVIDERS } from '../lib/constants';
import { LANGUAGE_CONFIG } from '../translations';
import type { Language } from '../translations';

export function SettingsPage() {
  const { t, language, setLanguage: setAppLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'general' | 'providers' | 'api' | 'security'>('general');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">{t.settings.title}</h1>
        <p className="page-subtitle">{t.settings.subtitle}</p>
      </div>

      <div className="flex items-center gap-2 border-b border-surface-border pb-0 overflow-x-auto">
        <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={Sliders}>
          {t.settings.general}
        </TabButton>
        <TabButton active={activeTab === 'providers'} onClick={() => setActiveTab('providers')} icon={Cpu}>
          {t.settings.aiProviders}
        </TabButton>
        <TabButton active={activeTab === 'api'} onClick={() => setActiveTab('api')} icon={Key}>
          {t.settings.apiKeys}
        </TabButton>
        <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={Shield}>
          {t.settings.security}
        </TabButton>
      </div>

      {activeTab === 'general' && <GeneralTab language={language} setLanguage={setAppLanguage} />}
      {activeTab === 'general' && <DataManagementSection />}
      {activeTab === 'providers' && <ProvidersTab />}
      {activeTab === 'api' && <ApiKeysTab />}
      {activeTab === 'security' && <SecurityTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
        active ? 'border-accent-500 text-white' : 'border-transparent text-studio-400 hover:text-studio-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function GeneralTab({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const { t } = useLanguage();

  return (
    <div className="card max-w-2xl">
      <h3 className="text-sm font-semibold text-white mb-4">{t.settings.language}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(LANGUAGE_CONFIG) as [Language, typeof LANGUAGE_CONFIG.en][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setLanguage(key)}
            className={`p-4 rounded-xl border text-center transition-all ${
              language === key
                ? 'bg-accent-600/15 border-accent-600/40 text-white'
                : 'bg-surface border-surface-border text-studio-400 hover:border-studio-600'
            }`}
          >
            <Globe className={`w-6 h-6 mx-auto mb-2 ${language === key ? 'text-accent-400' : 'text-studio-500'}`} />
            <p className="text-sm font-medium">{cfg.nativeLabel}</p>
            <p className="text-xs text-studio-500 mt-0.5">{cfg.label}</p>
            <p className="text-[10px] text-studio-600 mt-0.5 uppercase">{cfg.dir}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProvidersTab() {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <p className="text-sm text-studio-400">
        {t.settings.providersDescription}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AI_PROVIDERS.map((provider) => (
          <div key={provider.value} className="card-hover">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-studio-800 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-studio-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{provider.label}</p>
                  <p className="text-xs text-studio-400">{provider.description}</p>
                </div>
              </div>
              <ToggleSwitch />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const { t } = useLanguage();

  const apiKeys = [
    { name: 'OpenAI API Key', env: 'OPENAI_API_KEY', configured: false },
    { name: 'ElevenLabs API Key', env: 'ELEVENLABS_API_KEY', configured: false },
    { name: 'Runway API Key', env: 'RUNWAY_API_KEY', configured: false },
    { name: 'Kling API Key', env: 'KLING_API_KEY', configured: false },
    { name: 'Stability AI Key', env: 'STABILITY_API_KEY', configured: false },
  ];

  return (
    <div className="card max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-accent-500" />
        <p className="text-sm text-studio-300">
          {t.settings.apiKeysNote}
        </p>
      </div>
      <div className="space-y-3">
        {apiKeys.map((key) => (
          <div key={key.env} className="flex items-center justify-between p-4 rounded-lg bg-surface border border-surface-border">
            <div>
              <p className="text-sm font-medium text-white">{key.name}</p>
              <p className="text-xs text-studio-500 font-mono">{key.env}</p>
            </div>
            <span className={`badge ${key.configured ? 'badge-accent' : 'bg-studio-800 text-studio-400 border border-studio-700'}`}>
              {key.configured ? t.settings.configured : t.settings.notSet}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityTab() {
  const { t } = useLanguage();

  return (
    <div className="card max-w-2xl">
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-surface border border-surface-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{t.settings.authentication}</p>
              <p className="text-xs text-studio-400 mt-0.5">{t.settings.authDescription}</p>
            </div>
            <span className="badge-accent">{t.settings.ready}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-surface border border-surface-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{t.settings.roles}</p>
              <p className="text-xs text-studio-400 mt-0.5">{t.settings.rolesDescription}</p>
            </div>
            <span className="badge-warning">{t.settings.planned}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-surface border border-surface-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{t.settings.rls}</p>
              <p className="text-xs text-studio-400 mt-0.5">{t.settings.rlsDescription}</p>
            </div>
            <span className="badge-accent">{t.settings.ready}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataManagementSection() {
  const { t } = useLanguage();
  const store = useStudioStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleExport = () => {
    const data = {
      version: 1,
      exported_at: new Date().toISOString(),
      characters: store.characters,
      episodes: store.episodes,
      prompts: store.prompts,
      voices: store.voices,
      renderJobs: store.renderJobs,
      publishTargets: store.publishTargets,
      stylePresets: store.stylePresets,
      mediaAssets: store.mediaAssets,
      subtitleTracks: store.subtitleTracks,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.version || !data.characters) {
          setImportStatus(t.common.error);
          return;
        }
        localStorage.setItem('ai-studio-store', JSON.stringify({ state: data, version: 1 }));
        setImportStatus(t.common.success);
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        setImportStatus(t.common.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    localStorage.removeItem('ai-studio-store');
    window.location.reload();
  };

  return (
    <div className="card max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-accent-500" />
        <h3 className="text-sm font-semibold text-white">{t.settings.dataManagement}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={handleExport} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-border bg-surface hover:border-accent-600/40 transition-colors">
          <Download className="w-5 h-5 text-accent-400" />
          <span className="text-sm text-studio-300">{t.settings.exportData}</span>
        </button>
        <label className="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-border bg-surface hover:border-accent-600/40 transition-colors cursor-pointer">
          <Upload className="w-5 h-5 text-accent-400" />
          <span className="text-sm text-studio-300">{t.settings.importData}</span>
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-border bg-surface hover:border-danger-600/40 transition-colors">
            <RotateCcw className="w-5 h-5 text-studio-400" />
            <span className="text-sm text-studio-300">{t.settings.resetData}</span>
          </button>
        ) : (
          <button onClick={handleReset} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-danger-600/40 bg-danger-900/10 transition-colors">
            <RotateCcw className="w-5 h-5 text-danger-400" />
            <span className="text-sm text-danger-400">{t.common.confirm}?</span>
          </button>
        )}
      </div>
      {importStatus && (
        <p className={`mt-3 text-xs ${importStatus === t.common.success ? 'text-accent-400' : 'text-danger-400'}`}>
          {importStatus}
        </p>
      )}
    </div>
  );
}

function ToggleSwitch() {
  const [enabled, setEnabled] = useState(false);
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-accent-600' : 'bg-studio-700'}`}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  );
}
