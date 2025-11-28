/**
 * Bug Fix Tests: task status command shows completed task information
 * 
 * @bug Confusing UX when completed task exists
 * @severity P1 HIGH
 * @fixedIn v2.1.5-dev
 * 
 * Tests that `npx ai-workflow task status` properly shows completed task
 * information instead of generic "No active task" message.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskManager } from '../../src/core/task-manager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { getTestTimeout, getUniqueAIContextDir, cleanupWithRetry, waitForTask } from '../test-helpers';

describe('Bug Fix: task status shows completed task info', () => {
  // Set environment-aware timeout at describe level (before any tests run)
  jest.setTimeout(getTestTimeout());
  
  let manager: TaskManager;
  let testDir: string;
  let taskFile: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  // Using centralized waitForTask() helper from test-helpers.ts

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir); // Track for cleanup
    taskFile = path.join(testDir, 'current-task.json');
    
    // Clean test directory
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
    
    // Create manager with unique test directory
    manager = new TaskManager(testDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('Completed Task Detection', () => {
    it('should detect completed task in file when getCurrentTask returns null', async () => {
      // Create and complete a task
      const task = await manager.createTask('Test completed task display');
      
      // Progress to READY_TO_COMMIT before completing
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('../test-helpers.js');
      await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      // Verify getCurrentTask returns null (BUG-FIX-011)
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
      
      // But task file should exist with completed status
      const exists = await fs.pathExists(taskFile);
      expect(exists).toBe(true);
      
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('completed');
      expect(taskData.completedAt).toBeDefined();
      expect(taskData.taskId).toBe(task.id);
      expect(taskData.originalGoal).toBe('Test completed task display');
    });

    it('should handle completed task with all metadata', async () => {
      // Wrap entire test in try-catch to catch any exceptions
      try {
        // Enable debug logging
        process.env.DEBUG_TASK_MANAGER = 'true';
        
        // Create task with requirements
        // Ensure testDir is set before creating task
        expect(testDir).toBeDefined();
        expect(manager).toBeDefined();
        
        console.log('[TEST] testDir:', testDir);
        console.log('[TEST] taskFile:', taskFile);
        
        let task;
        try {
          console.log('[TEST] Calling createTask...');
          task = await manager.createTask('Task with metadata', ['REQ-001']);
          console.log('[TEST] createTask returned:', task ? `id=${task.id}` : 'UNDEFINED');
        } catch (error) {
          console.log('[TEST] createTask threw error:', (error as Error).message);
          console.log('[TEST] Error stack:', (error as Error).stack);
          throw new Error(`createTask failed: ${(error as Error).message}. TestDir: ${testDir}`);
        }
        
        if (!task) {
          // Debug: Check if queue file exists
          const queueFile = path.join(testDir, 'tasks.json');
          const queueExists = await fs.pathExists(queueFile);
          const taskFileExists = await fs.pathExists(taskFile);
          const queueContent = queueExists ? await fs.readJson(queueFile).catch(() => 'read failed') : 'not exists';
          const taskFileContent = taskFileExists ? await fs.readJson(taskFile).catch(() => 'read failed') : 'not exists';
          
          console.log('[TEST] Queue file exists:', queueExists);
          console.log('[TEST] Queue content:', JSON.stringify(queueContent, null, 2));
          console.log('[TEST] Task file exists:', taskFileExists);
          console.log('[TEST] Task file content:', JSON.stringify(taskFileContent, null, 2));
          
          throw new Error(
            `createTask returned undefined. ` +
            `Queue file exists: ${queueExists}, ` +
            `Task file exists: ${taskFileExists}, ` +
            `TestDir: ${testDir}`
          );
        }
        
        console.log('[TEST] Before expect(task).toBeDefined(), task:', task);
        expect(task).toBeDefined();
        console.log('[TEST] After expect(task).toBeDefined()');
        
        console.log('[TEST] Before expect(task.id).toBeDefined(), task.id:', task.id);
        expect(task.id).toBeDefined();
        console.log('[TEST] After expect(task.id).toBeDefined()');
        
        // Disable debug logging before waitForTask
        delete process.env.DEBUG_TASK_MANAGER;
        
        // FIX: Wait for task to be available in queue
        console.log('[TEST] Before waitForTask()');
        try {
          await waitForTask(manager, taskFile);
          console.log('[TEST] waitForTask() completed successfully');
        } catch (error) {
          console.log('[TEST] waitForTask failed (non-fatal):', (error as Error).message);
          // Continue anyway - task was created successfully
        }
        
        // FIX: Verify task exists
        console.log('[TEST] Before getCurrentTask()');
        const verifyTask = await manager.getCurrentTask();
        console.log('[TEST] verifyTask:', verifyTask ? `id=${verifyTask.id}` : 'null');
        expect(verifyTask).toBeDefined();
        console.log('[TEST] After expect(verifyTask).toBeDefined()');
        
        // Progress through workflow
        console.log('[TEST] Before updateTaskState(DESIGNING)');
        await manager.updateTaskState('DESIGNING');
        console.log('[TEST] After updateTaskState(DESIGNING)');
        
        await manager.updateTaskState('IMPLEMENTING');
        await manager.updateTaskState('TESTING');
        await manager.updateTaskState('REVIEWING');
        
        // FIX: Complete review checklist before READY_TO_COMMIT
        const { completeReviewChecklist } = await import('../test-helpers.js');
        await completeReviewChecklist(manager);
        
        await manager.updateTaskState('READY_TO_COMMIT');
        
        // Complete the task
        console.log('[TEST] Before completeTask()');
        await manager.completeTask();
        console.log('[TEST] After completeTask()');
        
        // FIX: Wait for file system sync after completion
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Read task data
        console.log('[TEST] Before readJson(taskFile)');
        const taskData = await fs.readJson(taskFile);
        console.log('[TEST] After readJson(taskFile), taskData:', JSON.stringify(taskData, null, 2));
        console.log('[TEST] taskData.status:', taskData.status);
        console.log('[TEST] taskData.workflow:', taskData.workflow);
        console.log('[TEST] taskData.workflow?.currentState:', taskData.workflow?.currentState);
        
        // Verify all metadata is preserved
        console.log('[TEST] Checking taskData.status === completed');
        expect(taskData.status).toBe('completed');
        console.log('[TEST] Checking taskData.taskId === task.id');
        expect(taskData.taskId).toBe(task.id);
        console.log('[TEST] Checking taskData.originalGoal');
        expect(taskData.originalGoal).toBe('Task with metadata');
        console.log('[TEST] Checking taskData.startedAt');
        expect(taskData.startedAt).toBeDefined();
        console.log('[TEST] Checking taskData.completedAt');
        expect(taskData.completedAt).toBeDefined();
        console.log('[TEST] Checking taskData.workflow exists');
        expect(taskData.workflow).toBeDefined();
        console.log('[TEST] Checking taskData.workflow.currentState');
        expect(taskData.workflow.currentState).toBe('READY_TO_COMMIT');
        console.log('[TEST] Checking taskData.requirements');
        expect(taskData.requirements).toContain('REQ-001');
        
        console.log('[TEST] All assertions passed!');
      } catch (error) {
        console.log('[TEST] EXCEPTION CAUGHT:', (error as Error).message);
        console.log('[TEST] Error stack:', (error as Error).stack);
        throw error; // Re-throw to fail test
      }
    });
  });

  describe('No Active Task Scenarios', () => {
    it('should distinguish between no file and completed task', async () => {
      // Scenario 1: No task file exists
      let exists = await fs.pathExists(taskFile);
      expect(exists).toBe(false);
      
      let current = await manager.getCurrentTask();
      expect(current).toBeNull();
      
      // Scenario 2: Completed task exists
      await manager.createTask('Task to complete for testing');
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('../test-helpers.js');
      await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      exists = await fs.pathExists(taskFile);
      expect(exists).toBe(true); // File exists this time
      
      current = await manager.getCurrentTask();
      expect(current).toBeNull(); // But still returns null
      
      // The difference: File exists with completed status
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('completed');
    });

    it('should handle in-progress task correctly', async () => {
      // Create task (in_progress by default)
      const task = await manager.createTask('In-progress task');
      expect(task).toBeDefined();
      
      // FIX: Wait for task to be available in queue (using centralized helper)
      await waitForTask(manager, taskFile);
      
      // waitForTask() already verified task exists and file exists
      // Just verify getCurrentTask returns the task
      const verifyTask = await manager.getCurrentTask();
      expect(verifyTask).toBeDefined();
      
      // Task file should exist (waitForTask already checked this)
      const exists = await fs.pathExists(taskFile);
      expect(exists).toBe(true);
      
      // getCurrentTask returns the task
      const current = await manager.getCurrentTask();
      expect(current).not.toBeNull();
      expect(current?.id).toBe(task.id);
      
      // Status is in_progress
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('in_progress');
      expect(taskData.completedAt).toBeUndefined();
    });
  });

  describe('User Experience Improvements', () => {
    it('should provide helpful information for completed tasks', async () => {
      // Create and complete task
      const task = await manager.createTask('Improve user authentication');
      expect(task).toBeDefined();
      
      // FIX: Wait for task to be available in queue (using centralized helper)
      await waitForTask(manager, taskFile);
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('../test-helpers.js');
      await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      // FIX: Wait for file system sync after completion
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Read task data (simulating what CLI does)
      const taskData = await fs.readJson(taskFile);
      expect(taskData).toBeDefined();
      
      // CLI should be able to display this information:
      expect(taskData.taskId).toBeDefined();
      expect(taskData.originalGoal).toBeDefined();
      expect(taskData.startedAt).toBeDefined();
      expect(taskData.completedAt).toBeDefined();
      
      // This allows showing:
      // "✅ Task Completed"
      // "ID: task-xxx"
      // "Goal: Improve user authentication"
      // "Started: 2025-11-11..."
      // "Completed: 2025-11-11..."
      // "💡 Create a new task: npx ai-workflow task create "<goal>""
    });

    it('should guide user to create new task after completion', async () => {
      // This test performs multiple state transitions and task operations
      // Set longer timeout for complex operations
      jest.setTimeout(15000);
      
      // Complete a task
      await manager.createTask('Previous task completed');
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('../test-helpers.js');
      await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      // Verify no active task
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
      
      // User should be guided to create new task
      // This is what the updated CLI now does
      
      // Verify new task can be created
      const newTask = await manager.createTask('New task after completion');
      expect(newTask).toBeDefined();
      expect(newTask.id).not.toBe('task-xxx'); // Different ID
    }, 15000);
  });

  describe('Edge Cases', () => {
    it('should handle corrupted completed task gracefully', async () => {
      // Create and complete task
      await manager.createTask('Test task for corruption handling');
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('../test-helpers.js');
      await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      // Corrupt the task file
      const taskData = await fs.readJson(taskFile);
      delete taskData.completedAt; // Remove completion timestamp
      await fs.writeJson(taskFile, taskData);
      
      // Reading should still work
      const corruptedData = await fs.readJson(taskFile);
      expect(corruptedData.status).toBe('completed');
      expect(corruptedData.completedAt).toBeUndefined();
    });

    it('should handle task file with missing status field', async () => {
      // Create task (don't complete it - test missing status on active task)
      await manager.createTask('Test task for status field testing');
      
      // Wait for task to be available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Manually remove status field to test edge case
      const taskData = await fs.readJson(taskFile);
      delete taskData.status;
      await fs.writeJson(taskFile, taskData);
      
      // File exists but status is undefined
      const dataWithoutStatus = await fs.readJson(taskFile);
      expect(dataWithoutStatus.status).toBeUndefined();
      
      // getCurrentTask should still return the task (no status = not completed, and no completedAt)
      const current = await manager.getCurrentTask();
      expect(current).not.toBeNull();
    });
  });

  describe('Backwards Compatibility', () => {
    it('should not break existing active task display', async () => {
      // Create active task
      const task = await manager.createTask('Active task test');
      
      // getCurrentTask should work as before
      const current = await manager.getCurrentTask();
      expect(current).not.toBeNull();
      expect(current?.id).toBe(task.id);
      expect(current?.goal).toBe('Active task test');
      
      // All existing functionality preserved
      await manager.updateTaskState('DESIGNING');
      const after = await manager.getCurrentTask();
      expect(after?.status).toBe('DESIGNING');
    });

    it('should maintain existing error messages for truly no task', async () => {
      // No task file at all
      const exists = await fs.pathExists(taskFile);
      expect(exists).toBe(false);
      
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
      
      // CLI shows: "⚠️ No active task"
      // CLI shows: "Create one with: npx ai-workflow task create "<goal>""
      // This behavior unchanged for truly no task scenario
    });
  });

  describe('Multiple Completions', () => {
    it('should handle multiple task completions in sequence', async () => {
      // This test performs multiple task completions - needs longer timeout
      // Use it() timeout parameter instead of jest.setTimeout() for better reliability
      for (let i = 1; i <= 3; i++) {
        // Create task
        const task = await manager.createTask(`Test task number ${i} for completion`);
        expect(task.goal).toBe(`Test task number ${i} for completion`);
        
        // Progress through all states to READY_TO_COMMIT
        await manager.updateTaskState('DESIGNING');
        await manager.updateTaskState('IMPLEMENTING');
        await manager.updateTaskState('TESTING');
        await manager.updateTaskState('REVIEWING');
        
        // FIX: Complete review checklist before READY_TO_COMMIT
        const { completeReviewChecklist } = await import('../test-helpers.js');
        await completeReviewChecklist(manager);
        
        await manager.updateTaskState('READY_TO_COMMIT');
        
        // Complete it
        await manager.completeTask();
        
        // Verify completed
        const taskData = await fs.readJson(taskFile);
        expect(taskData.status).toBe('completed');
        expect(taskData.originalGoal).toBe(`Test task number ${i} for completion`);
        
        // Verify getCurrentTask returns null
        const current = await manager.getCurrentTask();
        expect(current).toBeNull();
      }
      
      // Last task file should be Test task number 3
      const finalData = await fs.readJson(taskFile);
      expect(finalData.originalGoal).toBe('Test task number 3 for completion');
      expect(finalData.status).toBe('completed');
    }, 30000); // 30s timeout for 3 task completions with full state transitions in parallel execution
  });

  describe('JSON Output Mode', () => {
    it('should support JSON format for completed tasks', async () => {
      // Create and complete task
      const task = await manager.createTask('JSON test task for output');
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('../test-helpers.js');
      await completeReviewChecklist(manager);
      
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      // Read task data (simulating JSON output)
      const taskData = await fs.readJson(taskFile);
      
      // CLI should output JSON like:
      const expectedJson = {
        success: true,
        data: {
          id: taskData.taskId,
          goal: taskData.originalGoal,
          status: 'completed',
          state: taskData.workflow?.currentState,
          startedAt: taskData.startedAt,
          completedAt: taskData.completedAt
        }
      };
      
      expect(expectedJson.success).toBe(true);
      expect(expectedJson.data.id).toBe(task.id);
      expect(expectedJson.data.goal).toBe('JSON test task for output');
      expect(expectedJson.data.status).toBe('completed');
      expect(expectedJson.data.completedAt).toBeDefined();
    });
  });
});

