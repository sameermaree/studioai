/**
 * Text-to-Speech (TTS) Service
 * 
 * This service provides a unified interface for text-to-speech generation
 * across different providers, supporting multiple languages including Arabic.
 */

export interface TTSVoice {
  id: string;
  name: string;
  language: string; // Language code like 'en-US', 'ar-SA', etc.
  gender: 'male' | 'female' | 'neutral';
  provider: string;
  isNeural: boolean; // Is it a neural/AI voice or standard TTS?
  sampleRate?: number; // Hz
  style?: string; // e.g., 'casual', 'formal', etc.
  description?: string;
  tags?: string[];
}

export interface TTSSpeechOptions {
  text: string;
  voiceId: string;
  outputFormat?: 'mp3' | 'wav' | 'ogg';
  sampleRate?: 8000 | 16000 | 22050 | 24000 | 44100 | 48000;
  speed?: number; // 0.5 to 2.0, with 1.0 as normal speed
  pitch?: number; // -10 to 10, with 0 as normal pitch
  volume?: number; // 0 to 100, with 100 as max volume
  emphasis?: Array<{
    word: string;
    level: 'strong' | 'moderate' | 'reduced';
  }>;
  pauseMs?: number; // Additional pause in milliseconds after sentences
  ssml?: boolean; // Whether the text contains SSML tags
  metadata?: Record<string, any>;
}

export interface TTSSpeechResult {
  audioData: ArrayBuffer;
  mimeType: string;
  duration: number; // Duration in seconds
  wordTimings?: Array<{
    word: string;
    startTime: number;
    endTime: number;
  }>;
  textSegments?: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>;
  metadata: {
    voiceId: string;
    language: string;
    provider: string;
    text: string;
    options: Partial<TTSSpeechOptions>;
    [key: string]: any;
  };
}

export interface TTSProvider {
  id: string;
  name: string;
  supportedLanguages: string[];
  supportsSSML: boolean;
  isAvailable: () => Promise<boolean>;
  getVoices: () => Promise<TTSVoice[]>;
  generateSpeech: (options: TTSSpeechOptions) => Promise<TTSSpeechResult>;
}

/**
 * Text-to-Speech service for generating speech from text
 */
export class TTSService {
  private providers: Map<string, TTSProvider> = new Map();
  private voices: Map<string, TTSVoice> = new Map();
  private voicesByLanguage: Map<string, TTSVoice[]> = new Map();
  private voicesByProvider: Map<string, TTSVoice[]> = new Map();
  private defaultVoice: TTSVoice | null = null;
  private defaultVoiceByLanguage: Map<string, TTSVoice> = new Map();
  
  /**
   * Register a TTS provider
   */
  public registerProvider(provider: TTSProvider): void {
    this.providers.set(provider.id, provider);
    console.log(`Registered TTS provider: ${provider.name}`);
  }
  
  /**
   * Get a provider by ID
   */
  public getProvider(id: string): TTSProvider | undefined {
    return this.providers.get(id);
  }
  
  /**
   * Get all available providers
   */
  public getProviders(): TTSProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Check if a provider is available
   */
  public async isProviderAvailable(id: string): Promise<boolean> {
    const provider = this.providers.get(id);
    
    if (!provider) {
      return false;
    }
    
    try {
      return await provider.isAvailable();
    } catch (error) {
      console.error(`Error checking provider availability: ${error}`);
      return false;
    }
  }
  
  /**
   * Initialize the TTS service
   */
  public async initialize(): Promise<void> {
    // Load voices from all providers
    await this.loadAllVoices();
    
    // Select default voices
    this.selectDefaultVoices();
  }
  
  /**
   * Load voices from all providers
   */
  private async loadAllVoices(): Promise<void> {
    // Clear existing voices
    this.voices.clear();
    this.voicesByLanguage.clear();
    this.voicesByProvider.clear();
    
    // Load voices from each provider
    for (const provider of this.providers.values()) {
      try {
        // Check if provider is available
        const isAvailable = await provider.isAvailable();
        
        if (!isAvailable) {
          console.warn(`TTS provider ${provider.name} is not available`);
          continue;
        }
        
        // Get voices
        const voices = await provider.getVoices();
        
        // Store voices
        for (const voice of voices) {
          this.voices.set(voice.id, voice);
          
          // Group by language
          if (!this.voicesByLanguage.has(voice.language)) {
            this.voicesByLanguage.set(voice.language, []);
          }
          this.voicesByLanguage.get(voice.language)!.push(voice);
          
          // Group by provider
          if (!this.voicesByProvider.has(provider.id)) {
            this.voicesByProvider.set(provider.id, []);
          }
          this.voicesByProvider.get(provider.id)!.push(voice);
        }
        
        console.log(`Loaded ${voices.length} voices from ${provider.name}`);
      } catch (error) {
        console.error(`Error loading voices from ${provider.name}: ${error}`);
      }
    }
  }
  
  /**
   * Select default voices
   */
  private selectDefaultVoices(): void {
    // Select a default voice for each language
    for (const [language, voices] of this.voicesByLanguage.entries()) {
      // Prefer neural voices
      const neuralVoices = voices.filter(voice => voice.isNeural);
      
      if (neuralVoices.length > 0) {
        this.defaultVoiceByLanguage.set(language, neuralVoices[0]);
      } else if (voices.length > 0) {
        this.defaultVoiceByLanguage.set(language, voices[0]);
      }
    }
    
    // Select a global default voice (prefer English)
    const englishVoice = this.defaultVoiceByLanguage.get('en-US') || 
                          this.defaultVoiceByLanguage.get('en-GB');
    
    if (englishVoice) {
      this.defaultVoice = englishVoice;
    } else if (this.defaultVoiceByLanguage.size > 0) {
      this.defaultVoice = Array.from(this.defaultVoiceByLanguage.values())[0];
    }
  }
  
  /**
   * Get all available voices
   */
  public getVoices(): TTSVoice[] {
    return Array.from(this.voices.values());
  }
  
  /**
   * Get voices by language
   */
  public getVoicesByLanguage(language: string): TTSVoice[] {
    return this.voicesByLanguage.get(language) || [];
  }
  
  /**
   * Get voices by provider
   */
  public getVoicesByProvider(providerId: string): TTSVoice[] {
    return this.voicesByProvider.get(providerId) || [];
  }
  
  /**
   * Get a voice by ID
   */
  public getVoice(id: string): TTSVoice | undefined {
    return this.voices.get(id);
  }
  
  /**
   * Get the default voice
   */
  public getDefaultVoice(): TTSVoice | null {
    return this.defaultVoice;
  }
  
  /**
   * Get the default voice for a language
   */
  public getDefaultVoiceForLanguage(language: string): TTSVoice | undefined {
    return this.defaultVoiceByLanguage.get(language);
  }
  
  /**
   * Set the default voice
   */
  public setDefaultVoice(voiceId: string): boolean {
    const voice = this.voices.get(voiceId);
    
    if (!voice) {
      return false;
    }
    
    this.defaultVoice = voice;
    return true;
  }
  
  /**
   * Set the default voice for a language
   */
  public setDefaultVoiceForLanguage(language: string, voiceId: string): boolean {
    const voice = this.voices.get(voiceId);
    
    if (!voice || voice.language !== language) {
      return false;
    }
    
    this.defaultVoiceByLanguage.set(language, voice);
    return true;
  }
  
  /**
   * Generate speech from text
   */
  public async generateSpeech(options: TTSSpeechOptions): Promise<TTSSpeechResult> {
    // Get the voice
    const voice = this.voices.get(options.voiceId);
    
    if (!voice) {
      throw new Error(`Voice not found: ${options.voiceId}`);
    }
    
    // Get the provider
    const provider = this.providers.get(voice.provider);
    
    if (!provider) {
      throw new Error(`Provider not found for voice: ${voice.provider}`);
    }
    
    try {
      // Check if provider is available
      const isAvailable = await provider.isAvailable();
      
      if (!isAvailable) {
        throw new Error(`TTS provider ${provider.name} is not available`);
      }
      
      // Generate speech
      return await provider.generateSpeech(options);
    } catch (error) {
      throw new Error(`Error generating speech: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate speech from text using the default voice for a language
   */
  public async generateSpeechWithDefaultVoice(
    text: string,
    language: string,
    options?: Partial<Omit<TTSSpeechOptions, 'text' | 'voiceId'>>
  ): Promise<TTSSpeechResult> {
    const voice = this.defaultVoiceByLanguage.get(language);
    
    if (!voice) {
      throw new Error(`No default voice found for language: ${language}`);
    }
    
    return this.generateSpeech({
      text,
      voiceId: voice.id,
      ...options
    });
  }
  
  /**
   * Convert speech result to an audio file URL
   */
  public speechResultToURL(result: TTSSpeechResult): string {
    const blob = new Blob([result.audioData], { type: result.mimeType });
    return URL.createObjectURL(blob);
  }
  
  /**
   * Get supported languages
   */
  public getSupportedLanguages(): string[] {
    return Array.from(this.voicesByLanguage.keys());
  }
}