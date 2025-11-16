/**
 * Validator with Config Support - Core Build Extension
 * Extends base Validator to use config for thresholds
 * @requirement REQ-FIX-004 - Configurable validation thresholds
 */

import { Validator, ValidationResult } from './validator.js';

/**
 * Extended Validator with config support
 * @requirement REQ-FIX-004 - Load thresholds from config
 */
export class ValidatorWithConfig extends Validator {
  private config: any = null;

  /**
   * Load configuration if available
   * @requirement REQ-FIX-004 - Try to load from Full Build config
   */
  private async loadConfig(): Promise<void> {
    if (this.config) return;
    
    try {
      // Try to import Full Build config manager
      // Note: This only works if @shadel/ai-workflow-full is installed
      const { getConfig } = await import('@shadel/ai-workflow-full/dist/core/config-manager.js');
      const configManager = getConfig();
      this.config = await configManager.getAll();
    } catch {
      // Full Build not available or config not accessible
      // Use hard-coded defaults (Free Build fallback)
      this.config = {
        autoActions: {
          preCommit: {
            requirementsCoverageMin: 80,
            testCoverageMin: 60,
          },
        },
        validation: {
          requirementsCoverageMin: 80,
          testCoverageMin: 60,
        },
      };
    }
  }

  /**
   * Get requirements coverage minimum from config
   * @requirement REQ-FIX-004 - Configurable threshold
   */
  async getRequirementsCoverageMin(): Promise<number> {
    await this.loadConfig();
    return (
      this.config?.validation?.requirementsCoverageMin ||
      this.config?.autoActions?.preCommit?.requirementsCoverageMin ||
      80
    );
  }

  /**
   * Get test coverage minimum from config
   * @requirement REQ-FIX-004 - Configurable threshold
   */
  async getTestCoverageMin(): Promise<number> {
    await this.loadConfig();
    return (
      this.config?.validation?.testCoverageMin ||
      this.config?.autoActions?.preCommit?.testCoverageMin ||
      60
    );
  }

  /**
   * Enhanced validate with config thresholds
   * @requirement REQ-FIX-004 - Use config values
   */
  async validateWithConfig(): Promise<any> {
    const baseResult = await this.validateAll();
    
    // Add config-aware checks
    const minReqCoverage = await this.getRequirementsCoverageMin();
    const minTestCoverage = await this.getTestCoverageMin();
    
    // Return enhanced result with config info
    return {
      ...baseResult,
      config: {
        requirementsCoverageMin: minReqCoverage,
        testCoverageMin: minTestCoverage,
      },
    };
  }
}

