/**
 * AudioTabContent.tsx — Multi-Provider Audio Generation
 * Providers: Edge-TTS (free) | ElevenLabs | OpenAI TTS
 */
import { useEffect, useRef, useState } from 'react';
import {
  Volume2, Loader2, Play, Square, CheckCircle,
  XCircle, Server, RefreshCw, AlertTriangle,
  Trash2, Key, Eye, EyeOff, ChevronDown,
} from 'lucide-react';
import type { Episode, Scene } from '../../types';
import type { AudioVoice, AudioProvider, AudioServerHealth } from '../../services/audioGenerationService';
import {
  checkAudioServer, getAudioProviders, getAudioVoices,
  generateSceneAudio, waitForAudio, deleteSceneAudio, saveApiKey,
} from '../../services/audioGenerationService';
import { speakText } from '../../services/sceneAudioService';

interface Props {
  episode: Episode;
  sortedScenes: Scene[];
  updateSceneAudio: (sceneId: string, audio: {
    audio_url?: string | null;
    audio_duration?: number | null;
    audio_status?: 'none' | 'generating' | 'done' | 'failed';
    voice_id?: string | null;
    voice_provider?: string | null;
  }) => void;
}

export function AudioTabContent({ episode, sortedScenes, updateSceneAudio }: Props) {
  const [health, setHealth] = useState<AudioServerHealth | null>(null);
  const [providers, setProviders] = useState<AudioProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('edge-tts');
  const [voices, setVoices] = useState<AudioVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('en-US-JennyNeural');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { handleRefresh(); }, []);

  // Reload voices when provider changes
  useEffect(() => {
    loadVoices(selectedProvider);
  }, [selectedProvider]);

  const handleRefresh = async () => {
    const h = await checkAudioServer();
    setHealth(h);
    if (h.ok) {
      const ps = await getAudioProviders();
      setProviders(ps);
      await loadVoices(selectedProvider);
    }
  };

  const loadVoices = async (provider: string) => {
    const vs = await getAudioVoices(provider);
    setVoices(vs);
    if (vs.length > 0 && !vs.find(v => v.id === selectedVoiceId)) {
      setSelectedVoiceId(vs[0].id);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    setKeyStatus('idle');
    const result = await saveApiKey(selectedProvider, apiKeyInput.trim());
    setKeyStatus(result.ok ? 'ok' : 'error');
    setSavingKey(false);
    if (result.ok) {
      setApiKeyInput('');
      await handleRefresh();
    }
  };

  const handleGenerateOne = async (scene: Scene) => {
    if (!scene.narration?.trim() || !health?.ok) return;
    setGeneratingId(scene.id);
    updateSceneAudio(scene.id, { audio_status: 'generating', voice_provider: selectedProvider });

    try {
      const jobId = await generateSceneAudio({
        episode_id: episode.id,
        scene_id:   scene.id,
        text:       scene.narration,
        voice_id:   selectedVoiceId,
        provider:   selectedProvider,
      });
      const job = await waitForAudio(jobId, () => {}, abortRef.current?.signal);
      if (job.status === 'done' && job.audio_url) {
        updateSceneAudio(scene.id, {
          audio_url:      job.audio_url,
          audio_duration: job.duration_seconds,
          audio_status:   'done',
          voice_id:       selectedVoiceId,
          voice_provider: selectedProvider,
        });
      }
    } catch {
      updateSceneAudio(scene.id, { audio_status: 'failed' });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateAll = async () => {
    if (!health?.ok) return;
    const pending = sortedScenes.filter(
      s => s.narration?.trim() && s.audio_status !== 'done'
    );
    setGeneratingAll(true);
    abortRef.current = new AbortController();
    for (const scene of pending) {
      if (abortRef.current?.signal.aborted) break;
      await handleGenerateOne(scene);
    }
    setGeneratingAll(false);
  };

  const handlePreview = (scene: Scene) => {
    audioRef.current?.pause();
    if (scene.audio_url) {
      const el = new Audio(scene.audio_url);
      audioRef.current = el;
      el.play().catch(() => { if (scene.narration) speakText(scene.narration); });
    } else if (scene.narration) {
      speakText(scene.narration);
    }
  };

  const handleDelete = async (scene: Scene) => {
    await deleteSceneAudio(episode.id, scene.id);
    updateSceneAudio(scene.id, { audio_url: null, audio_duration: null, audio_status: 'none' });
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const needsKey = currentProvider?.needs_key && !currentProvider?.has_key;
  const scenesWithAudio = sortedScenes.filter(s => s.audio_status === 'done').length;
  const pendingCount = sortedScenes.filter(
    s => s.narration?.trim() && s.audio_status !== 'done'
  ).length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">

      {/* Server status */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4" /> Audio Server
          </h2>
          <button onClick={handleRefresh}
            className="text-xs text-studio-500 hover:text-studio-300 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        {health === null ? (
          <div className="flex items-center gap-2 text-studio-500 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> Checking...
          </div>
        ) : health.ok ? (
          <div className="flex items-center gap-2 text-emerald-400 text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> Connected — localhost:3334
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <XCircle className="w-3.5 h-3.5" /> Not running
            </div>
            <div className="p-2.5 rounded-lg bg-studio-800 border border-studio-700 text-xs space-y-1">
              <p className="text-studio-300 font-medium">Start the server:</p>
              <p className="font-mono bg-studio-900 px-2 py-1 rounded">python audio_server.py</p>
            </div>
          </div>
        )}
      </div>

      {health?.ok && (
        <>
          {/* Provider selector */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-white">Provider</h2>
            <div className="grid grid-cols-3 gap-2">
              {providers.map(p => (
                <button key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs
                    transition-colors ${selectedProvider === p.id
                      ? 'bg-accent-600/15 border-accent-600/40 text-accent-400'
                      : 'bg-studio-900 border-studio-700 text-studio-400 hover:border-studio-500'
                    }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className={`text-[10px] ${p.available ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {p.available ? 'Ready' : p.needs_key ? 'Needs key' : 'Unavailable'}
                  </span>
                </button>
              ))}
            </div>

            {/* API key input — only for paid providers */}
            {currentProvider?.needs_key && (
              <div className="space-y-2 pt-1 border-t border-studio-800">
                <p className="text-xs text-studio-400 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  {currentProvider.has_key ? 'API key saved ✓ — paste new key to update' : `Enter ${currentProvider.label} API key`}
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="sk-..."
                      className="input text-xs pr-8 font-mono"
                    />
                    <button
                      onClick={() => setShowKey(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-studio-500"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveKey}
                    disabled={savingKey || !apiKeyInput.trim()}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40 shrink-0"
                  >
                    {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                  </button>
                </div>
                {keyStatus === 'ok' && <p className="text-xs text-emerald-400">Key saved successfully</p>}
                {keyStatus === 'error' && <p className="text-xs text-red-400">Failed to save key</p>}
              </div>
            )}
          </div>

          {/* Voice selector */}
          {!needsKey && voices.length > 0 && (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-white">Voice</h2>
              <select
                value={selectedVoiceId}
                onChange={e => setSelectedVoiceId(e.target.value)}
                className="input text-sm"
                disabled={generatingAll}
              >
                {voices.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.lang !== 'multi' ? ` (${v.lang})` : ''}
                    {v.description ? ` — ${v.description}` : ''}
                    {` · ${v.gender}`}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between">
                <p className="text-xs text-studio-500">
                  {scenesWithAudio}/{sortedScenes.length} generated
                </p>
                {generatingAll ? (
                  <button onClick={() => abortRef.current?.abort()}
                    className="text-xs btn-secondary py-1 px-3 flex items-center gap-1">
                    <Square className="w-3 h-3" /> Stop
                  </button>
                ) : (
                  <button onClick={handleGenerateAll}
                    disabled={!health.ok || pendingCount === 0}
                    className="text-xs btn-primary py-1 px-3 flex items-center gap-1 disabled:opacity-40">
                    <Volume2 className="w-3.5 h-3.5" />
                    Generate All ({pendingCount} pending)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scene list */}
          <div className="space-y-2">
            {sortedScenes.map(scene => {
              const hasNarration = !!scene.narration?.trim();
              const isDone = scene.audio_status === 'done';
              const isFailed = scene.audio_status === 'failed';
              const isGen = generatingId === scene.id ||
                (generatingAll && scene.audio_status === 'generating');

              return (
                <div key={scene.id}
                  className="p-3 rounded-lg bg-studio-900 border border-studio-800 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{scene.title}</p>
                      {hasNarration
                        ? <p className="text-xs text-studio-500 mt-0.5 line-clamp-2">{scene.narration}</p>
                        : <p className="text-xs text-studio-700 mt-0.5 italic">No narration</p>}
                    </div>
                    <div className="shrink-0 text-xs">
                      {isDone && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {scene.audio_duration ? `${scene.audio_duration.toFixed(1)}s` : 'Ready'}
                          {scene.voice_provider && (
                            <span className="text-studio-600 ml-1">{scene.voice_provider}</span>
                          )}
                        </span>
                      )}
                      {isFailed && <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Failed</span>}
                      {isGen && <span className="text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Generating...</span>}
                    </div>
                  </div>

                  {hasNarration && (
                    <div className="flex items-center gap-2">
                      {isDone && (
                        <>
                          <button onClick={() => handlePreview(scene)}
                            className="text-xs btn-secondary py-1 px-2 flex items-center gap-1">
                            <Play className="w-3 h-3" /> Play
                          </button>
                          <button onClick={() => handleGenerateOne(scene)}
                            disabled={isGen || needsKey}
                            className="text-xs text-studio-600 hover:text-studio-300 p-1 transition-colors"
                            title="Regenerate">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDelete(scene)}
                            className="text-xs text-studio-600 hover:text-red-400 p-1 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {!isDone && !isGen && (
                        <button onClick={() => handleGenerateOne(scene)}
                          disabled={!health.ok || needsKey}
                          className="text-xs btn-secondary py-1 px-2 flex items-center gap-1 disabled:opacity-40">
                          <Volume2 className="w-3 h-3" />
                          {needsKey ? 'Set API key first' : 'Generate'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
