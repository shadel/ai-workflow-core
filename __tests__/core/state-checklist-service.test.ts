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
import { 
  getUniqueAIContextDir, 
  cleanupWithRetry,
  getTestTimeout,
  getPerformanceThreshold
} from '../test-helpers.js';

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

  describe('markItemComplete() with evidence', () => {
    /**
     * @requirement Checklist Evidence System
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should mark item complete with evidence', async () => {
      // Given: Checklist with item that requires evidence
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
      const item = checklist?.items.find(i => i.id === 'write-code');
      
      // When: markItemComplete() called with valid evidence
      const startTime = Date.now();
      const evidence = {
        type: 'file_created' as const,
        description: 'Created authentication module',
        files: ['src/auth.ts', 'src/auth.test.ts'],
        timestamp: new Date().toISOString()
      };
      
      await service.markItemComplete('IMPLEMENTING', 'write-code', evidence);
      const duration = Date.now() - startTime;
      
      // Then: Item marked complete, evidence saved
      const updatedChecklist = await service.loadStateChecklist('IMPLEMENTING');
      const updatedItem = updatedChecklist?.items.find(i => i.id === 'write-code');
      expect(updatedItem?.completed).toBe(true);
      expect(updatedItem?.evidence).toEqual(evidence);
      
      // Performance: Should complete within threshold
      const threshold = getPerformanceThreshold('file-operation');
      expect(duration).toBeLessThan(threshold);
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - Evidence Required
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should throw error if evidence required but not provided', async () => {
      // Given: Checklist item with evidenceRequired = true
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
      if (checklist) {
        const item = checklist.items.find(i => i.id === 'write-code');
        if (item) {
          item.evidenceRequired = true;
          await service.saveStateChecklist(checklist, 'IMPLEMENTING');
        }
      }
      
      // When: markItemComplete() called without evidence
      // Then: Throws error with clear message
      await expect(
        service.markItemComplete('IMPLEMENTING', 'write-code')
      ).rejects.toThrow('Evidence is REQUIRED');
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - Evidence Validation
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should validate evidence structure', async () => {
      // Given: Invalid evidence (missing required fields)
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
      
      const invalidEvidence = {
        type: 'file_created' as const,
        // Missing description and files
        timestamp: new Date().toISOString()
      };
      
      // When: markItemComplete() called
      // Then: Throws validation error
      await expect(
        service.markItemComplete('IMPLEMENTING', 'write-code', invalidEvidence as any)
      ).rejects.toThrow();
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - File Evidence Validation
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should validate file_created evidence requires files', async () => {
      // Given: Evidence type = file_created, no files
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
      
      const evidence = {
        type: 'file_created' as const,
        description: 'Created files',
        timestamp: new Date().toISOString()
        // Missing files array
      };
      
      // When: validateEvidence() called (via markItemComplete)
      // Then: Throws error
      await expect(
        service.markItemComplete('IMPLEMENTING', 'write-code', evidence as any)
      ).rejects.toThrow('File-based evidence must include files array');
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - Command Evidence Validation
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should validate command_run evidence requires command', async () => {
      // Given: Evidence type = command_run, no command
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
      // Use an item that exists in IMPLEMENTING checklist
      const itemId = checklist?.items.find(i => i.id === 'write-code')?.id || 'write-code';
      
      const evidence = {
        type: 'command_run' as const,
        description: 'Ran command',
        timestamp: new Date().toISOString()
        // Missing command
      };
      
      // When: validateEvidence() called
      // Then: Throws error
      await expect(
        service.markItemComplete('IMPLEMENTING', itemId, evidence as any)
      ).rejects.toThrow('Command-based evidence must include command');
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - Manual Evidence Validation
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should validate manual evidence requires manualNotes', async () => {
      // Given: Evidence type = manual, no manualNotes
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
      
      const evidence = {
        type: 'manual' as const,
        description: 'Manual completion',
        timestamp: new Date().toISOString()
        // Missing manualNotes
      };
      
      // When: validateEvidence() called
      // Then: Throws error
      await expect(
        service.markItemComplete('UNDERSTANDING', 'understand-requirements', evidence as any)
      ).rejects.toThrow('Manual evidence must include manualNotes');
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - Evidence Persistence
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should save evidence to checklist item', async () => {
      // Given: Evidence object
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
      
      const evidence = {
        type: 'file_created' as const,
        description: 'Created authentication module',
        files: ['src/auth.ts'],
        timestamp: new Date().toISOString()
      };
      
      // When: markItemComplete() called with evidence
      await service.markItemComplete('IMPLEMENTING', 'write-code', evidence);
      
      // Then: Evidence saved in item.evidence field
      const checklist = await service.loadStateChecklist('IMPLEMENTING');
      const item = checklist?.items.find(i => i.id === 'write-code');
      expect(item?.evidence).toEqual(evidence);
      expect(item?.completed).toBe(true);
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - Timestamp Auto-generation
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should auto-generate timestamp if not provided', async () => {
      // Given: Evidence without timestamp
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
      
      const evidence = {
        type: 'file_created' as const,
        description: 'Created files',
        files: ['src/auth.ts']
        // Missing timestamp
      };
      
      // When: markItemComplete() called
      await service.markItemComplete('IMPLEMENTING', 'write-code', evidence as any);
      
      // Then: Timestamp added automatically
      const checklist = await service.loadStateChecklist('IMPLEMENTING');
      const item = checklist?.items.find(i => i.id === 'write-code');
      expect(item?.evidence?.timestamp).toBeDefined();
      expect(item?.evidence?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }, getTestTimeout());
  });

  describe('loadStateChecklist() - Lazy Initialization', () => {
    /**
     * @requirement Lazy Initialization - UNDERSTANDING State
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     */
    it('should auto-initialize checklist for UNDERSTANDING state if missing', async () => {
      // Given: Task exists but no checklist
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

      // Ensure no checklist exists
      const taskData = await fs.readJson(taskFile);
      if (taskData.stateChecklists) {
        delete taskData.stateChecklists.UNDERSTANDING;
        await fs.writeJson(taskFile, taskData);
      }

      // When: Load checklist for UNDERSTANDING state
      const checklist = await service.loadStateChecklist('UNDERSTANDING');

      // Then: Checklist should be auto-initialized and returned
      expect(checklist).not.toBeNull();
      expect(checklist?.items.length).toBeGreaterThan(0);
    }, getTestTimeout());

    /**
     * @requirement Lazy Initialization - DESIGNING State
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     */
    it('should auto-initialize checklist for DESIGNING state if missing', async () => {
      // Given: Task exists but no checklist
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

      // Ensure no checklist exists
      const taskData = await fs.readJson(taskFile);
      if (taskData.stateChecklists) {
        delete taskData.stateChecklists.DESIGNING;
        await fs.writeJson(taskFile, taskData);
      }

      // When: Load checklist for DESIGNING state
      const checklist = await service.loadStateChecklist('DESIGNING');

      // Then: Checklist should be auto-initialized and returned
      expect(checklist).not.toBeNull();
      expect(checklist?.items.length).toBeGreaterThan(0);
    }, getTestTimeout());

    /**
     * @requirement Lazy Initialization - Only for Early States
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     */
    it('should not auto-initialize checklist for IMPLEMENTING or later states', async () => {
      // Given: Task exists but no checklist
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

      // Ensure no checklist exists
      const taskData = await fs.readJson(taskFile);
      if (taskData.stateChecklists) {
        delete taskData.stateChecklists.IMPLEMENTING;
        await fs.writeJson(taskFile, taskData);
      }

      // When: Load checklist for IMPLEMENTING state
      const checklist = await service.loadStateChecklist('IMPLEMENTING');

      // Then: Should return null (not auto-initialize)
      expect(checklist).toBeNull();
    }, getTestTimeout());
  });
});

