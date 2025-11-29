/**
 * File Operation Utilities Tests
 * Tests for file operation utility functions
 * @requirement TASK-3.1 - Refactor to Eliminate Duplication
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import {
  writeFileSafe,
  writeJsonSafe,
  readJsonSafe,
  readFileSafe,
  fileExists,
  removeFile,
  copyFile,
  moveFile
} from '../../src/utils/file-operation-utils.js';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('File Operation Utilities', () => {
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

  describe('writeFileSafe()', () => {
    it('should write file with automatic directory creation', async () => {
      const filePath = path.join(testDir, 'nested', 'dir', 'file.txt');
      const content = 'test content';
      
      await writeFileSafe(filePath, content);
      
      expect(await fs.pathExists(filePath)).toBe(true);
      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(content);
    });

    it('should write file with custom encoding', async () => {
      const filePath = path.join(testDir, 'file.txt');
      const content = 'test content';
      
      await writeFileSafe(filePath, content, 'utf-8');
      
      const readContent = await fs.readFile(filePath, 'utf-8');
      expect(readContent).toBe(content);
    });
  });

  describe('writeJsonSafe()', () => {
    it('should write JSON file with automatic directory creation', async () => {
      const filePath = path.join(testDir, 'nested', 'data.json');
      const data = { key: 'value', number: 123 };
      
      await writeJsonSafe(filePath, data);
      
      expect(await fs.pathExists(filePath)).toBe(true);
      const readData = await fs.readJson(filePath);
      expect(readData).toEqual(data);
    });

    it('should write JSON file with formatting', async () => {
      const filePath = path.join(testDir, 'formatted.json');
      const data = { key: 'value' };
      
      await writeJsonSafe(filePath, data, { spaces: 2 });
      
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('  "key"'); // Indented
    });
  });

  describe('readJsonSafe()', () => {
    it('should read JSON file', async () => {
      const filePath = path.join(testDir, 'data.json');
      const data = { key: 'value', number: 123 };
      await fs.writeJson(filePath, data);
      
      const readData = await readJsonSafe(filePath);
      
      expect(readData).toEqual(data);
    });

    it('should throw error if file does not exist', async () => {
      const filePath = path.join(testDir, 'nonexistent.json');
      
      await expect(readJsonSafe(filePath)).rejects.toThrow();
    });
  });

  describe('readFileSafe()', () => {
    it('should read file content', async () => {
      const filePath = path.join(testDir, 'file.txt');
      const content = 'test content';
      await fs.writeFile(filePath, content);
      
      const readContent = await readFileSafe(filePath);
      
      expect(readContent).toBe(content);
    });

    it('should read file with custom encoding', async () => {
      const filePath = path.join(testDir, 'file.txt');
      const content = 'test content';
      await fs.writeFile(filePath, content, 'utf-8');
      
      const readContent = await readFileSafe(filePath, 'utf-8');
      
      expect(readContent).toBe(content);
    });
  });

  describe('fileExists()', () => {
    it('should return true if file exists', async () => {
      const filePath = path.join(testDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      
      const exists = await fileExists(filePath);
      
      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');
      
      const exists = await fileExists(filePath);
      
      expect(exists).toBe(false);
    });

    it('should return false if path is a directory', async () => {
      const dirPath = path.join(testDir, 'dir');
      await fs.ensureDir(dirPath);
      
      const exists = await fileExists(dirPath);
      
      expect(exists).toBe(false);
    });
  });

  describe('removeFile()', () => {
    it('should remove file', async () => {
      const filePath = path.join(testDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      
      await removeFile(filePath);
      
      expect(await fs.pathExists(filePath)).toBe(false);
    });
  });

  describe('copyFile()', () => {
    it('should copy file with automatic directory creation', async () => {
      const srcFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'nested', 'dest.txt');
      await fs.writeFile(srcFile, 'content');
      
      await copyFile(srcFile, destFile);
      
      expect(await fs.pathExists(destFile)).toBe(true);
      const content = await fs.readFile(destFile, 'utf-8');
      expect(content).toBe('content');
    });
  });

  describe('moveFile()', () => {
    it('should move file with automatic directory creation', async () => {
      const srcFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'nested', 'dest.txt');
      await fs.writeFile(srcFile, 'content');
      
      await moveFile(srcFile, destFile);
      
      expect(await fs.pathExists(srcFile)).toBe(false);
      expect(await fs.pathExists(destFile)).toBe(true);
      const content = await fs.readFile(destFile, 'utf-8');
      expect(content).toBe('content');
    });
  });
});

