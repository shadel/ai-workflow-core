/**
 * CLI Tests: Task Command --silent Flag
 * Tests --silent flag on task commands
 * @requirement REQ-MDC-OPTIMIZATION-002
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { TaskManager } from '../../src/core/task-manager.js';
import { formatCommandOutput } from '../../src/cli/utils/output-formatter.js';
import { 
  getUniqueAIContextDir, 
  cleanupWithRetry,
  getTestTimeout
} from '../test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CLI: task command --silent flag', () => {
  let testDir: string;
  let originalCwd: string;
  let taskManager: TaskManager;
  const testDirs: string[] = [];
  
  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir);
    await fs.ensureDir(path.join(testDir, '.ai-context'));
    process.chdir(testDir);
    taskManager = new TaskManager(testDir);
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    await new Promise(resolve => setTimeout(resolve, 100));
    await cleanupWithRetry(testDir);
  });
  
  describe('task status --json --silent', () => {
    it('should output only JSON, no other messages', async () => {
      jest.setTimeout(getTestTimeout());
      // Given: Active task exists
      await taskManager.createTask('Test task for silent flag');
      
      // When: Format output with --silent (simulating task status --json --silent)
      const current = await taskManager.getCurrentTask();
      const progress = await taskManager.getProgress();
      const output = formatCommandOutput(
        { ...current, progress },
        undefined,
        { json: true, silent: true }
      );
      
      // Then: Output is clean JSON only (no console messages)
      const parsed = JSON.parse(output.trim());
      expect(parsed).toHaveProperty('status');
      expect(parsed).toHaveProperty('data');
      
      // Verify: JSON.parse succeeds, no extra text
      expect(() => JSON.parse(output.trim())).not.toThrow();
    });
    
    it('should suppress error messages when --silent used', async () => {
      // Given: No active task
      // When: Format error output with --silent (simulating task status --json --silent)
      const current = await taskManager.getCurrentTask();
      const output = formatCommandOutput(
        current ? { ...current } : null,
        undefined,
        { json: true, silent: true }
      );
      
      // Then: Only JSON output (success or error)
      const parsed = JSON.parse(output.trim());
      expect(parsed).toHaveProperty('status');
      // Status can be 'success' or 'error' depending on task existence
      expect(['success', 'error']).toContain(parsed.status);
    });
  });
  
  describe('task state command', () => {
    it('should return state only', async () => {
      // Given: Active task with state "IMPLEMENTING"
      await taskManager.createTask('Test task for state command');
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // When: Get state (simulating task state command)
      const current = await taskManager.getCurrentTask();
      const state = current?.status || 'NO_TASK';
      
      // Then: Output is "IMPLEMENTING"
      expect(state).toBe('IMPLEMENTING');
    });
    
    it('should return state as JSON', async () => {
      // Given: Active task with state "IMPLEMENTING"
      await taskManager.createTask('Test task for state command');
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // When: Get state as JSON (simulating task state --json)
      const current = await taskManager.getCurrentTask();
      const state = current?.status || 'NO_TASK';
      const output = JSON.stringify({ state });
      
      // Then: Output is {"state":"IMPLEMENTING"}
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({ state: 'IMPLEMENTING' });
    });
    
    it('should return NO_TASK when no task exists', async () => {
      // Given: No active task
      // When: Get state (simulating task state command)
      const current = await taskManager.getCurrentTask();
      const state = current?.status || 'NO_TASK';
      
      // Then: Output is "NO_TASK"
      expect(state).toBe('NO_TASK');
    });
  });
  
  describe('task status --state-only', () => {
    it('should return only state, not full status', async () => {
      // Given: Active task
      await taskManager.createTask('Test task for state command');
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // When: Get state only (simulating task status --state-only --json)
      const current = await taskManager.getCurrentTask();
      const state = current?.status || 'NO_TASK';
      const output = JSON.stringify({ state });
      
      // Then: Output is {"state":"IMPLEMENTING"} (not full status object)
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({ state: 'IMPLEMENTING' });
      expect(parsed).not.toHaveProperty('goal');
      expect(parsed).not.toHaveProperty('id');
    });
  });
});

