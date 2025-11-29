/**
 * Tests for SourceSyncChecker
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { SourceSyncChecker } from '../../src/validators/source-sync-checker.js';
import { parseSourceReference } from '../../src/types/documentation.js';
import { getUniqueTestDir, cleanupWithRetry } from '../test-helpers.js';

describe('SourceSyncChecker', () => {
  let testDir: string;
  let checker: SourceSyncChecker;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testDir = getUniqueTestDir();
    testDirs.push(testDir); // Track for cleanup
    await fs.ensureDir(testDir);
    checker = new SourceSyncChecker(testDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('parseSourceReference()', () => {
    it('should parse valid source reference', () => {
      const ref = 'src/core/test.ts:10-20';
      const result = parseSourceReference(ref);

      expect(result).not.toBeNull();
      expect(result?.file).toBe('src/core/test.ts');
      expect(result?.startLine).toBe(10);
      expect(result?.endLine).toBe(20);
    });

    it('should return null for invalid format', () => {
      expect(parseSourceReference('invalid')).toBeNull();
      expect(parseSourceReference('file.ts')).toBeNull();
      expect(parseSourceReference('file.ts:10')).toBeNull();
      expect(parseSourceReference('file.ts:10-')).toBeNull();
    });
  });

  describe('checkSourceReference()', () => {
    it('should validate existing file with valid line range', async () => {
      const file = path.join('src', 'test.ts');
      await fs.ensureDir(path.dirname(path.join(testDir, file)));
      await fs.writeFile(
        path.join(testDir, file),
        'line 1\nline 2\nline 3\nline 4\nline 5\n'
      );

      const result = await checker.checkSourceReference(`${file}:2-4`);

      expect(result.synchronized).toBe(true);
      expect(result.sourceExists).toBe(true);
      expect(result.lineRangeValid).toBe(true);
      expect(result.contentMatches).toBe(true);
    });

    it('should detect non-existent file', async () => {
      const result = await checker.checkSourceReference('nonexistent.ts:1-10');

      expect(result.synchronized).toBe(false);
      expect(result.sourceExists).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should detect invalid line range', async () => {
      const file = 'test.ts';
      await fs.writeFile(path.join(testDir, file), 'line 1\nline 2\nline 3\n');

      const result = await checker.checkSourceReference(`${file}:1-100`);

      expect(result.synchronized).toBe(false);
      expect(result.lineRangeValid).toBe(false);
      expect(result.message).toContain('Invalid line range');
    });

    it('should detect invalid reference format', async () => {
      const result = await checker.checkSourceReference('invalid-format');

      expect(result.synchronized).toBe(false);
      expect(result.message).toContain('Invalid source reference format');
    });
  });

  describe('readSourceLines()', () => {
    it('should read specified line range', async () => {
      const file = 'source.ts';
      await fs.writeFile(
        path.join(testDir, file),
        'line 1\nline 2\nline 3\nline 4\nline 5\n'
      );

      const result = await checker.readSourceLines(`${file}:2-4`);

      expect(result).not.toBeNull();
      expect(result).toBe('line 2\nline 3\nline 4');
    });

    it('should return null for invalid reference', async () => {
      const result = await checker.readSourceLines('invalid');

      expect(result).toBeNull();
    });

    it('should return null for non-existent file', async () => {
      const result = await checker.readSourceLines('nonexistent.ts:1-10');

      expect(result).toBeNull();
    });
  });

  describe('detectChanges()', () => {
    it('should detect when source is newer than doc', async () => {
      const file = 'source.ts';
      const filePath = path.join(testDir, file);
      
      // Get timestamp before writing file
      const beforeWrite = Date.now();
      
      // Write file and ensure it's flushed
      await fs.writeFile(filePath, 'content');
      
      // Wait for file system to update mtime (CI environments need more time)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force sync to ensure mtime is updated (especially important in CI)
      try {
        const fd = await fsPromises.open(filePath, 'r+');
        await fd.sync();
        await fd.close();
      } catch (error) {
        // If sync fails (e.g., EPERM on Windows), just wait longer
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Verify file mtime is actually after beforeWrite
      // This ensures the file system has updated the timestamp
      let fileStats = await fs.stat(filePath);
      let retries = 0;
      while (fileStats.mtime.getTime() <= beforeWrite && retries < 10) {
        // Touch file to force mtime update
        await fs.utimes(filePath, fileStats.atime, new Date());
        await new Promise(resolve => setTimeout(resolve, 50));
        fileStats = await fs.stat(filePath);
        retries++;
      }
      
      // Use a date well before file creation to ensure it's older
      // Use file's actual mtime minus buffer to ensure comparison works
      const docUpdated = new Date(fileStats.mtime.getTime() - 1000); // 1 second before file mtime
      const result = await checker.detectChanges(file, docUpdated);

      expect(result).toBe(true);
    });

    it('should return false when doc is newer', async () => {
      const file = 'source.ts';
      const filePath = path.join(testDir, file);
      
      // Write file and ensure it's flushed
      await fs.writeFile(filePath, 'content');
      
      // Explicitly set file mtime using utimes (avoid timing-dependent logic)
      // This ensures file mtime is set correctly regardless of filesystem timing
      const fileWriteTime = new Date(Date.now() - 5000); // 5 seconds ago
      await fs.utimes(filePath, fileWriteTime, fileWriteTime);
      
      // Get actual file mtime after explicit setting
      const fileStats = await fs.stat(filePath);
      const fileMtime = fileStats.mtime.getTime();
      
      // Verify mtime was set correctly
      expect(fileMtime).toBeLessThan(Date.now());
      
      // Create doc date that is definitely after file mtime (use file mtime + 1 second)
      // This ensures doc is newer than source file without relying on timing
      const docUpdated = new Date(fileMtime + 1000);
      
      const result = await checker.detectChanges(file, docUpdated);

      expect(result).toBe(false);
    });

    it('should return true for non-existent file', async () => {
      const docUpdated = new Date();
      const result = await checker.detectChanges('nonexistent.ts', docUpdated);

      expect(result).toBe(true);
    });
  });

  describe('validateLogicSections()', () => {
    it('should validate all logic sections', async () => {
      const file1 = 'src/logic1.ts';
      const file2 = 'src/logic2.ts';
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.writeFile(path.join(testDir, file1), 'line 1\nline 2\nline 3\n');
      await fs.writeFile(path.join(testDir, file2), 'line 1\nline 2\n');

      const logicSections = [
        {
          name: 'Logic 1',
          type: 'business-logic' as const,
          source: `${file1}:1-2`,
          flowchart: false
        },
        {
          name: 'Logic 2',
          type: 'business-logic' as const,
          source: `${file2}:1-2`,
          flowchart: true
        }
      ];

      const result = await checker.validateLogicSections(
        logicSections,
        new Date().toISOString()
      );

      expect(result.valid).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should detect invalid logic section references', async () => {
      const logicSections = [
        {
          name: 'Invalid',
          type: 'business-logic' as const,
          source: 'nonexistent.ts:1-10',
          flowchart: false
        }
      ];

      const result = await checker.validateLogicSections(
        logicSections,
        new Date().toISOString()
      );

      expect(result.valid).toBe(false);
      expect(result.results[0].status.synchronized).toBe(false);
    });
  });

  describe('validateSourceFiles()', () => {
    it('should validate existing files', async () => {
      const file1 = 'src/file1.ts';
      const file2 = 'src/file2.ts';
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.writeFile(path.join(testDir, file1), 'content');
      await fs.writeFile(path.join(testDir, file2), 'content');

      const result = await checker.validateSourceFiles([file1, file2]);

      expect(result.valid).toBe(true);
      expect(result.existing).toEqual([file1, file2]);
      expect(result.missing).toEqual([]);
    });

    it('should detect missing files', async () => {
      const result = await checker.validateSourceFiles([
        'exists.ts',
        'missing.ts'
      ]);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('exists.ts');
      expect(result.missing).toContain('missing.ts');
    });
  });

  describe('compareWithSource()', () => {
    it('should detect matching code', async () => {
      const file = 'source.ts';
      await fs.writeFile(
        path.join(testDir, file),
        'line 1\nline 2\nline 3\n'
      );

      const docCode = 'line 1\nline 2\nline 3';
      const result = await checker.compareWithSource(docCode, `${file}:1-3`);

      expect(result.matches).toBe(true);
      expect(result.similarity).toBe(100);
    });

    it('should detect code differences', async () => {
      const file = 'source.ts';
      await fs.writeFile(
        path.join(testDir, file),
        'line 1\nline 2\nline 3\n'
      );

      const docCode = 'different line\nline 2\nline 3';
      const result = await checker.compareWithSource(docCode, `${file}:1-3`);

      expect(result.matches).toBe(false);
      expect(result.similarity).toBeLessThan(100);
    });

    it('should handle non-existent source', async () => {
      const result = await checker.compareWithSource(
        'code',
        'nonexistent.ts:1-10'
      );

      expect(result.matches).toBe(false);
      expect(result.similarity).toBe(0);
      expect(result.message).toContain('Cannot read source');
    });
  });
});

