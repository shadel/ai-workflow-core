/**
 * Unit tests for TaskQueue data structures and type definitions
 * @requirement FREE-TIER-001 - Task Queue Management
 */

import {
  Task,
  TaskStatus,
  Priority,
  TaskQueue,
  WorkflowProgress,
  isTaskStatus,
  isPriority,
  validateTask,
  validateTaskQueue
} from '../../src/core/task-queue.js';
import { WorkflowState } from '@shadel/workflow-core';

describe('TaskQueue Types and Interfaces', () => {
  describe('Type Guards', () => {
    describe('isTaskStatus', () => {
      it('should return true for valid TaskStatus values', () => {
        expect(isTaskStatus('QUEUED')).toBe(true);
        expect(isTaskStatus('ACTIVE')).toBe(true);
        expect(isTaskStatus('DONE')).toBe(true);
        expect(isTaskStatus('ARCHIVED')).toBe(true);
      });

      it('should return false for invalid values', () => {
        expect(isTaskStatus('INVALID')).toBe(false);
        expect(isTaskStatus('')).toBe(false);
        expect(isTaskStatus('queued')).toBe(false); // case sensitive
        expect(isTaskStatus(123 as any)).toBe(false);
      });
    });

    describe('isPriority', () => {
      it('should return true for valid Priority values', () => {
        expect(isPriority('CRITICAL')).toBe(true);
        expect(isPriority('HIGH')).toBe(true);
        expect(isPriority('MEDIUM')).toBe(true);
        expect(isPriority('LOW')).toBe(true);
      });

      it('should return false for invalid values', () => {
        expect(isPriority('INVALID')).toBe(false);
        expect(isPriority('')).toBe(false);
        expect(isPriority('critical')).toBe(false); // case sensitive
        expect(isPriority(123 as any)).toBe(false);
      });
    });
  });

  describe('validateTask', () => {
    it('should validate correct Task structure', () => {
      const validTask: Task = {
        id: 'task-1234567890',
        goal: 'This is a valid task goal with enough characters',
        status: 'ACTIVE',
        priority: 'HIGH',
        createdAt: '2025-11-17T09:00:00.000Z',
        workflow: {
          currentState: 'IMPLEMENTING',
          stateEnteredAt: '2025-11-17T09:00:00.000Z',
          stateHistory: []
        }
      };

      expect(validateTask(validTask)).toBe(true);
    });

    it('should reject task with invalid id', () => {
      const invalidTask = {
        id: 'invalid-id',
        goal: 'This is a valid task goal with enough characters',
        status: 'ACTIVE',
        createdAt: '2025-11-17T09:00:00.000Z'
      };

      expect(validateTask(invalidTask)).toBe(false);
    });

    it('should reject task with goal too short', () => {
      const invalidTask = {
        id: 'task-1234567890',
        goal: 'short',
        status: 'ACTIVE',
        createdAt: '2025-11-17T09:00:00.000Z'
      };

      expect(validateTask(invalidTask)).toBe(false);
    });

    it('should reject task with goal too long', () => {
      const invalidTask = {
        id: 'task-1234567890',
        goal: 'a'.repeat(501), // 501 characters
        status: 'ACTIVE',
        createdAt: '2025-11-17T09:00:00.000Z'
      };

      expect(validateTask(invalidTask)).toBe(false);
    });

    it('should reject task with invalid status', () => {
      const invalidTask = {
        id: 'task-1234567890',
        goal: 'This is a valid task goal with enough characters',
        status: 'INVALID',
        createdAt: '2025-11-17T09:00:00.000Z'
      };

      expect(validateTask(invalidTask)).toBe(false);
    });

    it('should reject task with invalid priority', () => {
      const invalidTask = {
        id: 'task-1234567890',
        goal: 'This is a valid task goal with enough characters',
        status: 'ACTIVE',
        priority: 'INVALID',
        createdAt: '2025-11-17T09:00:00.000Z'
      };

      expect(validateTask(invalidTask)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateTask(null)).toBe(false);
      expect(validateTask(undefined)).toBe(false);
    });

    it('should accept task with optional fields', () => {
      const taskWithOptionals: Task = {
        id: 'task-1234567890',
        goal: 'This is a valid task goal with enough characters',
        status: 'QUEUED',
        priority: 'MEDIUM',
        tags: ['feature', 'backend'],
        createdAt: '2025-11-17T09:00:00.000Z',
        activatedAt: '2025-11-17T10:00:00.000Z',
        completedAt: '2025-11-17T12:00:00.000Z',
        estimatedTime: '2 days',
        actualTime: 16.5,
        workflow: {
          currentState: 'TESTING',
          stateEnteredAt: '2025-11-17T10:00:00.000Z',
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-11-17T09:00:00.000Z' },
            { state: 'DESIGNING', enteredAt: '2025-11-17T09:30:00.000Z' }
          ]
        }
      };

      expect(validateTask(taskWithOptionals)).toBe(true);
    });
  });

  describe('validateTaskQueue', () => {
    it('should validate correct TaskQueue structure', () => {
      const validQueue: TaskQueue = {
        tasks: [
          {
            id: 'task-1234567890',
            goal: 'This is a valid task goal with enough characters',
            status: 'ACTIVE',
            createdAt: '2025-11-17T09:00:00.000Z'
          }
        ],
        activeTaskId: 'task-1234567890',
        metadata: {
          totalTasks: 1,
          queuedCount: 0,
          activeCount: 1,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: '2025-11-17T09:00:00.000Z'
        }
      };

      expect(validateTaskQueue(validQueue)).toBe(true);
    });

    it('should validate empty queue', () => {
      const emptyQueue: TaskQueue = {
        tasks: [],
        activeTaskId: null,
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: '2025-11-17T09:00:00.000Z'
        }
      };

      expect(validateTaskQueue(emptyQueue)).toBe(true);
    });

    it('should reject queue with invalid tasks array', () => {
      const invalidQueue = {
        tasks: 'not-an-array',
        activeTaskId: null,
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: '2025-11-17T09:00:00.000Z'
        }
      };

      expect(validateTaskQueue(invalidQueue)).toBe(false);
    });

    it('should reject queue with invalid activeTaskId type', () => {
      const invalidQueue = {
        tasks: [],
        activeTaskId: 123, // should be string or null
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: '2025-11-17T09:00:00.000Z'
        }
      };

      expect(validateTaskQueue(invalidQueue)).toBe(false);
    });

    it('should reject queue with missing metadata', () => {
      const invalidQueue = {
        tasks: [],
        activeTaskId: null
        // missing metadata
      };

      expect(validateTaskQueue(invalidQueue)).toBe(false);
    });

    it('should reject queue with invalid metadata.totalTasks', () => {
      const invalidQueue = {
        tasks: [],
        activeTaskId: null,
        metadata: {
          totalTasks: 'not-a-number',
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: '2025-11-17T09:00:00.000Z'
        }
      };

      expect(validateTaskQueue(invalidQueue)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateTaskQueue(null)).toBe(false);
      expect(validateTaskQueue(undefined)).toBe(false);
    });
  });

  describe('Type Definitions', () => {
    it('should have correct TaskStatus type values', () => {
      const statuses: TaskStatus[] = ['QUEUED', 'ACTIVE', 'DONE', 'ARCHIVED'];
      statuses.forEach(status => {
        expect(isTaskStatus(status)).toBe(true);
      });
    });

    it('should have correct Priority type values', () => {
      const priorities: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      priorities.forEach(priority => {
        expect(isPriority(priority)).toBe(true);
      });
    });

    it('should allow WorkflowProgress with valid WorkflowState', () => {
      const workflow: WorkflowProgress = {
        currentState: 'IMPLEMENTING',
        stateEnteredAt: '2025-11-17T09:00:00.000Z',
        stateHistory: [
          { state: 'UNDERSTANDING', enteredAt: '2025-11-17T08:00:00.000Z' },
          { state: 'DESIGNING', enteredAt: '2025-11-17T08:30:00.000Z' }
        ]
      };

      expect(workflow.currentState).toBe('IMPLEMENTING');
      expect(workflow.stateHistory.length).toBe(2);
    });
  });
});

