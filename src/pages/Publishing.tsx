import { useState } from 'react';
import { Share2, Youtube, Clock, CheckCircle2, ExternalLink, Plus, X, Hash, Calendar, Image } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { PLATFORMS, LANGUAGES } from '../lib/constants';
import type { PublishTarget, Platform, Language } from '../types';

export function Publishing() {
  const { publishTargets, episodes, addPublishTarget } = useStudioStore();
  const { t } = useLanguage();
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'published' | 'scheduled' | 'drafts'>('published');

  const published = publishTargets.filter((t) => t.status === 'published');
  const scheduled = publishTargets.filter((t) => t.status === 'scheduled');
  const drafts = publishTargets.filter((t) => t.status === 'draft');

  const tabData = { published, scheduled, drafts };
  const currentList = tabData[activeTab];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.publishing.title}</h1>
          <p className="page-subtitle">{t.publishing.subtitle}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t.publishing.newPublish}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {PLATFORMS.map((p) => {
          const count = publishTargets.filter((t) => t.platform === p.value && t.status === 'published').length;
          return (
            <div key={p.value} className="card-hover text-center">
              <PlatformIcon platform={p.value} />
              <p className="text-sm font-medium text-white mt-2">{t.publishing.platforms[p.value as keyof typeof t.publishing.platforms]}</p>
              <p className="text-xs text-studio-400 mt-0.5">{count} {t.publishing.published.toLowerCase()}</p>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="flex items-center gap-4 border-b border-surface-border -mx-6 px-6 mb-4">
          <TabButton active={activeTab === 'published'} onClick={() => setActiveTab('published')} icon={CheckCircle2}>
            {t.publishing.published} ({published.length})
          </TabButton>
          <TabButton active={activeTab === 'scheduled'} onClick={() => setActiveTab('scheduled')} icon={Calendar}>
            {t.publishing.scheduled} ({scheduled.length})
          </TabButton>
          <TabButton active={activeTab === 'drafts'} onClick={() => setActiveTab('drafts')} icon={Clock}>
            {t.publishing.drafts} ({drafts.length})
          </TabButton>
        </div>

        <div className="space-y-3">
          {currentList.map((target) => (
            <PublishRow key={target.id} target={target} episodes={episodes} />
          ))}
          {currentList.length === 0 && (
            <p className="text-sm text-studio-500 text-center py-8">{t.common.noResults}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">{t.publishing.channelManagement}</h3>
          <div className="space-y-3">
            {PLATFORMS.map((p) => (
              <div key={p.value} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-border">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={p.value} />
                  <div>
                    <p className="text-sm font-medium text-white">{p.label}</p>
                    <p className="text-xs text-studio-500">{t.publishing.notConnected}</p>
                  </div>
                </div>
                <button className="btn-secondary text-xs py-1">{t.publishing.connect}</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">{t.publishing.publishHistory}</h3>
          <div className="space-y-2">
            {published.slice(0, 5).map((target) => (
              <div key={target.id} className="flex items-center gap-3 p-2 rounded bg-surface text-sm">
                <PlatformIcon platform={target.platform} />
                <span className="text-white truncate flex-1">{target.title}</span>
                <span className="text-xs text-studio-500">{target.published_at ? new Date(target.published_at).toLocaleDateString() : ''}</span>
              </div>
            ))}
            {published.length === 0 && <p className="text-xs text-studio-500 py-4 text-center">{t.common.noResults}</p>}
          </div>
        </div>
      </div>

      {showCreate && (
        <PublishModal
          episodes={episodes}
          onSave={(data) => {
            addPublishTarget({
              ...data,
              id: crypto.randomUUID(),
              status: data.scheduled_at ? 'scheduled' : 'draft',
              published_at: null,
              external_url: null,
              created_at: new Date().toISOString(),
            } as PublishTarget);
            setShowCreate(false);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? 'border-accent-500 text-white' : 'border-transparent text-studio-400 hover:text-studio-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const icons: Record<Platform, React.ReactNode> = {
    youtube: <Youtube className="w-6 h-6 text-red-400" />,
    tiktok: <Share2 className="w-6 h-6 text-cyan-400" />,
    instagram: <Image className="w-6 h-6 text-pink-400" />,
    facebook: <Share2 className="w-6 h-6 text-blue-400" />,
  };
  return <span className="shrink-0">{icons[platform]}</span>;
}

function PublishRow({ target, episodes }: { target: PublishTarget; episodes: { id: string; title: string }[] }) {
  const ep = episodes.find((e) => e.id === target.episode_id);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-surface-border hover:border-studio-600 transition-colors">
      <PlatformIcon platform={target.platform} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{target.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {ep && <span className="text-xs text-studio-400">{ep.title}</span>}
          <span className="text-xs text-studio-500">{target.language.toUpperCase()}</span>
          {target.scheduled_at && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Calendar className="w-3 h-3" />
              {new Date(target.scheduled_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {target.hashtags.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {target.hashtags.slice(0, 4).map((h) => (
              <span key={h} className="flex items-center text-[10px] text-accent-400">
                <Hash className="w-3 h-3" />{h.replace('#', '')}
              </span>
            ))}
          </div>
        )}
      </div>
      {target.external_url && (
        <a href={target.external_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-studio-400 hover:text-accent-400 transition-colors">
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function PublishModal({
  episodes,
  onSave,
  onClose,
}: {
  episodes: { id: string; title: string }[];
  onSave: (data: Partial<PublishTarget>) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [episodeId, setEpisodeId] = useState('');
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [scheduledAt, setScheduledAt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      episode_id: episodeId,
      platform,
      title,
      description,
      hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean),
      language,
      scheduled_at: scheduledAt || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">{t.publishing.newPublish}</h2>
          <button onClick={onClose} className="p-1 text-studio-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.episodes.title}</label>
              <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} className="input" required>
                <option value="">--</option>
                {episodes.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.publishing.platform}</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="input">
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t.publishing.title_field}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">{t.common.description}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-[60px] resize-y" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.publishing.hashtags}</label>
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="input" placeholder="#ai, #content" />
            </div>
            <div>
              <label className="label">{t.common.language}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="input">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t.publishing.schedule}</label>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t.common.cancel}</button>
            <button type="submit" className="btn-primary">
              {scheduledAt ? t.publishing.schedule : t.publishing.publishNow}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
