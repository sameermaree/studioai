import { Asset } from '../../../domain/assets/entities/Asset';
import { VoiceGenerationService } from './VoiceGenerationService';
import { AssetIndexer } from '../../../services/comfyui/assets/assetIndexer';

// Simple scene structure (would be imported from domain in real implementation)
interface Scene {
  id: string;
  title: string;
  description: string;
  narration?: string;
  dialogues?: Array<{
    id: string;
    character_id: string;
    text: string;
    start_time?: number;
    duration?: number;
  }>;
}

/**
 * Service for connecting scene narration and dialogues to voice assets
 */
export class SceneVoiceService {
  private voiceGenerationService: VoiceGenerationService;
  private assetIndexer: AssetIndexer;
  
  constructor(voiceGenerationService: VoiceGenerationService, assetIndexer: AssetIndexer) {
    this.voiceGenerationService = voiceGenerationService;
    this.assetIndexer = assetIndexer;
  }
  
  /**
   * Generate voice for scene narration
   */
  public async generateNarrationVoice(
    scene: Scene,
    voiceId: string,
    language: 'en' | 'ar' = 'en',
    providerId?: string
  ): Promise<Asset> {
    if (!scene.narration) {
      throw new Error('Scene has no narration text');
    }
    
    return this.voiceGenerationService.generateVoiceForSceneNarration(
      scene.id,
      scene.narration,
      voiceId,
      {
        language,
        provider: providerId
      }
    );
  }
  
  /**
   * Generate voices for all dialogues in a scene
   */
  public async generateDialogueVoices(
    scene: Scene,
    characterVoices: Record<string, { voiceId: string; language: 'en' | 'ar' }>,
    defaultVoiceId?: string,
    defaultLanguage: 'en' | 'ar' = 'en',
    providerId?: string
  ): Promise<Asset[]> {
    if (!scene.dialogues || scene.dialogues.length === 0) {
      return [];
    }
    
    const assets: Asset[] = [];
    
    for (const dialogue of scene.dialogues) {
      if (!dialogue.text) continue;
      
      // Get voice configuration for this character
      const voiceConfig = dialogue.character_id && characterVoices[dialogue.character_id];
      const voiceId = voiceConfig?.voiceId || defaultVoiceId;
      const language = voiceConfig?.language || defaultLanguage;
      
      if (!voiceId) {
        console.warn(`No voice assigned for character ${dialogue.character_id}, skipping...`);
        continue;
      }
      
      // Generate voice for this dialogue
      try {
        const asset = await this.voiceGenerationService.generateVoiceForCharacterDialogue(
          dialogue.character_id,
          dialogue.text,
          voiceId,
          {
            language,
            provider: providerId,
            sceneId: scene.id
          }
        );
        
        assets.push(asset);
      } catch (error) {
        console.error(`Failed to generate voice for dialogue ${dialogue.id}:`, error);
      }
    }
    
    return assets;
  }
  
  /**
   * Find existing voice assets for a scene
   */
  public findSceneVoiceAssets(sceneId: string): Asset[] {
    const results = this.assetIndexer.search({
      type: 'audio',
      category: 'voice',
      searchText: sceneId
    });
    
    // Group by type (narration vs dialogue)
    return results.assets
      .filter(asset => 
        asset.metadata.scene_id === sceneId && 
        asset.status === 'complete'
      )
      .sort((a, b) => 
        // Sort by creation date, newest first
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
  
  /**
   * Attach voice assets to a scene's timeline
   */
  public attachVoiceAssetsToTimeline(
    sceneId: string,
    timelineId: string
  ): { narration?: Asset, dialogues: Asset[] } {
    // Find voice assets for this scene
    const voiceAssets = this.findSceneVoiceAssets(sceneId);
    
    // Group by type
    const narrationAssets = voiceAssets.filter(asset => !asset.metadata.character_id);
    const dialogueAssets = voiceAssets.filter(asset => !!asset.metadata.character_id);
    
    // In a real implementation, we would add these assets to timeline tracks
    // For now, we'll just return them
    return {
      narration: narrationAssets.length > 0 ? narrationAssets[0] : undefined,
      dialogues: dialogueAssets
    };
  }
  
  /**
   * Generate subtitles from voice assets with timestamps
   * This uses the word_timestamps metadata from voice generation
   */
  public generateSubtitlesFromVoice(asset: Asset): Array<{
    text: string;
    start_time: number;
    end_time: number;
    language: string;
  }> {
    const metadata = asset.metadata as any;
    if (!metadata.word_timestamps || !metadata.language) {
      return [];
    }
    
    // Get word timestamps
    const wordTimestamps = metadata.word_timestamps;
    const language = metadata.language;
    
    // Simple implementation: one subtitle for the entire audio
    // In a real implementation, we would break this into phrases/sentences
    return [{
      text: wordTimestamps.map((wt: any) => wt.word).join(' '),
      start_time: wordTimestamps[0]?.start || 0,
      end_time: wordTimestamps[wordTimestamps.length - 1]?.end || metadata.duration,
      language
    }];
  }
}