/**
 * Unit tests for TaskCompletionService
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskCompletionService } from '../../src/core/task-completion-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskFileSync } from '../../src/core/task-file-sync.js';
import { ContextInjector } from '../../src/core/context-injector.js';
import { RoleSystem } from '../../src/core/role-system.js';
import { RuleManager } from '../../src/utils/rule-manager.js';
import { TaskMigration } from '../../src/utils/migration.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskCompletionService', () => {
  let service: TaskCompletionService;
  let testContextDir: string;
  let taskFile: string;
  let queueManager: TaskQueueManager;
  let fileSync: TaskFileSync;
  let contextInjector: ContextInjector;
  let roleSystem: RoleSystem;
  let ruleManager: RuleManager;
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
    contextInjector = new ContextInjector(testContextDir);
    roleSystem = new RoleSystem();
    ruleManager = new RuleManager();
    migration = new TaskMigration(testContextDir);
    
    const syncFileFromQueueFn = async (queueTask: any, preserveFields: string[]) => {
      await fileSync.syncFromQueue(queueTask);
    };
    
    service = new TaskCompletionService(
      queueManager,
      fileSync,
      contextInjector,
      roleSystem,
      ruleManager,
      migration,
      testContextDir,
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

  describe('completeTask()', () => {
    it('should throw error when no active task exists', async () => {
      await expect(service.completeTask()).rejects.toThrow('No active task to complete');
    });

    it('should throw error when task is not at READY_TO_COMMIT state', async () => {
      const task = await queueManager.createTask('Test task completion');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'IMPLEMENTING' as WorkflowState;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
      }

      await expect(service.completeTask()).rejects.toThrow('Cannot complete task at IMPLEMENTING state');
    });

    it('should complete task when at READY_TO_COMMIT state', async () => {
      const task = await queueManager.createTask('Test task completion');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'READY_TO_COMMIT' as WorkflowState;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
      }

      const result = await service.completeTask();

      expect(result.alreadyCompleted).toBe(false);
      const completedTask = await queueManager.getActiveTask();
      expect(completedTask).toBeNull(); // Task should be deactivated after completion
    });

    it('should return alreadyCompleted=true when task already completed', async () => {
      const task = await queueManager.createTask('Test task completion');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        queueTask.status = 'DONE';
        queueTask.completedAt = new Date().toISOString();
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'READY_TO_COMMIT' as WorkflowState;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
      }

      const result = await service.completeTask();

      expect(result.alreadyCompleted).toBe(true);
    });

    it('should clear context files after completion', async () => {
      const task = await queueManager.createTask('Test task completion');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'READY_TO_COMMIT' as WorkflowState;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
      }

      // Create context files
      await fs.writeFile(path.join(testContextDir, 'STATUS.txt'), 'test');
      await fs.writeFile(path.join(testContextDir, 'NEXT_STEPS.md'), 'test');

      await service.completeTask();

      expect(await fs.pathExists(path.join(testContextDir, 'STATUS.txt'))).toBe(false);
      expect(await fs.pathExists(path.join(testContextDir, 'NEXT_STEPS.md'))).toBe(false);
    });

    it('should activate next queued task if available', async () => {
      // Create first task and complete it
      const task1 = await queueManager.createTask('First task completion');
      const taskId1 = task1.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask1 = queue.tasks.find((t: any) => t.id === taskId1);
      if (queueTask1) {
        if (!queueTask1.workflow) {
          queueTask1.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask1.workflow.currentState = 'READY_TO_COMMIT' as WorkflowState;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask1);
      }

      // Create second task (will be queued)
      await queueManager.createTask('Second task completion');

      await service.completeTask();

      // Second task should be activated
      const activeTask = await queueManager.getActiveTask();
      expect(activeTask).not.toBeNull();
      expect(activeTask?.goal).toBe('Second task completion');
    });
  });
});

