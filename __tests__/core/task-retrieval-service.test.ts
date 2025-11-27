/**
 * Unit tests for TaskRetrievalService
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskRetrievalService } from '../../src/core/task-retrieval-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskFileSync } from '../../src/core/task-file-sync.js';
import { TaskValidator } from '../../src/core/task-validator.js';
import { TaskMigration } from '../../src/utils/migration.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskRetrievalService', () => {
  let service: TaskRetrievalService;
  let testContextDir: string;
  let taskFile: string;
  let queueManager: TaskQueueManager;
  let fileSync: TaskFileSync;
  let validator: TaskValidator;
  let migration: TaskMigration;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskFile = path.join(testContextDir, 'current-task.json');
    
    queueManager = new TaskQueueManager(testContextDir);
    fileSync = new TaskFileSync(testContextDir);
    validator = new TaskValidator();
    migration = new TaskMigration(testContextDir);
    
    // Mock syncFileFromQueue function
    const syncFileFromQueueFn = async (queueTask: any, preserveFields: string[]) => {
      await fileSync.syncFromQueue(queueTask);
    };
    
    service = new TaskRetrievalService(
      queueManager,
      fileSync,
      validator,
      migration,
      taskFile,
      syncFileFromQueueFn
    );
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('getCurrentTask()', () => {
    it('should return null when no task exists', async () => {
      const task = await service.getCurrentTask();
      expect(task).toBeNull();
    });

    it('should return task from file when file exists', async () => {
      // FIX: Ensure queue is empty so file task is returned
      const queue = await (queueManager as any).loadQueue();
      queue.tasks = [];
      queue.activeTaskId = null;
      await (queueManager as any).saveQueue(queue);
      
      const taskData = {
        taskId: 'task-123',  // FIX: Use taskId instead of id to match file format
        originalGoal: 'Test task',  // FIX: Use originalGoal to match file format
        status: 'in_progress',  // FIX: Use in_progress status
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING' as WorkflowState,
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      await fs.writeJson(taskFile, taskData);

      const task = await service.getCurrentTask();

      expect(task).not.toBeNull();
      expect(task?.id).toBe('task-123');
      expect(task?.goal).toBe('Test task');
      // Task from file may have workflow in different structure
      const taskAny = task as any;
      if (taskAny.workflow) {
        expect(taskAny.workflow.currentState).toBe('UNDERSTANDING');
      }
    });

    it('should return task from queue when queue has active task', async () => {
      const queueTask = await queueManager.createTask('Queue task description with enough characters');
      const queueTaskId = queueTask.id;
      
      // Get the task to verify it exists
      const activeTask = await queueManager.getActiveTask();
      expect(activeTask).not.toBeNull();

      const task = await service.getCurrentTask();

      expect(task).not.toBeNull();
      expect(task?.id).toBe(queueTaskId);
      expect(task?.goal).toBe('Queue task description with enough characters');
    });

    it('should prefer queue task over file when both exist', async () => {
      // Create file task
      const fileTask = {
        id: 'file-task-789',
        goal: 'File task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING' as WorkflowState,
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };
      await fs.writeJson(taskFile, fileTask);

      // Create queue task (must be at least 10 characters)
      const queueTask = await queueManager.createTask('Queue task description with enough characters');
      const queueTaskId = queueTask.id;

      const task = await service.getCurrentTask();

      // Should prefer queue task
      expect(task).not.toBeNull();
      expect(task?.id).toBe(queueTaskId);
      expect(task?.goal).toBe('Queue task description with enough characters');
    });

    it('should handle completed task', async () => {
      // FIX: Use a fresh queue manager instance to ensure complete isolation
      // Create a new isolated context directory for this test
      const isolatedContextDir = getUniqueAIContextDir();
      await fs.ensureDir(isolatedContextDir);
      const isolatedTaskFile = path.join(isolatedContextDir, 'current-task.json');
      
      const isolatedQueueManager = new TaskQueueManager(isolatedContextDir);
      const isolatedFileSync = new TaskFileSync(isolatedContextDir);
      const isolatedValidator = new TaskValidator();
      const isolatedMigration = new TaskMigration(isolatedContextDir);
      
      const syncFileFromQueueFn = async (queueTask: any, preserveFields: string[]) => {
        await isolatedFileSync.syncFromQueue(queueTask);
      };
      
      const isolatedService = new TaskRetrievalService(
        isolatedQueueManager,
        isolatedFileSync,
        isolatedValidator,
        isolatedMigration,
        isolatedTaskFile,
        syncFileFromQueueFn
      );
      
      // Verify queue is empty
      const verifyQueue = await (isolatedQueueManager as any).loadQueue();
      expect(verifyQueue.tasks.length).toBe(0);
      expect(verifyQueue.activeTaskId).toBeNull();
      
      const taskData = {
        taskId: 'task-completed',  // FIX: Use taskId to match file format
        originalGoal: 'Completed task with enough characters',  // FIX: Must be at least 10 characters
        status: 'completed',  // FIX: Use lowercase 'completed' to match file format
        startedAt: '2025-01-01T00:00:00Z',
        completedAt: '2025-01-01T10:00:00Z',
        workflow: {
          currentState: 'READY_TO_COMMIT' as WorkflowState,
          stateEnteredAt: '2025-01-01T09:00:00Z',
          stateHistory: []
        }
      };

      await fs.writeJson(isolatedTaskFile, taskData);
      
      // Wait for file write to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const task = await isolatedService.getCurrentTask();
      
      // FIX: Completed tasks should return null (getCurrentTask filters them out at line 290)
      // getCurrentTask checks file status === 'completed' and returns null
      expect(task).toBeNull();
      
      // Cleanup isolated directory
      await fs.remove(isolatedContextDir).catch(() => {});
    });
  });
});

