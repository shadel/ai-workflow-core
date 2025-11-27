/**
 * Directory Utilities Tests
 * Tests for directory utility functions
 * @requirement TASK-3.1 - Refactor to Eliminate Duplication
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import {
  ensureDirectory,
  ensureParentDirectory,
  directoryExists,
  getSubdirectories,
  removeDirectory,
  copyDirectory
} from '../../src/utils/directory-utils.js';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('Directory Utilities', () => {
  let testDir: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir); // Track for cleanup
    await fs.ensureDir(testDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('ensureDirectory()', () => {
    it('should create directory if it does not exist', async () => {
      const dirPath = path.join(testDir, 'new-dir');
      
      await ensureDirectory(dirPath);
      
      expect(await fs.pathExists(dirPath)).toBe(true);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should not error if directory already exists', async () => {
      const dirPath = path.join(testDir, 'existing-dir');
      await fs.ensureDir(dirPath);
      
      await expect(ensureDirectory(dirPath)).resolves.not.toThrow();
      expect(await fs.pathExists(dirPath)).toBe(true);
    });
  });

  describe('ensureParentDirectory()', () => {
    it('should create parent directory for file path', async () => {
      const filePath = path.join(testDir, 'nested', 'deep', 'file.txt');
      
      await ensureParentDirectory(filePath);
      
      const parentDir = path.dirname(filePath);
      expect(await fs.pathExists(parentDir)).toBe(true);
    });
  });

  describe('directoryExists()', () => {
    it('should return true if directory exists', async () => {
      const dirPath = path.join(testDir, 'dir');
      await fs.ensureDir(dirPath);
      
      const exists = await directoryExists(dirPath);
      
      expect(exists).toBe(true);
    });

    it('should return false if directory does not exist', async () => {
      const dirPath = path.join(testDir, 'nonexistent');
      
      const exists = await directoryExists(dirPath);
      
      expect(exists).toBe(false);
    });

    it('should return false if path is a file', async () => {
      const filePath = path.join(testDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      
      const exists = await directoryExists(filePath);
      
      expect(exists).toBe(false);
    });
  });

  describe('getSubdirectories()', () => {
    it('should return empty array if directory does not exist', async () => {
      const dirPath = path.join(testDir, 'nonexistent');
      
      const subdirs = await getSubdirectories(dirPath);
      
      expect(subdirs).toEqual([]);
    });

    it('should return empty array if no subdirectories', async () => {
      const subdirs = await getSubdirectories(testDir);
      
      expect(subdirs).toEqual([]);
    });

    it('should return subdirectories', async () => {
      await fs.ensureDir(path.join(testDir, 'dir1'));
      await fs.ensureDir(path.join(testDir, 'dir2'));
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content');
      
      const subdirs = await getSubdirectories(testDir);
      
      expect(subdirs.length).toBe(2);
      expect(subdirs.some(d => d.includes('dir1'))).toBe(true);
      expect(subdirs.some(d => d.includes('dir2'))).toBe(true);
    });
  });

  describe('removeDirectory()', () => {
    it('should remove directory', async () => {
      const dirPath = path.join(testDir, 'dir');
      await fs.ensureDir(dirPath);
      
      await removeDirectory(dirPath);
      
      expect(await fs.pathExists(dirPath)).toBe(false);
    });

    it('should remove directory with contents', async () => {
      const dirPath = path.join(testDir, 'dir');
      await fs.ensureDir(dirPath);
      await fs.writeFile(path.join(dirPath, 'file.txt'), 'content');
      
      await removeDirectory(dirPath);
      
      expect(await fs.pathExists(dirPath)).toBe(false);
    });
  });

  describe('copyDirectory()', () => {
    it('should copy directory with contents', async () => {
      const srcDir = path.join(testDir, 'src');
      const destDir = path.join(testDir, 'dest');
      await fs.ensureDir(srcDir);
      await fs.writeFile(path.join(srcDir, 'file.txt'), 'content');
      
      await copyDirectory(srcDir, destDir);
      
      expect(await fs.pathExists(destDir)).toBe(true);
      expect(await fs.pathExists(path.join(destDir, 'file.txt'))).toBe(true);
      const content = await fs.readFile(path.join(destDir, 'file.txt'), 'utf-8');
      expect(content).toBe('content');
    });
  });
});

