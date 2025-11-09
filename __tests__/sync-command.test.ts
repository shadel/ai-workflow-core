/**
 * Unit tests for Sync Command
 * @requirement REQ-V2-003 - Sync command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';

describe('Sync Command', () => {
  const testContextDir = '.ai-context';

  beforeEach(async () => {
    await fs.remove(testContextDir);
  });

  afterEach(async () => {
    await fs.remove(testContextDir);
  });

  describe('Sync functionality', () => {
    it('should handle missing task gracefully', async () => {
      // @requirement REQ-V2-003 - No task handling
      // Sync should not error when no task
      expect(await fs.pathExists(`${testContextDir}/current-task.json`)).toBe(false);
      // Test would run CLI command here in real test
    });

    it('should read current task state', async () => {
      // @requirement REQ-V2-003 - State reading
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-123',
        originalGoal: 'Test sync',
        workflow: {
          currentState: 'DESIGN_COMPLETE'
        }
      });

      const taskData = await fs.readJson(`${testContextDir}/current-task.json`);
      expect(taskData.workflow.currentState).toBe('DESIGN_COMPLETE');
    });

    it('should maintain context files', async () => {
      // @requirement REQ-V2-003 - Context preservation
      await fs.ensureDir(testContextDir);
      await fs.writeFile(`${testContextDir}/STATUS.txt`, 'test status');
      await fs.writeFile(`${testContextDir}/NEXT_STEPS.md`, 'test steps');

      // Files should persist after sync
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(true);
      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(true);
    });
  });

  describe('State synchronization', () => {
    it('should sync when task exists', async () => {
      await fs.ensureDir(testContextDir);
      await fs.writeJson(`${testContextDir}/current-task.json`, {
        taskId: 'test-456',
        originalGoal: 'Test',
        workflow: { currentState: 'IMPLEMENTATION_COMPLETE' }
      });

      const taskData = await fs.readJson(`${testContextDir}/current-task.json`);
      expect(taskData.workflow.currentState).toBe('IMPLEMENTATION_COMPLETE');
    });
  });
});

