import { ComfyUIHealthCheck } from "./healthCheck";
import { BrowserEventEmitter } from "../../lib/BrowserEventEmitter";

export enum StabilityStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export type NodeInfo = {
  nodeId: string;
  class_type: string;
  inputs: Record<string, any>;
  is_output: boolean;
  status?: 'validated' | 'error' | 'warning';
  error_message?: string;
};

export interface DiagnosticInfo {
  status: StabilityStatus;
  last_check_time: Date;
  connected_since?: Date;
  latency?: number;
  gpu_info?: any;
  queue_size?: number;
  api_version?: string;
  reconnect_attempts?: number;
  last_error?: string;
  execution_count?: number;
  degraded_reason?: string;
  node_errors?: Record<string, string>;
}

/**
 * Service for ensuring stability in ComfyUI connections
 * 
 * Handles offline detection, reconnection, error handling,
 * and recovery mechanisms.
 */
export class ComfyUIStabilityLayer extends BrowserEventEmitter {
  private healthCheck: ComfyUIHealthCheck;
  private baseUrl: string;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private reconnectDelayMax: number;
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;
  private connectTimestamp?: Date;
  private lastCheckTime: Date = new Date();
  private status: StabilityStatus = StabilityStatus.OFFLINE;
  private executionErrorCounts: Record<string, number> = {};
  private nodeValidationCache: Record<string, NodeInfo[]> = {};
  private degradedThreshold: number;
  private diagnosticInfo: DiagnosticInfo;
  
  constructor(
    healthCheck: ComfyUIHealthCheck,
    baseUrl: string = 'http://localhost:8188',
    options: {
      maxReconnectAttempts?: number;
      reconnectDelay?: number;
      reconnectDelayMax?: number;
      degradedThreshold?: number;
    } = {}
  ) {
    super();
    this.healthCheck = healthCheck;
    this.baseUrl = baseUrl;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.reconnectDelay || 2000;
    this.reconnectDelayMax = options.reconnectDelayMax || 30000;
    this.degradedThreshold = options.degradedThreshold || 3;
    
    this.diagnosticInfo = {
      status: StabilityStatus.OFFLINE,
      last_check_time: this.lastCheckTime
    };
    
    // Set up health check listener
    this.healthCheck.addStatusListener((status) => {
      this.handleHealthStatus(status);
    });
  }
  
  /**
   * Initialize the stability layer
   */
  public async initialize(): Promise<boolean> {
    // Perform initial health check
    await this.checkHealth();
    return this.isAvailable();
  }
  
  /**
   * Check if ComfyUI is available
   */
  public isAvailable(): boolean {
    return this.status === StabilityStatus.ONLINE || this.status === StabilityStatus.DEGRADED;
  }
  
  /**
   * Get the current status
   */
  public getStatus(): StabilityStatus {
    return this.status;
  }
  
  /**
   * Get diagnostic information
   */
  public getDiagnostics(): DiagnosticInfo {
    return { ...this.diagnosticInfo };
  }
  
  /**
   * Force a health check
   */
  public async checkHealth(): Promise<void> {
    this.lastCheckTime = new Date();
    this.diagnosticInfo.last_check_time = this.lastCheckTime;
    
    const status = await this.healthCheck.checkHealth();
    this.handleHealthStatus(status);
  }
  
  /**
   * Handle a node execution error
   */
  public reportNodeError(nodeId: string, error: string): void {
    // Increment error count for this node
    this.executionErrorCounts[nodeId] = (this.executionErrorCounts[nodeId] || 0) + 1;
    
    // If we exceed the threshold, mark as degraded
    if (this.executionErrorCounts[nodeId] >= this.degradedThreshold) {
      if (this.status === StabilityStatus.ONLINE) {
        this.setStatus(StabilityStatus.DEGRADED, `Node ${nodeId} has failed ${this.executionErrorCounts[nodeId]} times`);
      }
    }
    
    // Store in diagnostic info
    if (!this.diagnosticInfo.node_errors) {
      this.diagnosticInfo.node_errors = {};
    }
    this.diagnosticInfo.node_errors[nodeId] = error;
    
    this.emit('nodeError', { nodeId, error, count: this.executionErrorCounts[nodeId] });
  }
  
  /**
   * Reset error counts (e.g., after successful operations)
   */
  public resetErrorCounts(): void {
    this.executionErrorCounts = {};
    this.diagnosticInfo.node_errors = {};
    
    // If we were degraded, try to go back online
    if (this.status === StabilityStatus.DEGRADED) {
      this.checkHealth();
    }
  }
  
  /**
   * Validate workflow nodes
   * 
   * @param workflow The workflow to validate
   * @returns Validation results for each node
   */
  public async validateWorkflowNodes(workflow: Record<string, any>): Promise<NodeInfo[]> {
    // Generate a hash of the workflow to use as cache key
    const workflowHash = this.hashWorkflow(workflow);
    
    // Check if we have a cached validation
    if (this.nodeValidationCache[workflowHash]) {
      return this.nodeValidationCache[workflowHash];
    }
    
    if (!this.isAvailable()) {
      throw new Error('ComfyUI is not available. Cannot validate workflow nodes.');
    }
    
    const validatedNodes: NodeInfo[] = [];
    
    try {
      // Check if the node info endpoint is available
      const nodeInfoResponse = await fetch(`${this.baseUrl}/object_info`);
      
      if (!nodeInfoResponse.ok) {
        throw new Error(`Failed to get node information: ${nodeInfoResponse.status} ${nodeInfoResponse.statusText}`);
      }
      
      const nodeInfo = await nodeInfoResponse.json();
      
      // Check each node in the workflow
      if (workflow.nodes) {
        for (const [nodeId, node] of Object.entries<any>(workflow.nodes)) {
          const nodeValidation: NodeInfo = {
            nodeId,
            class_type: node.class_type,
            inputs: node.inputs || {},
            is_output: this.isOutputNode(node)
          };
          
          // Check if the node type exists
          if (!nodeInfo[node.class_type]) {
            nodeValidation.status = 'error';
            nodeValidation.error_message = `Node type '${node.class_type}' is not available in this ComfyUI instance`;
          } else {
            // Check inputs
            const requiredInputs = nodeInfo[node.class_type].input.required;
            const missingInputs = [];
            
            for (const input of requiredInputs) {
              if (!(input.name in (node.inputs || {}))) {
                missingInputs.push(input.name);
              }
            }
            
            if (missingInputs.length > 0) {
              nodeValidation.status = 'warning';
              nodeValidation.error_message = `Missing required inputs: ${missingInputs.join(', ')}`;
            } else {
              nodeValidation.status = 'validated';
            }
          }
          
          validatedNodes.push(nodeValidation);
        }
      }
      
      // Cache the result
      this.nodeValidationCache[workflowHash] = validatedNodes;
      
      return validatedNodes;
    } catch (error) {
      console.error('Error validating workflow nodes:', error);
      
      // If validation fails, return basic info without validation
      if (workflow.nodes) {
        for (const [nodeId, node] of Object.entries<any>(workflow.nodes)) {
          validatedNodes.push({
            nodeId,
            class_type: node.class_type,
            inputs: node.inputs || {},
            is_output: this.isOutputNode(node),
            status: 'warning',
            error_message: 'Node validation unavailable'
          });
        }
      }
      
      return validatedNodes;
    }
  }
  
  /**
   * Clear the validation cache
   */
  public clearValidationCache(): void {
    this.nodeValidationCache = {};
  }
  
  /**
   * Handle health status update
   */
  private handleHealthStatus(status: any): void {
    const wasAvailable = this.isAvailable();
    
    if (status.available) {
      // System is online
      if (this.status === StabilityStatus.RECONNECTING) {
        this.setStatus(StabilityStatus.ONLINE, 'Reconnected to ComfyUI');
        this.stopReconnecting();
      } else if (this.status === StabilityStatus.OFFLINE || this.status === StabilityStatus.ERROR) {
        this.setStatus(StabilityStatus.ONLINE, 'Connected to ComfyUI');
      }
      
      // Update connection timestamp if this is a new connection
      if (!wasAvailable) {
        this.connectTimestamp = new Date();
        this.diagnosticInfo.connected_since = this.connectTimestamp;
      }
      
      // Store diagnostic info
      this.diagnosticInfo.latency = status.latency;
      this.diagnosticInfo.gpu_info = status.systemInfo?.devices;
      this.diagnosticInfo.queue_size = status.queueInfo?.queue_remaining;
    } else {
      // System is offline
      if (wasAvailable) {
        this.setStatus(StabilityStatus.OFFLINE, status.message || 'ComfyUI is offline');
        this.startReconnecting();
      } else if (this.status === StabilityStatus.RECONNECTING) {
        this.diagnosticInfo.last_error = status.message;
        // Continue reconnecting
        this.reconnect();
      }
    }
  }
  
  /**
   * Set the current status
   */
  private setStatus(status: StabilityStatus, message?: string): void {
    const previousStatus = this.status;
    this.status = status;
    
    // Update diagnostic info
    this.diagnosticInfo.status = status;
    
    if (status === StabilityStatus.DEGRADED) {
      this.diagnosticInfo.degraded_reason = message;
    } else if (status === StabilityStatus.ERROR || status === StabilityStatus.OFFLINE) {
      this.diagnosticInfo.last_error = message;
    }
    
    // Emit status change event
    if (previousStatus !== status) {
      this.emit('statusChange', { 
        previous: previousStatus, 
        current: status,
        message 
      });
    }
  }
  
  /**
   * Start the reconnection process
   */
  private startReconnecting(): void {
    if (this.reconnectTimer) {
      return; // Already reconnecting
    }
    
    this.reconnectAttempts = 0;
    this.setStatus(StabilityStatus.RECONNECTING, 'Attempting to reconnect to ComfyUI');
    this.diagnosticInfo.reconnect_attempts = 0;
    this.reconnect();
  }
  
  /**
   * Stop the reconnection process
   */
  private stopReconnecting(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
  
  /**
   * Perform a single reconnection attempt
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus(StabilityStatus.ERROR, `Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
      this.stopReconnecting();
      return;
    }
    
    this.reconnectAttempts++;
    this.diagnosticInfo.reconnect_attempts = this.reconnectAttempts;
    
    // Calculate backoff delay (exponential with jitter)
    const delay = Math.min(
      this.reconnectDelayMax,
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)
    ) * (0.9 + Math.random() * 0.2); // Add 10% jitter
    
    console.log(`ComfyUI reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      try {
        await this.checkHealth();
      } catch (error) {
        console.error('Error during reconnect attempt:', error);
        // Continue reconnecting
        this.reconnect();
      }
    }, delay);
  }
  
  /**
   * Check if a node is an output node based on its class_type
   */
  private isOutputNode(node: any): boolean {
    const outputNodeTypes = [
      'SaveImage', 
      'PreviewImage', 
      'VHS_VideoCombine', 
      'SaveVideo',
      'ShowImage',
      'SaveImageWithMetadata'
    ];
    
    return outputNodeTypes.includes(node.class_type);
  }
  
  /**
   * Create a simple hash of a workflow for caching
   */
  private hashWorkflow(workflow: Record<string, any>): string {
    try {
      // Get a string representation of nodes
      let nodeString = '';
      
      if (workflow.nodes) {
        for (const [nodeId, node] of Object.entries<any>(workflow.nodes)) {
          nodeString += `${nodeId}:${node.class_type};`;
        }
      }
      
      // Very simple hash function
      let hash = 0;
      for (let i = 0; i < nodeString.length; i++) {
        const char = nodeString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      
      return hash.toString(16);
    } catch (error) {
      // If hashing fails, use a timestamp
      return Date.now().toString(16);
    }
  }
}