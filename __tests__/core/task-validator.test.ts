/**
 * Unit tests for TaskValidator
 * @requirement REQ-V2-003 - Task validation tests
 */

import { TaskValidator, type ValidationResult } from '../../src/core/task-validator.js';
import type { Task as QueueTask } from '../../src/core/task-queue.js';
import type { TaskFileData } from '../../src/core/task-file-sync.js';
import { WorkflowState } from '@shadel/workflow-core';

describe('TaskValidator', () => {
  let validator: TaskValidator;

  beforeEach(() => {
    validator = new TaskValidator();
  });

  describe('validateStateTransition()', () => {
    it('should allow valid state transitions', async () => {
      await expect(
        validator.validateStateTransition('UNDERSTANDING', 'DESIGNING')
      ).resolves.not.toThrow();

      await expect(
        validator.validateStateTransition('DESIGNING', 'IMPLEMENTING')
      ).resolves.not.toThrow();

      await expect(
        validator.validateStateTransition('IMPLEMENTING', 'TESTING')
      ).resolves.not.toThrow();

      await expect(
        validator.validateStateTransition('TESTING', 'REVIEWING')
      ).resolves.not.toThrow();

      await expect(
        validator.validateStateTransition('REVIEWING', 'READY_TO_COMMIT')
      ).resolves.not.toThrow();
    });

    it('should reject invalid state transitions', async () => {
      await expect(
        validator.validateStateTransition('UNDERSTANDING', 'IMPLEMENTING')
      ).rejects.toThrow('Invalid state transition');

      await expect(
        validator.validateStateTransition('DESIGNING', 'UNDERSTANDING')
      ).rejects.toThrow('Invalid state transition');

      await expect(
        validator.validateStateTransition('TESTING', 'DESIGNING')
      ).rejects.toThrow('Invalid state transition');
    });

    it('should reject transitions from READY_TO_COMMIT', async () => {
      await expect(
        validator.validateStateTransition('READY_TO_COMMIT', 'UNDERSTANDING')
      ).rejects.toThrow('Invalid state transition');
    });
  });

  describe('validateStateHistory()', () => {
    it('should validate correct state history', async () => {
      const task: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'DESIGNING',
          stateEnteredAt: '2025-01-01T01:00:00Z',
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' }
          ]
        }
      };

      const result = await validator.validateStateHistory(task);
      expect(result.valid).toBe(true);
    });

    it('should detect state regression', async () => {
      const task: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING', // Regression from DESIGNING
          stateEnteredAt: '2025-01-01T02:00:00Z',
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' },
            { state: 'DESIGNING', enteredAt: '2025-01-01T01:00:00Z' }
          ]
        }
      };

      const result = await validator.validateStateHistory(task);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('State regression');
    });

    it('should detect state skip', async () => {
      const task: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'IMPLEMENTING', // Skipped DESIGNING
          stateEnteredAt: '2025-01-01T01:00:00Z',
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' }
          ]
        }
      };

      const result = await validator.validateStateHistory(task);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('State skip');
    });

    it('should validate empty history', async () => {
      const task: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      const result = await validator.validateStateHistory(task);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBoth()', () => {
    it('should validate consistent queue and file data', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'DESIGNING',
          stateEnteredAt: '2025-01-01T01:00:00Z',
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' }
          ]
        }
      };

      const fileData: TaskFileData = {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'DESIGNING',
          stateEnteredAt: '2025-01-01T01:00:00Z',
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' }
          ]
        }
      };

      const result = await validator.validateBoth(queueTask, fileData);
      expect(result.valid).toBe(true);
    });

    it('should detect state inconsistency', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'DESIGNING',
          stateEnteredAt: '2025-01-01T01:00:00Z',
          stateHistory: []
        }
      };

      const fileData: TaskFileData = {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'IMPLEMENTING', // Different from queue
          stateEnteredAt: '2025-01-01T02:00:00Z',
          stateHistory: []
        }
      };

      const result = await validator.validateBoth(queueTask, fileData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('State inconsistency');
    });

    it('should detect taskId inconsistency', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      const fileData: TaskFileData = {
        taskId: 'task-456', // Different from queue
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      const result = await validator.validateBoth(queueTask, fileData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('TaskId inconsistency');
    });
  });

  describe('getValidTransitions()', () => {
    it('should return valid transitions for a state', () => {
      const transitions = validator.getValidTransitions('UNDERSTANDING');
      expect(transitions).toEqual(['DESIGNING']);

      const transitions2 = validator.getValidTransitions('DESIGNING');
      expect(transitions2).toEqual(['IMPLEMENTING']);

      const transitions3 = validator.getValidTransitions('READY_TO_COMMIT');
      expect(transitions3).toEqual([]);
    });
  });
});


