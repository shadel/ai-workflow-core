/**
 * Unit tests for TaskQueueManager.completeTask() method
 * @requirement FREE-TIER-001 - Task Queue Management
 */

import { TaskQueueManager, Task } from '../../src/core/task-queue.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskQueueManager.completeTask()', () => {
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

  describe('Completing active task', () => {
    it('should mark task as DONE', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      const result = await manager.completeTask(task.id);

      expect(result.completed.status).toBe('DONE');
      expect(result.completed.completedAt).toBeDefined();
    });

    it('should calculate actual time', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await manager.completeTask(task.id);

      expect(result.completed.actualTime).toBeDefined();
      expect(result.completed.actualTime).toBeGreaterThan(0);
      expect(result.completed.actualTime).toBeLessThan(1); // Should be less than 1 hour for this test
    });

    it('should clear activeTaskId', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      await manager.completeTask(task.id);

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.activeTaskId).toBeNull();
    });
  });

  describe('Auto-activation of next task', () => {
    it('should auto-activate next QUEUED task', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      const result = await manager.completeTask(task1.id);

      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task2.id);
      expect(result.nextActive?.status).toBe('ACTIVE');
    });

    it('should not activate next task if no queued tasks', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      const result = await manager.completeTask(task.id);

      expect(result.nextActive).toBeUndefined();
    });

    it('should activate highest priority task first', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid', {
        priority: 'LOW'
      });
      const task3 = await manager.createTask('Third task with enough characters to be valid', {
        priority: 'CRITICAL'
      });

      const result = await manager.completeTask(task1.id);

      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task3.id); // CRITICAL should be activated first
      expect(result.nextActive?.priority).toBe('CRITICAL');
    });

    it('should activate oldest task if same priority', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid', {
        priority: 'HIGH'
      });
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      const task3 = await manager.createTask('Third task with enough characters to be valid', {
        priority: 'HIGH'
      });

      const result = await manager.completeTask(task1.id);

      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task2.id); // Older task should be activated first
    });
  });

  describe('Error handling', () => {
    it('should throw error if task not found', async () => {
      await expect(
        manager.completeTask('task-nonexistent')
      ).rejects.toThrow('Task not found: task-nonexistent');
    });

    it('should throw error if task is not active', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      await expect(
        manager.completeTask(task2.id) // task2 is QUEUED, not ACTIVE
      ).rejects.toThrow(`Task is not active: ${task2.id}`);
    });
  });

  describe('Workflow initialization for next task', () => {
    it('should initialize workflow for next task if not exists', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Remove workflow from task2
      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const queuedTask = queue.tasks.find((t: Task) => t.id === task2.id);
      delete queuedTask.workflow;
      await fs.writeJson(path.join(tempDir, 'tasks.json'), queue, { spaces: 2 });

      const result = await manager.completeTask(task1.id);

      expect(result.nextActive?.workflow).toBeDefined();
      expect(result.nextActive?.workflow?.currentState).toBe('UNDERSTANDING');
    });
  });

  describe('Metadata update', () => {
    it('should update metadata after completion', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      await manager.completeTask(task1.id);

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.metadata.completedCount).toBe(1);
      expect(queue.metadata.activeCount).toBe(1); // Next task auto-activated
      expect(queue.metadata.queuedCount).toBe(0);
    });
  });

  describe('Auto-activate configuration control', () => {
    let projectRoot: string;
    let configPath: string;

    beforeEach(() => {
      // Resolve project root: tempDir is contextDir (.ai-context), project root is parent
      projectRoot = path.dirname(tempDir);
      configPath = path.join(projectRoot, 'config', 'ai-workflow.config.json');
    });

    it('should auto-activate when config file does not exist (default = true)', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Ensure config file does not exist
      if (await fs.pathExists(configPath)) {
        await fs.remove(configPath);
      }

      const result = await manager.completeTask(task1.id);

      // Default behavior: should auto-activate
      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task2.id);
      expect(result.nextActive?.status).toBe('ACTIVE');
    });

    it('should auto-activate when config sets autoActivateNext = true', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Create config file with autoActivateNext = true
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, {
        autoActions: {
          task: {
            complete: {
              autoActivateNext: true
            }
          }
        }
      });

      const result = await manager.completeTask(task1.id);

      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task2.id);
      expect(result.nextActive?.status).toBe('ACTIVE');
    });

    it('should skip auto-activate when config sets autoActivateNext = false', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Create config file with autoActivateNext = false
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, {
        autoActions: {
          task: {
            complete: {
              autoActivateNext: false
            }
          }
        }
      });

      const result = await manager.completeTask(task1.id);

      // Should NOT auto-activate
      expect(result.nextActive).toBeUndefined();
      
      // Verify task2 is still QUEUED
      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const queuedTask = queue.tasks.find((t: Task) => t.id === task2.id);
      expect(queuedTask.status).toBe('QUEUED');
      expect(queue.activeTaskId).toBeNull();
    });

    it('should use default (true) when config field is missing', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Create config file without autoActivateNext field
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, {
        autoActions: {
          task: {
            complete: {
              autoMarkRequirementDone: false
            }
          }
        }
      });

      const result = await manager.completeTask(task1.id);

      // Default should be true
      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task2.id);
    });

    it('should allow CLI option to override config (force activate)', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Create config file with autoActivateNext = false
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, {
        autoActions: {
          task: {
            complete: {
              autoActivateNext: false
            }
          }
        }
      });

      // CLI option should override config
      const result = await manager.completeTask(task1.id, { autoActivateNext: true });

      // Should auto-activate despite config = false
      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task2.id);
    });

    it('should allow CLI option to override config (skip activate)', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Create config file with autoActivateNext = true
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, {
        autoActions: {
          task: {
            complete: {
              autoActivateNext: true
            }
          }
        }
      });

      // CLI option should override config
      const result = await manager.completeTask(task1.id, { autoActivateNext: false });

      // Should NOT auto-activate despite config = true
      expect(result.nextActive).toBeUndefined();
      
      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.activeTaskId).toBeNull();
    });
  });
});

