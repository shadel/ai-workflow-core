/**
 * Unit tests for Git Hooks
 * @requirement REQ-V2-003 - Git hooks system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { installGitHooks, uninstallGitHooks, areHooksInstalled } from '../src/hooks/install-hooks.js';

describe('Git Hooks', () => {
  const testDir = '.test-git-hooks';
  const gitDir = path.join(testDir, '.git');
  const hooksDir = path.join(gitDir, 'hooks');

  beforeEach(async () => {
    await fs.remove(testDir);
    await fs.ensureDir(gitDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('installGitHooks', () => {
    it('should install pre-commit hook', async () => {
      // @requirement REQ-V2-003 - Hook installation
      await installGitHooks(testDir);
      
      const hookPath = path.join(hooksDir, 'pre-commit');
      expect(await fs.pathExists(hookPath)).toBe(true);
    });

    it('should create executable hook file', async () => {
      await installGitHooks(testDir);
      
      const hookPath = path.join(hooksDir, 'pre-commit');
      const content = await fs.readFile(hookPath, 'utf-8');
      
      // Check hook content (cross-platform compatible)
      expect(content).toContain('#!/usr/bin/env node');
    });

    it('should fail if not a git repository', async () => {
      await fs.remove(gitDir); // Remove .git directory
      
      await expect(installGitHooks(testDir)).rejects.toThrow('Not a git repository');
    });

    it('should create hooks directory if missing', async () => {
      // Ensure .git exists but hooks doesn't
      expect(await fs.pathExists(hooksDir)).toBe(false);
      
      await installGitHooks(testDir);
      
      expect(await fs.pathExists(hooksDir)).toBe(true);
    });
  });

  describe('uninstallGitHooks', () => {
    it('should remove pre-commit hook', async () => {
      // @requirement REQ-V2-003 - Hook uninstallation
      await installGitHooks(testDir);
      expect(await fs.pathExists(path.join(hooksDir, 'pre-commit'))).toBe(true);
      
      await uninstallGitHooks(testDir);
      
      expect(await fs.pathExists(path.join(hooksDir, 'pre-commit'))).toBe(false);
    });

    it('should not error if no hooks exist', async () => {
      await expect(uninstallGitHooks(testDir)).resolves.not.toThrow();
    });
  });

  describe('areHooksInstalled', () => {
    it('should return true when hooks installed', async () => {
      await installGitHooks(testDir);
      
      const installed = await areHooksInstalled(testDir);
      expect(installed).toBe(true);
    });

    it('should return false when hooks not installed', async () => {
      const installed = await areHooksInstalled(testDir);
      expect(installed).toBe(false);
    });
  });

  describe('Hook content', () => {
    it('should include shebang', async () => {
      await installGitHooks(testDir);
      
      const hookPath = path.join(hooksDir, 'pre-commit');
      const content = await fs.readFile(hookPath, 'utf-8');
      
      expect(content).toMatch(/^#!/);
    });

    it('should import preCommitHook function', async () => {
      await installGitHooks(testDir);
      
      const hookPath = path.join(hooksDir, 'pre-commit');
      const content = await fs.readFile(hookPath, 'utf-8');
      
      expect(content).toContain('preCommitHook');
      expect(content).toContain('@ai-workflow/core');
    });
  });
});

