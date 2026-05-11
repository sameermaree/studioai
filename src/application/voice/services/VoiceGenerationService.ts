import { Asset } from '../../../domain/assets/entities/Asset';
import { 
  createPendingVoiceAsset, 
  completeVoiceAsset 
} from '../../../domain/voice/entities/VoiceAsset';
import { 
  TTSProvider,
  TTSGenerationOptions 
} from '../../../domain/voice/services/TTSProvider';
import { TTSProviderFactory } from '../../../domain/voice/services/TTSProviderFactory';
import { AssetIndexer } from '../../../services/comfyui/assets/assetIndexer';

/**
 * Service responsible for generating voice assets
 */
export class VoiceGenerationService {
  private assetIndexer: AssetIndexer;
  
  constructor(assetIndexer: AssetIndexer) {
    this.assetIndexer = assetIndexer;
    
    // Initialize TTS providers
    TTSProviderFactory.initialize();
  }
  
  /**
   * Generate voice for a scene narration or dialogue
   */
  public async generateVoiceForText(
    text: string,
    options: {
      voiceId: string;
      language: 'en' | 'ar' | string;
      characterId?: string;
      sceneId?: string;
      provider?: string;
      voiceName?: string;
      pitch?: number;
      speed?: number;
      emotion?: string;
      tags?: string[];
    }
  ): Promise<Asset> {
    // Get the provider
    const provider = options.provider 
      ? TTSProviderFactory.getProvider(options.provider) 
      : TTSProviderFactory.getDefaultProvider();
    
    if (!provider) {
      throw new Error(`TTS provider not found: ${options.provider || 'default'}`);
    }
    
    // Generate a filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = options.characterId ? 'character' : 'scene';
    const entityId = options.characterId || options.sceneId || 'voice';
    const filename = `${prefix}_${entityId.substring(0, 8)}_${timestamp}.mp3`;
    
    // Create display name
    const displayName = options.voiceName 
      ? `${options.voiceName} - ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`
      : `Voice - ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`;
    
    // Create a pending asset
    const pendingAsset = createPendingVoiceAsset({
      filename,
      displayName,
      language: options.language,
      characterId: options.characterId,
      sceneId: options.sceneId,
      voiceId: options.voiceId,
      voiceName: options.voiceName,
      provider: provider.getName(),
      tags: options.tags || []
    });
    
    try {
      // Index the pending asset
      this.assetIndexer.indexAsset(pendingAsset);
      
      // Prepare generation options
      const generationOptions: TTSGenerationOptions = {
        text,
        voiceId: options.voiceId,
        language: options.language,
        characterId: options.characterId,
        sceneId: options.sceneId,
        pitch: options.pitch,
        speed: options.speed,
        emotion: options.emotion,
        outputFormat: 'mp3'
      };
      
      // Generate the speech
      const result = await provider.generateSpeech(generationOptions);
      
      // In a real implementation, we would save the audio buffer to a file
      // For now, we'll create a mock URL
      const mockUrl = `mock://${filename}`;
      const path = `/voices/${options.language}/${filename}`;
      
      // Update the asset with the completed data
      const completedAsset = completeVoiceAsset(
        pendingAsset,
        mockUrl,
        path,
        result.metadata
      );
      
      // Index the completed asset
      this.assetIndexer.updateAsset(completedAsset.id, {
        url: completedAsset.url,
        thumbnailUrl: undefined,
        duration: result.metadata.duration
      });
      
      return completedAsset;
      
    } catch (error) {
      // Update the asset to failed status
      const failedAsset = {
        ...pendingAsset,
        status: 'failed' as const,
        metadata: {
          ...pendingAsset.metadata,
          error: error instanceof Error ? error.message : String(error)
        },
        updated_at: new Date().toISOString()
      };
      
      // Index the failed asset
      this.assetIndexer.updateAsset(failedAsset.id, {
        status: 'failed'
      });
      
      return failedAsset;
    }
  }
  
  /**
   * Generate voice for a scene narration
   */
  public async generateVoiceForSceneNarration(
    sceneId: string,
    narrationText: string,
    voiceId: string,
    options?: {
      language?: 'en' | 'ar' | string;
      provider?: string;
      pitch?: number;
      speed?: number;
      emotion?: string;
    }
  ): Promise<Asset> {
    return this.generateVoiceForText(
      narrationText,
      {
        voiceId,
        language: options?.language || 'en',
        sceneId,
        provider: options?.provider,
        pitch: options?.pitch,
        speed: options?.speed,
        emotion: options?.emotion,
        tags: ['narration', 'scene', `scene-${sceneId.substring(0, 8)}`]
      }
    );
  }
  
  /**
   * Generate voice for character dialogue
   */
  public async generateVoiceForCharacterDialogue(
    characterId: string,
    dialogueText: string,
    voiceId: string,
    options?: {
      language?: 'en' | 'ar' | string;
      provider?: string;
      sceneId?: string;
      pitch?: number;
      speed?: number;
      emotion?: string;
      characterName?: string;
    }
  ): Promise<Asset> {
    return this.generateVoiceForText(
      dialogueText,
      {
        voiceId,
        language: options?.language || 'en',
        characterId,
        sceneId: options?.sceneId,
        provider: options?.provider,
        voiceName: options?.characterName,
        pitch: options?.pitch,
        speed: options?.speed,
        emotion: options?.emotion,
        tags: [
          'dialogue', 
          'character', 
          `character-${characterId.substring(0, 8)}`,
          ...(options?.sceneId ? [`scene-${options.sceneId.substring(0, 8)}`] : [])
        ]
      }
    );
  }
  
  /**
   * Get available TTS providers
   */
  public getAvailableProviders(): string[] {
    return TTSProviderFactory.getProviderIds();
  }
  
  /**
   * Get available voices for a language
   */
  public async getAvailableVoicesForLanguage(
    language: string,
    providerId?: string
  ): Promise<Array<{ id: string; name: string; provider: string }>> {
    let providers: TTSProvider[];
    
    if (providerId) {
      const provider = TTSProviderFactory.getProvider(providerId);
      providers = provider ? [provider] : [];
    } else {
      providers = TTSProviderFactory.getAllProviders();
    }
    
    const voices: Array<{ id: string; name: string; provider: string }> = [];
    
    for (const provider of providers) {
      const providerVoices = await provider.getAvailableVoices(language);
      voices.push(
        ...providerVoices.map(voice => ({
          id: voice.id,
          name: voice.name,
          provider: provider.getName()
        }))
      );
    }
    
    return voices;
  }
}