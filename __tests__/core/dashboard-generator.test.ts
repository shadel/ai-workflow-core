/**
 * Unit tests for DashboardGenerator
 * @requirement FREE-TIER-003 - CLI Dashboard
 */

import { DashboardGenerator, DashboardData } from '../../src/core/dashboard-generator.js';
import { TaskQueueManager, Task } from '../../src/core/task-queue.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('DashboardGenerator', () => {
  let tempDir: string;
  let queueManager: TaskQueueManager;
  let generator: DashboardGenerator;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(() => {
    // Use unique directory per test to avoid conflicts in parallel execution
    tempDir = getUniqueAIContextDir();
    testDirs.push(tempDir); // Track for cleanup
    queueManager = new TaskQueueManager(tempDir);
    generator = new DashboardGenerator(queueManager);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('generate()', () => {
    it('should generate dashboard data with no tasks', async () => {
      const data = await generator.generate();

      expect(data.activeTask).toBeNull();
      expect(data.queue).toEqual([]);
      expect(data.recentCompleted).toEqual([]);
      expect(data.statistics.total).toBe(0);
      expect(data.statistics.queued).toBe(0);
      expect(data.statistics.active).toBe(0);
      expect(data.statistics.completed).toBe(0);
    });

    it('should include active task in dashboard', async () => {
      const task = await queueManager.createTask('Active task with enough characters to be valid');

      const data = await generator.generate();

      expect(data.activeTask).toBeDefined();
      expect(data.activeTask?.id).toBe(task.id);
      expect(data.activeTask?.goal).toBe('Active task with enough characters to be valid');
      expect(data.statistics.active).toBe(1);
    });

    it('should include queued tasks', async () => {
      const task1 = await queueManager.createTask('First task with enough characters to be valid');
      const task2 = await queueManager.createTask('Second task with enough characters to be valid');
      const task3 = await queueManager.createTask('Third task with enough characters to be valid');

      const data = await generator.generate();

      expect(data.queue.length).toBe(2); // task2 and task3 are queued
      expect(data.queue.map(t => t.id)).toContain(task2.id);
      expect(data.queue.map(t => t.id)).toContain(task3.id);
      expect(data.statistics.queued).toBe(2);
    });

    it('should include recent completed tasks', async () => {
      const task1 = await queueManager.createTask('First task with enough characters to be valid');
      const task2 = await queueManager.createTask('Second task with enough characters to be valid');

      // Complete task1
      await queueManager.completeTask(task1.id);

      const data = await generator.generate();

      expect(data.recentCompleted.length).toBe(1);
      expect(data.recentCompleted[0].id).toBe(task1.id);
      expect(data.statistics.completed).toBe(1);
    });

    it('should calculate statistics correctly', async () => {
      // Create multiple tasks
      const task1 = await queueManager.createTask('First task with enough characters to be valid');
      const task2 = await queueManager.createTask('Second task with enough characters to be valid', {
        priority: 'HIGH'
      });
      const task3 = await queueManager.createTask('Third task with enough characters to be valid', {
        priority: 'CRITICAL'
      });

      // Complete one
      await queueManager.completeTask(task1.id);

      const data = await generator.generate();

      expect(data.statistics.total).toBe(3);
      expect(data.statistics.active).toBe(1);
      expect(data.statistics.queued).toBe(1);
      expect(data.statistics.completed).toBe(1);
      expect(data.statistics.tasksByPriority.CRITICAL).toBe(1);
      expect(data.statistics.tasksByPriority.HIGH).toBe(1);
      expect(data.statistics.tasksByPriority.MEDIUM).toBe(1);
    });

    it('should calculate state distribution', async () => {
      const task = await queueManager.createTask('Task with enough characters to be valid');

      const data = await generator.generate();

      expect(data.stateDistribution.UNDERSTANDING).toBe(1);
      expect(data.stateDistribution.DESIGNING).toBe(0);
    });

    it('should limit queue to top 5', async () => {
      // Create 7 tasks (1 active, 6 queued)
      await queueManager.createTask('First task with enough characters to be valid');
      for (let i = 2; i <= 7; i++) {
        await queueManager.createTask(`Task ${i} with enough characters to be valid`);
      }

      const data = await generator.generate();

      expect(data.queue.length).toBe(5); // Limited to 5
      expect(data.statistics.queued).toBe(6); // But statistics show all 6
    });

    it('should limit recent completed to 5', async () => {
      // Create and complete 7 tasks
      for (let i = 1; i <= 7; i++) {
        const task = await queueManager.createTask(`Task ${i} with enough characters to be valid`);
        await queueManager.completeTask(task.id);
      }

      const data = await generator.generate();

      expect(data.recentCompleted.length).toBe(5); // Limited to 5
      expect(data.statistics.completed).toBe(7); // But statistics show all 7
    });
  });

  describe('calculateStatistics()', () => {
    it('should calculate completion this week', async () => {
      const task = await queueManager.createTask('Task with enough characters to be valid');
      await queueManager.completeTask(task.id);

      const data = await generator.generate();

      expect(data.statistics.completionThisWeek).toBe(1);
      expect(data.statistics.completionThisMonth).toBe(1);
    });

    it('should calculate average completion time', async () => {
      const task1 = await queueManager.createTask('First task with enough characters to be valid');
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      await queueManager.completeTask(task1.id);

      const data = await generator.generate();

      expect(data.statistics.avgCompletionTime).toBeGreaterThan(0);
      expect(data.statistics.avgCompletionTime).toBeLessThan(1); // Should be less than 1 hour
    });
  });
});

