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
    initialize?(engine: WorkflowEngine): Promise<void>;
    onStateChange?(from: WorkflowState, to: WorkflowState): Promise<void>;
    onTaskCreate?(task: Task): Promise<void>;
    onTaskComplete?(task: Task): Promise<void>;
    validate?(): Promise<ValidationResult>;
}
/**
 * Plugin Manager - Manages plugin registration and execution
 */
export declare class PluginManager {
    private plugins;
    private engine;
    /**
     * Set workflow engine instance
     */
    setEngine(engine: WorkflowEngine): void;
    /**
     * Register a plugin
     * @requirement REQ-V2-002 - Plugin registration and management
     */
    register(plugin: WorkflowPlugin): Promise<void>;
    /**
     * Unregister a plugin
     */
    unregister(pluginId: string): Promise<void>;
    /**
     * Execute a hook across all plugins
     * @requirement REQ-V2-002 - Plugin hook execution
     */
    executeHook(hookName: string, ...args: any[]): Promise<void>;
    /**
     * Get a specific plugin
     */
    getPlugin(id: string): WorkflowPlugin | undefined;
    /**
     * Get all registered plugins
     */
    getAllPlugins(): WorkflowPlugin[];
    /**
     * Check if plugin is registered
     */
    hasPlugin(id: string): boolean;
    /**
     * Get plugin count
     */
    getPluginCount(): number;
    /**
     * Clear all plugins
     */
    clear(): void;
}
//# sourceMappingURL=plugin-system.d.ts.map