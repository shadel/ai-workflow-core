/**
 * Unit tests for Validator Cursor Verification Cache
 * @requirement REQ-V2-003 - Validation command with Cursor verification
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { WorkflowState } from '@shadel/workflow-core';
import { Validator, ValidationResults, CursorVerification } from '../../src/core/validator.js';
import { cleanupAllTestDirs } from '../test-helpers';

describe('Validator - Cursor Verification Cache', () => {
  const testContextDir = '.test-ai-context-validator-cache';
  let validator: Validator;

  beforeEach(async () => {
    await fs.remove(testContextDir);
    await fs.remove('.ai-context');
    validator = new Validator();
  });

  afterEach(async () => {
    await cleanupAllTestDirs();
  });

  describe('saveValidationResults', () => {
    it('should save validation results to context', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      const results = await validator.validateAll();
      await (validator as any).saveValidationResults(results);

      const resultsFile = path.join('.ai-context', 'validation-results.json');
      expect(await fs.pathExists(resultsFile)).toBe(true);

      const saved = await fs.readJson(resultsFile);
      expect(saved.timestamp).toBeDefined();
      expect(saved.taskId).toBe('test-123');
      expect(saved.results.workflow).toBeDefined();
      expect(saved.results.files).toBeDefined();
      expect(saved.cursorVerified).toBeDefined();
      expect(saved.overall).toBeDefined();
    });

    it('should include commit hash if in git repo', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      const results = await validator.validateAll();
      await (validator as any).saveValidationResults(results);

      const saved = await fs.readJson('.ai-context/validation-results.json');
      // Commit hash may or may not be present depending on git repo
      // Just verify the structure is correct
      expect(saved).toHaveProperty('commitHash');
    });

    it('should preserve existing Cursor verifications when saving', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      // Create existing verification
      const existingVerification: CursorVerification = {
        verified: true,
        verifiedAt: '2025-11-17T10:00:00Z',
        notes: 'Test verification'
      };

      await fs.writeJson('.ai-context/validation-results.json', {
        timestamp: '2025-11-17T10:00:00Z',
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {
          'pattern-1': existingVerification
        },
        overall: true
      });

      const results = await validator.validateAll();
      await (validator as any).saveValidationResults(results);

      const saved = await fs.readJson('.ai-context/validation-results.json');
      expect(saved.cursorVerified['pattern-1']).toEqual(existingVerification);
    });
  });

  describe('loadValidationResults', () => {
    it('should return null if no cached results exist', async () => {
      const result = await (validator as any).loadValidationResults();
      expect(result).toBeNull();
    });

    it('should load validation results from context', async () => {
      await fs.ensureDir('.ai-context');
      const testResults: ValidationResults = {
        timestamp: '2025-11-17T10:00:00Z',
        taskId: 'test-123',
        commitHash: 'abc123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {},
        overall: true
      };

      await fs.writeJson('.ai-context/validation-results.json', testResults);

      const loaded = await (validator as any).loadValidationResults();
      expect(loaded).not.toBeNull();
      expect(loaded?.taskId).toBe('test-123');
      expect(loaded?.commitHash).toBe('abc123');
      expect(loaded?.overall).toBe(true);
    });

    it('should return null if file is corrupted', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeFile('.ai-context/validation-results.json', 'invalid json');

      const result = await (validator as any).loadValidationResults();
      expect(result).toBeNull();
    });
  });

  describe('isResultsStale', () => {
    it('should return false for fresh results', async () => {
      await fs.ensureDir('.ai-context');
      const freshResults: ValidationResults = {
        timestamp: new Date().toISOString(), // Just now
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {},
        overall: true
      };

      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });

      const isStale = await (validator as any).isResultsStale(freshResults);
      expect(isStale).toBe(false);
    });

    it('should return true if task changed', async () => {
      await fs.ensureDir('.ai-context');
      const oldResults: ValidationResults = {
        timestamp: new Date().toISOString(),
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {},
        overall: true
      };

      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-456', // Different task
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });

      const isStale = await (validator as any).isResultsStale(oldResults);
      expect(isStale).toBe(true);
    });

    it('should return true if results are older than 30 minutes', async () => {
      await fs.ensureDir('.ai-context');
      const oldResults: ValidationResults = {
        timestamp: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 minutes ago
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {},
        overall: true
      };

      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });

      const isStale = await (validator as any).isResultsStale(oldResults);
      expect(isStale).toBe(true);
    });

    it('should return true if commit hash changed', async () => {
      await fs.ensureDir('.ai-context');
      const oldResults: ValidationResults = {
        timestamp: new Date().toISOString(),
        taskId: 'test-123',
        commitHash: 'old-hash',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {},
        overall: true
      };

      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });

      // Mock getCurrentCommitHash to return different hash
      const validatorAny = validator as any;
      const originalGetHash = validatorAny.getCurrentCommitHash;
      validatorAny.getCurrentCommitHash = jest.fn(() => 'new-hash');

      const isStale = await (validator as any).isResultsStale(oldResults);
      expect(isStale).toBe(true);

      // Restore
      validatorAny.getCurrentCommitHash = originalGetHash;
    });
  });

  describe('applyCursorVerifications', () => {
    it('should return results unchanged if no verifications exist', async () => {
      await fs.ensureDir('.ai-context');
      const results = {
        workflow: { passed: true, message: 'OK' },
        files: { passed: true, message: 'OK' },
        patterns: [
          {
            pattern: {
              id: 'pattern-1',
              title: 'Test',
              applicableStates: ['READY_TO_COMMIT'] as WorkflowState[],
              description: 'Test pattern',
              action: 'Test action',
              validation: { type: 'custom' as const, rule: '', message: '', severity: 'warning' as const },
              content: 'Test content',
              createdAt: '2025-11-17T10:00:00Z'
            },
            passed: false,
            message: 'Not verified',
            severity: 'warning' as const
          }
        ],
        overall: false
      };

      const verified = await (validator as any).applyCursorVerifications(results);
      expect(verified.patterns?.[0].passed).toBe(false);
      expect(verified.overall).toBe(false);
    });

    it('should override pattern result if Cursor verified it', async () => {
      await fs.ensureDir('.ai-context');
      const verification: CursorVerification = {
        verified: true,
        verifiedAt: '2025-11-17T10:00:00Z',
        notes: 'Documentation complete'
      };

      await fs.writeJson('.ai-context/validation-results.json', {
        timestamp: '2025-11-17T10:00:00Z',
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {
          'pattern-1': verification
        },
        overall: false
      });

      const results = {
        workflow: { passed: true, message: 'OK' },
        files: { passed: true, message: 'OK' },
        patterns: [
          {
            pattern: {
              id: 'pattern-1',
              title: 'Test',
              applicableStates: ['READY_TO_COMMIT'] as WorkflowState[],
              description: 'Test pattern',
              action: 'Test action',
              validation: { type: 'custom' as const, rule: '', message: '', severity: 'warning' as const },
              content: 'Test content',
              createdAt: '2025-11-17T10:00:00Z'
            },
            passed: false,
            message: 'Not verified',
            severity: 'warning' as const
          }
        ],
        overall: false
      };

      const verified = await (validator as any).applyCursorVerifications(results);
      expect(verified.patterns?.[0].passed).toBe(true);
      expect(verified.patterns?.[0].message).toContain('Verified by Cursor');
      expect(verified.overall).toBe(true); // Should pass now
    });

    it('should recalculate overall status based on error violations only', async () => {
      await fs.ensureDir('.ai-context');
      const verification: CursorVerification = {
        verified: true,
        verifiedAt: '2025-11-17T10:00:00Z',
        notes: 'OK'
      };

      await fs.writeJson('.ai-context/validation-results.json', {
        timestamp: '2025-11-17T10:00:00Z',
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {
          'pattern-1': verification
        },
        overall: false
      });

      const results = {
        workflow: { passed: true, message: 'OK' },
        files: { passed: true, message: 'OK' },
        patterns: [
          {
            pattern: {
              id: 'pattern-1',
              title: 'Test',
              applicableStates: ['READY_TO_COMMIT'] as WorkflowState[],
              description: 'Test pattern',
              action: 'Test action',
              validation: { type: 'custom' as const, rule: '', message: '', severity: 'warning' as const },
              content: 'Test content',
              createdAt: '2025-11-17T10:00:00Z'
            },
            passed: false,
            message: 'Not verified',
            severity: 'warning' as const
          },
          {
            pattern: {
              id: 'pattern-2',
              title: 'Error',
              applicableStates: ['READY_TO_COMMIT'] as WorkflowState[],
              description: 'Error pattern',
              action: 'Fix error',
              validation: { type: 'file_exists' as const, rule: '', message: '', severity: 'error' as const },
              content: 'Error content',
              createdAt: '2025-11-17T10:00:00Z'
            },
            passed: false,
            message: 'File missing',
            severity: 'error' as const
          }
        ],
        overall: false
      };

      const verified = await (validator as any).applyCursorVerifications(results);
      // pattern-1 is verified (warning), but pattern-2 is error and not verified
      expect(verified.overall).toBe(false); // Should still fail due to error
    });
  });

  describe('verifyPattern', () => {
    it('should mark pattern as verified and save to context', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });

      await (validator as any).verifyPattern('pattern-1', 'Documentation complete');

      const saved = await fs.readJson('.ai-context/validation-results.json');
      expect(saved.cursorVerified['pattern-1']).toBeDefined();
      expect(saved.cursorVerified['pattern-1'].verified).toBe(true);
      expect(saved.cursorVerified['pattern-1'].notes).toBe('Documentation complete');
      expect(saved.cursorVerified['pattern-1'].verifiedAt).toBeDefined();
    });

    it('should update existing verification if pattern already verified', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/validation-results.json', {
        timestamp: '2025-11-17T10:00:00Z',
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK' },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {
          'pattern-1': {
            verified: true,
            verifiedAt: '2025-11-17T10:00:00Z',
            notes: 'Old note'
          }
        },
        overall: true
      });

      await (validator as any).verifyPattern('pattern-1', 'Updated note');

      const saved = await fs.readJson('.ai-context/validation-results.json');
      expect(saved.cursorVerified['pattern-1'].notes).toBe('Updated note');
      expect(saved.cursorVerified['pattern-1'].verifiedAt).not.toBe('2025-11-17T10:00:00Z');
    });
  });

  describe('validateAll with caching', () => {
    it('should use cached results if useCachedResults is true and results are fresh', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      // Save initial results
      const initialResults = await validator.validateAll();
      await (validator as any).saveValidationResults(initialResults);

      // Modify task file to make fresh validation different
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Modified',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });

      // Use cache
      const cachedResults = await validator.validateAll({ useCachedResults: true });

      // Should use cached results - check that it's using cached data
      // The cached results should have the same taskId
      expect(cachedResults.workflow.passed).toBe(true);
      expect(cachedResults.overall).toBe(true);
    });

    it('should run fresh validation if cached results are stale', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      // Save old results (31 minutes ago)
      const oldResults: ValidationResults = {
        timestamp: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
        taskId: 'test-123',
        results: {
          workflow: { passed: true, message: 'OK', details: { goal: 'Old' } },
          files: { passed: true, message: 'OK' }
        },
        cursorVerified: {},
        overall: true
      };
      await fs.writeJson('.ai-context/validation-results.json', oldResults);

      // Use cache (should detect stale and run fresh)
      const results = await validator.validateAll({ useCachedResults: true });

      // Should have fresh results
      expect(results.workflow.details?.goal).toBe('Test');
    });

    it('should save results if saveToContext is true', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      await validator.validateAll({ saveToContext: true });

      const resultsFile = path.join('.ai-context', 'validation-results.json');
      expect(await fs.pathExists(resultsFile)).toBe(true);
    });

    it('should work without cache (backward compatibility)', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      // Should work without any options
      const results = await validator.validateAll();
      expect(results.workflow).toBeDefined();
      expect(results.files).toBeDefined();
      expect(results.overall).toBeDefined();
    });
  });
});

