/**
 * A lightweight implementation of EventEmitter for browser environments
 * 
 * This provides a compatible API with Node.js EventEmitter but works in the browser
 */
export class BrowserEventEmitter {
  private events: Record<string, Function[]> = {};

  /**
   * Register an event listener
   */
  public on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   * Register a one-time event listener
   */
  public once(event: string, listener: Function): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * Remove an event listener
   */
  public off(event: string, listener: Function): this {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    return this;
  }

  /**
   * Remove all listeners for an event
   */
  public removeAllListeners(event?: string): this {
    if (event) {
      this.events[event] = [];
    } else {
      this.events = {};
    }
    return this;
  }

  /**
   * Emit an event
   */
  public emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) {
      return false;
    }
    
    this.events[event].forEach(listener => {
      listener.apply(this, args);
    });
    
    return true;
  }

  /**
   * Get all listeners for an event
   */
  public listeners(event: string): Function[] {
    return this.events[event] || [];
  }

  /**
   * Add a listener (alias for on)
   */
  public addListener(event: string, listener: Function): this {
    return this.on(event, listener);
  }

  /**
   * Remove a listener (alias for off)
   */
  public removeListener(event: string, listener: Function): this {
    return this.off(event, listener);
  }
}