/**
 * BUG-013: Ensure `task complete` on already-completed task returns success (exit 0)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { cleanupWithRetry } from '../test-helpers.js';

const execFileAsync = promisify(execFile);

describe('CLI: task complete on already-completed task (BUG-013)', () => {
  let testDir: string;
  let originalCwd: string;
  let cliAbs: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    originalCwd = process.cwd();
    testDir = path.join(os.tmpdir(), `test-bug13-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    testDirs.push(testDir); // Track for cleanup
    cliAbs = path.join(originalCwd, 'dist', 'cli', 'index.js');
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  it('should return success and message on already-completed task', async () => {
    // Seed an already-completed task
    const ctxDir = path.join(testDir, '.ai-context');
    await fs.ensureDir(ctxDir);
    const now = new Date();
    const earlier = new Date(now.getTime() - 5 * 60 * 1000);
    await fs.writeJson(path.join(ctxDir, 'current-task.json'), {
      taskId: 'task-bug13-test',
      originalGoal: 'Bug13 test',
      status: 'completed',
      startedAt: earlier.toISOString(),
      completedAt: now.toISOString(),
      workflow: { currentState: 'READY_TO_COMMIT' }
    }, { spaces: 2 });

    // Invoke `task complete` → should detect already completed and exit 0
    const first = await execFileAsync('node', [cliAbs, 'task', 'complete'], {
      env: process.env,
      cwd: testDir,
    });
    expect(first.stdout).toMatch(/Task already completed|✅ Task already completed!/);

    // Invoke again remains successful
    const second = await execFileAsync('node', [cliAbs, 'task', 'complete'], {
      env: process.env,
      cwd: testDir,
    });
    expect(second.stdout).toMatch(/Task already completed|✅ Task already completed!/);
  });
});
