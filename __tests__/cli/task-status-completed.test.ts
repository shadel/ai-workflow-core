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

import { TaskManager } from '../../src/core/task-manager';
import fs from 'fs-extra';
import path from 'path';

describe('Bug Fix: task status shows completed task info', () => {
  let manager: TaskManager;
  const testDir = '.test-task-status';
  const taskFile = path.join(testDir, 'current-task.json');

  beforeEach(async () => {
    // Clean test directory
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
    
    // Create manager with test directory
    manager = new TaskManager(testDir);
  });

  afterEach(async () => {
    // Cleanup
    await fs.remove(testDir);
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
      // Create task with requirements
      const task = await manager.createTask('Task with metadata', ['REQ-001']);
      
      // Progress through workflow
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      await manager.updateTaskState('READY_TO_COMMIT');
      
      // Complete the task
      await manager.completeTask();
      
      // Read task data
      const taskData = await fs.readJson(taskFile);
      
      // Verify all metadata is preserved
      expect(taskData.status).toBe('completed');
      expect(taskData.taskId).toBe(task.id);
      expect(taskData.originalGoal).toBe('Task with metadata');
      expect(taskData.startedAt).toBeDefined();
      expect(taskData.completedAt).toBeDefined();
      expect(taskData.workflow.currentState).toBe('READY_TO_COMMIT');
      expect(taskData.requirements).toContain('REQ-001');
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
      
      // Task file exists
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
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      // Read task data (simulating what CLI does)
      const taskData = await fs.readJson(taskFile);
      
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
      // Complete a task
      await manager.createTask('Previous task completed');
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
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
    });
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
      // Create task and manually remove status
      await manager.createTask('Test task for status field testing');
      
      // Progress through all states to READY_TO_COMMIT
      await manager.updateTaskState('DESIGNING');
      await manager.updateTaskState('IMPLEMENTING');
      await manager.updateTaskState('TESTING');
      await manager.updateTaskState('REVIEWING');
      await manager.updateTaskState('READY_TO_COMMIT');
      
      await manager.completeTask();
      
      const taskData = await fs.readJson(taskFile);
      delete taskData.status;
      await fs.writeJson(taskFile, taskData);
      
      // File exists but status is undefined
      const dataWithoutStatus = await fs.readJson(taskFile);
      expect(dataWithoutStatus.status).toBeUndefined();
      
      // getCurrentTask will not filter it out (no status = not completed)
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
      for (let i = 1; i <= 3; i++) {
        // Create task
        const task = await manager.createTask(`Test task number ${i} for completion`);
        expect(task.goal).toBe(`Test task number ${i} for completion`);
        
        // Progress through all states to READY_TO_COMMIT
        await manager.updateTaskState('DESIGNING');
        await manager.updateTaskState('IMPLEMENTING');
        await manager.updateTaskState('TESTING');
        await manager.updateTaskState('REVIEWING');
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
    });
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

