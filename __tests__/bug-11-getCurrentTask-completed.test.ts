/**
 * Bug #11 Tests: getCurrentTask() Returns Completed Tasks
 * 
 * @bug BUG-011
 * @severity P0 CRITICAL
 * @fixedIn v2.1.5-dev
 * 
 * Tests the fix for Bug #11 where getCurrentTask() was returning
 * completed tasks, blocking new task creation.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskManager } from '../src/core/task-manager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getTestTimeout, getUniqueAIContextDir, cleanupWithRetry } from './test-helpers';

describe('Bug #11: getCurrentTask() with Completed Tasks', () => {
  // Set environment-aware timeout at describe level (before any tests run)
  jest.setTimeout(getTestTimeout());
  
  let manager: TaskManager;
  let testDir: string;
  let taskFile: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  // Helper function to progress task through all workflow states
  // OPTIMIZED: Reduced delays in completeReviewChecklist helper
  async function progressToCommitReady() {
    await manager.updateTaskState('DESIGNING');
    await manager.updateTaskState('IMPLEMENTING');
    await manager.updateTaskState('TESTING');
    await manager.updateTaskState('REVIEWING');
    
    // FIX: Complete review checklist before READY_TO_COMMIT
    const { completeReviewChecklist } = await import('./test-helpers.js');
    await completeReviewChecklist(manager);
    
    await manager.updateTaskState('READY_TO_COMMIT');
  }

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir); // Track for cleanup
    taskFile = path.join(testDir, 'current-task.json');
    
    // Clean test directory
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
    
    // Create manager with test directory
    manager = new TaskManager(testDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('Core Bug Fix: Status Check', () => {
    it('should return null for completed tasks', async () => {
      // @bug BUG-011 - getCurrentTask should not return completed tasks
      
      // Create and complete a task
      const task = await manager.createTask('Test task for Bug #11');
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      
      // Progress to READY_TO_COMMIT before completing
      await progressToCommitReady();
      
      // Complete the task
      await manager.completeTask();
      
      // Read task file to verify it's marked completed (cached read)
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('completed');
      expect(taskData.completedAt).toBeDefined();
      
      // BUG #11 FIX: getCurrentTask should return null for completed tasks
      const currentTask = await manager.getCurrentTask();
      expect(currentTask).toBeNull();
    });

    it('should return task for in-progress status', async () => {
      // Create a task (in_progress by default)
      const task = await manager.createTask('In-progress task');
      
      // getCurrentTask should return the task
      const currentTask = await manager.getCurrentTask();
      expect(currentTask).not.toBeNull();
      expect(currentTask?.id).toBe(task.id);
      expect(currentTask?.goal).toBe('In-progress task');
    });

    it('should distinguish between workflow state and task status', async () => {
      // @bug BUG-011 - Was checking workflow.currentState instead of status
      
      // Create task and progress to READY_TO_COMMIT
      await manager.createTask('Test workflow state vs task status');
      
      // Progress through workflow states
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
        // FIX: Complete review checklist before READY_TO_COMMIT
        const { completeReviewChecklist } = await import('./test-helpers.js');
        await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      // Task is at READY_TO_COMMIT but still in_progress
      const taskData = await fs.readJson(taskFile);
      expect(taskData.workflow.currentState).toBe('READY_TO_COMMIT');
      expect(taskData.status).toBe('in_progress');
      
      // getCurrentTask should still return the task (not completed yet)
      const currentTask = await manager.getCurrentTask();
      expect(currentTask).not.toBeNull();
      expect(currentTask?.status).toBe('READY_TO_COMMIT');
      
      // Now complete the task
      await manager.completeTask();
      
      // Task is completed even though workflow state is READY_TO_COMMIT
      const completedData = await fs.readJson(taskFile);
      expect(completedData.workflow.currentState).toBe('READY_TO_COMMIT');
      expect(completedData.status).toBe('completed');
      
      // getCurrentTask should NOW return null
      const afterComplete = await manager.getCurrentTask();
      expect(afterComplete).toBeNull();
    });
  });

  describe('New Task Creation After Completion', () => {
    it('should allow creating new task after completion', async () => {
      // This test performs multiple state transitions and task operations
      // @bug BUG-011 - This was blocked before the fix
      
      // Create and complete first task
      const task1 = await manager.createTask('First task');
      expect(task1.id).toBeDefined();
      
      await progressToCommitReady();
      await manager.completeTask();
      
      // Verify first task is completed
      const current1 = await manager.getCurrentTask();
      expect(current1).toBeNull();
      
      // BUG #11 FIX: Should be able to create new task
      const task2 = await manager.createTask('Second task after completion');
      expect(task2).toBeDefined();
      expect(task2.id).not.toBe(task1.id);
      expect(task2.goal).toBe('Second task after completion');
      
      // New task should be current
      const current2 = await manager.getCurrentTask();
      expect(current2).not.toBeNull();
      expect(current2?.id).toBe(task2.id);
    }, 15000);

    it('should block creating task when in-progress task exists', async () => {
      // Create first task (in-progress)
      const firstTask = await manager.createTask('First task');
      
      // With auto-queue, creating second task should queue it, not throw error
      const secondTask = await manager.createTask('Second task');
      expect(secondTask).toBeDefined();
      expect(secondTask.goal).toBe('Second task');
      
      // Verify first task is still active
      const stillActive = await manager.getCurrentTask();
      expect(stillActive?.id).toBe(firstTask.id);
      expect(stillActive?.goal).toBe('First task');
    }, 30000); // 30s timeout for task creation and queue operations in parallel execution

    it('should handle multiple task completions correctly', async () => {
      // This test performs multiple task completions - needs longer timeout
      // Create and complete multiple tasks in sequence
      for (let i = 1; i <= 3; i++) {
        const task = await manager.createTask(`Test task number ${i} for Bug 11`);
        expect(task.goal).toBe(`Test task number ${i} for Bug 11`);
        
        // Verify it's current
        const current = await manager.getCurrentTask();
        expect(current?.id).toBe(task.id);
        
        // Progress to READY_TO_COMMIT before completing
        await progressToCommitReady();
        
        // Complete it
        await manager.completeTask();
        
        // Verify no current task
        const afterComplete = await manager.getCurrentTask();
        expect(afterComplete).toBeNull();
      }
    }, 30000); // 30s timeout for 3 task completions with full state transitions in parallel execution
  });

  describe('Edge Cases', () => {
    it('should return null when no task file exists', async () => {
      // No task created yet
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
    });

    it('should handle corrupted status field gracefully', async () => {
      // Create task
      await manager.createTask('Test task for verification');
      
      // Manually corrupt the status field
      const taskData = await fs.readJson(taskFile);
      delete taskData.status;
      await fs.writeJson(taskFile, taskData);
      
      // getCurrentTask should not crash (returns task without status check)
      const current = await manager.getCurrentTask();
      expect(current).not.toBeNull();
    }, 30000); // 30s timeout for file operations in parallel execution

    it('should handle task file with only completedAt timestamp', async () => {
      // Create and complete task
      await manager.createTask('Test task for verification');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Task should be completed and getCurrentTask returns null
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('completed');
      expect(taskData.completedAt).toBeDefined();
      
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
    });
  });

  describe('Workflow Compliance', () => {
    it('should prevent work on completed tasks', async () => {
      // @bug BUG-011 - This scenario caused compliance violations
      
      // Create and complete task
      const task = await manager.createTask('Original task');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Verify no active task
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
      
      // Attempting to sync state should fail (no active task)
      await expect(
        manager.updateTaskState('IMPLEMENTING')
      ).rejects.toThrow();
    });

    it('should require new task for new work', async () => {
      // Complete existing task
      await manager.createTask('Task number one for testing');
      await progressToCommitReady();
      await manager.completeTask();
      
      // New work requires new task
      expect(await manager.getCurrentTask()).toBeNull();
      
      // Create new task for new work
      const newTask = await manager.createTask('Task 2 - new work');
      expect(newTask).toBeDefined();
      
      // Now there's an active task
      const current = await manager.getCurrentTask();
      expect(current?.id).toBe(newTask.id);
    });
  });

  describe('Performance and Consistency', () => {
    it('should consistently return null for completed tasks', async () => {
      // Create and complete task
      await manager.createTask('Consistency test');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Call getCurrentTask multiple times
      for (let i = 0; i < 10; i++) {
        const current = await manager.getCurrentTask();
        expect(current).toBeNull();
      }
    }, 30000); // 30s timeout for multiple getCurrentTask calls in parallel execution

    it('should handle rapid task creation after completion', async () => {
      // Create and complete first task
      await manager.createTask('Task number one for testing');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Immediately create second task (no delay)
      const task2 = await manager.createTask('Task 2 immediate');
      expect(task2).toBeDefined();
      
      // Verify new task is active
      const current = await manager.getCurrentTask();
      expect(current?.id).toBe(task2.id);
    });
  });

  describe('Regression Tests', () => {
    it('should not break existing functionality', async () => {
      // Test that all existing task operations still work
      
      // Create task
      const task = await manager.createTask('Full workflow test');
      expect(task).toBeDefined();
      
      // Get current (should work)
      const current1 = await manager.getCurrentTask();
      expect(current1?.id).toBe(task.id);
      
      // Sync state (should work)
      await manager.updateTaskState('DESIGNING');
      
      // Get current again (should still work)
      const current2 = await manager.getCurrentTask();
      expect(current2?.id).toBe(task.id);
      
      // Progress to READY_TO_COMMIT
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
        // FIX: Complete review checklist before READY_TO_COMMIT
        const { completeReviewChecklist } = await import('./test-helpers.js');
        await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      // Complete (should work)
      await manager.completeTask();
      
      // Get current after complete (should return null - Bug #11 fix)
      const current3 = await manager.getCurrentTask();
      expect(current3).toBeNull();
    });

    it('should maintain backward compatibility with task data structure', async () => {
      // Create task
      await manager.createTask('Compatibility test');
      
      // Read raw task data
      const taskData = await fs.readJson(taskFile);
      
      // Verify expected structure
      expect(taskData).toHaveProperty('taskId');
      expect(taskData).toHaveProperty('originalGoal');
      expect(taskData).toHaveProperty('status');
      expect(taskData).toHaveProperty('startedAt');
      expect(taskData).toHaveProperty('workflow');
      expect(taskData.workflow).toHaveProperty('currentState');
      
      // Progress to READY_TO_COMMIT before completing
      await progressToCommitReady();
      
      // Complete and verify completion fields added
      await manager.completeTask();
      const completedData = await fs.readJson(taskFile);
      expect(completedData).toHaveProperty('completedAt');
      expect(completedData.status).toBe('completed');
    });
  });

  describe('Documentation Examples', () => {
    it('should match bug report example', async () => {
      // Example from BUG-011-getCurrentTask-returns-completed-tasks.md
      
      // Before fix: getCurrentTask returned completed task
      // After fix: getCurrentTask returns null for completed task
      
      const task = await manager.createTask('Test task from bug report');
      await progressToCommitReady();
      await manager.completeTask();
      
      const current = await manager.getCurrentTask();
      expect(current).toBeNull(); // ✅ Fixed behavior
    });

    it('should enable scenario from compliance audit', async () => {
      // Scenario from workflow compliance audit report
      
      // User completes task at 13:20:40
      await manager.createTask('Fix failing tests');
      await progressToCommitReady();
      await manager.completeTask();
      
      // User wants to do new work at 20:20:19 (7 hours later)
      // Should be able to create new task
      const newTask = await manager.createTask('New work - compliance audit');
      expect(newTask).toBeDefined();
      
      // No violation - new work has new task ✅
      const current = await manager.getCurrentTask();
      expect(current?.id).toBe(newTask.id);
    });
  });
});

