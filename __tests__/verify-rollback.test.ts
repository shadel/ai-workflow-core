/**
 * Rollback Testing
 * 
 * Phase 8.7: Rollback Testing
 * Tests backup creation, restore, and recovery mechanisms.
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskManager } from '../src/core/task-manager.js';
import { TaskFileSync } from '../src/core/task-file-sync.js';
import { getUniqueAIContextDir, cleanupWithRetry } from './test-helpers.js';

describe('Phase 8.7: Rollback Testing', () => {
  let testDir: string;
  let taskManager: TaskManager;
  let fileSync: TaskFileSync;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir); // Track for cleanup
    await fs.ensureDir(testDir);
    taskManager = new TaskManager(testDir);
    fileSync = new TaskFileSync(testDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('8.7.1: Test backup creation', () => {
    it('should create backup before file modification', async () => {
      await taskManager.createTask('Test backup creation functionality');

      const filePath = path.join(testDir, 'current-task.json');

      // Verify file exists
      expect(await fs.pathExists(filePath)).toBe(true);

      // Manually trigger backup (simulating sync operation)
      const fileData = await fs.readJson(filePath);
      await fileSync.backupFile();

      // Verify backup created (backup is in backups/ directory)
      const backupDir = path.join(testDir, 'backups');
      const backups = await fs.readdir(backupDir);
      const backupFilesList = backups.filter(f => f.startsWith('current-task.json.backup.'));
      expect(backupFilesList.length).toBeGreaterThan(0);
      
      // Verify backup content matches original
      const latestBackup = path.join(backupDir, backupFilesList[0]);
      const backupData = await fs.readJson(latestBackup);
      expect(backupData.taskId).toBe(fileData.taskId);
      expect(backupData.originalGoal).toBe(fileData.originalGoal);
    });
  });

  describe('8.7.2: Test restore from backup', () => {
    it('should restore file from backup correctly', async () => {
      await taskManager.createTask('Test restore from backup functionality');

      const filePath = path.join(testDir, 'current-task.json');
      const originalData = await fs.readJson(filePath);

      // Create backup
      await fileSync.backupFile();

      // Corrupt file
      await fs.writeFile(filePath, '{ corrupted }');

      // Restore from backup
      const hasBackup = await (fileSync as any).hasBackup();
      expect(hasBackup).toBe(true);

      await fileSync.rollbackFromBackup();

      // Verify file restored
      const restoredData = await fs.readJson(filePath);
      expect(restoredData.taskId).toBe(originalData.taskId);
      expect(restoredData.originalGoal).toBe(originalData.originalGoal);
    });
  });

  describe('8.7.3: Test recovery from sync failure', () => {
    it('should recover from sync failure using backup', async () => {
      await taskManager.createTask('Test recovery from sync failure');

      const filePath = path.join(testDir, 'current-task.json');
      const originalData = await fs.readJson(filePath);

      // Create backup
      await fileSync.backupFile();

      // Simulate sync failure (corrupt file during sync)
      try {
        await fs.writeFile(filePath, '{ sync failure }');
        // Simulate failed sync operation
        throw new Error('Sync failed');
      } catch (error) {
        // Recovery: restore from backup
        if (await (fileSync as any).hasBackup()) {
          await fileSync.rollbackFromBackup();
        }
      }

      // Verify recovery
      const recoveredData = await fs.readJson(filePath);
      expect(recoveredData.taskId).toBe(originalData.taskId);
      expect(recoveredData.originalGoal).toBe(originalData.originalGoal);
    });
  });

  describe('8.7.4: Test recovery from validation failure', () => {
    it('should recover from validation failure using backup', async () => {
      await taskManager.createTask('Test recovery from validation failure');

      const filePath = path.join(testDir, 'current-task.json');
      const originalData = await fs.readJson(filePath);

      // Create backup
      await fileSync.backupFile();

      // Simulate validation failure (invalid data)
      try {
        const invalidData = {
          ...originalData,
          workflow: {
            currentState: 'INVALID_STATE', // Invalid state
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          }
        };
        await fs.writeJson(filePath, invalidData, { spaces: 2 });

        // Simulate validation failure
        throw new Error('Validation failed');
      } catch (error) {
        // Recovery: restore from backup
        if (await (fileSync as any).hasBackup()) {
          await fileSync.rollbackFromBackup();
        }
      }

      // Verify recovery
      const recoveredData = await fs.readJson(filePath);
      expect(recoveredData.taskId).toBe(originalData.taskId);
      expect(recoveredData.workflow.currentState).toBe(originalData.workflow.currentState);
    });
  });

  describe('8.7.5: Verify rollback works correctly', () => {
    it('should handle rollback in all scenarios', async () => {
      await taskManager.createTask('Test comprehensive rollback scenarios');

      const filePath = path.join(testDir, 'current-task.json');
      const originalData = await fs.readJson(filePath);

      // Scenario 1: File corruption
      await fileSync.backupFile();
      await fs.writeFile(filePath, '{ corrupted }');
      await fileSync.rollbackFromBackup();
      let recovered = await fs.readJson(filePath);
      expect(recovered.taskId).toBe(originalData.taskId);

      // Scenario 2: Invalid data
      await fileSync.backupFile();
      await fs.writeJson(filePath, { invalid: 'data' }, { spaces: 2 });
      await fileSync.rollbackFromBackup();
      recovered = await fs.readJson(filePath);
      expect(recovered.taskId).toBe(originalData.taskId);

      // Scenario 3: Missing file
      await fileSync.backupFile();
      await fs.remove(filePath);
      await fileSync.rollbackFromBackup();
      expect(await fs.pathExists(filePath)).toBe(true);
      recovered = await fs.readJson(filePath);
      expect(recovered.taskId).toBe(originalData.taskId);
    });
  });
});

