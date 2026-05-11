import type { Language, VoiceProvider } from '../../types';

export interface TTSRequest {
  text: string;
  voice_key: string;
  provider: VoiceProvider;
  language: Language;
}

export interface TTSResponse {
  id: string;
  audio_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export async function synthesizeSpeech(_request: TTSRequest): Promise<TTSResponse> {
  return {
    id: crypto.randomUUID(),
    status: 'pending',
  };
}

export async function cloneVoice(_audioSampleUrl: string, _name: string): Promise<{ voice_key: string }> {
  return {
    voice_key: `cloned-${crypto.randomUUID().slice(0, 8)}`,
  };
}
