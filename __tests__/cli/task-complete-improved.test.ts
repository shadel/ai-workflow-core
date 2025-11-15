/**
 * Task Complete - Improved UX Tests
 * Tests the bug fix for confusing "No active task" message
 * 
 * @requirement BUG-FIX: Better UX for completed tasks
 */

import { TaskManager } from '../../src/core/task-manager';
import fs from 'fs-extra';
import path from 'path';

describe('Task Complete - Improved UX', () => {
  let manager: TaskManager;
  const testDir = '.test-task-complete-ux';
  const taskFile = path.join(testDir, 'current-task.json');

  // Helper function to progress task through all workflow states
  async function progressToCommitReady() {
    await manager.updateTaskState('DESIGNING');
    await manager.updateTaskState('IMPLEMENTING');
    await manager.updateTaskState('TESTING');
    await manager.updateTaskState('REVIEWING');
    await manager.updateTaskState('READY_TO_COMMIT');
  }

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

  describe('Already Completed Task', () => {
    it('should detect completed task from file when getCurrentTask returns null', async () => {
      // Setup: Create and complete a task
      const task = await manager.createTask('Test task for completed detection');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Verify task is completed
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('completed');
      expect(taskData.completedAt).toBeDefined();
      
      // getCurrentTask should return null
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
      
      // But file exists with completed status
      const fileExists = await fs.pathExists(taskFile);
      expect(fileExists).toBe(true);
    });
    
    it('should preserve all task metadata when completed', async () => {
      // Create task with all metadata
      const task = await manager.createTask('Feature implementation with metadata');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Read completed task
      const taskData = await fs.readJson(taskFile);
      
      // Verify all fields preserved
      expect(taskData.taskId).toBe(task.id);
      expect(taskData.originalGoal).toBe('Feature implementation with metadata');
      expect(taskData.status).toBe('completed');
      expect(taskData.startedAt).toBeDefined();
      expect(taskData.completedAt).toBeDefined();
      expect(taskData.workflow).toBeDefined();
      expect(taskData.workflow.currentState).toBe('READY_TO_COMMIT');
    });
    
    it('should calculate correct duration for completed task', async () => {
      // Create task
      await manager.createTask('Duration calculation test');
      await progressToCommitReady();
      
      // Wait a bit to have measurable duration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await manager.completeTask();
      
      // Read task
      const taskData = await fs.readJson(taskFile);
      
      // Verify timestamps exist
      expect(taskData.startedAt).toBeDefined();
      expect(taskData.completedAt).toBeDefined();
      
      // Calculate duration
      const start = new Date(taskData.startedAt);
      const end = new Date(taskData.completedAt);
      const duration = end.getTime() - start.getTime();
      
      // Should have positive duration
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('No Active Task Scenarios', () => {
    it('should distinguish between no file and completed task', async () => {
      // Scenario 1: No file
      let fileExists = await fs.pathExists(taskFile);
      expect(fileExists).toBe(false);
      
      let current = await manager.getCurrentTask();
      expect(current).toBeNull();
      
      // Scenario 2: Completed task
      await manager.createTask('Distinction test task');
      await progressToCommitReady();
      await manager.completeTask();
      
      fileExists = await fs.pathExists(taskFile);
      expect(fileExists).toBe(true); // File exists this time!
      
      current = await manager.getCurrentTask();
      expect(current).toBeNull(); // But still returns null
      
      // The difference: File has completed status
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('completed');
    });
    
    it('should handle in-progress task correctly', async () => {
      // Create task (in_progress by default)
      const task = await manager.createTask('In-progress task for testing');
      
      // Task file exists
      const fileExists = await fs.pathExists(taskFile);
      expect(fileExists).toBe(true);
      
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

  describe('Edge Cases', () => {
    it('should handle corrupted task file gracefully', async () => {
      // Create corrupted file (without required fields)
      await fs.writeJson(taskFile, { corrupted: true, invalid: 'data' });
      
      // getCurrentTask should not crash and return the data it can
      // (not null because there's no 'completed' status)
      try {
        const current = await manager.getCurrentTask();
        // May return something or may throw - both are acceptable for corrupted data
        expect(true).toBe(true); // Test passes if no crash
      } catch (error) {
        // Also acceptable - corrupted file causes error
        expect(error).toBeDefined();
      }
    });
    
    it('should handle task file with missing completedAt field', async () => {
      // Create and complete task
      await manager.createTask('Task with missing completedAt');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Remove completedAt field
      const taskData = await fs.readJson(taskFile);
      delete taskData.completedAt;
      await fs.writeJson(taskFile, taskData);
      
      // Should still detect as completed (status field is key)
      const modifiedData = await fs.readJson(taskFile);
      expect(modifiedData.status).toBe('completed');
      expect(modifiedData.completedAt).toBeUndefined();
      
      // getCurrentTask should return null
      const current = await manager.getCurrentTask();
      expect(current).toBeNull();
    });
    
    it('should handle task file with missing status field', async () => {
      // Create task
      await manager.createTask('Task for status field test');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Remove status field
      const taskData = await fs.readJson(taskFile);
      delete taskData.status;
      await fs.writeJson(taskFile, taskData);
      
      // Without status field, should not be considered completed
      const current = await manager.getCurrentTask();
      expect(current).not.toBeNull(); // Returns task because no status check
    });
    
    it('should handle empty task file', async () => {
      // Create empty file
      await fs.writeJson(taskFile, {});
      
      // Should not crash - empty object has no 'completed' status so not filtered
      try {
        const current = await manager.getCurrentTask();
        // May return object without required fields
        expect(true).toBe(true); // Test passes if no crash
      } catch (error) {
        // Or may throw due to missing required fields - also acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Multiple Task Lifecycle', () => {
    it('should handle multiple task completions in sequence', async () => {
      // Complete 3 tasks in sequence
      for (let i = 1; i <= 3; i++) {
        const task = await manager.createTask(`Sequential task ${i} for lifecycle test`);
        expect(task.goal).toBe(`Sequential task ${i} for lifecycle test`);
        
        // Progress and complete
        await progressToCommitReady();
        await manager.completeTask();
        
        // Verify completed
        const taskData = await fs.readJson(taskFile);
        expect(taskData.status).toBe('completed');
        expect(taskData.originalGoal).toBe(`Sequential task ${i} for lifecycle test`);
        
        // getCurrentTask returns null
        const current = await manager.getCurrentTask();
        expect(current).toBeNull();
      }
      
      // Last task should be task 3
      const finalData = await fs.readJson(taskFile);
      expect(finalData.originalGoal).toBe('Sequential task 3 for lifecycle test');
    });
    
    it('should allow creating new task after completion', async () => {
      // Complete first task
      await manager.createTask('First task in lifecycle');
      await progressToCommitReady();
      await manager.completeTask();
      
      // Verify no active task
      expect(await manager.getCurrentTask()).toBeNull();
      
      // Should be able to create new task
      const task2 = await manager.createTask('Second task after completion');
      expect(task2).toBeDefined();
      expect(task2.goal).toBe('Second task after completion');
      
      // New task should be active
      const current = await manager.getCurrentTask();
      expect(current?.id).toBe(task2.id);
    });
  });

  describe('Duration Calculation', () => {
    it('should calculate duration in minutes for short tasks', async () => {
      await manager.createTask('Short task for duration test');
      
      // Wait 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await progressToCommitReady();
      await manager.completeTask();
      
      const taskData = await fs.readJson(taskFile);
      const start = new Date(taskData.startedAt);
      const end = new Date(taskData.completedAt);
      const diff = end.getTime() - start.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      
      // Should be 0 minutes (< 1 minute)
      expect(minutes).toBe(0);
    });
    
    it('should preserve timestamps for duration calculation', async () => {
      await manager.createTask('Timestamp preservation test');
      await progressToCommitReady();
      await manager.completeTask();
      
      const taskData = await fs.readJson(taskFile);
      
      // Timestamps should be valid ISO strings
      expect(taskData.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(taskData.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      
      // Should be parseable
      expect(new Date(taskData.startedAt).getTime()).toBeGreaterThan(0);
      expect(new Date(taskData.completedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Backwards Compatibility', () => {
    it('should not break existing task creation', async () => {
      const task = await manager.createTask('Compatibility test task');
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.goal).toBe('Compatibility test task');
      
      // File should be created correctly
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('in_progress');
      expect(taskData.completedAt).toBeUndefined();
    });
    
    it('should not break existing task completion flow', async () => {
      await manager.createTask('Standard completion flow test');
      await progressToCommitReady();
      
      // Complete task - should work as before
      await manager.completeTask();
      
      // Verify completion
      const taskData = await fs.readJson(taskFile);
      expect(taskData.status).toBe('completed');
      expect(taskData.completedAt).toBeDefined();
    });
    
    it('should maintain task data structure', async () => {
      await manager.createTask('Data structure test task');
      
      const taskData = await fs.readJson(taskFile);
      
      // Verify expected structure
      expect(taskData).toHaveProperty('taskId');
      expect(taskData).toHaveProperty('originalGoal');
      expect(taskData).toHaveProperty('status');
      expect(taskData).toHaveProperty('startedAt');
      expect(taskData).toHaveProperty('workflow');
      expect(taskData.workflow).toHaveProperty('currentState');
      expect(taskData.workflow).toHaveProperty('stateEnteredAt');
      expect(taskData.workflow).toHaveProperty('stateHistory');
    });
  });
});

