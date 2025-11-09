/**
 * Unit tests for Validator
 * @requirement REQ-V2-003 - Validation command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { Validator } from '../src/core/validator.js';

describe('Validator', () => {
  const testContextDir = '.test-ai-context-validator';
  let validator: Validator;

  beforeEach(async () => {
    validator = new Validator();
    await fs.remove(testContextDir);
    await fs.remove('.ai-context');
  });

  afterEach(async () => {
    await fs.remove(testContextDir);
    await fs.remove('.ai-context');
  });

  describe('validateWorkflow', () => {
    it('should fail when no task file exists', async () => {
      // @requirement REQ-V2-003 - Task existence validation
      const result = await validator.validateWorkflow();
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('No active task');
    });

    it('should fail when task has no workflow state', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test'
        // No workflow property
      });

      const result = await validator.validateWorkflow();
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('no workflow state');
    });

    it('should fail for invalid workflow state', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
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
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
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

    it('should pass for all valid states', async () => {
      const validStates = [
        'UNDERSTANDING',
        'DESIGN_COMPLETE',
        'IMPLEMENTATION_COMPLETE',
        'TESTING_COMPLETE',
        'REVIEW_COMPLETE',
        'COMMIT_READY'
      ];

      for (const state of validStates) {
        await fs.ensureDir('.ai-context');
        await fs.writeJson('.ai-context/current-task.json', {
          taskId: 'test-123',
          originalGoal: 'Test',
          workflow: { currentState: state }
        });

        const result = await validator.validateWorkflow();
        expect(result.passed).toBe(true);
        
        await fs.remove('.ai-context');
      }
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
      await fs.ensureDir('.ai-context');
      await fs.writeFile('.ai-context/current-task.json', '{}');
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

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
      // Setup valid state
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'DESIGN_COMPLETE' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

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

    it('should return false when not at COMMIT_READY state', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'UNDERSTANDING' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      const ready = await validator.isReadyToCommit();
      expect(ready).toBe(false);
    });

    it('should return true when at COMMIT_READY state', async () => {
      await fs.ensureDir('.ai-context');
      await fs.writeJson('.ai-context/current-task.json', {
        taskId: 'test-123',
        originalGoal: 'Test',
        workflow: { currentState: 'COMMIT_READY' }
      });
      await fs.writeFile('.ai-context/STATUS.txt', 'test');
      await fs.writeFile('.ai-context/NEXT_STEPS.md', 'test');

      const ready = await validator.isReadyToCommit();
      expect(ready).toBe(true);
    });
  });
});

