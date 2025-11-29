/**
 * Unit tests for TaskListService
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskListService } from '../../src/core/task-list-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskMigration } from '../../src/utils/migration.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskListService', () => {
  let service: TaskListService;
  let testContextDir: string;
  let queueManager: TaskQueueManager;
  let migration: TaskMigration;
  let getCurrentTaskFn: () => Promise<any>;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    
    queueManager = new TaskQueueManager(testContextDir);
    migration = new TaskMigration(testContextDir);
    
    getCurrentTaskFn = async () => {
      const activeTask = await queueManager.getActiveTask();
      if (activeTask) {
        return {
          id: activeTask.id,
          goal: activeTask.goal,
          status: activeTask.workflow?.currentState || 'UNDERSTANDING',
          startedAt: activeTask.createdAt,
          roleApprovals: []
        };
      }
      return null;
    };
    
    service = new TaskListService(
      queueManager,
      migration,
      testContextDir,
      getCurrentTaskFn
    );
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('listTasks()', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await service.listTasks();

      expect(tasks).toEqual([]);
    });

    it('should return all tasks from queue', async () => {
      await queueManager.createTask('First task description');
      await queueManager.createTask('Second task description');

      const tasks = await service.listTasks();

      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(tasks.some(t => t.goal === 'First task description')).toBe(true);
      expect(tasks.some(t => t.goal === 'Second task description')).toBe(true);
    });

    it('should filter tasks by status', async () => {
      const taskObj1 = await queueManager.createTask('Task 1 description');
      const taskId1 = taskObj1.id;
      const taskObj2 = await queueManager.createTask('Task 2 description');
      const taskId2 = taskObj2.id;
      
      // Set different states
      const queue = await (queueManager as any).loadQueue();
      const queueTask1 = queue.tasks.find((t: any) => t.id === taskId1);
      const queueTask2 = queue.tasks.find((t: any) => t.id === taskId2);
      if (queueTask1) {
        queueTask1.workflow = { currentState: 'UNDERSTANDING' as WorkflowState, stateEnteredAt: new Date().toISOString(), stateHistory: [] };
      }
      if (queueTask2) {
        queueTask2.workflow = { currentState: 'IMPLEMENTING' as WorkflowState, stateEnteredAt: new Date().toISOString(), stateHistory: [] };
      }
      await (queueManager as any).saveQueue(queue);

      const tasks = await service.listTasks('IMPLEMENTING');

      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.every(t => t.status === 'IMPLEMENTING')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      await queueManager.createTask('Task 1 description');
      await queueManager.createTask('Task 2 description');
      await queueManager.createTask('Task 3 description');

      const tasks = await service.listTasks(undefined, 2);

      expect(tasks.length).toBeLessThanOrEqual(2);
    });

    it('should include tasks from history', async () => {
      // Create a task and complete it
      const task = await queueManager.createTask('Completed task description');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        queueTask.status = 'DONE';
        queueTask.completedAt = new Date().toISOString();
        await (queueManager as any).saveQueue(queue);
      }

      // Create history file
      const historyDir = path.join(testContextDir, 'task-history');
      await fs.ensureDir(historyDir);
      await fs.writeJson(path.join(historyDir, `${taskId}.json`), {
        taskId: taskId as string,
        originalGoal: 'Completed task description',
        workflow: { currentState: 'READY_TO_COMMIT' },
        completedAt: new Date().toISOString()
      });

      const tasks = await service.listTasks();

      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.some(t => t.id === (taskId as string))).toBe(true);
    });

    it('should combine queue tasks and history tasks', async () => {
      // Create active task
      await queueManager.createTask('Active task description');

      // Create history task
      const historyDir = path.join(testContextDir, 'task-history');
      await fs.ensureDir(historyDir);
      await fs.writeJson(path.join(historyDir, 'history-task.json'), {
        taskId: 'history-task',
        originalGoal: 'History task',
        workflow: { currentState: 'READY_TO_COMMIT' },
        completedAt: new Date().toISOString()
      });

      const tasks = await service.listTasks();

      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(tasks.some(t => t.goal === 'Active task description')).toBe(true);
      expect(tasks.some(t => t.id === 'history-task')).toBe(true);
    });
  });
});

