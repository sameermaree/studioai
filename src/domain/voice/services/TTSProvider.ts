import { VoiceMetadata } from '../entities/VoiceAsset';

export type TTSVoiceId = string;

export interface TTSVoice {
  id: TTSVoiceId;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  description?: string;
  sampleUrl?: string;
  isCloned?: boolean;
  provider: string;
}

export interface TTSGenerationOptions {
  text: string;
  voiceId: TTSVoiceId;
  language: 'en' | 'ar' | string;
  characterId?: string;
  sceneId?: string;
  pitch?: number;
  speed?: number;
  emotion?: string;
  outputFormat?: 'mp3' | 'wav' | 'ogg';
}

export interface TTSGenerationResult {
  audioBuffer: ArrayBuffer;
  metadata: VoiceMetadata;
  format: string;
  duration: number;
}

/**
 * Interface for TTS providers
 */
export interface TTSProvider {
  /**
   * Get the provider name
   */
  getName(): string;
  
  /**
   * Check if the provider is available and configured
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get supported languages
   */
  getSupportedLanguages(): Promise<string[]>;
  
  /**
   * Get available voices for the provider
   */
  getAvailableVoices(language?: string): Promise<TTSVoice[]>;
  
  /**
   * Generate speech from text
   */
  generateSpeech(options: TTSGenerationOptions): Promise<TTSGenerationResult>;
}