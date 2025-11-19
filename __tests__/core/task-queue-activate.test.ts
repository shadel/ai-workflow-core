/**
 * Unit tests for TaskQueueManager.activateTask() method
 * @requirement FREE-TIER-001 - Task Queue Management
 */

import { TaskQueueManager, Task } from '../../src/core/task-queue.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('TaskQueueManager.activateTask()', () => {
  let tempDir: string;
  let manager: TaskQueueManager;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `task-queue-test-${Date.now()}`);
    manager = new TaskQueueManager(tempDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Activating queued task', () => {
    it('should activate queued task', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      expect(task1.status).toBe('ACTIVE');
      expect(task2.status).toBe('QUEUED');

      const activated = await manager.activateTask(task2.id);

      expect(activated.status).toBe('ACTIVE');
      expect(activated.id).toBe(task2.id);
      expect(activated.activatedAt).toBeDefined();
    });

    it('should deactivate previous active task', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      await manager.activateTask(task2.id);

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const deactivatedTask = queue.tasks.find((t: Task) => t.id === task1.id);
      expect(deactivatedTask.status).toBe('QUEUED');
    });

    it('should preserve workflow state when deactivating', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Simulate workflow state
      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const activeTask = queue.tasks.find((t: Task) => t.id === task1.id);
      activeTask.workflow = {
        currentState: 'IMPLEMENTING',
        stateEnteredAt: new Date().toISOString(),
        stateHistory: [
          { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
          { state: 'DESIGNING', enteredAt: new Date().toISOString() }
        ]
      };
      await fs.writeJson(path.join(tempDir, 'tasks.json'), queue, { spaces: 2 });

      await manager.activateTask(task2.id);

      const updatedQueue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const deactivatedTask = updatedQueue.tasks.find((t: Task) => t.id === task1.id);
      expect(deactivatedTask.workflow).toBeDefined();
      expect(deactivatedTask.workflow.currentState).toBe('IMPLEMENTING');
      expect(deactivatedTask.workflow.stateHistory).toHaveLength(2);
    });

    it('should update activeTaskId', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      await manager.activateTask(task2.id);

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.activeTaskId).toBe(task2.id);
    });
  });

  describe('Activating already active task', () => {
    it('should return task without changes if already active', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      const result = await manager.activateTask(task.id);

      expect(result.id).toBe(task.id);
      expect(result.status).toBe('ACTIVE');
    });

    it('should not change activeTaskId if task already active', async () => {
      const task = await manager.createTask('This is a valid task goal with enough characters');

      await manager.activateTask(task.id);

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.activeTaskId).toBe(task.id);
    });
  });

  describe('Error handling', () => {
    it('should throw error if task not found', async () => {
      await expect(
        manager.activateTask('task-nonexistent')
      ).rejects.toThrow('Task not found: task-nonexistent');
    });

    it('should throw error for invalid task ID format', async () => {
      await expect(
        manager.activateTask('invalid-id')
      ).rejects.toThrow('Task not found: invalid-id');
    });
  });

  describe('Workflow initialization', () => {
    it('should initialize workflow for task without workflow', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Remove workflow from task2
      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const queuedTask = queue.tasks.find((t: Task) => t.id === task2.id);
      delete queuedTask.workflow;
      await fs.writeJson(path.join(tempDir, 'tasks.json'), queue, { spaces: 2 });

      const activated = await manager.activateTask(task2.id);

      expect(activated.workflow).toBeDefined();
      expect(activated.workflow?.currentState).toBe('UNDERSTANDING');
      expect(activated.workflow?.stateHistory).toEqual([]);
    });

    it('should preserve existing workflow if task has one', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      // Add workflow to task2
      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const queuedTask = queue.tasks.find((t: Task) => t.id === task2.id);
      queuedTask.workflow = {
        currentState: 'TESTING',
        stateEnteredAt: new Date().toISOString(),
        stateHistory: [
          { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() }
        ]
      };
      await fs.writeJson(path.join(tempDir, 'tasks.json'), queue, { spaces: 2 });

      const activated = await manager.activateTask(task2.id);

      expect(activated.workflow).toBeDefined();
      expect(activated.workflow?.currentState).toBe('TESTING');
      expect(activated.workflow?.stateHistory).toHaveLength(1);
    });
  });

  describe('Metadata update', () => {
    it('should update metadata after activation', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      await manager.activateTask(task2.id);

      const queue = await fs.readJson(path.join(tempDir, 'tasks.json'));
      expect(queue.metadata.activeCount).toBe(1);
      expect(queue.metadata.queuedCount).toBe(1);
    });
  });
});

