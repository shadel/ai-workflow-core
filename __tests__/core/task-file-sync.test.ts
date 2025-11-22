/**
 * Unit tests for TaskFileSync
 * @requirement REQ-V2-003 - Task file synchronization tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskFileSync, type TaskFileData } from '../../src/core/task-file-sync.js';
import type { Task as QueueTask } from '../../src/core/task-queue.js';
import { cleanupAllTestDirs } from '../test-helpers.js';

describe('TaskFileSync', () => {
  let testContextDir: string;
  let fileSync: TaskFileSync;

  beforeEach(async () => {
    testContextDir = path.join(os.tmpdir(), `test-task-file-sync-${Date.now()}`);
    await fs.ensureDir(testContextDir);
    fileSync = new TaskFileSync(testContextDir);
  });

  afterEach(async () => {
    await fs.remove(testContextDir).catch(() => {});
  });

  describe('syncFromQueue()', () => {
    it('should sync queue task to file', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      await fileSync.syncFromQueue(queueTask);

      const fileData = await fs.readJson(path.join(testContextDir, 'current-task.json'));
      expect(fileData.taskId).toBe(queueTask.id);
      expect(fileData.originalGoal).toBe(queueTask.goal);
      expect(fileData.workflow.currentState).toBe(queueTask.workflow?.currentState);
    });

    it('should sync reviewChecklist from queue', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'REVIEWING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        },
        reviewChecklist: {
          items: [
            {
              id: 'item-1',
              description: 'Test item',
              category: 'manual',
              completed: false
            }
          ]
        }
      };

      await fileSync.syncFromQueue(queueTask);

      const fileData = await fs.readJson(path.join(testContextDir, 'current-task.json'));
      expect(fileData.reviewChecklist).toBeDefined();
      expect(fileData.reviewChecklist?.items).toHaveLength(1);
      expect(fileData.reviewChecklist?.items[0].id).toBe('item-1');
    });

    it('should preserve specified fields from existing file', async () => {
      // Create existing file with requirements
      const existingFile: TaskFileData = {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        },
        requirements: ['req1', 'req2']
      };

      await fs.writeJson(path.join(testContextDir, 'current-task.json'), existingFile, { spaces: 2 });

      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'DESIGNING',
          stateEnteredAt: '2025-01-01T01:00:00Z',
          stateHistory: []
        }
      };

      await fileSync.syncFromQueue(queueTask, { preserveFields: ['requirements'] });

      const fileData = await fs.readJson(path.join(testContextDir, 'current-task.json'));
      expect(fileData.requirements).toEqual(['req1', 'req2']);
      expect(fileData.workflow.currentState).toBe('DESIGNING'); // Updated from queue
    });

    it('should create backup before sync if enabled', async () => {
      const existingFile: TaskFileData = {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      await fs.writeJson(path.join(testContextDir, 'current-task.json'), existingFile, { spaces: 2 });

      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Updated task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'DESIGNING',
          stateEnteredAt: '2025-01-01T01:00:00Z',
          stateHistory: []
        }
      };

      await fileSync.syncFromQueue(queueTask, { backup: true });

      const backupDir = path.join(testContextDir, 'backups');
      const backups = await fs.readdir(backupDir);
      expect(backups.length).toBeGreaterThan(0);
      expect(backups.some(f => f.startsWith('current-task.json.backup.'))).toBe(true);
    });
  });

  describe('detectManualEdit()', () => {
    it('should detect manual edit when file differs from queue', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      // Sync first
      await fileSync.syncFromQueue(queueTask);

      // Manually edit file
      const fileData = await fs.readJson(path.join(testContextDir, 'current-task.json'));
      fileData.workflow.currentState = 'DESIGNING'; // Manual edit
      await fs.writeJson(path.join(testContextDir, 'current-task.json'), fileData, { spaces: 2 });

      const detected = await fileSync.detectManualEdit(queueTask);
      expect(detected).toBe(true);
    });

    it('should return false when file matches queue', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      await fileSync.syncFromQueue(queueTask);

      // Wait a bit for file system to sync
      await new Promise(resolve => setTimeout(resolve, 50));

      const detected = await fileSync.detectManualEdit(queueTask);
      expect(detected).toBe(false);
    });

    it('should return false when file does not exist', async () => {
      const queueTask: QueueTask = {
        id: 'task-123',
        goal: 'Test task',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      const detected = await fileSync.detectManualEdit(queueTask);
      expect(detected).toBe(false);
    });
  });

  describe('backupFile()', () => {
    it('should create backup file', async () => {
      const fileData: TaskFileData = {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      await fs.writeJson(path.join(testContextDir, 'current-task.json'), fileData, { spaces: 2 });

      await fileSync.backupFile();

      const backupDir = path.join(testContextDir, 'backups');
      const backups = await fs.readdir(backupDir);
      expect(backups.length).toBeGreaterThan(0);

      const backupFile = path.join(backupDir, backups[0]);
      const backupData = await fs.readJson(backupFile);
      expect(backupData.taskId).toBe(fileData.taskId);
    });

    it('should keep only last 5 backups', async () => {
      const fileData: TaskFileData = {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      await fs.writeJson(path.join(testContextDir, 'current-task.json'), fileData, { spaces: 2 });

      // Create 7 backups
      for (let i = 0; i < 7; i++) {
        await fileSync.backupFile();
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for timestamp
      }

      const backupDir = path.join(testContextDir, 'backups');
      const backups = await fs.readdir(backupDir);
      const backupFiles = backups.filter(f => f.startsWith('current-task.json.backup.'));
      expect(backupFiles.length).toBeLessThanOrEqual(5);
    });
  });

  describe('rollbackFromBackup()', () => {
    it('should restore file from latest backup', async () => {
      const originalFile: TaskFileData = {
        taskId: 'task-123',
        originalGoal: 'Original task',
        status: 'in_progress',
        startedAt: '2025-01-01T00:00:00Z',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: '2025-01-01T00:00:00Z',
          stateHistory: []
        }
      };

      await fs.writeJson(path.join(testContextDir, 'current-task.json'), originalFile, { spaces: 2 });
      await fileSync.backupFile();

      // Modify file
      const modifiedFile = { ...originalFile, originalGoal: 'Modified task' };
      await fs.writeJson(path.join(testContextDir, 'current-task.json'), modifiedFile, { spaces: 2 });

      // Rollback
      await fileSync.rollbackFromBackup();

      const restoredFile = await fs.readJson(path.join(testContextDir, 'current-task.json'));
      expect(restoredFile.originalGoal).toBe('Original task');
    });
  });
});

