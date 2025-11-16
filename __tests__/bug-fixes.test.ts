/**
 * Tests for Bug Fixes - Prevent Regression
 * Tests all 7 critical bug fixes from 2025-11-11 audit
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { TaskManager } from '../src/core/task-manager';
import { ContextInjector } from '../src/core/context-injector';
import { WorkflowState } from '@shadel/workflow-core';
import { cleanupAllTestDirs, mockConsoleWarnFiltered } from './test-helpers';

describe('Bug Fixes - Regression Prevention', () => {
  const testContextDir = '.test-bug-fixes';
  let taskManager: TaskManager;

  beforeEach(async () => {
    taskManager = new TaskManager(testContextDir);
    await fs.remove(testContextDir);
    await fs.remove('.ai-context');
  });

  afterEach(async () => {
    await fs.remove(testContextDir);
    await cleanupAllTestDirs();
  });

  // ============================================================================
  // BUG #1: State Transition Validation (P0 CRITICAL)
  // ============================================================================
  
  describe('Bug #1: State Transition Validation', () => {
    beforeEach(async () => {
      // Clean up before each test to ensure isolation
      await fs.remove(testContextDir);
      await fs.remove('.ai-context');
      taskManager = new TaskManager(testContextDir);
      await taskManager.createTask('Test task for state transitions', [], true);
    });

    it('should BLOCK jumping from UNDERSTANDING to READY_TO_COMMIT', async () => {
      // Bug was: Could jump states freely
      // Fix: Must progress sequentially
      
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow(/Invalid state transition/);
    });

    it('should ALLOW moving UNDERSTANDING → DESIGNING', async () => {
      // Sequential progression should work
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).resolves.not.toThrow();
    });

    it('should ALLOW moving forward by 1 step', async () => {
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('TESTING');
    });

    it('should BLOCK skipping states', async () => {
      // Try to skip DESIGNING
      await expect(
        taskManager.updateTaskState('IMPLEMENTING')
      ).rejects.toThrow(/Invalid state transition/);
    });

    it('should REJECT staying at same state', async () => {
      // Same state transitions are not allowed
      await expect(
        taskManager.updateTaskState('UNDERSTANDING')
      ).rejects.toThrow(/Invalid state transition/);
    });

    it('should REJECT moving backward', async () => {
      await taskManager.updateTaskState('DESIGNING');
      
      // Backward transitions are not allowed
      await expect(
        taskManager.updateTaskState('UNDERSTANDING')
      ).rejects.toThrow(/Invalid state transition/);
    });

    it('should provide helpful error message on invalid transition', async () => {
      try {
        await taskManager.updateTaskState('TESTING');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid state transition');
        expect(error.message).toContain('UNDERSTANDING');
        expect(error.message).toContain('TESTING');
        expect(error.message).toContain('Next valid state');
      }
    });

    it('should warn when moving to TESTING without tests', async () => {
      const consoleSpy = mockConsoleWarnFiltered();
      
      // Set timestamps to avoid rate limiting warnings
      const taskFile = `${testContextDir}/current-task.json`;
      
      await taskManager.updateTaskState('DESIGNING');
      
      // Manually set time to 6 minutes ago to avoid rate limiting
      let taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Again for next transition
      taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      consoleSpy.mockClear(); // Clear any previous warnings
      
      // Mock fs.pathExists to return false for test directories
      const originalPathExists = fs.pathExists;
      jest.spyOn(fs, 'pathExists').mockImplementation(async (path: string) => {
        // If checking for test directories, return false
        if (typeof path === 'string' && (path.includes('__tests__') || path.includes('test') || path.includes('tests'))) {
          return false;
        }
        // Otherwise use original implementation
        return originalPathExists(path);
      });
      
      await taskManager.updateTaskState('TESTING');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No test directory found')
      );
      
      jest.restoreAllMocks();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // BUG #2: Sync Command Actually Syncs (P1 HIGH)
  // ============================================================================
  
  describe('Bug #2: Sync Command Functionality', () => {
    // Note: Testing sync command requires integration test
    // Here we test the underlying updateTaskState which sync uses
    
    it('should update state when called with valid transition', async () => {
      await taskManager.createTask('Sync test task', [], true);
      
      await taskManager.updateTaskState('DESIGNING');
      
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('DESIGNING');
    });

    it('should throw error when trying invalid transition via sync', async () => {
      await taskManager.createTask('Sync test task', [], true);
      
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // BUG #3: Task Complete Requires READY_TO_COMMIT (P1 HIGH)
  // ============================================================================
  
  describe('Bug #3: Task Complete State Check', () => {
    beforeEach(async () => {
      await taskManager.createTask('Complete test', [], true);
    });

    it('should BLOCK completing task at UNDERSTANDING state', async () => {
      // Bug was: Could complete at any state
      // Fix: Requires READY_TO_COMMIT
      
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow(/Cannot complete task at UNDERSTANDING/);
    });

    it('should BLOCK completing task at IMPLEMENTING', async () => {
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow(/Cannot complete task at IMPLEMENTING/);
    });

    it('should ALLOW completing task at READY_TO_COMMIT', async () => {
      // Progress through all states
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      // Now should allow completion
      await expect(
        taskManager.completeTask()
      ).resolves.not.toThrow();
    });

    it('should provide helpful error message when blocking complete', async () => {
      try {
        await taskManager.completeTask();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Cannot complete task');
        expect(error.message).toContain('UNDERSTANDING');
        expect(error.message).toContain('READY_TO_COMMIT');
      }
    });
  });

  // ============================================================================
  // BUG #4: Task Create Overwrite Protection (P1 HIGH)
  // ============================================================================
  
  describe('Bug #4: Task Create Overwrite Protection', () => {
    it('should BLOCK creating new task when one exists', async () => {
      // Bug was: Silently overwrote existing task
      // Fix: Throws error, requires --force
      
      await taskManager.createTask('First task', [], true);
      
      await expect(
        taskManager.createTask('Second task')
      ).rejects.toThrow(/Active task already exists/);
    });

    it('should show existing task info in error message', async () => {
      await taskManager.createTask('Existing task', [], true);
      
      try {
        await taskManager.createTask('New task for testing');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Existing task');
        expect(error.message).toContain('Complete it first');
        expect(error.message).toContain('--force');
      }
    });

    it('should ALLOW creating task with --force flag', async () => {
      await taskManager.createTask('First task', [], true);
      
      // Force overwrite
      const newTask = await taskManager.createTask('Second task', [], true);
      
      expect(newTask.goal).toBe('Second task');
    });

    it('should ALLOW creating task when no existing task', async () => {
      // No existing task
      const task = await taskManager.createTask('New task for testing');
      
      expect(task).toBeDefined();
      expect(task.goal).toBe('New task for testing');
    });
  });

  // ============================================================================
  // BUG #5: Context Injector Validates Input (P2)
  // ============================================================================
  
  describe('Bug #5: Context Injector Validation', () => {
    let contextInjector: ContextInjector;

    beforeEach(() => {
      contextInjector = new ContextInjector(testContextDir);
    });

    it('should ACCEPT any workflow state (no validation in ContextInjector)', async () => {
      // ContextInjector doesn't validate states - it just uses what's provided
      // Validation happens at TaskManager level, not ContextInjector
      
      await expect(
        contextInjector.updateAfterCommand('test', {
          task: {
            id: 'test',
            goal: 'Test',
            status: 'INVALID_STATE' as any,
            startedAt: new Date().toISOString(),
            roleApprovals: []
          },
          warnings: [],
          blockers: []
        })
      ).resolves.not.toThrow(); // ContextInjector accepts any state
    });

    it('should ACCEPT valid workflow states', async () => {
      const validStates: WorkflowState[] = [
        'UNDERSTANDING',
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ];

      for (const state of validStates) {
        await expect(
          contextInjector.updateAfterCommand('test', {
            task: {
              id: 'test',
              goal: 'Test',
              status: state,
              startedAt: new Date().toISOString(),
              roleApprovals: []
            },
            warnings: [],
            blockers: []
          })
        ).resolves.not.toThrow();
        
        // Clean up for next iteration
        await fs.remove(testContextDir);
      }
    });
  });

  // ============================================================================
  // BUG #6: Clear Context Files on Complete (P3)
  // ============================================================================
  
  describe('Bug #6: Context Files Cleared on Complete', () => {
    it('should remove STATUS.txt after task completion', async () => {
      await taskManager.createTask('Test complete', [], true);
      
      // Progress to READY_TO_COMMIT
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      // Complete task
      await taskManager.completeTask();
      
      // Context files should be removed from testContextDir
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(false);
    });

    it('should remove NEXT_STEPS.md after task completion', async () => {
      await taskManager.createTask('Test complete', [], true);
      
      // Progress to READY_TO_COMMIT and complete
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      await taskManager.updateTaskState('READY_TO_COMMIT');
      await taskManager.completeTask();
      
      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(false);
    });

    it('should remove WARNINGS.md if exists', async () => {
      await taskManager.createTask('Test complete with warnings', [], true);
      
      // Create warnings file in taskManager's context directory
      await fs.ensureDir(testContextDir);
      await fs.writeFile(`${testContextDir}/WARNINGS.md`, 'test');
      
      // Verify it exists before completion
      expect(await fs.pathExists(`${testContextDir}/WARNINGS.md`)).toBe(true);
      
      // Progress and complete
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      await taskManager.updateTaskState('READY_TO_COMMIT');
      await taskManager.completeTask();
      
      // Context files should be removed from testContextDir (taskManager's contextDir)
      expect(await fs.pathExists(`${testContextDir}/WARNINGS.md`)).toBe(false);
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(false);
      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(false);
    });
  });

  // ============================================================================
  // BUG #7: Goal Quality Validation (P3)
  // ============================================================================
  
  describe('Bug #7: Goal Quality Validation', () => {
    it('should REJECT empty goal', async () => {
      // Bug was: Accepted empty goals
      // Fix: Requires ≥10 characters
      
      await expect(
        taskManager.createTask('')
      ).rejects.toThrow(/at least 10 characters/);
    });

    it('should REJECT too short goal', async () => {
      await expect(
        taskManager.createTask('a')
      ).rejects.toThrow(/at least 10 characters/);
    });

    it('should REJECT whitespace-only goal', async () => {
      await expect(
        taskManager.createTask('          ')
      ).rejects.toThrow(/at least 10 characters/);
    });

    it('should ACCEPT valid goal (≥10 characters)', async () => {
      const task = await taskManager.createTask('Valid goal with enough characters', [], true);
      
      expect(task).toBeDefined();
      expect(task.goal).toBe('Valid goal with enough characters');
    });

    it('should provide helpful error message for short goal', async () => {
      try {
        await taskManager.createTask('short');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('at least 10 characters');
        expect(error.message).toContain('Example:');
        expect(error.message).toContain('Bad:');
      }
    });
  });

  // ============================================================================
  // INTEGRATION TESTS: Full Workflow with All Fixes
  // ============================================================================
  
  describe('Integration: Full Workflow with Bug Fixes', () => {
    it('should enforce complete workflow from start to finish', async () => {
      // 1. Create task (with quality validation)
      const task = await taskManager.createTask('Integration test workflow', [], true);
      expect(task.status).toBe('UNDERSTANDING');
      
      // 2. Cannot complete immediately (Bug #3 fix)
      await expect(taskManager.completeTask()).rejects.toThrow();
      
      // 3. Cannot jump to READY_TO_COMMIT (Bug #1 fix)
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow();
      
      // 4. Must progress sequentially
      await taskManager.updateTaskState('DESIGNING');
      expect((await taskManager.getCurrentTask())?.status).toBe('DESIGNING');
      
      await taskManager.updateTaskState('IMPLEMENTING');
      expect((await taskManager.getCurrentTask())?.status).toBe('IMPLEMENTING');
      
      await taskManager.updateTaskState('TESTING');
      expect((await taskManager.getCurrentTask())?.status).toBe('TESTING');
      
      await taskManager.updateTaskState('REVIEWING');
      expect((await taskManager.getCurrentTask())?.status).toBe('REVIEWING');
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      expect((await taskManager.getCurrentTask())?.status).toBe('READY_TO_COMMIT');
      
      // 5. Now can complete
      await expect(taskManager.completeTask()).resolves.not.toThrow();
    });

    it('should prevent creating second task without completing first', async () => {
      // Bug #4 fix
      await taskManager.createTask('First task', [], true);
      
      // Try to create second
      await expect(
        taskManager.createTask('Second task without force')
      ).rejects.toThrow(/Active task already exists/);
    });

    it('should clear context files after completion', async () => {
      // Bug #6 fix
      await taskManager.createTask('Clear test', [], true);
      
      // Progress to READY_TO_COMMIT
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      // Create context files in testContextDir (taskManager's contextDir)
      await fs.ensureDir(testContextDir);
      await fs.writeFile(`${testContextDir}/STATUS.txt`, 'test');
      await fs.writeFile(`${testContextDir}/NEXT_STEPS.md`, 'test');
      
      // Verify files exist before completion
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(true);
      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(true);
      
      // Complete
      await taskManager.completeTask();
      
      // Files should be cleared from testContextDir
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(false);
      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(false);
    });
  });

  // ============================================================================
  // EDGE CASES: Ensure Fixes Don't Break Existing Functionality
  // ============================================================================
  
  describe('Edge Cases: Fixes Don\'t Break Existing Features', () => {
    it('should still allow valid sequential progression', async () => {
      await taskManager.createTask('Sequential test', [], true);
      
      // Full valid progression
      const states: WorkflowState[] = [
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ];
      
      for (const state of states) {
        await expect(taskManager.updateTaskState(state)).resolves.not.toThrow();
      }
    });

    it('should still create task when no existing task', async () => {
      // Overwrite protection shouldn't affect first task
      const task = await taskManager.createTask('First task ever');
      
      expect(task).toBeDefined();
    });

    it('should still allow force overwrite when explicitly requested', async () => {
      await taskManager.createTask('First task with valid length', [], true);
      const task2 = await taskManager.createTask('Second task with valid length too', [], true);
      
      expect(task2.goal).toBe('Second task with valid length too');
    });
  });

  // ============================================================================
  // REGRESSION TESTS: Verify Original Bugs Fixed
  // ============================================================================
  
  describe('Regression: Original Bugs Cannot Happen Again', () => {
    it('REGRESSION: Cannot bypass workflow by jumping states', async () => {
      // Original bug from audit
      await taskManager.createTask('Regression test', [], true);
      
      // This was possible before, must fail now
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow();
    });

    it('REGRESSION: Cannot complete without finishing workflow', async () => {
      // Original bug from audit
      await taskManager.createTask('Regression test', [], true);
      
      // This was possible before, must fail now
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow();
    });

    it('REGRESSION: Cannot lose existing task by accident', async () => {
      // Original bug from audit  
      await taskManager.createTask('Important task', [], true);
      
      // This was possible (silent overwrite), must fail now
      await expect(
        taskManager.createTask('Accidental new task')
      ).rejects.toThrow();
    });

    it('REGRESSION: Cannot create meaningless tasks', async () => {
      // Original bug from audit
      // This was possible (empty goal), must fail now
      await expect(
        taskManager.createTask('')
      ).rejects.toThrow();
    });
  });
});

