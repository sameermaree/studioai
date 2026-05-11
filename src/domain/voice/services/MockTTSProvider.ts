import { TTSGenerationOptions, TTSGenerationResult, TTSProvider, TTSVoice } from './TTSProvider';

/**
 * Mock TTS Provider for development and testing
 */
export class MockTTSProvider implements TTSProvider {
  private mockVoices: TTSVoice[] = [
    {
      id: 'en-us-male-1',
      name: 'English Male 1',
      language: 'en',
      gender: 'male',
      description: 'Mock English male voice',
      provider: 'mock'
    },
    {
      id: 'en-us-female-1',
      name: 'English Female 1',
      language: 'en',
      gender: 'female',
      description: 'Mock English female voice',
      provider: 'mock'
    },
    {
      id: 'ar-male-1',
      name: 'Arabic Male 1',
      language: 'ar',
      gender: 'male',
      description: 'Mock Arabic male voice',
      provider: 'mock'
    },
    {
      id: 'ar-female-1',
      name: 'Arabic Female 1',
      language: 'ar',
      gender: 'female',
      description: 'Mock Arabic female voice',
      provider: 'mock'
    }
  ];
  
  /**
   * Get the provider name
   */
  public getName(): string {
    return 'Mock TTS Provider';
  }
  
  /**
   * Check if the provider is available
   * Mock provider is always available
   */
  public async isAvailable(): Promise<boolean> {
    return true;
  }
  
  /**
   * Get supported languages
   */
  public async getSupportedLanguages(): Promise<string[]> {
    return ['en', 'ar'];
  }
  
  /**
   * Get available voices
   */
  public async getAvailableVoices(language?: string): Promise<TTSVoice[]> {
    if (language) {
      return this.mockVoices.filter(voice => voice.language === language);
    }
    return this.mockVoices;
  }
  
  /**
   * Generate speech from text (mock implementation)
   * This doesn't actually generate audio but returns a placeholder
   */
  public async generateSpeech(options: TTSGenerationOptions): Promise<TTSGenerationResult> {
    console.log('Mock TTS generating speech:', options);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Calculate mock duration based on text length (roughly 100ms per character)
    const duration = Math.max(1, options.text.length * 0.1);
    
    // Create an empty audio buffer (in a real implementation this would contain audio data)
    const audioBuffer = new ArrayBuffer(1024);
    
    // Generate mock word timestamps
    const words = options.text.split(/\s+/);
    const wordTimestamps = words.map((word, index) => {
      const start = (duration / words.length) * index;
      const end = (duration / words.length) * (index + 1);
      return { word, start, end };
    });
    
    return {
      audioBuffer,
      metadata: {
        language: options.language,
        duration,
        character_id: options.characterId,
        scene_id: options.sceneId,
        voice_id: options.voiceId,
        provider: 'mock',
        word_timestamps: wordTimestamps,
        pitch: options.pitch,
        speed: options.speed,
        emotion: options.emotion
      },
      format: 'mp3',
      duration
    };
  }
}