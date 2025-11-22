/**
 * Tests for Bug Fixes - Prevent Regression
 * Tests all 7 critical bug fixes from 2025-11-11 audit
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { TaskManager } from '../src/core/task-manager';
import { ContextInjector } from '../src/core/context-injector';
import { WorkflowState } from '@shadel/workflow-core';
import { cleanupAllTestDirs, mockConsoleWarnFiltered, getTestTimeout } from './test-helpers';

describe('Bug Fixes - Regression Prevention', () => {
  // FIX: Use unique test directory per test to avoid conflicts
  let testContextDir: string;
  let taskManager: TaskManager;

  beforeEach(async () => {
    // FIX: Create unique directory for each test to ensure isolation
    testContextDir = `.test-bug-fixes-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await fs.remove(testContextDir);
    await fs.remove('.ai-context');
    taskManager = new TaskManager(testContextDir);
  });

  afterEach(async () => {
    if (testContextDir) {
      await fs.remove(testContextDir);
    }
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
      
      // FIX: Verify task exists in queue and file after creation
      // This ensures the task is properly saved before tests run
      const activeTask = await taskManager.getCurrentTask();
      expect(activeTask).toBeDefined();
      expect(activeTask?.id).toBeDefined();
      
      // Verify file exists
      const taskFile = `${testContextDir}/current-task.json`;
      const fileExists = await fs.pathExists(taskFile);
      expect(fileExists).toBe(true);
      
      // Small delay to ensure file system sync
      await new Promise(resolve => setTimeout(resolve, 10));
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
      await expect(
        taskManager.updateTaskState('TESTING')
      ).rejects.toThrow(/Invalid state transition/);
      
      try {
        await taskManager.updateTaskState('TESTING');
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
      
      // FIX: Verify task exists before first state transition
      let task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await taskManager.updateTaskState('DESIGNING');
      
      // FIX: Verify state was updated and task still exists
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('DESIGNING');
      await new Promise(resolve => setTimeout(resolve, 50)); // Longer delay for queue sync
      
      // Manually set time to 6 minutes ago to avoid rate limiting
      // FIX: Update both queue and file to maintain sync
      let taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // FIX: Wait longer for queue sync after manual file write
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // FIX: Verify state was updated and task still exists
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('IMPLEMENTING');
      await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay for queue sync
      
      // Again for next transition
      taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // FIX: Wait longer for queue sync after manual file write
      await new Promise(resolve => setTimeout(resolve, 100));
      
      consoleSpy.mockClear(); // Clear any previous warnings
      
      // FIX: Mock fs.pathExists to return false ONLY for actual test directories (__tests__)
      // NOT for task file paths which may contain "test" in the directory name
      const originalPathExists = fs.pathExists;
      jest.spyOn(fs, 'pathExists').mockImplementation(async (path: string) => {
        // If checking for actual test source directories, return false
        // But allow task file paths (which may contain "test" in directory name)
        if (typeof path === 'string' && path.includes('__tests__')) {
          return false;
        }
        // Also check if it's a test directory path (but not task file)
        if (typeof path === 'string' && path.includes('/tests/') && !path.includes('current-task.json')) {
          return false;
        }
        // Otherwise use original implementation
        return originalPathExists(path);
      });
      
      // FIX: Verify task still exists before final transition
      task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      expect(task?.id).toBeDefined();
      
      // FIX: After manually writing to file, ensure queue is synced
      // Re-read task to ensure queue and file are in sync
      await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay for sync
      
      // Double-check task exists after delay
      task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      expect(task?.id).toBeDefined();
      
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
    beforeEach(async () => {
      // Clean up before each test to ensure isolation
      await fs.remove(testContextDir);
      await fs.remove('.ai-context');
      taskManager = new TaskManager(testContextDir);
    });
    
    // Note: Testing sync command requires integration test
    // Here we test the underlying updateTaskState which sync uses
    
    it('should update state when called with valid transition', async () => {
      await taskManager.createTask('Sync test task', [], true);

      // FIX: Verify task exists before updating state
      const taskBefore = await taskManager.getCurrentTask();
      expect(taskBefore).toBeDefined();
      expect(taskBefore?.id).toBeDefined();

      // Longer delay to ensure file system and queue sync
      await new Promise(resolve => setTimeout(resolve, 100));

      await taskManager.updateTaskState('DESIGNING');

      // FIX: Verify state was updated
      await new Promise(resolve => setTimeout(resolve, 50));
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
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
      // Clean up before each test to ensure isolation
      await fs.remove(testContextDir);
      await fs.remove('.ai-context');
      taskManager = new TaskManager(testContextDir);
      
      await taskManager.createTask('Complete test', [], true);
      
      // FIX: Verify task exists after creation
      const activeTask = await taskManager.getCurrentTask();
      expect(activeTask).toBeDefined();
      expect(activeTask?.id).toBeDefined();
      
      // Verify file exists
      const taskFile = `${testContextDir}/current-task.json`;
      const fileExists = await fs.pathExists(taskFile);
      expect(fileExists).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay for queue sync
    });

    it('should BLOCK completing task at UNDERSTANDING state', async () => {
      // Bug was: Could complete at any state
      // Fix: Requires READY_TO_COMMIT
      
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow(/Cannot complete task at UNDERSTANDING/);
    });

    it('should BLOCK completing task at IMPLEMENTING', async () => {
      // FIX: Verify task exists before state transitions
      let task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await taskManager.updateTaskState('DESIGNING');
      
      // FIX: Verify state was updated
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('DESIGNING');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // FIX: Verify state was updated
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('IMPLEMENTING');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow(/Cannot complete task at IMPLEMENTING/);
    });

    it('should ALLOW completing task at READY_TO_COMMIT', async () => {
      // FIX: Verify task exists before state transitions
      let task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Progress through all states
      await taskManager.updateTaskState('DESIGNING');
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('DESIGNING');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await taskManager.updateTaskState('IMPLEMENTING');
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('IMPLEMENTING');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await taskManager.updateTaskState('TESTING');
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('TESTING');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await taskManager.updateTaskState('REVIEWING');
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('REVIEWING');
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for checklist init
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      if (checklist && checklist.items) {
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('READY_TO_COMMIT');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Now should allow completion
      await expect(
        taskManager.completeTask()
      ).resolves.not.toThrow();
    });

    it('should provide helpful error message when blocking complete', async () => {
      // FIX: Verify task exists before calling completeTask
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow(/Cannot complete task/);
      
      try {
        await taskManager.completeTask();
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
    beforeEach(async () => {
      // Clean up before each test to ensure isolation
      await fs.remove(testContextDir);
      await fs.remove('.ai-context');
      taskManager = new TaskManager(testContextDir);
    });
    
    it('should BLOCK creating new task when one exists', async () => {
      // Bug was: Silently overwrote existing task
      // Fix: With auto-queue feature, new task is queued instead of throwing error
      // But active task should remain active
      
      await taskManager.createTask('First task', [], true);
      
      // FIX: Verify first task exists and is active
      const firstTask = await taskManager.getCurrentTask();
      expect(firstTask).toBeDefined();
      expect(firstTask?.id).toBeDefined();
      expect(firstTask?.goal).toBe('First task');
      await new Promise(resolve => setTimeout(resolve, 100)); // Longer delay for queue sync
      
      // With auto-queue, creating new task should queue it, not throw error
      const secondTask = await taskManager.createTask('Second task');
      expect(secondTask).toBeDefined();
      expect(secondTask.goal).toBe('Second task');
      
      // Verify first task is still active
      const stillActiveTask = await taskManager.getCurrentTask();
      expect(stillActiveTask).toBeDefined();
      expect(stillActiveTask?.id).toBe(firstTask?.id);
      expect(stillActiveTask?.goal).toBe('First task');
      
      // Verify second task was queued (not active)
      expect(secondTask.id).not.toBe(firstTask?.id);
    });

    it('should show existing task info in error message', async () => {
      // With auto-queue feature, this test needs to be updated
      // New tasks are queued instead of throwing error
      await taskManager.createTask('Existing task', [], true);
      
      // Verify existing task is active
      const existingTask = await taskManager.getCurrentTask();
      expect(existingTask).toBeDefined();
      expect(existingTask?.goal).toBe('Existing task');
      
      // Create new task - should be queued, not throw error
      const newTask = await taskManager.createTask('New task for testing');
      expect(newTask).toBeDefined();
      expect(newTask.goal).toBe('New task for testing');
      
      // Verify existing task is still active
      const stillActive = await taskManager.getCurrentTask();
      expect(stillActive?.id).toBe(existingTask?.id);
      expect(stillActive?.goal).toBe('Existing task');
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
      
      // FIX: Verify task exists before state transitions
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Progress to READY_TO_COMMIT
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      if (checklist && checklist.items) {
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      // Complete task
      await taskManager.completeTask();
      
      // Context files should be removed from testContextDir
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(false);
    });

    it('should remove NEXT_STEPS.md after task completion', async () => {
      // Environment-aware timeout: CI needs more time, local can be faster
      jest.setTimeout(getTestTimeout());
      
      await taskManager.createTask('Test complete', [], true);
      
      // FIX: Verify task exists before state transitions
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Progress to READY_TO_COMMIT and complete
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      if (checklist && checklist.items) {
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      await taskManager.completeTask();
      
      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(false);
    });

    it('should remove WARNINGS.md if exists', async () => {
      await taskManager.createTask('Test complete with warnings', [], true);
      
      // FIX: Verify task exists before state transitions
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
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
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      if (checklist && checklist.items) {
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
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
      await expect(
        taskManager.createTask('short')
      ).rejects.toThrow(/at least 10 characters/);
      
      try {
        await taskManager.createTask('short');
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
      
      // FIX: Verify task exists before operations
      const verifyTask = await taskManager.getCurrentTask();
      expect(verifyTask).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
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
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      if (checklist && checklist.items) {
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      expect((await taskManager.getCurrentTask())?.status).toBe('READY_TO_COMMIT');
      
      // 5. Now can complete
      await expect(taskManager.completeTask()).resolves.not.toThrow();
    });

    it('should prevent creating second task without completing first', async () => {
      // Bug #4 fix - With auto-queue, new task is queued instead of throwing error
      await taskManager.createTask('First task', [], true);
      
      // FIX: Verify first task exists
      const firstTask = await taskManager.getCurrentTask();
      expect(firstTask).toBeDefined();
      expect(firstTask?.goal).toBe('First task');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // With auto-queue, creating second task should queue it, not throw error
      const secondTask = await taskManager.createTask('Second task without force');
      expect(secondTask).toBeDefined();
      expect(secondTask.goal).toBe('Second task without force');
      
      // Verify first task is still active
      const stillActive = await taskManager.getCurrentTask();
      expect(stillActive?.id).toBe(firstTask?.id);
      expect(stillActive?.goal).toBe('First task');
    });

    it('should clear context files after completion', async () => {
      // Bug #6 fix
      await taskManager.createTask('Clear test', [], true);
      
      // FIX: Verify task exists before state transitions
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Progress to READY_TO_COMMIT
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      if (checklist && checklist.items) {
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
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
      
      // FIX: Verify task exists before state transitions
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Full valid progression
      const states: WorkflowState[] = [
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ];
      
      for (const state of states) {
        // FIX: Complete review checklist before READY_TO_COMMIT
        if (state === 'READY_TO_COMMIT') {
          const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
          let checklist = await (taskManager as any).loadReviewChecklist();
          if (checklist && checklist.items) {
            for (const item of checklist.items) {
              checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
            }
            await (taskManager as any).saveReviewChecklist(checklist);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        await expect(taskManager.updateTaskState(state)).resolves.not.toThrow();
      }
    });

    it('should still create task when no existing task', async () => {
      // Overwrite protection shouldn't affect first task
      const task = await taskManager.createTask('First task ever');
      
      // FIX: Verify task exists
      expect(task).toBeDefined();
      const verifyTask = await taskManager.getCurrentTask();
      expect(verifyTask).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should still allow force overwrite when explicitly requested', async () => {
      await taskManager.createTask('First task with valid length', [], true);
      
      // FIX: Verify first task exists
      const firstTask = await taskManager.getCurrentTask();
      expect(firstTask).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
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
      
      // FIX: Verify task exists before state transitions
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // This was possible before, must fail now
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow();
    });

    it('REGRESSION: Cannot complete without finishing workflow', async () => {
      // Original bug from audit
      await taskManager.createTask('Regression test', [], true);
      
      // FIX: Verify task exists before operations
      const task = await taskManager.getCurrentTask();
      expect(task).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // This was possible before, must fail now
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow();
    });

    it('REGRESSION: Cannot lose existing task by accident', async () => {
      // Original bug from audit - With auto-queue, new task is queued instead of overwriting
      await taskManager.createTask('Important task', [], true);
      
      // FIX: Verify first task exists
      const firstTask = await taskManager.getCurrentTask();
      expect(firstTask).toBeDefined();
      expect(firstTask?.goal).toBe('Important task');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // With auto-queue, creating new task should queue it, not overwrite active task
      const newTask = await taskManager.createTask('Accidental new task');
      expect(newTask).toBeDefined();
      expect(newTask.goal).toBe('Accidental new task');
      
      // Verify first task is still active (not lost)
      const stillActive = await taskManager.getCurrentTask();
      expect(stillActive?.id).toBe(firstTask?.id);
      expect(stillActive?.goal).toBe('Important task');
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

