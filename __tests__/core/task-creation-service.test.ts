/**
 * Unit tests for TaskCreationService
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskCreationService } from '../../src/core/task-creation-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { ContextInjector } from '../../src/core/context-injector.js';
import { RoleSystem } from '../../src/core/role-system.js';
import { RuleManager } from '../../src/utils/rule-manager.js';
import { TaskMigration } from '../../src/utils/migration.js';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskCreationService', () => {
  let service: TaskCreationService;
  let testContextDir: string;
  let taskFile: string;
  let queueManager: TaskQueueManager;
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
    contextInjector = new ContextInjector(testContextDir);
    roleSystem = new RoleSystem();
    ruleManager = new RuleManager();
    migration = new TaskMigration(testContextDir);
    
    const syncFileFromQueueFn = async (queueTask: any, preserveFields: string[]) => {
      const { TaskFileSync } = await import('../../src/core/task-file-sync.js');
      const fileSync = new TaskFileSync(testContextDir);
      await fileSync.syncFromQueue(queueTask);
    };
    
    service = new TaskCreationService(
      queueManager,
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

  describe('createTask()', () => {
    it('should throw error when goal is too short', async () => {
      await expect(service.createTask('short')).rejects.toThrow('Task goal must be at least 10 characters');
    });

    it('should throw error when goal is empty', async () => {
      await expect(service.createTask('')).rejects.toThrow('Task goal must be at least 10 characters');
    });

    it('should create task with valid goal', async () => {
      const task = await service.createTask('Implement user authentication feature');

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.goal).toBe('Implement user authentication feature');
      expect(task.status).toBe('UNDERSTANDING');
    });

    it('should create task with requirements', async () => {
      const task = await service.createTask('Implement user authentication', ['REQ-V2-003']);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      
      // Verify requirements are stored
      const queueTask = await queueManager.getActiveTask();
      expect(queueTask).not.toBeNull();
      const queue = await (queueManager as any).loadQueue();
      const queueTaskInQueue = queue.tasks.find((t: any) => t.id === task.id);
      expect((queueTaskInQueue as any)?.requirements).toContain('REQ-V2-003');
    });

    it('should sync file when task is ACTIVE', async () => {
      const task = await service.createTask('Test task creation');

      expect(await fs.pathExists(taskFile)).toBe(true);
      const fileData = await fs.readJson(taskFile);
      expect(fileData.taskId).toBe(task.id);
    });

    it('should queue task when active task exists', async () => {
      // Create first task
      await service.createTask('First active task');

      // Create second task (should be queued)
      const secondTask = await service.createTask('Second queued task');

      const activeTask = await queueManager.getActiveTask();
      expect(activeTask?.goal).toBe('First active task');
      
      const queue = await (queueManager as any).loadQueue();
      const queuedTask = queue.tasks.find((t: any) => t.id === secondTask.id);
      expect(queuedTask?.status).toBe('QUEUED');
    });

    it('should force activate task when force=true', async () => {
      // Create first task
      await service.createTask('First task');

      // Force create second task
      const secondTask = await service.createTask('Second task', [], true);

      const activeTask = await queueManager.getActiveTask();
      expect(activeTask?.id).toBe(secondTask.id);
      expect(activeTask?.goal).toBe('Second task');
    });

    it('should activate roles based on task goal', async () => {
      const task = await service.createTask('Implement security authentication feature');

      expect(task).toBeDefined();
      // Verify context files were created (indicates role activation)
      expect(await fs.pathExists(path.join(testContextDir, 'STATUS.txt'))).toBe(true);
    });
  });
});

