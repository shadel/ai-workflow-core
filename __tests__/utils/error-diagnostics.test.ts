/**
 * Error Diagnostics Tests
 * Tests for error diagnostics utilities
 * @requirement TASK-2.2 - Error Handling Improvements
 */

import { describe, it, expect } from '@jest/globals';
import {
  EnhancedError,
  createEnhancedError,
  wrapError,
  formatErrorForLogging,
  isRetryableError,
  getErrorRecoverySuggestion,
  diagnoseFileOperation
} from '../../src/utils/error-diagnostics.js';
import fs from 'fs-extra';
import path from 'path';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('Error Diagnostics', () => {
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

  describe('EnhancedError', () => {
    it('should create enhanced error with context', () => {
      const context = {
        operation: 'writeFile',
        filePath: '/test/path.txt'
      };
      const error = createEnhancedError('Test error', context);

      expect(error).toBeInstanceOf(EnhancedError);
      expect(error.message).toBe('Test error');
      expect(error.context.operation).toBe('writeFile');
      expect(error.context.filePath).toBe('/test/path.txt');
      expect(error.timestamp).toBeDefined();
    });

    it('should wrap existing error', () => {
      const originalError = new Error('Original error');
      const context = {
        operation: 'readFile',
        filePath: '/test/path.txt'
      };
      const error = wrapError(originalError, context);

      expect(error).toBeInstanceOf(EnhancedError);
      expect(error.message).toContain('readFile failed');
      expect(error.originalError).toBe(originalError);
      expect(error.context.operation).toBe('readFile');
    });

    it('should format error message with context', () => {
      const context = {
        operation: 'writeFile',
        filePath: path.join(testDir, 'file.txt')
      };
      const error = createEnhancedError('Failed to write file', context);
      const formatted = error.getFormattedMessage();

      expect(formatted).toContain('Failed to write file');
      expect(formatted).toContain('Operation: writeFile');
      expect(formatted).toContain('File:');
      expect(formatted).toContain('Timestamp:');
    });

    it('should get structured report', () => {
      const context = {
        operation: 'writeFile',
        filePath: '/test/path.txt'
      };
      const error = createEnhancedError('Test error', context);
      const report = error.getStructuredReport();

      expect(report.error).toBe('Test error');
      expect(report.context).toEqual(context);
      expect(report.timestamp).toBeDefined();
      expect(report.originalError).toBeDefined();
    });
  });

  describe('formatErrorForLogging()', () => {
    it('should format enhanced error', () => {
      const context = {
        operation: 'writeFile',
        filePath: '/test/path.txt'
      };
      const error = createEnhancedError('Test error', context);
      const formatted = formatErrorForLogging(error);

      expect(formatted).toContain('Test error');
      expect(formatted).toContain('writeFile');
    });

    it('should format regular error with context', () => {
      const error = new Error('Regular error');
      const context = {
        operation: 'readFile'
      };
      const formatted = formatErrorForLogging(error, context);

      expect(formatted).toContain('Regular error');
      expect(formatted).toContain('Operation: readFile');
    });
  });

  describe('isRetryableError()', () => {
    it('should detect ENOENT as retryable', () => {
      const error = new Error('ENOENT: no such file or directory');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should detect EACCES as retryable', () => {
      const error = new Error('EACCES: permission denied');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should detect timeout as retryable', () => {
      const error = new Error('ETIMEDOUT: operation timed out');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should detect timeout in lowercase', () => {
      const error = new Error('timeout occurred');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not detect non-retryable errors', () => {
      const error = new Error('Invalid argument');
      
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getErrorRecoverySuggestion()', () => {
    it('should provide suggestions for ENOENT', () => {
      const error = new Error('ENOENT: no such file or directory');
      const context = {
        operation: 'writeFile',
        filePath: '/test/path.txt'
      };
      const suggestions = getErrorRecoverySuggestion(error, context);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('does not exist');
    });

    it('should provide suggestions for EACCES', () => {
      const error = new Error('EACCES: permission denied');
      const suggestions = getErrorRecoverySuggestion(error);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('Permission denied');
    });

    it('should provide general suggestions for unknown errors', () => {
      const error = new Error('Unknown error');
      const suggestions = getErrorRecoverySuggestion(error);

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('diagnoseFileOperation()', () => {
    it('should diagnose file operation', async () => {
      const filePath = path.join(testDir, 'file.txt');
      await fs.writeFile(filePath, 'content');

      const diagnostics = await diagnoseFileOperation('readFile', filePath);

      expect(diagnostics.fileExists).toBe(true);
      expect(diagnostics.directoryExists).toBe(true);
      expect(diagnostics.fileReadable).toBe(true);
    });

    it('should diagnose non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');

      const diagnostics = await diagnoseFileOperation('readFile', filePath);

      expect(diagnostics.fileExists).toBe(false);
      expect(diagnostics.directoryExists).toBe(true);
    });
  });
});

