/**
 * Unit tests for TaskUpdateService
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskUpdateService } from '../../src/core/task-update-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { ContextInjector } from '../../src/core/context-injector.js';
import { RuleManager } from '../../src/utils/rule-manager.js';
import { TaskMigration } from '../../src/utils/migration.js';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskUpdateService', () => {
  let service: TaskUpdateService;
  let testContextDir: string;
  let taskFile: string;
  let queueManager: TaskQueueManager;
  let contextInjector: ContextInjector;
  let ruleManager: RuleManager;
  let migration: TaskMigration;
  let getCurrentTaskFn: () => Promise<any>;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskFile = path.join(testContextDir, 'current-task.json');
    
    queueManager = new TaskQueueManager(testContextDir);
    contextInjector = new ContextInjector(testContextDir);
    ruleManager = new RuleManager();
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
    
    const syncFileFromQueueFn = async (queueTask: any, preserveFields: string[]) => {
      const { TaskFileSync } = await import('../../src/core/task-file-sync.js');
      const fileSync = new TaskFileSync(testContextDir);
      await fileSync.syncFromQueue(queueTask);
    };
    
    service = new TaskUpdateService(
      queueManager,
      contextInjector,
      ruleManager,
      migration,
      taskFile,
      getCurrentTaskFn,
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

  describe('updateTask()', () => {
    it('should throw error when task not found', async () => {
      await expect(service.updateTask('non-existent', { goal: 'New goal description' })).rejects.toThrow('not found or not active');
    });

    it('should update task goal', async () => {
      const task = await queueManager.createTask('Original goal description');
      const taskId = task.id;
      
      await service.updateTask(taskId, { goal: 'Updated goal description' });

      const activeTask = await queueManager.getActiveTask();
      expect(activeTask?.goal).toBe('Updated goal description');
    });

    it('should add requirement to task', async () => {
      const task = await queueManager.createTask('Test task update');
      const taskId = task.id;
      
      await service.updateTask(taskId, { addReq: 'REQ-V2-003' });

      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      expect((queueTask as any)?.requirements).toContain('REQ-V2-003');
    });

    it('should not duplicate requirements when adding same requirement', async () => {
      const task = await queueManager.createTask('Test task update');
      const taskId = task.id;
      
      await service.updateTask(taskId, { addReq: 'REQ-V2-003' });
      await service.updateTask(taskId, { addReq: 'REQ-V2-003' });

      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      const reqCount = (queueTask as any)?.requirements?.filter((r: string) => r === 'REQ-V2-003').length || 0;
      expect(reqCount).toBe(1);
    });

    it('should update both goal and requirements', async () => {
      const task = await queueManager.createTask('Original goal description');
      const taskId = task.id;
      
      await service.updateTask(taskId, { goal: 'Updated goal description', addReq: 'REQ-V2-004' });

      const activeTask = await queueManager.getActiveTask();
      expect(activeTask?.goal).toBe('Updated goal description');
      
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      expect((queueTask as any)?.requirements).toContain('REQ-V2-004');
    });

    it('should sync file after update', async () => {
      const task = await queueManager.createTask('Test task update');
      const taskId = task.id;
      
      await service.updateTask(taskId, { goal: 'Updated goal description' });

      expect(await fs.pathExists(taskFile)).toBe(true);
      const fileData = await fs.readJson(taskFile);
      expect(fileData.originalGoal).toBe('Updated goal description');
    });

    it('should update context files after update', async () => {
      const task = await queueManager.createTask('Test task update');
      const taskId = task.id;
      
      await service.updateTask(taskId, { goal: 'Updated goal description' });

      expect(await fs.pathExists(path.join(testContextDir, 'STATUS.txt'))).toBe(true);
    });
  });
});

