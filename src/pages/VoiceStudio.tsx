import { useState, useEffect } from 'react';
import { Plus, Mic2, Globe, Volume2, Trash2, X, Upload, Play } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';
import { useLanguage } from '../hooks/useLanguage';
import { VoiceGenerationService } from '../application/voice/services/VoiceGenerationService';
import { AssetIndexer } from '../services/comfyui/assets/assetIndexer';
import { LANGUAGES } from '../lib/constants';
import type { Voice, Language, VoiceProvider } from '../types';

export function VoiceStudio() {
  const { voices, characters, addVoice, deleteVoice } = useStudioStore();
  const { t } = useLanguage();
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [generatedVoiceAssets, setGeneratedVoiceAssets] = useState<any[]>([]);
  
  // Initialize services
  const assetIndexer = new AssetIndexer();
  const voiceService = new VoiceGenerationService(assetIndexer);
  
  // Load available providers
  useEffect(() => {
    assetIndexer.initialize();
    const providers = voiceService.getAvailableProviders();
    setAvailableProviders(providers);
    
    // Load generated voice assets from asset indexer
    const voiceAssets = assetIndexer.search({ 
      type: 'audio', 
      category: 'voice' 
    });
    
    setGeneratedVoiceAssets(voiceAssets.assets);
  }, []);

  const groupedByLang = voices.reduce<Record<string, Voice[]>>((acc, v) => {
    (acc[v.language] ??= []).push(v);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="page-title">{t.voice.title}</h1>
          <p className="page-subtitle">{t.voice.subtitle}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t.voice.addVoice}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LANGUAGES.map((lang) => (
          <div key={lang.value} className="card">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-accent-500" />
              <h3 className="text-sm font-semibold text-white">{lang.label}</h3>
              <span className="text-xs text-studio-500">({(groupedByLang[lang.value] ?? []).length})</span>
            </div>
            <div className="space-y-2">
              {(groupedByLang[lang.value] ?? []).map((voice) => {
                const char = characters.find((c) => c.id === voice.character_id);
                return (
                  <div key={voice.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-surface-border group hover:border-studio-600 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-studio-800 flex items-center justify-center shrink-0">
                      <Mic2 className="w-4 h-4 text-studio-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{voice.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-studio-500">{voice.provider}</span>
                        {voice.is_cloned && <span className="badge-accent text-[10px]">{t.voice.cloned}</span>}
                        {char && <span className="text-xs text-studio-400">- {char.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors" title={t.voice.preview}>
                        <Play className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-surface-lighter text-studio-400 hover:text-white transition-colors">
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteVoice(voice.id)}
                        className="p-1.5 rounded-md hover:bg-danger-900/30 text-studio-400 hover:text-danger-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(groupedByLang[lang.value] ?? []).length === 0 && (
                <p className="text-xs text-studio-500 text-center py-4">{t.voice.noVoices}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Generate Voice</h3>
        <div 
          className="border-2 border-dashed border-surface-border rounded-xl p-8 text-center hover:border-accent-600/40 transition-colors cursor-pointer group"
          onClick={() => setShowGenerate(true)}
        >
          <Mic2 className="w-10 h-10 text-studio-600 mx-auto mb-3 group-hover:text-accent-500 transition-colors" />
          <p className="text-sm text-studio-400">Generate voice for a character or scene</p>
          <p className="text-xs text-studio-500 mt-1">Click to generate a new voice asset</p>
        </div>
      </div>
      
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Generated Voice Assets</h3>
        {generatedVoiceAssets.length === 0 ? (
          <p className="text-center text-studio-500 text-sm py-8">No voice assets generated yet</p>
        ) : (
          <div className="space-y-3">
            {generatedVoiceAssets.map(asset => (
              <div key={asset.id} className="p-3 bg-surface rounded-lg border border-surface-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-accent-900/30 rounded-md flex items-center justify-center">
                      <Volume2 className="w-4 h-4 text-accent-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{asset.metadata.voice_name || asset.id.substring(0, 8)}</p>
                      <p className="text-xs text-studio-500">
                        {asset.metadata.duration?.toFixed(1)}s • {asset.metadata.provider || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-md hover:bg-accent-900/20 text-studio-400 hover:text-accent-400 transition-colors">
                      <Play className="w-4 h-4" />
                    </button>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${asset.status === 'complete' ? 'bg-green-900/20 text-green-500' : asset.status === 'pending' ? 'bg-amber-900/20 text-amber-500' : 'bg-red-900/20 text-red-500'}`}>
                      {asset.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">{t.voice.voiceCloning}</h3>
        <div className="border-2 border-dashed border-surface-border rounded-xl p-8 text-center hover:border-accent-600/40 transition-colors cursor-pointer group">
          <Upload className="w-10 h-10 text-studio-600 mx-auto mb-3 group-hover:text-accent-500 transition-colors" />
          <p className="text-sm text-studio-400">{t.voice.uploadSample}</p>
          <p className="text-xs text-studio-500 mt-1">{t.voice.sampleFormat}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">{t.voice.supportedProviders}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {availableProviders.map((p) => {
            const statusColor = p === 'mock' || p === 'browser' ? 'bg-green-900/20 text-green-500' : 'bg-amber-900/20 text-amber-500';
            return (
              <div key={p} className="p-3 rounded-lg bg-surface border border-surface-border text-center">
                <Mic2 className="w-5 h-5 text-studio-500 mx-auto mb-1" />
                <p className="text-xs text-studio-300">{p}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-2 inline-block ${statusColor}`}>
                  {p === 'mock' || p === 'browser' ? 'Available' : 'Coming Soon'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && (
        <VoiceModal
          characters={characters}
          onSave={(data) => {
            addVoice({
              ...data,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
            } as Voice);
            setShowCreate(false);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
      
      {showGenerate && (
        <GenerateVoiceModal
          characters={characters}
          voiceService={voiceService}
          availableProviders={availableProviders}
          onGenerated={(asset) => {
            // Update the generated assets list
            setGeneratedVoiceAssets(prev => [asset, ...prev]);
            setShowGenerate(false);
          }}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </div>
  );
}

function GenerateVoiceModal({
  characters,
  voiceService,
  availableProviders,
  onGenerated,
  onClose,
}: {
  characters: { id: string; name: string }[];
  voiceService: VoiceGenerationService;
  availableProviders: string[];
  onGenerated: (asset: any) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [provider, setProvider] = useState(availableProviders[0] || 'mock');
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [voices, setVoices] = useState<Array<{ id: string; name: string; provider: string }>>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  // Load voices when provider or language changes
  useEffect(() => {
    async function loadVoices() {
      try {
        const availableVoices = await voiceService.getAvailableVoicesForLanguage(language, provider);
        setVoices(availableVoices);
        if (availableVoices.length > 0) {
          setSelectedVoice(availableVoices[0].id);
        }
      } catch (error) {
        console.error('Failed to load voices:', error);
        setError('Failed to load voices');
      }
    }
    
    loadVoices();
  }, [provider, language, voiceService]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoice || !text) return;
    
    setIsGenerating(true);
    setError('');
    
    try {
      const asset = await voiceService.generateVoiceForText(
        text,
        {
          voiceId: selectedVoice,
          language,
          characterId: characterId || undefined,
          provider,
          voiceName: characterId ? characters.find(c => c.id === characterId)?.name : undefined
        }
      );
      
      onGenerated(asset);
    } catch (error) {
      console.error('Failed to generate voice:', error);
      setError(error instanceof Error ? error.message : String(error));
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Generate Voice</h2>
          <button onClick={onClose} className="p-1 text-studio-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-danger-900/20 border border-danger-900/40 rounded-md text-danger-400 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Text to Speak</label>
            <textarea 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              className="input min-h-[100px]" 
              required 
              placeholder="Enter the text that will be converted to speech..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Language</label>
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value as 'en' | 'ar')} 
                className="input"
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
            <div>
              <label className="label">Provider</label>
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value)} 
                className="input"
              >
                {availableProviders.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="label">Voice</label>
            <select 
              value={selectedVoice} 
              onChange={(e) => setSelectedVoice(e.target.value)} 
              className="input"
            >
              {voices.map(voice => (
                <option key={voice.id} value={voice.id}>{voice.name}</option>
              ))}
              {voices.length === 0 && (
                <option disabled>No voices available</option>
              )}
            </select>
          </div>
          
          <div>
            <label className="label">Character (optional)</label>
            <select 
              value={characterId} 
              onChange={(e) => setCharacterId(e.target.value)} 
              className="input"
            >
              <option value="">None (Generic Voice)</option>
              {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t.common.cancel}</button>
            <button 
              type="submit" 
              className="btn-primary flex items-center gap-2"
              disabled={isGenerating || !selectedVoice || !text}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Voice'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VoiceModal({
  characters,
  onSave,
  onClose,
}: {
  characters: { id: string; name: string }[];
  onSave: (data: Partial<Voice>) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [provider, setProvider] = useState<VoiceProvider>('elevenlabs');
  const [voiceKey, setVoiceKey] = useState('');
  const [characterId, setCharacterId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      language,
      provider,
      voice_key: voiceKey,
      is_cloned: false,
      sample_url: null,
      character_id: characterId || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">{t.voice.addVoice}</h2>
          <button onClick={onClose} className="p-1 text-studio-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t.voice.voiceName}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t.voice.language}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="input">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.voice.provider}</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as VoiceProvider)} className="input">
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
                <option value="azure">Azure</option>
                <option value="local">Local</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t.voice.voiceKey}</label>
            <input value={voiceKey} onChange={(e) => setVoiceKey(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">{t.voice.assignCharacter}</label>
            <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} className="input">
              <option value="">--</option>
              {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
