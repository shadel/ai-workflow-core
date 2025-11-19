/**
 * Integration tests for TaskQueueManager
 * @requirement FREE-TIER-001 - Task Queue Management
 */

import { TaskQueueManager, Task } from '../../src/core/task-queue.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('TaskQueueManager Integration Tests', () => {
  let tempDir: string;
  let manager: TaskQueueManager;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `task-queue-integration-${Date.now()}`);
    manager = new TaskQueueManager(tempDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Full lifecycle', () => {
    it('should handle CREATE → ACTIVE → DONE → ARCHIVED lifecycle', async () => {
      // CREATE
      const task = await manager.createTask('Integration test task with enough characters');
      expect(task.status).toBe('ACTIVE');
      expect(task.workflow).toBeDefined();

      // Complete (DONE)
      const result = await manager.completeTask(task.id);
      expect(result.completed.status).toBe('DONE');
      expect(result.completed.completedAt).toBeDefined();
      expect(result.completed.actualTime).toBeDefined();

      // Archive old tasks (simulate 30+ days old)
      const queue = await (manager as any).loadQueue();
      const doneTask = queue.tasks.find((t: Task) => t.id === task.id);
      if (doneTask) {
        // Simulate old completion date
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 31);
        doneTask.completedAt = oldDate.toISOString();
        await (manager as any).saveQueue(queue);
      }

      const archivedCount = await manager.archiveOldTasks();
      expect(archivedCount).toBe(1);

      const archivedQueue = await (manager as any).loadQueue();
      const archivedTask = archivedQueue.tasks.find((t: Task) => t.id === task.id);
      expect(archivedTask?.status).toBe('ARCHIVED');
    });
  });

  describe('Multi-task workflow', () => {
    it('should handle multiple tasks with priority sorting', async () => {
      // Create tasks with different priorities
      const lowTask = await manager.createTask('Low priority task with enough characters', {
        priority: 'LOW'
      });
      const highTask = await manager.createTask('High priority task with enough characters', {
        priority: 'HIGH'
      });
      const criticalTask = await manager.createTask('Critical priority task with enough characters', {
        priority: 'CRITICAL'
      });

      // All should be queued except first
      const queue = await manager.listTasks({ status: ['QUEUED'] });
      expect(queue.length).toBe(2); // highTask and criticalTask (lowTask is active)

      // Complete active task
      await manager.completeTask(lowTask.id);

      // Next should be CRITICAL (highest priority)
      const activeTask = await manager.getActiveTask();
      expect(activeTask?.id).toBe(criticalTask.id);
      expect(activeTask?.priority).toBe('CRITICAL');
    });

    it('should auto-activate next task when completing', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');
      const task3 = await manager.createTask('Third task with enough characters to be valid');

      // Complete task1
      const result = await manager.completeTask(task1.id);

      // task2 should be auto-activated
      expect(result.nextActive).toBeDefined();
      expect(result.nextActive?.id).toBe(task2.id);
      expect(result.nextActive?.status).toBe('ACTIVE');

      // Verify in queue
      const activeTask = await manager.getActiveTask();
      expect(activeTask?.id).toBe(task2.id);
    });
  });

  describe('Concurrent access (file locking)', () => {
    it('should handle concurrent createTask calls', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.createTask(`Concurrent task ${i} with enough characters to be valid`)
      );

      const tasks = await Promise.all(promises);

      // All tasks should be created
      expect(tasks.length).toBe(10);
      expect(new Set(tasks.map(t => t.id)).size).toBe(10); // All unique IDs

      // Only one should be ACTIVE
      const activeTasks = tasks.filter(t => t.status === 'ACTIVE');
      expect(activeTasks.length).toBe(1);

      // Rest should be QUEUED
      const queuedTasks = tasks.filter(t => t.status === 'QUEUED');
      expect(queuedTasks.length).toBe(9);
    }, 15000); // Increase timeout for concurrent operations
  });

  describe('Error handling', () => {
    it('should validate goal length', async () => {
      await expect(
        manager.createTask('short')
      ).rejects.toThrow('at least 10 characters');

      const longGoal = 'a'.repeat(501);
      await expect(
        manager.createTask(longGoal)
      ).rejects.toThrow('less than 500 characters');
    });

    it('should validate priority', async () => {
      await expect(
        // @ts-expect-error - Testing invalid priority
        manager.createTask('Valid task goal with enough characters', { priority: 'INVALID' })
      ).rejects.toThrow('Invalid priority');
    });

    it('should validate taskId in activateTask', async () => {
      // @ts-expect-error - Testing invalid input
      await expect(manager.activateTask(null)).rejects.toThrow('Task ID is required');
      await expect(manager.activateTask('')).rejects.toThrow('Task ID is required');
      await expect(manager.activateTask('nonexistent')).rejects.toThrow('Task not found');
    });

    it('should validate taskId in completeTask', async () => {
      // @ts-expect-error - Testing invalid input
      await expect(manager.completeTask(null)).rejects.toThrow();
      await expect(manager.completeTask('')).rejects.toThrow();
      await expect(manager.completeTask('nonexistent')).rejects.toThrow('Task not found');
    });

    it('should prevent completing non-active task', async () => {
      const task1 = await manager.createTask('First task with enough characters to be valid');
      const task2 = await manager.createTask('Second task with enough characters to be valid');

      await expect(
        manager.completeTask(task2.id) // task2 is QUEUED, not ACTIVE
      ).rejects.toThrow('Task is not active');
    });
  });

  describe('Performance with many tasks', () => {
    it('should handle 100 tasks efficiently', async () => {
      const startTime = Date.now();

      // Create 100 tasks sequentially (concurrent would be too slow with file locking)
      const tasks = [];
      for (let i = 0; i < 100; i++) {
        tasks.push(await manager.createTask(`Task ${i} with enough characters to be valid`));
      }

      const createTime = Date.now() - startTime;
      expect(createTime).toBeLessThan(30000); // Should complete in < 30 seconds (sequential)

      // List all tasks
      const listStart = Date.now();
      const allTasks = await manager.listTasks({});
      const listTime = Date.now() - listStart;
      expect(listTime).toBeLessThan(1000); // Should complete in < 1 second

      expect(allTasks.length).toBe(100);
      expect(allTasks.filter(t => t.status === 'ACTIVE').length).toBe(1);
      expect(allTasks.filter(t => t.status === 'QUEUED').length).toBe(99);
    }, 60000); // Increase timeout for performance test
  });
});

