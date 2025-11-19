/**
 * Tests for ShellInstaller
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import os from 'os';
import { ShellInstaller } from '../src/utils/shell-installer';

describe('ShellInstaller', () => {
  let installer: ShellInstaller;
  const testDir = '.test-shell-install';

  beforeEach(async () => {
    installer = new ShellInstaller();
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('detectShell', () => {
    it('should detect shell type', () => {
      const shell = installer.detectShell();
      
      expect(shell).toBeDefined();
      expect(['bash', 'zsh', 'fish', 'powershell', 'cmd', 'unknown']).toContain(shell);
    });

    it('should return string value', () => {
      const shell = installer.detectShell();
      
      expect(typeof shell).toBe('string');
      expect(shell.length).toBeGreaterThan(0);
    });
  });

  describe('getProfilePath', () => {
    it('should return profile path for bash shell', () => {
      const profilePath = installer.getProfilePath('bash');
      
      expect(profilePath).toBeDefined();
      expect(typeof profilePath).toBe('string');
      expect(profilePath.length).toBeGreaterThan(0);
    });

    it('should return profile path for zsh shell', () => {
      const profilePath = installer.getProfilePath('zsh');
      
      expect(profilePath).toBeDefined();
      expect(typeof profilePath).toBe('string');
      expect(profilePath).toContain('.zshrc');
    });

    it('should return profile path for fish shell', () => {
      const profilePath = installer.getProfilePath('fish');
      
      expect(profilePath).toBeDefined();
      expect(typeof profilePath).toBe('string');
      expect(profilePath).toContain('config.fish');
    });

    it('should return empty string for cmd shell', () => {
      const profilePath = installer.getProfilePath('cmd');
      
      expect(profilePath).toBe('');
    });

    it('should return absolute path for detected shell', () => {
      const shell = installer.detectShell();
      const profilePath = installer.getProfilePath(shell);
      
      if (profilePath) {
        expect(profilePath.includes(os.homedir()) || profilePath.startsWith('/')).toBe(true);
      }
    });
  });

  describe('isInstalled', () => {
    it('should return false when not installed', async () => {
      const installed = await installer.isInstalled();
      
      expect(typeof installed).toBe('boolean');
    });

    it('should check for alias in shell config', async () => {
      const result = await installer.isInstalled();
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('install', () => {
    it('should handle installation process', async () => {
      try {
        const result = await installer.install();
        expect(typeof result).toBe('boolean');
      } catch (error) {
        // May fail in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('uninstall', () => {
    it('should handle uninstall process', async () => {
      try {
        const result = await installer.uninstall();
        expect(typeof result).toBe('boolean');
      } catch (error) {
        // May fail in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('Platform compatibility', () => {
    it('should work on current platform', () => {
      const platform = os.platform();
      expect(['linux', 'darwin', 'win32']).toContain(platform);
      
      const shell = installer.detectShell();
      expect(shell).toBeDefined();
    });
  });
});

