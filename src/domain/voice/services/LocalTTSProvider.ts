import { TTSGenerationOptions, TTSGenerationResult, TTSProvider, TTSVoice } from './TTSProvider';

/**
 * Local TTS Provider using browser's SpeechSynthesis API
 * This is limited but works without external dependencies
 */
export class LocalTTSProvider implements TTSProvider {
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  
  constructor() {
    // Load voices when initialized
    this.loadVoices();
    
    // Listen for voices changed event
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = this.loadVoices.bind(this);
    }
  }
  
  /**
   * Load available voices from the browser
   */
  private loadVoices(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.voices = window.speechSynthesis.getVoices();
      this.voicesLoaded = true;
    }
  }
  
  /**
   * Get the provider name
   */
  public getName(): string {
    return 'Browser TTS';
  }
  
  /**
   * Check if the provider is available
   */
  public async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 
           !!window.speechSynthesis &&
           !!window.AudioContext;
  }
  
  /**
   * Get supported languages
   */
  public async getSupportedLanguages(): Promise<string[]> {
    // Ensure voices are loaded
    if (!this.voicesLoaded) {
      this.loadVoices();
    }
    
    // Extract unique language codes
    const languages = new Set<string>();
    
    this.voices.forEach(voice => {
      if (voice.lang) {
        const langCode = voice.lang.split('-')[0];
        languages.add(langCode);
      }
    });
    
    return Array.from(languages);
  }
  
  /**
   * Get available voices
   */
  public async getAvailableVoices(language?: string): Promise<TTSVoice[]> {
    // Ensure voices are loaded
    if (!this.voicesLoaded) {
      this.loadVoices();
    }
    
    // Filter voices by language if specified
    let filteredVoices = this.voices;
    if (language) {
      filteredVoices = this.voices.filter(voice => 
        voice.lang && voice.lang.startsWith(language)
      );
    }
    
    // Convert to TTSVoice format
    return filteredVoices.map(voice => ({
      id: voice.voiceURI,
      name: voice.name,
      language: voice.lang ? voice.lang.split('-')[0] : 'unknown',
      gender: this.inferGender(voice.name),
      description: `${voice.name} (${voice.lang})`,
      provider: 'browser'
    }));
  }
  
  /**
   * Generate speech from text using browser's SpeechSynthesis
   */
  public async generateSpeech(options: TTSGenerationOptions): Promise<TTSGenerationResult> {
    if (!(await this.isAvailable())) {
      throw new Error('Browser TTS is not available');
    }
    
    // Find the requested voice
    const synth = window.speechSynthesis;
    const allVoices = synth.getVoices();
    const voice = allVoices.find(v => v.voiceURI === options.voiceId);
    
    if (!voice) {
      throw new Error(`Voice not found: ${options.voiceId}`);
    }
    
    // Create a promise that resolves when audio is generated
    return new Promise((resolve, reject) => {
      try {
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(options.text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = options.speed || 1.0;
        utterance.pitch = options.pitch || 1.0;
        
        // Set up audio recording
        const audioContext = new AudioContext();
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
        const audioChunks: Blob[] = [];
        
        // Connect audio nodes
        const source = audioContext.createOscillator();
        source.connect(mediaStreamDestination);
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        // We need a fallback duration calculation since the browser API doesn't provide it directly
        // This is a rough estimate: ~100ms per character
        const estimatedDuration = Math.max(1, options.text.length * 0.1);
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          
          // Generate mock word timestamps (not available in browser TTS)
          const words = options.text.split(/\s+/);
          const wordTimestamps = words.map((word, index) => {
            const start = (estimatedDuration / words.length) * index;
            const end = (estimatedDuration / words.length) * (index + 1);
            return { word, start, end };
          });
          
          resolve({
            audioBuffer: arrayBuffer,
            metadata: {
              language: options.language,
              duration: estimatedDuration,
              character_id: options.characterId,
              scene_id: options.sceneId,
              voice_id: options.voiceId,
              provider: 'browser',
              word_timestamps: wordTimestamps,
              pitch: options.pitch,
              speed: options.speed
            },
            format: 'wav',
            duration: estimatedDuration
          });
        };
        
        // Start recording and speech synthesis
        mediaRecorder.start();
        source.start();
        synth.speak(utterance);
        
        // Stop recording after estimated duration plus a small buffer
        setTimeout(() => {
          source.stop();
          mediaRecorder.stop();
          synth.cancel(); // Cancel any ongoing speech
        }, (estimatedDuration * 1000) + 500);
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Try to infer gender from voice name
   * This is a simple heuristic and not very reliable
   */
  private inferGender(name: string): 'male' | 'female' | 'neutral' {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('female') || 
        lowerName.includes('woman') || 
        lowerName.includes('girl')) {
      return 'female';
    } else if (lowerName.includes('male') || 
               lowerName.includes('man') || 
               lowerName.includes('boy')) {
      return 'male';
    }
    
    return 'neutral';
  }
}