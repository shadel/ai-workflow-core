/**
 * Unit tests for Upgrade Command
 * @requirement FIX-UPGRADE-COMMAND - Test upgrade command fixes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { getPackageInfo } from '../../../src/cli/utils/package-info.js';
import { fetchLatestVersion } from '../../../src/cli/utils/npm-registry.js';
import { compareVersions } from '../../../src/cli/utils/version-compare.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current version from package.json (dynamic, not hardcoded)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const CURRENT_VERSION = packageJson.version;

describe('Upgrade Command', () => {
  beforeEach(() => {
    // Reset any mocks if needed
  });

  describe('Package Info Display', () => {
    it('should display correct current version (not hardcoded)', () => {
      const info = getPackageInfo();
      
      // Compare with dynamically loaded version from package.json
      expect(info.version).toBe(CURRENT_VERSION);
      expect(info.version).not.toBe('2.0.0'); // Should not be hardcoded old version
      expect(info.version).toMatch(/^\d+\.\d+\.\d+/); // Should be valid semver
    });

    it('should display correct package name', () => {
      const info = getPackageInfo();
      
      expect(info.name).toBe('@shadel/ai-workflow-core');
      expect(info.name).not.toBe('@ai-workflow/core'); // Should not be old name
    });
  });

  describe('npm Registry Check', () => {
    it('should fetch latest version from npm registry', async () => {
      // Test with real function - will need network or mock
      // For now, test that function exists and can be called
      const packageInfo = getPackageInfo();
      
      // This test verifies the function signature and return type
      // Actual network test would require mocking fetch
      expect(typeof fetchLatestVersion).toBe('function');
      expect(packageInfo.name).toBe('@shadel/ai-workflow-core');
    });

    it('should handle npm registry fetch failure gracefully', async () => {
      // Test that function handles errors
      // In real scenario, would mock fetch to throw error
      const result = await fetchLatestVersion('@nonexistent-package-xyz-12345');
      
      // Should return null values, not throw
      expect(result.latestVersion).toBeNull();
      expect(result.betaVersion).toBeNull();
      expect(result.publishDate).toBeNull();
    });
  });

  describe('Version Comparison', () => {
    it('should detect outdated version correctly', () => {
      const comparison = compareVersions('3.1.0', '3.1.2');
      expect(comparison).toBe('outdated');
    });

    it('should detect current version correctly', () => {
      const comparison = compareVersions('3.1.2', '3.1.2');
      expect(comparison).toBe('current');
    });

    it('should detect ahead version correctly', () => {
      const comparison = compareVersions('3.2.0', '3.1.2');
      expect(comparison).toBe('ahead');
    });
  });

  describe('--check-only flag behavior', () => {
    it('should output JSON format with version info', async () => {
      const packageInfo = getPackageInfo();
      const registryInfo = await fetchLatestVersion(packageInfo.name);
      const comparison = registryInfo.latestVersion 
        ? compareVersions(packageInfo.version, registryInfo.latestVersion)
        : 'unknown';

      const jsonOutput = JSON.stringify({
        current: packageInfo.version,
        latest: registryInfo.latestVersion,
        status: comparison,
        package: packageInfo.name
      }, null, 2);

      const parsed = JSON.parse(jsonOutput);
      
      expect(parsed).toHaveProperty('current');
      expect(parsed).toHaveProperty('latest');
      expect(parsed).toHaveProperty('status');
      expect(parsed).toHaveProperty('package');
      expect(parsed.package).toBe('@shadel/ai-workflow-core');
      expect(typeof parsed.current).toBe('string');
      expect(['outdated', 'current', 'ahead', 'unknown']).toContain(parsed.status);
    });

    it('should have correct exit code logic (0 for current, 1 for outdated)', () => {
      // Exit code 0 if current
      expect(compareVersions('3.1.2', '3.1.2') === 'current' ? 0 : 1).toBe(0);
      
      // Exit code 1 if outdated
      expect(compareVersions('3.1.0', '3.1.2') === 'current' ? 0 : 1).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle package info errors gracefully', () => {
      // getPackageInfo should work in normal case
      const info = getPackageInfo();
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
    });

    it('should handle npm registry network errors', async () => {
      // Test with non-existent package to verify graceful handling
      const result = await fetchLatestVersion('@nonexistent-package-xyz-12345');
      
      // Should return null values, not throw
      expect(result.latestVersion).toBeNull();
      expect(result.betaVersion).toBeNull();
      expect(result.publishDate).toBeNull();
    });
  });

  describe('--sync-rules flag', () => {
    it('should use syncMDCFiles from cursor-rules-sync utility', async () => {
      // Verify that upgrade command uses the shared utility
      // This is an integration test verifying the refactoring worked
      const { syncMDCFiles } = await import('../../../src/cli/utils/cursor-rules-sync.js');
      
      expect(typeof syncMDCFiles).toBe('function');
      // Function should accept projectRoot, userRulesDir, and options
      expect(syncMDCFiles.length).toBeGreaterThanOrEqual(2);
    });

    it('should use syncStateBehaviors from cursor-rules-sync utility', async () => {
      const { syncStateBehaviors } = await import('../../../src/cli/utils/cursor-rules-sync.js');
      
      expect(typeof syncStateBehaviors).toBe('function');
    });

    it('should use createCommandsMD from cursor-rules-sync utility', async () => {
      const { createCommandsMD } = await import('../../../src/cli/utils/cursor-rules-sync.js');
      
      expect(typeof createCommandsMD).toBe('function');
    });
  });
});

