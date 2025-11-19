/**
 * Unit tests for TaskMigration utility
 * @requirement FREE-TIER-001 - Task Queue Management
 */

import { TaskMigration, MigrationResult } from '../../src/utils/migration.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('TaskMigration', () => {
  let tempDir: string;
  let migration: TaskMigration;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `migration-test-${Date.now()}`);
    migration = new TaskMigration(tempDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('needsMigration()', () => {
    it('should return false when no current-task.json exists', async () => {
      const needs = await migration.needsMigration();
      expect(needs).toBe(false);
    });

    it('should return true when current-task.json exists but tasks.json does not', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'current-task.json'), {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress',
        startedAt: new Date().toISOString()
      });

      const needs = await migration.needsMigration();
      expect(needs).toBe(true);
    });

    it('should return true when tasks.json is empty', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'current-task.json'), {
        taskId: 'task-123',
        originalGoal: 'Test task',
        status: 'in_progress'
      });
      await fs.writeJson(path.join(tempDir, 'tasks.json'), {
        tasks: [],
        activeTaskId: null,
        metadata: { totalTasks: 0, queuedCount: 0, activeCount: 0, completedCount: 0, archivedCount: 0, lastUpdated: '' }
      });

      const needs = await migration.needsMigration();
      expect(needs).toBe(true);
    });

    it('should return false when tasks.json has tasks', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'current-task.json'), {
        taskId: 'task-123',
        originalGoal: 'Test task'
      });
      await fs.writeJson(path.join(tempDir, 'tasks.json'), {
        tasks: [{ id: 'task-123', goal: 'Test', status: 'ACTIVE', createdAt: new Date().toISOString() }],
        activeTaskId: 'task-123',
        metadata: { totalTasks: 1, queuedCount: 0, activeCount: 1, completedCount: 0, archivedCount: 0, lastUpdated: '' }
      });

      const needs = await migration.needsMigration();
      expect(needs).toBe(false);
    });
  });

  describe('migrate()', () => {
    it('should return success=false when migration not needed', async () => {
      const result = await migration.migrate();
      expect(result.success).toBe(true);
      expect(result.migrated).toBe(false);
    });

    it('should create backup when migrating', async () => {
      await fs.ensureDir(tempDir);
      const currentTask = {
        taskId: 'task-123',
        originalGoal: 'Test task with enough characters to be valid',
        status: 'in_progress',
        startedAt: new Date().toISOString()
      };
      await fs.writeJson(path.join(tempDir, 'current-task.json'), currentTask);

      const result = await migration.migrate();

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(true);
      expect(result.backupCreated).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(await fs.pathExists(result.backupPath!)).toBe(true);
    });

    it('should preserve workflow state during migration', async () => {
      await fs.ensureDir(tempDir);
      const currentTask = {
        taskId: 'task-123',
        originalGoal: 'Test task with enough characters to be valid',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        workflow: {
          currentState: 'IMPLEMENTING',
          stateEnteredAt: new Date().toISOString(),
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() }
          ]
        }
      };
      await fs.writeJson(path.join(tempDir, 'current-task.json'), currentTask);

      await migration.migrate();

      const tasksData = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const migratedTask = tasksData.tasks[0];
      expect(migratedTask.workflow).toBeDefined();
      expect(migratedTask.workflow.currentState).toBe('IMPLEMENTING');
      expect(migratedTask.workflow.stateHistory).toHaveLength(1);
    });

    it('should detect priority from goal', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'current-task.json'), {
        taskId: 'task-123',
        originalGoal: 'Fix critical bug in authentication system',
        status: 'in_progress'
      });

      await migration.migrate();

      const tasksData = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const migratedTask = tasksData.tasks[0];
      expect(migratedTask.priority).toBe('CRITICAL');
    });

    it('should use MEDIUM as default priority', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'current-task.json'), {
        taskId: 'task-123',
        originalGoal: 'Regular task with enough characters to be valid',
        status: 'in_progress'
      });

      await migration.migrate();

      const tasksData = await fs.readJson(path.join(tempDir, 'tasks.json'));
      const migratedTask = tasksData.tasks[0];
      expect(migratedTask.priority).toBe('MEDIUM');
    });

    it('should handle dry-run mode', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'current-task.json'), {
        taskId: 'task-123',
        originalGoal: 'Test task with enough characters to be valid',
        status: 'in_progress'
      });

      const result = await migration.migrate(true); // dry-run

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(true);
      expect(result.backupCreated).toBe(true);
      expect(result.backupPath).toBeUndefined(); // No backup in dry-run
      expect(await fs.pathExists(path.join(tempDir, 'tasks.json'))).toBe(false); // No file created
    });

    it('should handle missing goal field', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeJson(path.join(tempDir, 'current-task.json'), {
        taskId: 'task-123',
        status: 'in_progress'
        // No goal or originalGoal
      });

      const result = await migration.migrate();

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(true);
    });

    it('should handle corrupted current-task.json gracefully', async () => {
      await fs.ensureDir(tempDir);
      await fs.writeFile(path.join(tempDir, 'current-task.json'), 'invalid json');

      const result = await migration.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

