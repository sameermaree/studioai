/**
 * Service for monitoring the health of ComfyUI
 * 
 * This service handles periodic health checks and provides
 * fallback functionality when ComfyUI is unavailable.
 */
export class ComfyUIHealthCheck {
  private baseUrl: string;
  private connectionTimeout: number;
  private checkInterval: number;
  private intervalId: any = null;
  private status: {
    available: boolean;
    lastCheck: Date;
    message?: string;
    latency?: number;
    systemInfo?: any;
    queueInfo?: any;
  };
  private listeners: ((status: any) => void)[] = [];

  constructor(
    baseUrl: string = 'http://localhost:8188',
    options: {
      connectionTimeout?: number;
      checkInterval?: number;
    } = {}
  ) {
    this.baseUrl = baseUrl;
    this.connectionTimeout = options.connectionTimeout || 10000;
    this.checkInterval = options.checkInterval || 30000;
    this.status = {
      available: false,
      lastCheck: new Date()
    };
  }

  /**
   * Start periodic health checks
   */
  public startMonitoring(): void {
    if (this.intervalId) {
      // Already monitoring
      return;
    }

    // Run initial check immediately
    this.checkHealth();

    // Set up interval for periodic checks
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, this.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check the health of the ComfyUI instance
   */
  public async checkHealth(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.connectionTimeout);
      
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const wasAvailable = this.status.available;
        
        // Get GPU information if available
        const hasGpu = data?.system?.devices?.some((d: any) => 
          d.type === 'cuda' || d.type === 'mps' || d.type === 'rocm'
        );
        
        // Update status
        this.status = {
          available: true,
          lastCheck: new Date(),
          message: `ComfyUI is available. GPU: ${hasGpu ? 'Yes' : 'No'}`,
          latency,
          systemInfo: data.system,
          queueInfo: data.queue
        };
        
        // If status changed from unavailable to available, notify listeners
        if (!wasAvailable) {
          this.notifyListeners();
        }
        
        return this.status;
      } else {
        this.setUnavailable(`ComfyUI returned status ${response.status}`, latency);
        return this.status;
      }
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      const message = isTimeout 
        ? `Connection to ComfyUI timed out after ${this.connectionTimeout}ms`
        : `Failed to connect to ComfyUI: ${error instanceof Error ? error.message : String(error)}`;
      
      this.setUnavailable(message, Date.now() - startTime);
      return this.status;
    }
  }

  /**
   * Get the current status
   */
  public getStatus(): any {
    return { ...this.status };
  }

  /**
   * Add a listener for status changes
   */
  public addStatusListener(listener: (status: any) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a status listener
   */
  public removeStatusListener(listener: (status: any) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Check if ComfyUI is available
   */
  public isAvailable(): boolean {
    return this.status.available;
  }

  /**
   * Get information about why ComfyUI is unavailable
   */
  public getUnavailabilityReason(): string | undefined {
    if (this.status.available) {
      return undefined;
    }
    return this.status.message;
  }

  /**
   * Set ComfyUI as unavailable and notify listeners
   */
  private setUnavailable(message: string, latency?: number): void {
    const wasAvailable = this.status.available;
    this.status = {
      available: false,
      lastCheck: new Date(),
      message,
      latency
    };
    
    // Notify listeners only if status changed
    if (wasAvailable) {
      this.notifyListeners();
    }
  }

  /**
   * Notify listeners of status change
   */
  private notifyListeners(): void {
    const statusCopy = { ...this.status };
    for (const listener of this.listeners) {
      try {
        listener(statusCopy);
      } catch (error) {
        console.error('Error in ComfyUI status listener:', error);
      }
    }
  }
}