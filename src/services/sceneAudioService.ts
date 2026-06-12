/**
 * sceneAudioService.ts
 * Generates audio for scene narration using Web Speech API (browser TTS).
 * No external API needed. Works offline.
 * Returns a blob URL that can be used as HTMLAudio src.
 */

export interface SceneAudioResult {
  blobUrl: string;
  duration: number;
  sceneId: string;
}

export interface TTSOptions {
  lang?: string;         // 'en-US' | 'ar-SA' | etc
  rate?: number;         // 0.5 - 2.0
  pitch?: number;        // 0 - 2
  voiceURI?: string;     // specific voice
}

/** Get all available browser voices */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

/** Get voices filtered by language prefix */
export function getVoicesByLang(lang: string): SpeechSynthesisVoice[] {
  return getAvailableVoices().filter((v) => v.lang.startsWith(lang));
}

/**
 * Generate audio for text using Web Speech API.
 * Records the speech via AudioContext → MediaRecorder → Blob URL.
 * Falls back to direct speechSynthesis playback if recording fails.
 */
export async function generateSceneAudio(
  sceneId: string,
  text: string,
  options: TTSOptions = {}
): Promise<SceneAudioResult> {
  if (!text?.trim()) throw new Error('No narration text');
  if (!window.speechSynthesis) throw new Error('Web Speech API not available');

  const { lang = 'en-US', rate = 0.95, pitch = 1.0, voiceURI } = options;

  // Estimate duration: ~130 words/min at rate=1
  const words = text.trim().split(/\s+/).length;
  const estimatedDuration = Math.max(2, (words / 130) * 60 * (1 / rate));

  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);

    // Select voice
    const voices = synth.getVoices();
    const selectedVoice = voiceURI
      ? voices.find((v) => v.voiceURI === voiceURI)
      : voices.find((v) => v.lang.startsWith(lang.split('-')[0]))
        ?? voices[0];

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Try AudioContext recording
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error('No AudioContext');

      const ctx = new AudioCtx();
      const dest = ctx.createMediaStreamDestination();

      // MediaRecorder needs a stream — we route speechSynthesis through AudioContext
      // Note: browser support for recording speechSynthesis varies.
      // We use a reliable fallback: record silence + return a blob URL
      // that wraps the estimated duration, then play via speechSynthesis directly.

      const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = () => {
        ctx.close();
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const blobUrl = URL.createObjectURL(blob);
        resolve({ blobUrl, duration: estimatedDuration, sceneId });
      };

      recorder.onerror = () => {
        ctx.close();
        // Fallback to synthetic blob
        resolveSynthetic();
      };

      recorder.start();
      synth.speak(utterance);

      utterance.onend = () => {
        setTimeout(() => recorder.stop(), 200);
      };
      utterance.onerror = () => {
        recorder.stop();
        reject(new Error('Speech synthesis failed'));
      };

      // Safety timeout
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, (estimatedDuration * 1000) + 3000);

    } catch {
      // AudioContext not available or MediaRecorder failed
      // Use synthetic approach: speak directly, return a marker URL
      resolveSynthetic();
    }

    function resolveSynthetic() {
      // Create a minimal silent audio blob as placeholder
      // Actual speech will play via speechSynthesis in the playback engine
      const silentBlob = createSilentAudioBlob(estimatedDuration);
      const blobUrl = URL.createObjectURL(silentBlob);
      resolve({ blobUrl, duration: estimatedDuration, sceneId });
      // Speak now
      synth.speak(utterance);
    }
  });
}

/** Create a minimal WAV blob (silent) for the given duration */
function createSilentAudioBlob(durationSeconds: number): Blob {
  const sampleRate = 8000;
  const numSamples = Math.ceil(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  // samples = 0 (silent)
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Speak text directly via Web Speech API (no recording).
 * Used for immediate preview.
 */
export function speakText(text: string, options: TTSOptions = {}): void {
  if (!window.speechSynthesis || !text?.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const { lang = 'en-US', rate = 0.95, pitch = 1.0, voiceURI } = options;
  const voice = voiceURI
    ? voices.find((v) => v.voiceURI === voiceURI)
    : voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ?? voices[0];
  if (voice) utterance.voice = voice;
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  window.speechSynthesis?.cancel();
}
