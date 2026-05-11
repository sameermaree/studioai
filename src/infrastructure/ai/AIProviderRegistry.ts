import { AICapability, AIProvider } from './AIProviderInterface';

export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private preferredProviders: Map<AICapability, string[]> = new Map();
  
  /**
   * Register an AI provider
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    
    // Register provider for each of its capabilities
    for (const capability of provider.capabilities) {
      const providers = this.preferredProviders.get(capability) || [];
      if (!providers.includes(provider.id)) {
        providers.push(provider.id);
        this.preferredProviders.set(capability, providers);
      }
    }
  }
  
  /**
   * Get a provider by ID
   */
  getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }
  
  /**
   * Get all registered providers
   */
  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Get providers that support a specific capability
   */
  getProvidersByCapability(capability: AICapability): AIProvider[] {
    const providerIds = this.preferredProviders.get(capability) || [];
    return providerIds
      .map(id => this.providers.get(id))
      .filter((provider): provider is AIProvider => provider !== undefined);
  }
  
  /**
   * Set preferred providers for a capability
   */
  setPreferredProviders(capability: AICapability, providerIds: string[]): void {
    // Verify all provider IDs are valid
    for (const id of providerIds) {
      if (!this.providers.has(id)) {
        throw new Error(`Unknown provider ID: ${id}`);
      }
      
      // Verify provider supports this capability
      const provider = this.providers.get(id);
      if (!provider?.capabilities.includes(capability)) {
        throw new Error(`Provider ${id} does not support capability: ${capability}`);
      }
    }
    
    this.preferredProviders.set(capability, [...providerIds]);
  }
  
  /**
   * Get a provider chain for a capability with fallbacks
   * Returns providers in order of preference that are actually available
   */
  async getFallbackChain(capability: AICapability): Promise<AIProvider[]> {
    const providers = this.getProvidersByCapability(capability);
    
    // Check availability of each provider
    const availabilityChecks = await Promise.all(
      providers.map(async provider => ({
        provider,
        available: await provider.isAvailable()
      }))
    );
    
    // Filter to available providers only and sort by preference
    const availableProviders = availabilityChecks
      .filter(item => item.available)
      .map(item => item.provider);
    
    // If no preferred order is set, return all available providers
    const preferredOrder = this.preferredProviders.get(capability) || [];
    
    if (preferredOrder.length === 0) {
      return availableProviders;
    }
    
    // Sort by preferred order
    return availableProviders.sort((a, b) => {
      const indexA = preferredOrder.indexOf(a.id);
      const indexB = preferredOrder.indexOf(b.id);
      
      // Providers not in the preferred list go to the end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
  }
}

// Singleton instance for global use
export const aiProviderRegistry = new AIProviderRegistry();