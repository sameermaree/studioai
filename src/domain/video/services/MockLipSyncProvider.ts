import { LipSyncProvider } from './LipSyncService';

/**
 * Mock Lip Sync Provider for development and testing
 * This simulates the behavior of a real lip sync engine without actually doing anything
 */
export class MockLipSyncProvider implements LipSyncProvider {
  /**
   * Get provider name
   */
  public getName(): string {
    return 'Mock Lip Sync';
  }
  
  /**
   * Check if provider is available
   */
  public async isAvailable(): Promise<boolean> {
    return true; // Mock is always available
  }
  
  /**
   * Perform lip sync (mock implementation)
   */
  public async syncLips(
    videoPath: string,
    audioPath: string,
    options?: {
      faceRect?: [number, number, number, number];
      outputWidth?: number;
      outputHeight?: number;
    }
  ): Promise<{
    outputPath: string;
    thumbnailUrl?: string;
  }> {
    console.log('Mock Lip Sync: Simulating lip sync process');
    console.log('Video:', videoPath);
    console.log('Audio:', audioPath);
    if (options?.faceRect) {
      console.log('Face Rectangle:', options.faceRect);
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a mock output path
    const timestamp = Date.now();
    const outputPath = `mock://lipsync/output_${timestamp}.mp4`;
    const thumbnailUrl = `mock://lipsync/thumbnail_${timestamp}.jpg`;
    
    console.log('Mock Lip Sync: Process complete');
    console.log('Output:', outputPath);
    
    return {
      outputPath,
      thumbnailUrl
    };
  }
}