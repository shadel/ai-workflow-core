/**
 * Plugin System for Workflow Engine
 * @requirement REQ-V2-002
 */
/**
 * Plugin Manager - Manages plugin registration and execution
 */
export class PluginManager {
    plugins = new Map();
    engine = null;
    /**
     * Set workflow engine instance
     */
    setEngine(engine) {
        this.engine = engine;
    }
    /**
     * Register a plugin
     * @requirement REQ-V2-002 - Plugin registration and management
     */
    async register(plugin) {
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
    async unregister(pluginId) {
        if (!this.plugins.has(pluginId)) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        this.plugins.delete(pluginId);
    }
    /**
     * Execute a hook across all plugins
     * @requirement REQ-V2-002 - Plugin hook execution
     */
    async executeHook(hookName, ...args) {
        for (const plugin of this.plugins.values()) {
            const hook = plugin[hookName];
            if (typeof hook === 'function') {
                await hook.apply(plugin, args);
            }
        }
    }
    /**
     * Get a specific plugin
     */
    getPlugin(id) {
        return this.plugins.get(id);
    }
    /**
     * Get all registered plugins
     */
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }
    /**
     * Check if plugin is registered
     */
    hasPlugin(id) {
        return this.plugins.has(id);
    }
    /**
     * Get plugin count
     */
    getPluginCount() {
        return this.plugins.size;
    }
    /**
     * Clear all plugins
     */
    clear() {
        this.plugins.clear();
    }
}
//# sourceMappingURL=plugin-system.js.map