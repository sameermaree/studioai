import { TTSProvider, TTSVoice, TTSSpeechOptions, TTSSpeechResult } from '../TTSService';

/**
 * Web Speech API TTS Provider
 * 
 * This provider uses the browser's Web Speech API for text-to-speech.
 * It's a simple provider that works in browsers without any external dependencies.
 */
export class WebSpeechTTSProvider implements TTSProvider {
  public id = 'web-speech';
  public name = 'Web Speech API';
  public supportedLanguages: string[] = [];
  public supportsSSML = false;
  
  private availableVoices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;
  
  constructor() {
    // Initialize the provider
    this.initPromise = this.initialize();
  }
  
  /**
   * Initialize the provider
   */
  private async initialize(): Promise<boolean> {
    // Check if the Web Speech API is available
    if (!window.speechSynthesis) {
      console.warn('Web Speech API is not supported in this browser');
      this.isInitialized = false;
      return false;
    }
    
    try {
      // Load the available voices
      this.availableVoices = await this.loadVoices();
      
      // Extract the supported languages
      this.supportedLanguages = Array.from(
        new Set(this.availableVoices.map(voice => voice.lang))
      );
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing Web Speech TTS provider:', error);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Load the available voices
   */
  private async loadVoices(): Promise<SpeechSynthesisVoice[]> {
    // If voices are already loaded, return them
    if (window.speechSynthesis.getVoices().length > 0) {
      return window.speechSynthesis.getVoices();
    }
    
    // Wait for voices to be loaded
    return new Promise<SpeechSynthesisVoice[]>((resolve) => {
      // Set up a timeout in case voices don't load
      const timeout = setTimeout(() => {
        resolve(window.speechSynthesis.getVoices());
      }, 3000);
      
      // Set up the voiceschanged event listener
      window.speechSynthesis.onvoiceschanged = () => {
        clearTimeout(timeout);
        resolve(window.speechSynthesis.getVoices());
      };
    });
  }
  
  /**
   * Check if the provider is available
   */
  public async isAvailable(): Promise<boolean> {
    if (this.initPromise) {
      await this.initPromise;
    }
    
    return this.isInitialized && window.speechSynthesis !== undefined;
  }
  
  /**
   * Get the available voices
   */
  public async getVoices(): Promise<TTSVoice[]> {
    if (!this.isInitialized) {
      if (this.initPromise) {
        await this.initPromise;
      } else {
        await this.initialize();
      }
      
      if (!this.isInitialized) {
        return [];
      }
    }
    
    // Convert Web Speech API voices to our format
    return this.availableVoices.map(voice => this.convertVoice(voice));
  }
  
  /**
   * Convert a Web Speech API voice to our format
   */
  private convertVoice(voice: SpeechSynthesisVoice): TTSVoice {
    return {
      id: `${this.id}:${voice.name}`,
      name: voice.name,
      language: voice.lang,
      gender: this.inferGender(voice.name),
      provider: this.id,
      isNeural: voice.localService === false, // Remote voices are usually better quality
      description: `${voice.name} (${voice.lang})${voice.localService ? ' (Local)' : ''}`,
      tags: voice.localService ? ['local'] : ['remote']
    };
  }
  
  /**
   * Infer the gender from a voice name
   */
  private inferGender(name: string): 'male' | 'female' | 'neutral' {
    const lowercaseName = name.toLowerCase();
    
    if (lowercaseName.includes('female') || lowercaseName.includes('woman') || 
        lowercaseName.includes('girl') || lowercaseName.includes('fiona')) {
      return 'female';
    } else if (lowercaseName.includes('male') || lowercaseName.includes('man') || 
               lowercaseName.includes('boy') || lowercaseName.includes('guy')) {
      return 'male';
    }
    
    // For Arabic names
    if (lowercaseName.includes('laila') || lowercaseName.includes('salma') || 
        lowercaseName.includes('fatima') || lowercaseName.includes('amal')) {
      return 'female';
    } else if (lowercaseName.includes('ahmed') || lowercaseName.includes('mohammad') || 
               lowercaseName.includes('ali') || lowercaseName.includes('omar')) {
      return 'male';
    }
    
    return 'neutral';
  }
  
  /**
   * Generate speech from text
   */
  public async generateSpeech(options: TTSSpeechOptions): Promise<TTSSpeechResult> {
    if (!this.isInitialized) {
      if (this.initPromise) {
        await this.initPromise;
      } else {
        await this.initialize();
      }
      
      if (!this.isInitialized) {
        throw new Error('Web Speech TTS provider is not initialized');
      }
    }
    
    // Parse the voice ID to get the original voice name
    const voiceName = options.voiceId.split(':')[1];
    
    if (!voiceName) {
      throw new Error(`Invalid voice ID: ${options.voiceId}`);
    }
    
    // Find the voice
    const voice = this.availableVoices.find(v => v.name === voiceName);
    
    if (!voice) {
      throw new Error(`Voice not found: ${voiceName}`);
    }
    
    try {
      // Generate speech using the Web Speech API
      const audioData = await this.synthesizeSpeech(options.text, voice, {
        rate: options.speed || 1.0,
        pitch: options.pitch ? (options.pitch / 10) + 1 : 1.0,
        volume: options.volume ? options.volume / 100 : 1.0
      });
      
      // Get the voice info for metadata
      const voiceInfo = this.convertVoice(voice);
      
      // Create the result
      return {
        audioData,
        mimeType: 'audio/wav',
        duration: this.estimateDuration(options.text, options.speed || 1.0),
        metadata: {
          voiceId: options.voiceId,
          language: voiceInfo.language,
          provider: this.id,
          text: options.text,
          options: {
            speed: options.speed,
            pitch: options.pitch,
            volume: options.volume
          }
        }
      };
    } catch (error) {
      throw new Error(`Error generating speech: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Synthesize speech using the Web Speech API
   */
  private async synthesizeSpeech(
    text: string,
    voice: SpeechSynthesisVoice,
    options: {
      rate?: number;
      pitch?: number;
      volume?: number;
    } = {}
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      try {
        // Create an audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create a buffer for storing audio data
        const chunks: Float32Array[] = [];
        
        // Create a script processor node to capture audio data
        const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
        
        scriptNode.onaudioprocess = (event) => {
          const channel = event.inputBuffer.getChannelData(0);
          const buffer = new Float32Array(channel.length);
          buffer.set(channel);
          chunks.push(buffer);
        };
        
        // Connect the script node
        scriptNode.connect(audioContext.destination);
        
        // Create a media stream destination
        const destination = audioContext.createMediaStreamDestination();
        scriptNode.connect(destination);
        
        // Set up the utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;
        
        // Set up event handlers
        utterance.onend = () => {
          // Disconnect and close
          scriptNode.disconnect();
          audioContext.close();
          
          // Combine chunks
          const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
          const combinedBuffer = new Float32Array(totalLength);
          
          let offset = 0;
          for (const chunk of chunks) {
            combinedBuffer.set(chunk, offset);
            offset += chunk.length;
          }
          
          // Convert to 16-bit PCM
          const pcmBuffer = this.float32ToInt16(combinedBuffer);
          
          // Create a WAV file
          const wavBuffer = this.createWavFile(pcmBuffer, {
            numChannels: 1,
            sampleRate: audioContext.sampleRate
          });
          
          resolve(wavBuffer);
        };
        
        utterance.onerror = (event) => {
          // Disconnect and close
          scriptNode.disconnect();
          audioContext.close();
          
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };
        
        // Speak the utterance
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Convert a Float32Array to an Int16Array
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Convert to 16-bit PCM
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }
  
  /**
   * Create a WAV file from PCM data
   */
  private createWavFile(
    pcmData: Int16Array,
    options: {
      numChannels: number;
      sampleRate: number;
    }
  ): ArrayBuffer {
    const numChannels = options.numChannels || 1;
    const sampleRate = options.sampleRate || 44100;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = pcmData.length * bytesPerSample;
    const bufferSize = 44 + dataSize;
    
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    
    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');
    
    // 'fmt ' sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // sub-chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    
    // 'data' sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write PCM data
    const offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(offset + i * bytesPerSample, pcmData[i], true);
    }
    
    return buffer;
  }
  
  /**
   * Write a string to a DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  /**
   * Estimate the duration of a text
   */
  private estimateDuration(text: string, rate: number): number {
    // Average speaking rate is about 150 words per minute
    const wordsPerMinute = 150 * rate;
    
    // Split the text into words
    const words = text.split(/\s+/).length;
    
    // Calculate duration in seconds
    const durationInSeconds = (words / wordsPerMinute) * 60;
    
    // Add some buffer for pauses
    return durationInSeconds * 1.1;
  }
}