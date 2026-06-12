/**
 * audioGenerationService.ts — Multi-Provider TTS Bridge
 * Supports: edge-tts | elevenlabs | openai
 */

const AUDIO_SERVER = 'http://localhost:3334';
const POLL_INTERVAL_MS = 1500;

// ── Types ──────────────────────────────────────────────────
export interface AudioVoice {
  id: string;
  name: string;
  lang: string;
  gender: 'male' | 'female' | 'neutral';
  description?: string;
}

export interface AudioProvider {
  id: string;
  label: string;
  available: boolean;
  has_key: boolean;
  needs_key: boolean;
}

export interface AudioGenerateRequest {
  episode_id:        string;
  scene_id:          string;
  text:              string;
  voice_id:          string;
  provider:          string;
  rate?:             string;
  volume?:           string;
  stability?:        number;
  similarity_boost?: number;
  style?:            number;
}

export interface AudioJob {
  id:               string;
  status:           'queued' | 'generating' | 'done' | 'failed';
  progress:         number;
  provider?:        string;
  voice_id?:        string;
  duration_seconds?: number;
  audio_url?:       string;
  error?:           string;
}

export interface AudioServerHealth {
  ok:        boolean;
  version?:  string;
  providers?: Record<string, { available: boolean; has_key: boolean }>;
  error?:    string;
}

// ── Health ─────────────────────────────────────────────────
export async function checkAudioServer(): Promise<AudioServerHealth> {
  try {
    const res = await fetch(`${AUDIO_SERVER}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, error: 'Server error' };
    const data = await res.json();
    return { ok: true, version: data.version, providers: data.providers };
  } catch {
    return { ok: false, error: 'Server not running' };
  }
}

// ── Providers ──────────────────────────────────────────────
export async function getAudioProviders(): Promise<AudioProvider[]> {
  try {
    const res = await fetch(`${AUDIO_SERVER}/providers`);
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

// ── Voices ─────────────────────────────────────────────────
export async function getAudioVoices(
  provider: string,
  lang?: string
): Promise<AudioVoice[]> {
  try {
    const params = new URLSearchParams({ provider });
    if (lang) params.set('lang', lang);
    const res = await fetch(`${AUDIO_SERVER}/voices?${params}`);
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

// ── API Key ────────────────────────────────────────────────
export async function saveApiKey(
  provider: string,
  apiKey: string
): Promise<{ ok: boolean; available: boolean; error?: string }> {
  try {
    const res = await fetch(`${AUDIO_SERVER}/settings/apikey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, available: false, error: err.detail };
    }
    return res.json();
  } catch (e: any) {
    return { ok: false, available: false, error: e.message };
  }
}

export async function getProviderStatus(): Promise<
  Record<string, { has_key: boolean }>
> {
  try {
    const res = await fetch(`${AUDIO_SERVER}/settings/providers`);
    return res.ok ? res.json() : {};
  } catch {
    return {};
  }
}

// ── Generate ───────────────────────────────────────────────
export async function generateSceneAudio(
  req: AudioGenerateRequest
): Promise<string> {
  const res = await fetch(`${AUDIO_SERVER}/audio/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Audio generation failed: ${res.status}`);
  }
  const data = await res.json();
  return data.job_id as string;
}

// ── Poll ───────────────────────────────────────────────────
export async function waitForAudio(
  jobId: string,
  onProgress: (job: AudioJob) => void,
  signal?: AbortSignal
): Promise<AudioJob> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (signal?.aborted) { reject(new Error('Cancelled')); return; }
      try {
        const res = await fetch(`${AUDIO_SERVER}/audio/${jobId}/status`);
        if (!res.ok) throw new Error('Status check failed');
        const job: AudioJob = await res.json();
        onProgress(job);
        if (job.status === 'done') { resolve(job); return; }
        if (job.status === 'failed') { reject(new Error(job.error || 'Failed')); return; }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (e) { reject(e); }
    };
    poll();
  });
}

// ── Delete ─────────────────────────────────────────────────
export async function deleteSceneAudio(
  episodeId: string,
  sceneId: string
): Promise<void> {
  await fetch(
    `${AUDIO_SERVER}/audio/${episodeId.slice(0, 8)}/${sceneId.slice(0, 8)}`,
    { method: 'DELETE' }
  );
}

export function buildAudioUrl(episodeId: string, sceneId: string): string {
  return `${AUDIO_SERVER}/audio/file/${episodeId.slice(0,8)}/${sceneId.slice(0,8)}.mp3`;
}
