/**
 * Task Config Loader - Read task config directly from file
 * Compatible with Full Build ConfigManager architecture
 * @requirement DISABLE-AUTO-ACTIVATE
 *
 * IMPORTANT: Default values must match Full Build ConfigManager.getDefaults()
 * See: packages/workflow-full/src/core/config-manager.ts:312
 *
 * Architecture compatibility:
 * - Path: Same as Full Build (`config/ai-workflow.config.json` relative to process.cwd())
 * - Field: Same as Full Build (`autoActions.task.complete.autoActivateNext`)
 * - Default: Same as Full Build (true)
 */

import fs from 'fs-extra';
import path from 'path';

export interface TaskCompleteConfig {
  autoActivateNext: boolean;
}

/**
 * Default value - MUST match Full Build ConfigManager default
 * Source: packages/workflow-full/src/core/config-manager.ts:312
 *
 * When Full Build default changes, update this value too.
 */
const DEFAULT_AUTO_ACTIVATE_NEXT = true;

/**
 * Load task completion config from config file
 *
 * Architecture compatibility:
 * - Path: Same as Full Build (`config/ai-workflow.config.json` relative to process.cwd())
 * - Field: Same as Full Build (`autoActions.task.complete.autoActivateNext`)
 * - Default: Same as Full Build (true)
 *
 * Differences from Full Build:
 * - No merge with defaults (reads raw JSON)
 * - No validation (graceful degradation)
 * - No caching (reads fresh each time)
 */
export async function loadTaskCompleteConfig(
  projectRoot: string = process.cwd()
): Promise<TaskCompleteConfig> {
  // Path resolution: Same as Full Build ConfigManager
  // Full Build: configPath || 'config/ai-workflow.config.json'
  // This is relative to process.cwd() in Full Build
  const configPath = path.join(projectRoot, 'config', 'ai-workflow.config.json');

  try {
    // Check if config file exists
    if (!(await fs.pathExists(configPath))) {
      // No config file - use default (same as Full Build)
      return { autoActivateNext: DEFAULT_AUTO_ACTIVATE_NEXT };
    }

    // Read config file (raw JSON, no merge)
    // Full Build does: mergeWithDefaults(loadedConfig)
    // Core Build: Reads directly (user must set value explicitly)
    const config = await fs.readJson(configPath);

    // Field access: Same pattern as Full Build
    // Full Build: config.get('autoActions.task.complete.autoActivateNext')
    // Core Build: config?.autoActions?.task?.complete?.autoActivateNext
    const autoActivateNext =
      config?.autoActions?.task?.complete?.autoActivateNext;

    // If field is explicitly set (even if false), use it
    // If field is null or undefined, use default (same as Full Build)
    // This matches Full Build behavior: mergeWithDefaults() fills missing/null fields
    if (autoActivateNext !== undefined && autoActivateNext !== null) {
      return { autoActivateNext };
    }

    // Field missing or null - use default (same as Full Build)
    return { autoActivateNext: DEFAULT_AUTO_ACTIVATE_NEXT };
  } catch (error) {
    // Error reading file - use default (same as Full Build error handling)
    // Full Build: Uses defaults on error too
    return { autoActivateNext: DEFAULT_AUTO_ACTIVATE_NEXT };
  }
}

/**
 * Get default value (exported for tests and documentation)
 */
export function getDefaultAutoActivateNext(): boolean {
  return DEFAULT_AUTO_ACTIVATE_NEXT;
}

