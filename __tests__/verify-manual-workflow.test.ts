/**
 * Manual Verification Tests
 * 
 * Phase 8.4: Manual Verification
 * Tests full workflow scenarios to ensure no data loss or corruption.
 * 
 * Pattern: Uses task-manager-test-patterns.ts helper to ensure correct instance management
 * See TESTING_PATTERNS.md for best practices
 */

import fs from 'fs-extra';
import path from 'path';
import { TaskManager } from '../src/core/task-manager.js';
import { TaskQueueManager } from '../src/core/task-queue.js';
import { createTaskManagerTestContext } from './task-manager-test-patterns.js';

describe('Phase 8.4: Manual Verification', () => {
  // Pattern: Use test context helper for consistent setup
  // This ensures we use the same queueManager instance as taskManager
  const ctx = createTaskManagerTestContext();
  
  // Legacy compatibility: Create aliases for existing tests
  // New tests should use ctx.taskManager and ctx.getQueueManager() directly
  let taskManager: TaskManager;
  let testDir: string;
  
  // Initialize aliases in beforeEach (single beforeEach, no duplicate)
  beforeEach(async () => {
    await ctx.setup();
    taskManager = ctx.taskManager;
    testDir = ctx.testDir;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('8.4.1: Full workflow: Create → Update State → Complete', () => {
    it('should complete full workflow without data loss', async () => {
      // Create task
      const task = await taskManager.createTask('Implement user authentication with JWT tokens');
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();

      // Verify initial state
      let currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.status).toBe('UNDERSTANDING');

      // Progress through states
      await taskManager.updateTaskState('DESIGNING');
      currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.status).toBe('DESIGNING');

      await taskManager.updateTaskState('IMPLEMENTING');
      currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.status).toBe('IMPLEMENTING');

      await taskManager.updateTaskState('TESTING');
      currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.status).toBe('TESTING');

      await taskManager.updateTaskState('REVIEWING');
      currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.status).toBe('REVIEWING');

      // Complete review checklist
      const { completeReviewChecklist } = await import('./test-helpers.js');
      await completeReviewChecklist(taskManager);

      await taskManager.updateTaskState('READY_TO_COMMIT');
      currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.status).toBe('READY_TO_COMMIT');

      // Complete task
      await taskManager.completeTask();

      // Verify completion
      // Use taskManager's queueManager (same instance)
      const taskManagerQueueManager = (taskManager as any).queueManager as TaskQueueManager;
      const activeTask = await taskManagerQueueManager.getActiveTask();
      
      // After completion, if no next task, activeTask should be null
      // If next task auto-activated, activeTask will be the next task
      // Both are valid behaviors
      
      // Verify completed task in queue
      // Reuse taskManagerQueueManager from above
      const queue = await (taskManagerQueueManager as any).loadQueue();
      const completedTask = queue.tasks.find((t: any) => t.id === currentTask?.id);
      expect(completedTask).toBeDefined();
      expect(completedTask.status).toBe('DONE');
      expect(completedTask.completedAt).toBeDefined();
      
      // Verify file status
      // If next task auto-activated, file will show next task (not completed task)
      // If no next task, file should show completed task status
      const filePath = path.join(testDir, 'current-task.json');
      if (await fs.pathExists(filePath)) {
        const fileData = await fs.readJson(filePath);
        if (activeTask) {
          // Next task auto-activated - file shows next task
          expect(fileData.taskId).toBe(activeTask.id);
          expect(fileData.status).toBe('in_progress');
        } else {
          // No next task - file should show completed task
          // According to completeTask() logic, file is synced with completed task
          expect(fileData.taskId).toBe(currentTask?.id);
          expect(fileData.status).toBe('completed');
          expect(fileData.completedAt).toBeDefined();
        }
      } else {
        // File removed should only happen if there's no next task AND file was explicitly removed
        // But according to current implementation, file is kept with completed status
        // So this branch should rarely be reached
        expect(activeTask).toBeNull();
      }
    });
  });

  describe('8.4.2: Task switch workflow', () => {
    it('should switch tasks without data loss', async () => {
      console.log('[TEST] Step 1: Creating first task...');
      // Create first task
      const task1 = await taskManager.createTask('First task for switch testing workflow');
      const task1Id = task1.id;
      console.log('[TEST] Step 1: Created task1, taskId:', task1Id);

      console.log('[TEST] Step 2: Creating second task...');
      // Create second task (will be QUEUED because task1 is active)
      const task2 = await taskManager.createTask('Second task for switch testing workflow');
      const task2Id = task2.id;
      console.log('[TEST] Step 2: Created task2, taskId:', task2Id, 'status:', task2.status);

      // CRITICAL FIX: Use taskManager's queueManager instead of separate instance
      // This ensures we're testing with the same instance that taskManager uses internally
      // Using separate queueManager instance causes timing issues and data inconsistency
      const taskManagerQueueManager = (taskManager as any).queueManager as TaskQueueManager;

      console.log('[TEST] Step 3: Verifying task1 is still active (task2 should be queued)...');
      // Verify task1 is still active (task2 should be QUEUED, not ACTIVE)
      const activeQueueTaskBefore = await taskManagerQueueManager.getActiveTask();
      console.log('[TEST] Step 3: Active task from queue:', activeQueueTaskBefore?.id, 'Expected (task1):', task1Id);
      expect(activeQueueTaskBefore?.id).toBe(task1Id); // task1 should still be active
      
      console.log('[TEST] Step 3.5: Activating task2...');
      // Now activate task2 (this will queue task1 and activate task2)
      const activatedTask2 = await taskManagerQueueManager.activateTask(task2Id);
      console.log('[TEST] Step 3.5: Activated task2, taskId:', activatedTask2.id, 'status:', activatedTask2.status);
      expect(activatedTask2.id).toBe(task2Id);
      expect(activatedTask2.status).toBe('ACTIVE');
      
      // Wait for queue flush
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify task2 is now active
      const activeAfterActivate2 = await taskManagerQueueManager.getActiveTask();
      console.log('[TEST] Step 3.5: Active task after activating task2:', activeAfterActivate2?.id, 'Expected:', task2Id);
      expect(activeAfterActivate2?.id).toBe(task2Id);

      // Check file taskId before switch
      const filePath = path.join(testDir, 'current-task.json');
      if (await fs.pathExists(filePath)) {
        const fileDataBefore = await fs.readJson(filePath);
        console.log('[TEST] Step 3: File taskId BEFORE switch:', fileDataBefore.taskId);
      }

      console.log('[TEST] Step 4: Activating task1...');
      // Switch back to task1 using taskManager's queueManager (proper way)
      // This ensures queue state is correctly updated and visible to taskManager
      const activatedTask = await taskManagerQueueManager.activateTask(task1Id);
      console.log('[TEST] Step 4: Activated task, taskId:', activatedTask.id, 'Expected:', task1Id);
      
      // Verify activation succeeded
      expect(activatedTask.id).toBe(task1Id);
      expect(activatedTask.status).toBe('ACTIVE');
      
      // Check file taskId immediately after activate
      if (await fs.pathExists(filePath)) {
        const fileDataAfterActivate = await fs.readJson(filePath);
        console.log('[TEST] Step 4: File taskId IMMEDIATELY after activate:', fileDataAfterActivate.taskId);
      }
      
      console.log('[TEST] Step 5: Waiting for queue flush...');
      // Wait a bit for queue to be saved to disk and flushed
      // This ensures file is written before next read operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check file taskId after wait
      if (await fs.pathExists(filePath)) {
        const fileDataAfterWait = await fs.readJson(filePath);
        console.log('[TEST] Step 5: File taskId AFTER wait:', fileDataAfterWait.taskId);
      }
      
      console.log('[TEST] Step 6: Getting active task from queue...');
      // Get active task from taskManager's queueManager (same instance)
      // This ensures we're using the same instance that taskManager uses
      const activeTaskFromQueue = await taskManagerQueueManager.getActiveTask();
      console.log('[TEST] Step 6: Active task from queue:', activeTaskFromQueue?.id, 'Expected:', task1Id);
      
      // Verify task1 is active
      expect(activeTaskFromQueue?.id).toBe(task1Id);
      expect(activeTaskFromQueue?.status).toBe('ACTIVE');
      
      // Check file taskId before sync
      if (await fs.pathExists(filePath)) {
        const fileDataBeforeSync = await fs.readJson(filePath);
        console.log('[TEST] Step 6: File taskId BEFORE sync:', fileDataBeforeSync.taskId);
      }
      
      console.log('[TEST] Step 7: Syncing file from queue...');
      // Sync file from queue using the active task
      // Since we're using the same queueManager instance, this should work correctly
      if (activeTaskFromQueue && activeTaskFromQueue.status === 'ACTIVE') {
        console.log('[TEST] Step 7: Calling syncFileFromQueue with taskId:', activeTaskFromQueue.id);
        await taskManager.syncFileFromQueue(activeTaskFromQueue, []);
        console.log('[TEST] Step 7: syncFileFromQueue completed');
      }
      
      // Check file taskId immediately after sync
      if (await fs.pathExists(filePath)) {
        const fileDataAfterSync = await fs.readJson(filePath);
        console.log('[TEST] Step 7: File taskId IMMEDIATELY after sync:', fileDataAfterSync.taskId);
      }
      
      console.log('[TEST] Step 8: Waiting for file flush...');
      // Wait for file write to complete and flush (especially important on Windows)
      // TaskFileSync already has delays, but we add extra delay for test reliability
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check file taskId after final wait
      if (await fs.pathExists(filePath)) {
        const fileDataAfterFinalWait = await fs.readJson(filePath);
        console.log('[TEST] Step 8: File taskId AFTER final wait:', fileDataAfterFinalWait.taskId);
      }

      console.log('[TEST] Step 9: Verifying file has task1...');
      // Verify task1 is now active via file (syncFileFromQueue updates file directly)
      expect(await fs.pathExists(filePath)).toBe(true);
      
      // Read file and verify it has task1
      const fileData = await fs.readJson(filePath);
      console.log('[TEST] Step 9: Final file taskId:', fileData.taskId, 'Expected:', task1Id);
      
      // Debug: Log file data if test fails
      if (fileData.taskId !== task1Id) {
        console.log('[TEST] ❌ File has wrong taskId:', {
          expected: task1Id,
          received: fileData.taskId,
          fileData: JSON.stringify(fileData, null, 2)
        });
      }
      
      // Verify file has task1
      expect(fileData.taskId).toBe(task1Id);
      expect(fileData.originalGoal).toBe('First task for switch testing workflow');
      
      console.log('[TEST] Step 10: Verifying queue has task1 as active...');
      // Also verify queue has task1 as active (using same instance)
      const activeQueueTaskAfter = await taskManagerQueueManager.getActiveTask();
      console.log('[TEST] Step 10: Final queue active task:', activeQueueTaskAfter?.id, 'Expected:', task1Id);
      expect(activeQueueTaskAfter?.id).toBe(task1Id);
    });
  });

  describe('8.4.3: Review checklist save/load', () => {
    it('should save and load review checklist correctly', async () => {
      await taskManager.createTask('Test review checklist save and load functionality');
      
      // Progress to REVIEWING state
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');

      // Review checklist should be automatically created
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      expect(fileData.reviewChecklist).toBeDefined();
      expect(fileData.reviewChecklist.items).toBeDefined();
      expect(fileData.reviewChecklist.items.length).toBeGreaterThan(0);

      // Verify queue also has checklist
      // Use taskManager's queueManager (same instance)
      const taskManagerQueueManager = (taskManager as any).queueManager as TaskQueueManager;
      const queueTask = await taskManagerQueueManager.getActiveTask();
      expect(queueTask?.reviewChecklist).toBeDefined();
      expect(queueTask?.reviewChecklist?.items).toBeDefined();
    });
  });

  describe('8.4.4: Manual edit detection', () => {
    it('should detect manual edits and auto-sync', async () => {
      await taskManager.createTask('Test manual edit detection functionality');
      
      // Manually edit file (simulating user edit)
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      fileData.originalGoal = 'Manually edited goal';
      await fs.writeJson(filePath, fileData, { spaces: 2 });

      // Get current task should detect manual edit and sync
      const currentTask = await taskManager.getCurrentTask();
      
      // File should be synced back from queue
      const syncedData = await fs.readJson(filePath);
      expect(syncedData.originalGoal).toBe('Test manual edit detection functionality');
    });
  });

  describe('8.4.5: Validation on state transitions', () => {
    it('should validate state transitions correctly', async () => {
      await taskManager.createTask('Test state transition validation');

      // Valid transition
      await taskManager.updateTaskState('DESIGNING');
      let currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.status).toBe('DESIGNING');

      // Invalid transition should throw error
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow('Invalid state transition');
    });
  });

  describe('8.4.6: Error scenarios', () => {
    it('should handle errors gracefully', async () => {
      // Test with invalid task ID
      await expect(
        taskManager.updateTask('invalid-id', { goal: 'New goal' })
      ).rejects.toThrow();

      // Test completing task not at READY_TO_COMMIT
      await taskManager.createTask('Test error handling scenarios');
      await expect(
        taskManager.completeTask()
      ).rejects.toThrow('Cannot complete task');
    });
  });

  describe('8.4.7: Edge cases', () => {
    it('should handle edge cases correctly', async () => {
      // Create task with requirements
      const task = await taskManager.createTask('Test edge cases handling', ['REQ-001']);
      
      // Add duplicate requirement
      await taskManager.updateTask(task.id, { addReq: 'REQ-001' });
      
      // Verify no duplicates
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      const reqCount = fileData.requirements.filter((r: string) => r === 'REQ-001').length;
      expect(reqCount).toBe(1);
    });
  });

  describe('8.4.8: Verify no data loss', () => {
    it('should preserve all data during operations', async () => {
      const requirements = ['REQ-001', 'REQ-002', 'REQ-003'];
      await taskManager.createTask('Test data preservation', requirements);

      // Progress through states
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      // Verify requirements preserved
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      expect(fileData.requirements).toEqual(requirements);

      // Verify queue also has requirements
      // Use taskManager's queueManager (same instance)
      const taskManagerQueueManager = (taskManager as any).queueManager as TaskQueueManager;
      const queueTask = await taskManagerQueueManager.getActiveTask();
      expect((queueTask as any).requirements).toEqual(requirements);
    });
  });

  describe('8.4.9: Verify no data corruption', () => {
    it('should prevent data corruption', async () => {
      await taskManager.createTask('Test data corruption prevention');

      // Multiple rapid state changes
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');

      // Verify file is valid JSON and has correct structure
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      
      expect(fileData.taskId).toBeDefined();
      expect(fileData.originalGoal).toBeDefined();
      expect(fileData.workflow).toBeDefined();
      expect(fileData.workflow.currentState).toBe('TESTING');
      expect(fileData.workflow.stateHistory).toBeDefined();
      expect(Array.isArray(fileData.workflow.stateHistory)).toBe(true);
    });
  });
});

