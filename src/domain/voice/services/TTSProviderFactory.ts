import { TTSProvider } from './TTSProvider';
import { MockTTSProvider } from './MockTTSProvider';
import { LocalTTSProvider } from './LocalTTSProvider';

/**
 * Factory for creating and managing TTS providers
 */
export class TTSProviderFactory {
  private static providers: Map<string, TTSProvider> = new Map();
  private static defaultProvider: string = 'mock';
  
  /**
   * Initialize the factory with available providers
   */
  public static initialize(): void {
    // Register providers
    this.registerProvider('mock', new MockTTSProvider());
    this.registerProvider('browser', new LocalTTSProvider());
    
    // TODO: Add more providers (XTTS, ElevenLabs, etc.) as they are implemented
  }
  
  /**
   * Register a TTS provider
   */
  public static registerProvider(id: string, provider: TTSProvider): void {
    this.providers.set(id, provider);
  }
  
  /**
   * Get a provider by ID
   */
  public static getProvider(id: string): TTSProvider | undefined {
    return this.providers.get(id);
  }
  
  /**
   * Get the default provider
   */
  public static getDefaultProvider(): TTSProvider {
    const provider = this.providers.get(this.defaultProvider);
    
    if (!provider) {
      // Fallback to any available provider
      const firstProvider = this.providers.values().next().value;
      
      if (!firstProvider) {
        throw new Error('No TTS providers registered');
      }
      
      return firstProvider;
    }
    
    return provider;
  }
  
  /**
   * Set the default provider
   */
  public static setDefaultProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider not found: ${id}`);
    }
    
    this.defaultProvider = id;
  }
  
  /**
   * Get all registered providers
   */
  public static getAllProviders(): TTSProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Get provider IDs
   */
  public static getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }
}