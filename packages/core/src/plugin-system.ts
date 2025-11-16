/**
 * Plugin System for Workflow Engine
 * @requirement REQ-V2-002
 */

import { WorkflowEngine } from './workflow-engine.js';
import { WorkflowState, Task, ValidationResult } from './types.js';

/**
 * Plugin interface for extending workflow engine
 * @requirement REQ-V2-002 - Plugin system for extensibility
 */
export interface WorkflowPlugin {
  id: string;
  name: string;
  version: string;
  
  // Lifecycle hooks
  initialize?(engine: WorkflowEngine): Promise<void>;
  onStateChange?(from: WorkflowState, to: WorkflowState): Promise<void>;
  onTaskCreate?(task: Task): Promise<void>;
  onTaskComplete?(task: Task): Promise<void>;
  
  // Validation hook
  validate?(): Promise<ValidationResult>;
}

/**
 * Plugin Manager - Manages plugin registration and execution
 */
export class PluginManager {
  private plugins: Map<string, WorkflowPlugin> = new Map();
  private engine: WorkflowEngine | null = null;

  /**
   * Set workflow engine instance
   */
  setEngine(engine: WorkflowEngine): void {
    this.engine = engine;
  }

  /**
   * Register a plugin
   * @requirement REQ-V2-002 - Plugin registration and management
   */
  async register(plugin: WorkflowPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }

    this.plugins.set(plugin.id, plugin);

    // Initialize plugin if it has initialize hook
    if (plugin.initialize && this.engine) {
      await plugin.initialize(this.engine);
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    this.plugins.delete(pluginId);
  }

  /**
   * Execute a hook across all plugins
   * @requirement REQ-V2-002 - Plugin hook execution
   */
  async executeHook(hookName: string, ...args: any[]): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const hook = (plugin as any)[hookName];
      if (typeof hook === 'function') {
        await hook.apply(plugin, args);
      }
    }
  }

  /**
   * Get a specific plugin
   */
  getPlugin(id: string): WorkflowPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): WorkflowPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if plugin is registered
   */
  hasPlugin(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Get plugin count
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
  }
}

