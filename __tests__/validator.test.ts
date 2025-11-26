/**
 * Unit tests for Validator
 * @requirement REQ-V2-003 - Validation command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { Validator } from '../src/core/validator.js';
import { getUniqueAIContextDir, cleanupWithRetry } from './test-helpers';

describe('Validator', () => {
  let testContextDir: string;
  let validator: Validator;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    // Ensure directory exists (don't remove - it's unique and doesn't exist yet)
    await fs.ensureDir(testContextDir);
    // Create validator with unique context directory
    validator = new Validator(testContextDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('validateWorkflow', () => {
    it('should fail when no task file exists', async () => {
      // @requirement REQ-V2-003 - Task existence validation
      const result = await validator.validateWorkflow();
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('No active task');
    });

    it('should fail when task has no workflow state', async () => {
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test'
        // No workflow property
      });

      const result = await validator.validateWorkflow();
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('no workflow state');
    });

    it('should fail for invalid workflow state', async () => {
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: {
          currentState: 'INVALID_STATE'
        }
      });

      const result = await validator.validateWorkflow();
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Invalid workflow state');
    });

    it('should pass for valid workflow state', async () => {
      // @requirement REQ-V2-003 - Valid state check
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test task',
        workflow: {
          currentState: 'UNDERSTANDING'
        }
      });

      const result = await validator.validateWorkflow();
      
      expect(result.passed).toBe(true);
      expect(result.message).toContain('valid');
      expect(result.details?.currentState).toBe('UNDERSTANDING');
    });

    // OPTIMIZED: Use test.each for parameterized tests - reduces setup overhead
    it.each([
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ])('should pass for valid state: %s', async (state) => {
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: state }
      });

      const result = await validator.validateWorkflow();
      expect(result.passed).toBe(true);
      expect(result.details?.currentState).toBe(state);
      
      await fs.remove(testContextDir);
    });
  });

  describe('validateFiles', () => {
    it('should fail when context files missing', async () => {
      // @requirement REQ-V2-003 - Required files validation
      const result = await validator.validateFiles();
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('missing');
      expect(result.details?.missingFiles).toBeDefined();
    });

    it('should pass when all required files exist', async () => {
      await fs.ensureDir(testContextDir);
      await fs.writeFile(`${testContextDir}/current-task.json`, '{}');
      await fs.writeFile(`${testContextDir}/STATUS.txt`, 'test');
      await fs.writeFile(`${testContextDir}/NEXT_STEPS.md`, 'test');

      const result = await validator.validateFiles();
      
      expect(result.passed).toBe(true);
      expect(result.message).toContain('present');
    });
  });

  describe('validateAll', () => {
    it('should return false overall when workflow fails', async () => {
      // @requirement REQ-V2-003 - Complete validation
      const results = await validator.validateAll();
      
      expect(results.overall).toBe(false);
      expect(results.workflow.passed).toBe(false);
    });

    it('should return true overall when all validations pass', async () => {
      // Setup valid state at READY_TO_COMMIT (required for overall pass)
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }  // Must be READY_TO_COMMIT for overall=true
      });
      await fs.writeFile(`${testContextDir}/STATUS.txt`, 'test');
      await fs.writeFile(`${testContextDir}/NEXT_STEPS.md`, 'test');

      const results = await validator.validateAll();
      
      expect(results.overall).toBe(true);
      expect(results.workflow.passed).toBe(true);
      expect(results.files.passed).toBe(true);
    });
  });

  describe('isReadyToCommit', () => {
    it('should return false when validation fails', async () => {
      // @requirement REQ-V2-003 - Commit readiness
      const ready = await validator.isReadyToCommit();
      expect(ready).toBe(false);
    });

    it('should return false when not at READY_TO_COMMIT state', async () => {
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'UNDERSTANDING' }
      });
      await fs.writeFile(`${testContextDir}/STATUS.txt`, 'test');
      await fs.writeFile(`${testContextDir}/NEXT_STEPS.md`, 'test');

      const ready = await validator.isReadyToCommit();
      expect(ready).toBe(false);
    });

    it('should return true when at READY_TO_COMMIT state', async () => {
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'READY_TO_COMMIT' }
      });
      await fs.writeFile(`${testContextDir}/STATUS.txt`, 'test');
      await fs.writeFile(`${testContextDir}/NEXT_STEPS.md`, 'test');

      const ready = await validator.isReadyToCommit();
      expect(ready).toBe(true);
    });
  });
});

