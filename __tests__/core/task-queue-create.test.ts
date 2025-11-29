/**
 * Unit tests for TaskQueueManager.createTask() method
 * @requirement FREE-TIER-001 - Task Queue Management
 */

import { TaskQueueManager, Task } from '../../src/core/task-queue.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskQueueManager.createTask()', () => {
  let tempDir: string;
  let manager: TaskQueueManager;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    tempDir = getUniqueAIContextDir();
    testDirs.push(tempDir); // Track for cleanup
    // Ensure directory exists before creating manager
    await fs.ensureDir(tempDir);
    manager = new TaskQueueManager(tempDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('Creating first task (becomes ACTIVE)', () => {
    it('should create first task as ACTIVE when no active task exists', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      expect(task).toBeDefined();
      expect(task.status).toBe('ACTIVE');
      expect(task.goal).toBe('This is a valid task goal with enough characters');
      expect(task.id).toMatch(/^task-\d+$/);
      expect(task.priority).toBe('MEDIUM');
      expect(task.createdAt).toBeDefined();
      expect(task.activatedAt).toBeDefined();
      expect(task.workflow).toBeDefined();
      expect(task.workflow?.currentState).toBe('UNDERSTANDING');
    });

    it('should set activeTaskId when creating first task', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.activeTaskId).toBe(task.id);
    });

    it('should initialize workflow for ACTIVE task', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      expect(task.workflow).toBeDefined();
      expect(task.workflow?.currentState).toBe('UNDERSTANDING');
      expect(task.workflow?.stateEnteredAt).toBeDefined();
      expect(task.workflow?.stateHistory).toEqual([]);
    });
  });

  describe('Creating task when active exists (becomes QUEUED)', () => {
    it('should create second task as QUEUED when active task exists', async () => {
      // Create first task (becomes ACTIVE)
      const firstTask = await manager.createTask('First task with enough characters to be valid');
      
      // Create second task (should be QUEUED)
      const secondTask = await manager.createTask('Second task with enough characters to be valid');

      expect(firstTask.status).toBe('ACTIVE');
      expect(secondTask.status).toBe('QUEUED');
      expect(secondTask.activatedAt).toBeUndefined();
      expect(secondTask.workflow).toBeUndefined();
    });

    it('should not change activeTaskId when creating queued task', async () => {
      const firstTask = await manager.createTask('First task with enough characters to be valid');
      await manager.createTask('Second task with enough characters to be valid');

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.activeTaskId).toBe(firstTask.id);
    });
  });

  describe('Goal validation', () => {
    it('should throw error for goal too short', async () => {
      await expect(
        manager.createTask('short')
      ).rejects.toThrow('at least 10 characters');
    });

    it('should throw error for empty goal', async () => {
      await expect(
        manager.createTask('')
      ).rejects.toThrow();
    });

    it('should throw error for goal with only whitespace', async () => {
      await expect(
        manager.createTask('   ')
      ).rejects.toThrow('at least 10 characters');
    });

    it('should throw error for goal too long', async () => {
      const longGoal = 'a'.repeat(501);
      await expect(
        manager.createTask(longGoal)
      ).rejects.toThrow('Task goal must be less than 500 characters');
    });

    it('should accept goal with exactly 10 characters', async () => {
      const task = await manager.createTask('1234567890');
      expect(task.goal).toBe('1234567890');
    });

    it('should accept goal with exactly 500 characters', async () => {
      const goal = 'a'.repeat(500);
      const task = await manager.createTask(goal);
      expect(task.goal).toBe(goal);
    });

    it('should trim whitespace from goal', async () => {
      const task = await manager.createTask('  This is a valid task goal with enough characters  ');
      expect(task.goal).toBe('This is a valid task goal with enough characters');
    });
  });

  describe('Task ID generation', () => {
    it('should generate unique task IDs', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      expect(task1.id).not.toBe(task2.id);
      expect(task1.id).toMatch(/^task-\d+$/);
      expect(task2.id).toMatch(/^task-\d+$/);
    });

    it('should generate task ID with timestamp format', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');
      const timestamp = parseInt(task.id.replace('task-', ''));
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Priority handling', () => {
    it('should use MEDIUM as default priority', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');
      expect(task.priority).toBe('MEDIUM');
    });

    it('should accept custom priority', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters', {
        priority: 'CRITICAL'
      });
      expect(task.priority).toBe('CRITICAL');
    });

    it('should accept all priority levels', async () => {
      const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
      
      for (const priority of priorities) {
        const task = await manager.createTask(
          `Task with ${priority} priority and enough characters`,
          { priority }
        );
        expect(task.priority).toBe(priority);
      }
    });
  });

  describe('Tags handling', () => {
    it('should use empty array as default tags', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');
      expect(task.tags).toEqual([]);
    });

    it('should accept custom tags', async () => {
      const tags = ['feature', 'backend', 'api'];
      const task = await manager.createTask('This is a valid task goal with enough characters', {
        tags
      });
      expect(task.tags).toEqual(tags);
    });
  });

  describe('Estimated time handling', () => {
    it('should not set estimatedTime by default', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');
      expect(task.estimatedTime).toBeUndefined();
    });

    it('should accept estimatedTime', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters', {
        estimatedTime: '2 days'
      });
      expect(task.estimatedTime).toBe('2 days');
    });
  });

  describe('Metadata update', () => {
    it('should update metadata after creating task', async () => {
      await manager.createTask('This is a valid task goal with enough characters');

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.metadata.totalTasks).toBe(1);
      expect(queue.metadata.activeCount).toBe(1);
      expect(queue.metadata.queuedCount).toBe(0);
      expect(queue.metadata.lastUpdated).toBeDefined();
    });

    it('should update metadata correctly for queued task', async () => {
      await manager.createTask('First task with enough characters to be valid');
      await manager.createTask('Second task with enough characters to be valid');

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.metadata.totalTasks).toBe(2);
      expect(queue.metadata.activeCount).toBe(1);
      expect(queue.metadata.queuedCount).toBe(1);
    });
  });

  describe('File saving', () => {
    it('should save task to file', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.tasks).toHaveLength(1);
      expect(queue.tasks[0].id).toBe(task.id);
      expect(queue.tasks[0].goal).toBe(task.goal);
    });

    it('should persist multiple tasks', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.tasks).toHaveLength(2);
      expect(queue.tasks.map((t: Task) => t.id)).toContain(task1.id);
      expect(queue.tasks.map((t: Task) => t.id)).toContain(task2.id);
    });
  });
});

