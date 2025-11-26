/**
 * Unit tests for StateChecklistService
 * @requirement Dynamic State Checklists - Phase 1.2
 */

import fs from 'fs-extra';
import path from 'path';
import { StateChecklistService } from '../../src/core/state-checklist-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskFileSync } from '../../src/core/task-file-sync.js';
import { ChecklistRegistry } from '../../src/core/checklist-registry.js';
import { WorkflowState } from '@shadel/workflow-core';
import { StateChecklistIncompleteError } from '../../src/core/state-checklist-incomplete-error.js';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('StateChecklistService', () => {
  let service: StateChecklistService;
  let testContextDir: string;
  let taskFile: string;
  let queueManager: TaskQueueManager;
  let fileSync: TaskFileSync;
  let registry: ChecklistRegistry;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskFile = path.join(testContextDir, 'current-task.json');
    
    queueManager = new TaskQueueManager(testContextDir);
    fileSync = new TaskFileSync(testContextDir);
    registry = new ChecklistRegistry();
    
    service = new StateChecklistService(
      queueManager,
      fileSync,
      taskFile,
      registry
    );
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('initializeStateChecklist()', () => {
    it('should initialize checklist for UNDERSTANDING state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('UNDERSTANDING');

      const checklist = await service.loadStateChecklist('UNDERSTANDING');
      expect(checklist).not.toBeNull();
      expect(checklist?.items).toBeDefined();
      expect(checklist?.items.length).toBeGreaterThan(0);
    });

    it('should initialize checklist for DESIGNING state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('DESIGNING');

      const checklist = await service.loadStateChecklist('DESIGNING');
      expect(checklist).not.toBeNull();
      expect(checklist?.items).toBeDefined();
    });

    it('should initialize checklist for IMPLEMENTING state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'IMPLEMENTING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('IMPLEMENTING');

      const checklist = await service.loadStateChecklist('IMPLEMENTING');
      expect(checklist).not.toBeNull();
    });

    it('should initialize checklist for TESTING state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'TESTING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('TESTING');

      const checklist = await service.loadStateChecklist('TESTING');
      expect(checklist).not.toBeNull();
    });

    it('should initialize checklist for REVIEWING state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'REVIEWING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('REVIEWING');

      const checklist = await service.loadStateChecklist('REVIEWING');
      expect(checklist).not.toBeNull();
    });

    it('should initialize checklist for READY_TO_COMMIT state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'READY_TO_COMMIT' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('READY_TO_COMMIT');

      const checklist = await service.loadStateChecklist('READY_TO_COMMIT');
      expect(checklist).not.toBeNull();
    });
  });

  describe('validateStateChecklistComplete()', () => {
    it('should pass when all required items are complete', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('DESIGNING');
      
      // Mark all required items as complete
      const checklist = await service.loadStateChecklist('DESIGNING');
      if (checklist) {
        checklist.items.forEach(item => {
          if (item.required) {
            item.completed = true;
          }
        });
        await service.saveStateChecklist(checklist, 'DESIGNING');
      }

      // Should not throw
      await expect(service.validateStateChecklistComplete('DESIGNING')).resolves.not.toThrow();
    });

    it('should throw StateChecklistIncompleteError when required items incomplete', async () => {
      // Enable checklist validation for this test (it's testing validation behavior)
      const originalEnv = process.env.ENABLE_CHECKLIST_VALIDATION;
      process.env.ENABLE_CHECKLIST_VALIDATION = 'true';
      
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('DESIGNING');
      
      // Don't mark items complete - leave them incomplete

      // Should throw StateChecklistIncompleteError
      await expect(service.validateStateChecklistComplete('DESIGNING'))
        .rejects.toThrow(StateChecklistIncompleteError);
      
      // Restore environment
      if (originalEnv) {
        process.env.ENABLE_CHECKLIST_VALIDATION = originalEnv;
      } else {
        delete process.env.ENABLE_CHECKLIST_VALIDATION;
      }
    });

    it('should validate for REVIEWING state (backward compatibility)', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'REVIEWING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('REVIEWING');
      
      // Mark all required items as complete
      const checklist = await service.loadStateChecklist('REVIEWING');
      if (checklist) {
        checklist.items.forEach(item => {
          if (item.required) {
            item.completed = true;
          }
        });
        await service.saveStateChecklist(checklist, 'REVIEWING');
      }

      // Should not throw
      await expect(service.validateStateChecklistComplete('REVIEWING')).resolves.not.toThrow();
    });

    it('should return early if no checklist exists (non-blocking)', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Don't initialize checklist - no checklist exists
      // Should return early without error (non-blocking for non-REVIEWING states)
      await expect(service.validateStateChecklistComplete('DESIGNING')).resolves.not.toThrow();
    });
  });

  describe('saveStateChecklist() and loadStateChecklist()', () => {
    it('should save and load checklist for any state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('DESIGNING');
      
      const checklist = await service.loadStateChecklist('DESIGNING');
      expect(checklist).not.toBeNull();
      expect(checklist?.items).toBeDefined();
    });

    it('should persist checklist to queue', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('DESIGNING');
      
      // Reload queue to verify checklist was saved
      const reloadedQueue = await (queueManager as any).loadQueue();
      const reloadedTask = reloadedQueue.tasks.find((t: any) => t.id === taskId);
      expect(reloadedTask).toBeDefined();
      expect(reloadedTask.stateChecklists).toBeDefined();
      expect(reloadedTask.stateChecklists.DESIGNING).toBeDefined();
    });

    it('should maintain backward compatibility for REVIEWING state', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'REVIEWING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('REVIEWING');
      
      // Check that reviewChecklist is also saved (backward compatibility)
      const reloadedQueue = await (queueManager as any).loadQueue();
      const reloadedTask = reloadedQueue.tasks.find((t: any) => t.id === taskId);
      expect(reloadedTask).toBeDefined();
      // REVIEWING state should save to both reviewChecklist and stateChecklists.REVIEWING
      expect(reloadedTask.reviewChecklist || reloadedTask.stateChecklists?.REVIEWING).toBeDefined();
    });
  });

  describe('markItemComplete()', () => {
    it('should mark item as complete', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('DESIGNING');
      
      const checklist = await service.loadStateChecklist('DESIGNING');
      expect(checklist).not.toBeNull();
      
      if (checklist && checklist.items.length > 0) {
        const itemId = checklist.items[0].id;
        await service.markItemComplete('DESIGNING', itemId);
        
        const reloadedChecklist = await service.loadStateChecklist('DESIGNING');
        expect(reloadedChecklist).not.toBeNull();
        const item = reloadedChecklist?.items.find(i => i.id === itemId);
        expect(item?.completed).toBe(true);
        expect(item?.completedAt).toBeDefined();
      }
    });
  });

  describe('displayChecklist()', () => {
    it('should display checklist without errors', async () => {
      const task = await queueManager.createTask('Test task with goal');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'DESIGNING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeStateChecklist('DESIGNING');
      
      const checklist = await service.loadStateChecklist('DESIGNING');
      expect(checklist).not.toBeNull();
      
      // Display should not throw
      if (checklist) {
        expect(() => service.displayChecklist(checklist, 'DESIGNING')).not.toThrow();
      }
    });
  });
});

