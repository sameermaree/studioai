import { useState } from 'react';
import { Plus, Copy, Sparkles, Star, Globe, Hash, X, Trash2, History, Wand2 } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { LANGUAGES } from '../lib/constants';
import type { Prompt, PromptCategory, Language } from '../types';

const CATEGORY_KEYS = ['cinematic', 'portrait', 'landscape', 'action', 'dialogue', 'custom'] as const;

export function PromptStudio() {
  const { prompts, addPrompt, deletePrompt } = useStudioStore();
  const { t } = useLanguage();
  const [showCreate, setShowCreate] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showHistory, setShowHistory] = useState(false);

  const filtered = filterCategory === 'all'
    ? prompts
    : prompts.filter((p) => p.category === filterCategory);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.prompts.title}</h1>
          <p className="page-subtitle">{t.prompts.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className="btn-secondary flex items-center gap-2">
            <History className="w-4 h-4" />
            {t.prompts.history}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t.prompts.newPrompt}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <FilterChip active={filterCategory === 'all'} onClick={() => setFilterCategory('all')}>{t.common.all}</FilterChip>
        {CATEGORY_KEYS.map((cat) => (
          <FilterChip key={cat} active={filterCategory === cat} onClick={() => setFilterCategory(cat)}>
            {t.prompts.categories[cat]}
          </FilterChip>
        ))}
      </div>

      {showHistory && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-accent-500" />
            {t.prompts.history}
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {prompts.slice().reverse().slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded bg-surface text-sm">
                <span className="text-studio-400 text-xs font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
                <span className="text-white truncate flex-1">{p.name}</span>
                <span className="badge-accent text-[10px]">{p.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((prompt) => (
          <PromptCard key={prompt.id} prompt={prompt} onDelete={() => deletePrompt(prompt.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full card text-center py-12">
            <Sparkles className="w-10 h-10 text-studio-700 mx-auto mb-3" />
            <p className="text-studio-400">{t.common.noResults}</p>
          </div>
        )}
      </div>

      {showCreate && (
        <PromptModal
          onSave={(data) => {
            addPrompt({
              ...data,
              id: crypto.randomUUID(),
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as Prompt);
            setShowCreate(false);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function PromptCard({ prompt, onDelete }: { prompt: Prompt; onDelete: () => void }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt.template);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const variables = prompt.template.match(/\{(\w+)\}/g) ?? [];

  return (
    <div className="card-hover">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-500" />
          <h3 className="text-sm font-semibold text-white">{prompt.name}</h3>
          {prompt.is_preset && <Star className="w-3.5 h-3.5 text-amber-400" />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="badge-accent">{t.prompts.categories[prompt.category as keyof typeof t.prompts.categories] ?? prompt.category}</span>
          <span className="flex items-center gap-1 text-xs text-studio-400">
            <Globe className="w-3 h-3" />{prompt.language.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="mt-3 text-sm text-studio-300 font-mono bg-surface rounded-lg p-3 line-clamp-3">
        {prompt.template}
      </div>

      {prompt.negative_prompt && (
        <p className="mt-2 text-xs text-danger-400/70 line-clamp-1">
          {t.prompts.negativePrompt}: {prompt.negative_prompt}
        </p>
      )}

      {variables.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <Wand2 className="w-3 h-3 text-studio-500" />
          {variables.map((v, i) => (
            <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-accent-900/20 text-accent-400 font-mono">
              {v}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {prompt.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-studio-800 text-studio-400">
              <Hash className="w-3 h-3" />{tag}
            </span>
          ))}
        </div>
        {prompt.seed != null && (
          <span className="text-xs text-studio-500 font-mono">seed: {prompt.seed}</span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-surface-border flex items-center justify-end gap-2">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-surface-lighter text-studio-400 hover:text-white transition-colors"
          title={t.prompts.copyPrompt}
        >
          <Copy className="w-4 h-4" />
          {copied && <span className="absolute -top-6 text-xs text-accent-400">{t.styles.copiedToClipboard}</span>}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-md hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg font-medium whitespace-nowrap transition-all ${
        active
          ? 'bg-accent-600/20 text-accent-400 border border-accent-700/30'
          : 'bg-surface-light text-studio-400 border border-surface-border hover:text-studio-200'
      }`}
    >
      {children}
    </button>
  );
}

function PromptModal({ onSave, onClose }: { onSave: (data: Partial<Prompt>) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PromptCategory>('cinematic');
  const [template, setTemplate] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [tags, setTags] = useState('');
  const [seed, setSeed] = useState('');
  const [isPreset, setIsPreset] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      category,
      template,
      negative_prompt: negativePrompt,
      language,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      is_preset: isPreset,
      seed: seed ? parseInt(seed) : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">{t.prompts.newPrompt}</h2>
          <button onClick={onClose} className="p-1 text-studio-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.common.name}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">{t.prompts.category}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as PromptCategory)} className="input">
                {CATEGORY_KEYS.map((c) => <option key={c} value={c}>{t.prompts.categories[c]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t.prompts.template}</label>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} className="input min-h-[100px] resize-y font-mono text-sm" required placeholder="{character_description}, cinematic..." />
            <p className="text-xs text-studio-500 mt-1">{t.prompts.variables}: {'{character}'}, {'{emotion}'}, {'{scene}'}</p>
          </div>
          <div>
            <label className="label">{t.prompts.negativePrompt}</label>
            <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="input min-h-[60px] resize-y text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">{t.prompts.language}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="input">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.prompts.seed}</label>
              <input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} className="input" placeholder="Random" />
            </div>
            <div>
              <label className="label">{t.common.tags}</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="tag1, tag2" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPreset} onChange={(e) => setIsPreset(e.target.checked)} className="w-4 h-4 rounded border-surface-border bg-surface text-accent-600 focus:ring-accent-600" />
              <span className="text-sm text-studio-300">{t.prompts.isPreset}</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t.common.cancel}</button>
            <button type="submit" className="btn-primary">{t.common.create}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
