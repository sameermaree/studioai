import { useState } from 'react';
import { Upload, Image, Video, Music, Search, Tag, Grid2x2 as Grid, List, X, Trash2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useStudioStore } from '../store/useStudioStore';
import type { MediaAsset } from '../types';

export function MediaStudio() {
  const { t } = useLanguage();
  const { mediaAssets, addMediaAsset, deleteMediaAsset } = useStudioStore();
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  const filtered = mediaAssets
    .filter((m) => filter === 'all' || m.type === filter)
    .filter((m) => !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.tags.some((tag) => tag.includes(searchQuery.toLowerCase())));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.media.title}</h1>
          <p className="page-subtitle">{t.media.subtitle}</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          {t.media.upload}
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} icon={null}>{t.media.all}</FilterChip>
          <FilterChip active={filter === 'image'} onClick={() => setFilter('image')} icon={Image}>{t.media.images}</FilterChip>
          <FilterChip active={filter === 'video'} onClick={() => setFilter('video')} icon={Video}>{t.media.videos}</FilterChip>
          <FilterChip active={filter === 'audio'} onClick={() => setFilter('audio')} icon={Music}>{t.media.audio}</FilterChip>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-studio-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.media.searchMedia}
              className="input ps-9 py-1.5 text-sm w-56"
            />
          </div>
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface-lighter text-white' : 'text-studio-400 hover:text-white'}`}>
            <Grid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface-lighter text-white' : 'text-studio-400 hover:text-white'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Upload className="w-12 h-12 text-studio-700 mx-auto mb-3" />
          <p className="text-studio-400">{t.media.noMedia}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((asset) => (
            <MediaCard key={asset.id} asset={asset} onDelete={() => deleteMediaAsset(asset.id)} onPreview={() => setPreviewAsset(asset)} />
          ))}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-surface-border">
            {filtered.map((asset) => (
              <MediaRow key={asset.id} asset={asset} onDelete={() => deleteMediaAsset(asset.id)} />
            ))}
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onAdd={(asset) => {
            addMediaAsset(asset);
            setShowUpload(false);
          }}
        />
      )}

      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-surface rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
              <div>
                <p className="text-sm font-medium text-white">{previewAsset.name}</p>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {previewAsset.tags.map((tag) => (
                    <span key={tag} className="text-[10px] text-studio-400">{tag}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setPreviewAsset(null)}
                className="p-1.5 rounded-md text-studio-400 hover:text-white hover:bg-surface-lighter transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-studio-900 flex items-center justify-center min-h-[300px] max-h-[70vh]">
              <img
                src={previewAsset.url}
                alt={previewAsset.name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaCard({ asset, onDelete, onPreview }: { asset: MediaAsset; onDelete: () => void; onPreview: () => void }) {
  const TypeIcon = asset.type === 'image' ? Image : asset.type === 'video' ? Video : Music;

  return (
    <div className="group rounded-xl bg-surface-light border border-surface-border overflow-hidden hover:border-accent-600/40 transition-all cursor-pointer" onClick={onPreview}>
      <div className="aspect-square bg-studio-800 relative overflow-hidden">
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon className="w-10 h-10 text-studio-600" />
          </div>
        )}
        <div className="absolute top-2 end-2">
          <span className="badge-accent text-[10px]">{asset.type}</span>
        </div>
        <button
          onClick={onDelete}
          className="absolute top-2 start-2 p-1.5 rounded-md bg-black/50 text-studio-300 hover:text-danger-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs font-medium text-white truncate">{asset.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-studio-500">{asset.size}</span>
          {asset.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="flex items-center gap-0.5 text-[10px] text-studio-400">
              <Tag className="w-2.5 h-2.5" />{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaRow({ asset, onDelete }: { asset: MediaAsset; onDelete: () => void }) {
  const TypeIcon = asset.type === 'image' ? Image : asset.type === 'video' ? Video : Music;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-surface-lighter transition-colors group">
      <div className="w-12 h-12 rounded-lg bg-studio-800 overflow-hidden shrink-0 flex items-center justify-center">
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <TypeIcon className="w-5 h-5 text-studio-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{asset.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {asset.tags.map((tag) => (
            <span key={tag} className="text-xs text-studio-400">{tag}</span>
          ))}
        </div>
      </div>
      <span className="text-xs text-studio-500">{asset.size}</span>
      <span className="text-xs text-studio-500">{asset.created_at.split('T')[0]}</span>
      <span className="badge-accent text-[10px]">{asset.type}</span>
      <button
        onClick={onDelete}
        className="p-1.5 rounded-md hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function FilterChip({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType | null; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium whitespace-nowrap transition-all ${
        active
          ? 'bg-accent-600/20 text-accent-400 border border-accent-700/30'
          : 'bg-surface-light text-studio-400 border border-surface-border hover:text-studio-200'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function UploadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (asset: MediaAsset) => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'image' | 'video' | 'audio'>('image');
  const [tags, setTags] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: crypto.randomUUID(),
      name: name || 'Untitled',
      type,
      url,
      thumbnail_url: type === 'image' ? url : '',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      size: 'N/A',
      mime_type: type === 'image' ? 'image/png' : type === 'video' ? 'video/mp4' : 'audio/mp3',
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">{t.media.upload}</h2>
          <button onClick={onClose} className="p-1 text-studio-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t.common.name}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="my-image.png" required />
          </div>
          <div>
            <label className="label">URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="input" placeholder="https://..." required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.common.type}</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'image' | 'video' | 'audio')} className="input">
                <option value="image">{t.media.images}</option>
                <option value="video">{t.media.videos}</option>
                <option value="audio">{t.media.audio}</option>
              </select>
            </div>
            <div>
              <label className="label">{t.common.tags}</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="bg, scene" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t.common.cancel}</button>
            <button type="submit" className="btn-primary">{t.common.add}</button>
          </div>
        </form>
      </div>
    </div>
  );
}