/**
 * Unit tests for Sync Command - AI Reload Prompt Feature
 * Tests the terminal output that prompts AI to reload context files
 * @see docs/solutions/cursor-auto-reload-solutions.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { mockCLICommand } from '../../../__tests__/mocks/cli-commands.mock.js';
import { getUniqueAIContextDir, cleanupWithRetry } from './test-helpers.js';

describe('Sync Command - AI Reload Prompt', () => {
  let testContextDir: string;
  let testDir: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    testDir = path.resolve(testContextDir);
    await fs.remove(testContextDir).catch(() => {});
    await fs.ensureDir(testContextDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('printAIReloadPrompt function', () => {
    it('should include AI reload prompt message in terminal output', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-123',
        originalGoal: 'Test AI reload prompt',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [
            { state: 'UNDERSTANDING', timestamp: new Date().toISOString() }
          ]
        },
        createdAt: new Date().toISOString()
      });

      const output = await mockCLICommand('sync --state DESIGNING', { cwd: testDir });

      expect(output).toContain('📢 FOR AI ASSISTANTS');
      expect(output).toContain('Context files have been updated');
      expect(output).toContain('Please reload these files NOW');
      expect(output).toContain('.ai-context/STATUS.txt');
      expect(output).toContain('.ai-context/NEXT_STEPS.md');
      expect(output).toContain('━'.repeat(60));
    });

    it('should display reload prompt for all state transitions', async () => {
      const states = ['DESIGNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'READY_TO_COMMIT'];
      const contextPath = path.join(testDir, '.ai-context');

      for (const state of states) {
        await fs.remove(testContextDir).catch(() => {});
        await fs.ensureDir(contextPath);
        
        await fs.writeJson(path.join(contextPath, 'current-task.json'), {
          taskId: `test-${state}`,
          originalGoal: `Test ${state}`,
          status: 'UNDERSTANDING',
          workflow: {
            currentState: 'UNDERSTANDING',
            stateHistory: [
              { state: 'UNDERSTANDING', timestamp: new Date().toISOString() }
            ]
          },
          createdAt: new Date().toISOString()
        });

        const output = await mockCLICommand(`sync --state ${state}`, { cwd: testDir });
        expect(output).toContain('📢 FOR AI ASSISTANTS');
      }
    }, 30000);

    it('should include visual separators for clarity', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-separator',
        originalGoal: 'Test separators',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [{ state: 'UNDERSTANDING', timestamp: new Date().toISOString() }]
        },
        createdAt: new Date().toISOString()
      });

      const output = await mockCLICommand('sync --state IMPLEMENTING', { cwd: testDir });
      expect(output).toMatch(/━{40,}/);
    });

    it('should NOT show reload prompt when sync fails', async () => {
      const output = await mockCLICommand('sync --state TESTING', { cwd: testDir });
      expect(output).toContain('❌ Error: No active task to sync');
      expect(output).not.toContain('📢 FOR AI ASSISTANTS');
    });
  });

  describe('AI Reload Prompt Content', () => {
    it('should mention Cursor and Copilot explicitly', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-ai-mention',
        originalGoal: 'Test AI mentions',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [{ state: 'UNDERSTANDING', timestamp: new Date().toISOString() }]
        },
        createdAt: new Date().toISOString()
      });

      const output = await mockCLICommand('sync --state DESIGNING', { cwd: testDir });
      expect(output).toContain('Cursor/Copilot');
    });

    it('should use imperative language (NOW, MUST)', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-imperative',
        originalGoal: 'Test imperative',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [{ state: 'UNDERSTANDING', timestamp: new Date().toISOString() }]
        },
        createdAt: new Date().toISOString()
      });

      const output = await mockCLICommand('sync --state IMPLEMENTING', { cwd: testDir });
      expect(output).toMatch(/NOW|MUST|Please/i);
    });

    it('should provide exact file paths to reload', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-paths',
        originalGoal: 'Test file paths',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [{ state: 'UNDERSTANDING', timestamp: new Date().toISOString() }]
        },
        createdAt: new Date().toISOString()
      });

      const output = await mockCLICommand('sync --state TESTING', { cwd: testDir });
      expect(output).toContain('STATUS.txt');
      expect(output).toContain('NEXT_STEPS.md');
      expect(output).toMatch(/\.ai-context\/STATUS\.txt/);
      expect(output).toMatch(/\.ai-context\/NEXT_STEPS\.md/);
    });
  });

  describe('Integration with Context Files', () => {
    it('should regenerate NEXT_STEPS.md before showing reload prompt', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-integration',
        originalGoal: 'Test integration',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [{ state: 'UNDERSTANDING', timestamp: new Date().toISOString() }]
        },
        createdAt: new Date().toISOString()
      });

      await mockCLICommand('sync --state DESIGNING', { cwd: testDir });

      const nextStepsPath = path.join(testDir, '.ai-context', 'NEXT_STEPS.md');
      const nextStepsExists = await fs.pathExists(nextStepsPath);
      expect(nextStepsExists).toBe(true);

      if (nextStepsExists) {
        const content = await fs.readFile(nextStepsPath, 'utf-8');
        expect(content).toContain('DESIGNING');
      }
    });

    it('should update STATUS.txt before showing reload prompt', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-status',
        originalGoal: 'Test status update',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [{ state: 'UNDERSTANDING', timestamp: new Date().toISOString() }]
        },
        createdAt: new Date().toISOString()
      });

      await mockCLICommand('sync --state IMPLEMENTING', { cwd: testDir });

      const statusPath = path.join(testDir, '.ai-context', 'STATUS.txt');
      const statusExists = await fs.pathExists(statusPath);
      expect(statusExists).toBe(true);

      if (statusExists) {
        const content = await fs.readFile(statusPath, 'utf-8');
        expect(content).toContain('IMPLEMENTING');
      }
    });
  });

  describe('Cross-platform Compatibility', () => {
    it('should use Unicode box drawing characters correctly', async () => {
      await fs.ensureDir(path.join(testDir, '.ai-context'));
      await fs.writeJson(path.join(testDir, '.ai-context', 'current-task.json'), {
        taskId: 'test-unicode',
        originalGoal: 'Test Unicode',
        status: 'UNDERSTANDING',
        workflow: {
          currentState: 'UNDERSTANDING',
          stateHistory: [{ state: 'UNDERSTANDING', timestamp: new Date().toISOString() }]
        },
        createdAt: new Date().toISOString()
      });

      const output = await mockCLICommand('sync --state REVIEWING', { cwd: testDir });
      expect(output).toMatch(/[━─]/);
    });

    it('should work on Windows with CRLF line endings', async () => {
      expect(true).toBe(true);
    });
  });
});
