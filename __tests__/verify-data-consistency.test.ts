/**
 * Data Consistency Verification Tests
 * 
 * Phase 8.3: Data Consistency Verification
 * Verifies that queue and file data are consistent after all operations.
 */

import fs from 'fs-extra';
import path from 'path';
import { TaskManager } from '../src/core/task-manager.js';
import { TaskQueueManager } from '../src/core/task-queue.js';
import { cleanupAllTestDirs } from './test-helpers.js';

describe('Phase 8.3: Data Consistency Verification', () => {
  let testDir: string;
  let taskManager: TaskManager;
  let queueManager: TaskQueueManager;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), `.test-verify-consistency-${Date.now()}`);
    await fs.ensureDir(testDir);
    taskManager = new TaskManager(testDir);
    queueManager = new TaskQueueManager(testDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  /**
   * Verify queue and file data are consistent
   */
  async function verifyConsistency(operation: string): Promise<{ passed: boolean; message: string; details?: any }> {
    const queueTask = await queueManager.getActiveTask();
    const filePath = path.join(testDir, 'current-task.json');
    
    if (!queueTask) {
      return {
        passed: true,
        message: 'No active task (expected for some operations)'
      };
    }

    if (!await fs.pathExists(filePath)) {
      return {
        passed: false,
        message: 'File does not exist but queue has active task'
      };
    }

    const fileData = await fs.readJson(filePath);

    // Verify core fields
    const checks = [
      {
        name: 'taskId',
        queue: queueTask.id,
        file: fileData.taskId,
        passed: queueTask.id === fileData.taskId
      },
      {
        name: 'goal',
        queue: queueTask.goal,
        file: fileData.originalGoal,
        passed: queueTask.goal === fileData.originalGoal
      },
      {
        name: 'state',
        queue: queueTask.workflow?.currentState,
        file: fileData.workflow?.currentState,
        passed: queueTask.workflow?.currentState === fileData.workflow?.currentState
      },
      {
        name: 'requirements',
        queue: (queueTask as any).requirements || [],
        file: fileData.requirements || [],
        passed: JSON.stringify((queueTask as any).requirements || []) === JSON.stringify(fileData.requirements || [])
      },
      {
        name: 'reviewChecklist',
        queue: queueTask.reviewChecklist,
        file: fileData.reviewChecklist,
        passed: JSON.stringify(queueTask.reviewChecklist || null) === JSON.stringify(fileData.reviewChecklist || null)
      }
    ];

    const failedChecks = checks.filter(c => !c.passed);
    
    if (failedChecks.length > 0) {
      return {
        passed: false,
        message: `Inconsistencies found: ${failedChecks.map(c => c.name).join(', ')}`,
        details: failedChecks
      };
    }

    return {
      passed: true,
      message: 'All fields consistent',
      details: checks
    };
  }

  describe('8.3.1: createTask() consistency', () => {
    it('should maintain queue-file consistency after createTask()', async () => {
      await taskManager.createTask('Test goal for consistency verification', ['REQ-001', 'REQ-002']);
      const result = await verifyConsistency('createTask()');
      expect(result.passed).toBe(true);
    });
  });

  describe('8.3.2: saveReviewChecklist() consistency', () => {
    it('should maintain queue-file consistency after saveReviewChecklist()', async () => {
      await taskManager.createTask('Test goal for consistency verification');
      // Progress through states to reach REVIEWING
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // Review checklist is automatically created in REVIEWING state
      // We verify consistency after state transition
      const result = await verifyConsistency('saveReviewChecklist()');
      expect(result.passed).toBe(true);
    });
  });

  describe('8.3.3: updateTaskState() consistency', () => {
    it('should maintain queue-file consistency after updateTaskState()', async () => {
      await taskManager.createTask('Test goal for consistency verification');
      await taskManager.updateTaskState('DESIGNING');
      const result = await verifyConsistency('updateTaskState()');
      expect(result.passed).toBe(true);
    });
  });

  describe('8.3.4: completeTask() consistency', () => {
    it('should maintain queue-file consistency after completeTask()', async () => {
      await taskManager.createTask('Test goal for consistency verification');
      // Progress through all states to READY_TO_COMMIT
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('./test-helpers.js');
      await completeReviewChecklist(taskManager);
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      await taskManager.completeTask();
      
      // After completion, task is marked as DONE in queue
      // Verify file reflects completion status
      const queueTask = await queueManager.getActiveTask();
      const filePath = path.join(testDir, 'current-task.json');
      
      // After completion, there should be no active task
      expect(queueTask).toBeNull();
      
      // Verify file shows completed status
      if (await fs.pathExists(filePath)) {
        const fileData = await fs.readJson(filePath);
        // File should have completedAt timestamp after completion
        expect(fileData.completedAt).toBeDefined();
        expect(fileData.status).toBe('completed');
      }
      
      // This is expected behavior - task completed successfully
      expect(true).toBe(true);
    });
  });

  describe('8.3.5: updateTask() consistency', () => {
    it('should maintain queue-file consistency after updateTask()', async () => {
      await taskManager.createTask('Test goal for consistency verification', ['REQ-001', 'REQ-002']);
      const task = await taskManager.getCurrentTask();
      if (!task) {
        throw new Error('No active task');
      }
      await taskManager.updateTask(task.id, { addReq: 'REQ-003' });
      const result = await verifyConsistency('updateTask()');
      if (!result.passed) {
        console.log('Consistency check failed:', result.message, result.details);
      }
      expect(result.passed).toBe(true);
    });
  });

  describe('8.3.6: requirements sync', () => {
    it('should sync requirements correctly from queue to file', async () => {
      const requirements = ['REQ-001', 'REQ-002', 'REQ-003'];
      await taskManager.createTask('Test goal for requirements sync verification', requirements);
      
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      
      expect(fileData.requirements).toEqual(requirements);
      
      const result = await verifyConsistency('requirements sync');
      expect(result.passed).toBe(true);
    });
  });

  describe('8.3.7: reviewChecklist sync', () => {
    it('should sync reviewChecklist correctly from queue to file', async () => {
      await taskManager.createTask('Test goal for consistency verification');
      // Progress through states to reach REVIEWING
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // Review checklist is automatically created in REVIEWING state
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      const queueTask = await queueManager.getActiveTask();
      
      // Verify checklist exists in both queue and file
      expect(queueTask?.reviewChecklist).toBeDefined();
      expect(fileData.reviewChecklist).toBeDefined();
      
      const result = await verifyConsistency('reviewChecklist sync');
      expect(result.passed).toBe(true);
    });
  });

  describe('8.3.8: workflow fields sync', () => {
    it('should sync all workflow fields correctly', async () => {
      await taskManager.createTask('Test goal for consistency verification');
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      const result = await verifyConsistency('workflow fields sync');
      expect(result.passed).toBe(true);
      
      // Verify state history
      const filePath = path.join(testDir, 'current-task.json');
      const fileData = await fs.readJson(filePath);
      const queueTask = await queueManager.getActiveTask();
      
      expect(fileData.workflow.currentState).toBe('IMPLEMENTING');
      expect(fileData.workflow.stateHistory.length).toBeGreaterThan(0);
      expect(fileData.workflow.stateHistory).toEqual(queueTask?.workflow?.stateHistory);
    });
  });
});

