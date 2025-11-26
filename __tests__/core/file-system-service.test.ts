/**
 * FileSystemService Tests
 * Tests for centralized file system operations
 * @requirement TASK-2.1 - File System Abstraction
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { FileSystemService, fileSystemService } from '../../src/core/file-system-service.js';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('FileSystemService', () => {
  let testDir: string;
  let fsService: FileSystemService;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir); // Track for cleanup
    await fs.ensureDir(testDir);
    fsService = new FileSystemService();
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('ensureDir()', () => {
    it('should create directory if it does not exist', async () => {
      const dirPath = path.join(testDir, 'new-dir');
      
      await fsService.ensureDir(dirPath);
      
      expect(await fs.pathExists(dirPath)).toBe(true);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should not error if directory already exists', async () => {
      const dirPath = path.join(testDir, 'existing-dir');
      await fs.ensureDir(dirPath);
      
      await expect(fsService.ensureDir(dirPath)).resolves.not.toThrow();
      expect(await fs.pathExists(dirPath)).toBe(true);
    });
  });

  describe('writeFile()', () => {
    it('should write file with automatic directory creation', async () => {
      const filePath = path.join(testDir, 'nested', 'dir', 'file.txt');
      const content = 'test content';
      
      await fsService.writeFile(filePath, content);
      
      expect(await fs.pathExists(filePath)).toBe(true);
      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(content);
    });

    it('should write file with custom encoding', async () => {
      const filePath = path.join(testDir, 'file.txt');
      const content = 'test content';
      
      await fsService.writeFile(filePath, content, 'utf-8');
      
      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(content);
    });
  });

  describe('writeJson()', () => {
    it('should write JSON file with automatic directory creation', async () => {
      const filePath = path.join(testDir, 'nested', 'data.json');
      const data = { key: 'value', number: 123 };
      
      await fsService.writeJson(filePath, data);
      
      expect(await fs.pathExists(filePath)).toBe(true);
      const readData = await fs.readJson(filePath);
      expect(readData).toEqual(data);
    });

    it('should write JSON file with formatting', async () => {
      const filePath = path.join(testDir, 'formatted.json');
      const data = { key: 'value' };
      
      await fsService.writeJson(filePath, data, { spaces: 2 });
      
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('  "key"'); // Indented
    });
  });

  describe('readJson()', () => {
    it('should read JSON file', async () => {
      const filePath = path.join(testDir, 'data.json');
      const data = { key: 'value', number: 123 };
      await fs.writeJson(filePath, data);
      
      const readData = await fsService.readJson(filePath);
      
      expect(readData).toEqual(data);
    });

    it('should throw error if file does not exist', async () => {
      const filePath = path.join(testDir, 'nonexistent.json');
      
      await expect(fsService.readJson(filePath)).rejects.toThrow();
    });
  });

  describe('readFile()', () => {
    it('should read file content', async () => {
      const filePath = path.join(testDir, 'file.txt');
      const content = 'test content';
      await fs.writeFile(filePath, content);
      
      const readContent = await fsService.readFile(filePath);
      
      expect(readContent).toBe(content);
    });

    it('should read file with custom encoding', async () => {
      const filePath = path.join(testDir, 'file.txt');
      const content = 'test content';
      await fs.writeFile(filePath, content, 'utf-8');
      
      const readContent = await fsService.readFile(filePath, 'utf-8');
      
      expect(readContent).toBe(content);
    });
  });

  describe('pathExists()', () => {
    it('should return true if path exists', async () => {
      const filePath = path.join(testDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      
      const exists = await fsService.pathExists(filePath);
      
      expect(exists).toBe(true);
    });

    it('should return false if path does not exist', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');
      
      const exists = await fsService.pathExists(filePath);
      
      expect(exists).toBe(false);
    });
  });

  describe('remove()', () => {
    it('should remove file', async () => {
      const filePath = path.join(testDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      
      await fsService.remove(filePath);
      
      expect(await fs.pathExists(filePath)).toBe(false);
    });

    it('should remove directory', async () => {
      const dirPath = path.join(testDir, 'dir');
      await fs.ensureDir(dirPath);
      
      await fsService.remove(dirPath);
      
      expect(await fs.pathExists(dirPath)).toBe(false);
    });
  });

  describe('copy()', () => {
    it('should copy file with automatic directory creation', async () => {
      const srcFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'nested', 'dest.txt');
      await fs.writeFile(srcFile, 'content');
      
      await fsService.copy(srcFile, destFile);
      
      expect(await fs.pathExists(destFile)).toBe(true);
      const content = await fs.readFile(destFile, 'utf-8');
      expect(content).toBe('content');
    });
  });

  describe('move()', () => {
    it('should move file with automatic directory creation', async () => {
      const srcFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'nested', 'dest.txt');
      await fs.writeFile(srcFile, 'content');
      
      await fsService.move(srcFile, destFile);
      
      expect(await fs.pathExists(srcFile)).toBe(false);
      expect(await fs.pathExists(destFile)).toBe(true);
      const content = await fs.readFile(destFile, 'utf-8');
      expect(content).toBe('content');
    });
  });

  describe('default instance', () => {
    it('should use default fileSystemService instance', async () => {
      const filePath = path.join(testDir, 'file.txt');
      
      await fileSystemService.writeFile(filePath, 'content');
      
      expect(await fs.pathExists(filePath)).toBe(true);
    });
  });
});

