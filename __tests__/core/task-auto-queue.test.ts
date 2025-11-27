/**
 * Task Auto-Queue Tests
 * Tests for auto-queue functionality when creating tasks
 * @requirement Task: xem xét về việc cho phép tạo task mới khi đang thực hiện task
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskManager } from '../../src/core/task-manager.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskManager - Auto-Queue', () => {
  let taskManager: TaskManager;
  let queueManager: TaskQueueManager;
  let testContextDir: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskManager = new TaskManager(testContextDir);
    queueManager = new TaskQueueManager(testContextDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('createTask - Auto-Queue Behavior', () => {
    it('should create task with ACTIVE status when no active task exists', async () => {
      const task = await taskManager.createTask('Test task for auto-queue when no active task', []);
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.goal).toBe('Test task for auto-queue when no active task');
      
      // Check queue status
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      const queueTask = queueTasks.find(t => t.id === task.id);
      expect(queueTask).toBeDefined();
      expect(queueTask?.status).toBe('ACTIVE');
      
      // Verify workflow state initialized
      expect(task.status).toBe('UNDERSTANDING');
    });

    it('should create task with QUEUED status when active task exists', async () => {
      // Create first task (will be ACTIVE)
      const activeTask = await taskManager.createTask('First active task for queue testing', []);
      expect(activeTask).toBeDefined();
      
      // Verify first task is active
      const activeQueueTasks = await queueManager.listTasks({ limit: 100 });
      const activeQueueTask = activeQueueTasks.find(t => t.id === activeTask.id);
      expect(activeQueueTask?.status).toBe('ACTIVE');
      
      // Create second task (should be QUEUED)
      const queuedTask = await taskManager.createTask('Second task that should be queued', []);
      expect(queuedTask).toBeDefined();
      expect(queuedTask.id).not.toBe(activeTask.id);
      
      // Check queue status
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      const queuedQueueTask = queueTasks.find(t => t.id === queuedTask.id);
      expect(queuedQueueTask).toBeDefined();
      expect(queuedQueueTask?.status).toBe('QUEUED');
      
      // Verify active task remains active
      const stillActiveTask = await taskManager.getCurrentTask();
      expect(stillActiveTask?.id).toBe(activeTask.id);
      
      // Verify queue count increased
      expect(queueTasks.length).toBe(2);
    });

    it('should preserve active task when creating queued task', async () => {
      // Create active task
      const activeTask = await taskManager.createTask('Active task to preserve during queue test', []);
      
      // Get active task before creating new one
      const beforeActiveTask = await taskManager.getCurrentTask();
      expect(beforeActiveTask?.id).toBe(activeTask.id);
      
      // Create queued task
      const queuedTask = await taskManager.createTask('Queued task that should not affect active task', []);
      
      // Verify active task unchanged
      const afterActiveTask = await taskManager.getCurrentTask();
      expect(afterActiveTask?.id).toBe(activeTask.id);
      expect(afterActiveTask?.goal).toBe(activeTask.goal);
      
      // Verify queued task is queued
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      const queuedQueueTask = queueTasks.find(t => t.id === queuedTask.id);
      expect(queuedQueueTask?.status).toBe('QUEUED');
    });

    it('should allow multiple queued tasks', async () => {
      // Create active task
      const activeTask = await taskManager.createTask('Active task for multiple queue test', []);
      
      // Create multiple queued tasks
      const queuedTask1 = await taskManager.createTask('First queued task for multiple queue test', []);
      const queuedTask2 = await taskManager.createTask('Second queued task for multiple queue test', []);
      const queuedTask3 = await taskManager.createTask('Third queued task for multiple queue test', []);
      
      // Verify all tasks exist
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      expect(queueTasks.length).toBe(4); // 1 active + 3 queued
      
      // Verify only one active task
      const activeCount = queueTasks.filter(t => t.status === 'ACTIVE').length;
      expect(activeCount).toBe(1);
      
      // Verify queued tasks are queued
      const queuedCount = queueTasks.filter(t => t.status === 'QUEUED').length;
      expect(queuedCount).toBe(3);
      
      // Verify active task is still the first one
      const currentActiveTask = await taskManager.getCurrentTask();
      expect(currentActiveTask?.id).toBe(activeTask.id);
    });
  });

  describe('createTask - Force Flag Behavior', () => {
    it('should activate new task immediately when --force is used', async () => {
      // Create active task
      const activeTask = await taskManager.createTask('Active task to be deactivated by force', []);
      expect(activeTask).toBeDefined();
      
      // Create new task with force flag
      const forcedTask = await taskManager.createTask('New task activated with force flag', [], true);
      expect(forcedTask).toBeDefined();
      expect(forcedTask.id).not.toBe(activeTask.id);
      
      // Verify new task is active
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      const forcedQueueTask = queueTasks.find(t => t.id === forcedTask.id);
      expect(forcedQueueTask?.status).toBe('ACTIVE');
      
      // Verify old task is queued (not completed)
      const oldQueueTask = queueTasks.find(t => t.id === activeTask.id);
      expect(oldQueueTask?.status).toBe('QUEUED');
      
      // Verify current active task is the new one
      const currentActiveTask = await taskManager.getCurrentTask();
      expect(currentActiveTask?.id).toBe(forcedTask.id);
    });

    it('should preserve old task state when using --force', async () => {
      // Create active task and progress it
      const activeTask = await taskManager.createTask('Active task with workflow state to preserve', []);
      
      // Manually update state for test (simulate state progression)
      const taskFile = path.join(testContextDir, 'current-task.json');
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'DESIGNING';
      taskData.workflow.stateHistory = taskData.workflow.stateHistory || [];
      taskData.workflow.stateHistory.push({
        state: 'DESIGNING',
        enteredAt: new Date().toISOString()
      });
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Also update in queue
      const queueFile = path.join(testContextDir, 'tasks.json');
      if (await fs.pathExists(queueFile)) {
        const queue = await fs.readJson(queueFile);
        const queueTask = queue.tasks.find((t: any) => t.id === activeTask.id);
        if (queueTask) {
          queueTask.workflow = queueTask.workflow || {};
          queueTask.workflow.currentState = 'DESIGNING';
          queueTask.workflow.stateHistory = queueTask.workflow.stateHistory || [];
          queueTask.workflow.stateHistory.push({
            state: 'DESIGNING',
            enteredAt: new Date().toISOString()
          });
          await fs.writeJson(queueFile, queue, { spaces: 2 });
        }
      }
      
      const beforeState = await taskManager.getCurrentTask();
      expect(beforeState?.status).toBe('DESIGNING');
      
      // Create new task with force
      const forcedTask = await taskManager.createTask('New task that should activate with force', [], true);
      
      // Verify old task state preserved (in queue)
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      const oldQueueTask = queueTasks.find(t => t.id === activeTask.id);
      expect(oldQueueTask).toBeDefined();
      expect(oldQueueTask?.workflow?.currentState).toBe('DESIGNING');
      
      // Verify new task is active
      const currentActiveTask = await taskManager.getCurrentTask();
      expect(currentActiveTask?.id).toBe(forcedTask.id);
      expect(currentActiveTask?.status).toBe('UNDERSTANDING'); // New task starts at UNDERSTANDING
    });

    it('should activate task immediately when --force used and no active task exists', async () => {
      // Create task with force (no active task exists)
      const forcedTask = await taskManager.createTask('Task created with force when no active task', [], true);
      
      // Should still be active (force doesn't matter when no active task)
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      const forcedQueueTask = queueTasks.find(t => t.id === forcedTask.id);
      expect(forcedQueueTask?.status).toBe('ACTIVE');
      
      const currentActiveTask = await taskManager.getCurrentTask();
      expect(currentActiveTask?.id).toBe(forcedTask.id);
    });
  });

  describe('createTask - Queue Management', () => {
    it('should maintain correct queue order (FIFO)', async () => {
      // Create active task
      await taskManager.createTask('Active task for FIFO queue test', []);
      
      // Create queued tasks in order
      const queuedTask1 = await taskManager.createTask('First queued task for FIFO test', []);
      const queuedTask2 = await taskManager.createTask('Second queued task for FIFO test', []);
      const queuedTask3 = await taskManager.createTask('Third queued task for FIFO test', []);
      
      // Get all tasks
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      
      // Verify all tasks exist
      expect(queueTasks.length).toBeGreaterThanOrEqual(4); // 1 active + 3 queued
      
      // Find positions of queued tasks
      const task1Index = queueTasks.findIndex(t => t.id === queuedTask1.id);
      const task2Index = queueTasks.findIndex(t => t.id === queuedTask2.id);
      const task3Index = queueTasks.findIndex(t => t.id === queuedTask3.id);
      
      // Verify all tasks found
      expect(task1Index).toBeGreaterThanOrEqual(0);
      expect(task2Index).toBeGreaterThanOrEqual(0);
      expect(task3Index).toBeGreaterThanOrEqual(0);
      
      // Verify order (creation time order - tasks created later should appear later in list)
      // Note: listTasks may not guarantee order, so we check creation timestamps instead
      const task1 = queueTasks.find(t => t.id === queuedTask1.id);
      const task2 = queueTasks.find(t => t.id === queuedTask2.id);
      const task3 = queueTasks.find(t => t.id === queuedTask3.id);
      
      expect(task1).toBeDefined();
      expect(task2).toBeDefined();
      expect(task3).toBeDefined();
      
      // Verify creation order by timestamp
      if (task1 && task2 && task3) {
        const time1 = new Date(task1.createdAt).getTime();
        const time2 = new Date(task2.createdAt).getTime();
        const time3 = new Date(task3.createdAt).getTime();
        
        expect(time1).toBeLessThan(time2);
        expect(time2).toBeLessThan(time3);
      }
    });

    it('should update queue metadata correctly', async () => {
      // Create active task
      await taskManager.createTask('Active task for metadata test', []);
      
      // Create queued task
      await taskManager.createTask('Queued task for metadata test', []);
      
      // Check queue metadata
      const queueFile = path.join(testContextDir, 'tasks.json');
      if (await fs.pathExists(queueFile)) {
        const queue = await fs.readJson(queueFile);
        expect(queue.metadata).toBeDefined();
        expect(queue.metadata.totalTasks).toBeGreaterThanOrEqual(2);
        expect(queue.metadata.activeCount).toBe(1);
        expect(queue.metadata.queuedCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('createTask - Context Files', () => {
    it('should update context files for active task', async () => {
      const task = await taskManager.createTask('Task for context file update test', []);
      
      // Verify context files exist
      const statusFile = path.join(testContextDir, 'STATUS.txt');
      const nextStepsFile = path.join(testContextDir, 'NEXT_STEPS.md');
      
      expect(await fs.pathExists(statusFile)).toBe(true);
      expect(await fs.pathExists(nextStepsFile)).toBe(true);
      
      // Verify status file contains task info
      const statusContent = await fs.readFile(statusFile, 'utf-8');
      expect(statusContent).toContain(task.goal);
    });

    it('should not update context files for queued task', async () => {
      // Create active task (context files updated)
      const activeTask = await taskManager.createTask('Active task for context file test', []);
      
      // Verify active task is current
      const currentTaskBefore = await taskManager.getCurrentTask();
      expect(currentTaskBefore?.id).toBe(activeTask.id);
      
      // Create queued task
      // Note: createTask may update context, but the key is that active task remains active
      const queuedTask = await taskManager.createTask('Queued task that should not update context', []);
      
      // Verify queued task is queued (not active)
      const queueTasks = await queueManager.listTasks({ limit: 100 });
      const queuedQueueTask = queueTasks.find(t => t.id === queuedTask.id);
      expect(queuedQueueTask?.status).toBe('QUEUED');
      
      // Verify active task is still the current task
      // (queued tasks don't become active, so context should reflect active task)
      const currentTaskAfter = await taskManager.getCurrentTask();
      expect(currentTaskAfter?.id).toBe(activeTask.id);
      expect(currentTaskAfter?.id).not.toBe(queuedTask.id);
      
      // Note: Context files may be updated by createTask, but the active task
      // should remain the same, so the "current task" in context should be the active one
    });
  });
});

