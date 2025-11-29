/**
 * Checklist CLI Commands Tests
 * @requirement Checklist Evidence System - CLI Integration
 */

import fs from 'fs-extra';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { StateChecklistService } from '../../src/core/state-checklist-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskFileSync } from '../../src/core/task-file-sync.js';
import { ChecklistRegistry } from '../../src/core/checklist-registry.js';
import { WorkflowState } from '@shadel/workflow-core';
import { 
  getUniqueAIContextDir, 
  cleanupWithRetry,
  getTestTimeout
} from '../test-helpers.js';

describe('Checklist CLI Commands', () => {
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

  describe('checklist check command with evidence', () => {
    /**
     * @requirement Checklist Evidence System - CLI Integration
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should mark item complete with file_created evidence', async () => {
      // Given: Active task, checklist item
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
      const itemId = checklist?.items.find(i => i.id === 'write-code')?.id || 'write-code';
      
      // When: checklist check called with file_created evidence
      const evidence = {
        type: 'file_created' as const,
        description: 'Created authentication module',
        files: ['src/auth.ts', 'src/auth.test.ts'],
        timestamp: new Date().toISOString()
      };
      
      await service.markItemComplete('IMPLEMENTING', itemId, evidence);
      
      // Then: Item marked complete, evidence saved
      const updatedChecklist = await service.loadStateChecklist('IMPLEMENTING');
      const updatedItem = updatedChecklist?.items.find(i => i.id === itemId);
      expect(updatedItem?.completed).toBe(true);
      expect(updatedItem?.evidence).toEqual(evidence);
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - CLI Integration
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should mark item complete with command_run evidence', async () => {
      // Given: Active task, checklist item
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
      const itemId = checklist?.items.find(i => i.id === 'write-code')?.id || 'write-code';
      
      // When: checklist check called with command_run evidence
      const evidence = {
        type: 'command_run' as const,
        description: 'Validation passed',
        command: 'npx ai-workflow validate',
        output: 'All validations passed',
        timestamp: new Date().toISOString()
      };
      
      await service.markItemComplete('IMPLEMENTING', itemId, evidence);
      
      // Then: Item marked complete, evidence saved
      const updatedChecklist = await service.loadStateChecklist('IMPLEMENTING');
      const updatedItem = updatedChecklist?.items.find(i => i.id === itemId);
      expect(updatedItem?.completed).toBe(true);
      expect(updatedItem?.evidence).toEqual(evidence);
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - CLI Integration
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should mark item complete with manual evidence', async () => {
      // Given: Active task, checklist item
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
      const itemId = checklist?.items.find(i => i.id === 'understand-requirements')?.id || 'understand-requirements';
      
      // When: checklist check called with manual evidence
      const evidence = {
        type: 'manual' as const,
        description: 'Discussed with user',
        manualNotes: 'User confirmed all requirements clear',
        timestamp: new Date().toISOString()
      };
      
      await service.markItemComplete('UNDERSTANDING', itemId, evidence);
      
      // Then: Item marked complete, evidence saved
      const updatedChecklist = await service.loadStateChecklist('UNDERSTANDING');
      const updatedItem = updatedChecklist?.items.find(i => i.id === itemId);
      expect(updatedItem?.completed).toBe(true);
      expect(updatedItem?.evidence).toEqual(evidence);
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - CLI Integration - Error Handling
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should fail if evidence required but not provided', async () => {
      // Given: Active task, checklist item with evidenceRequired = true
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
      
      // When: checklist check called without evidence
      // Then: Throws error
      await expect(
        service.markItemComplete('IMPLEMENTING', 'write-code')
      ).rejects.toThrow('Evidence is REQUIRED');
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - CLI Integration - Validation
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should validate evidence type-specific requirements', async () => {
      // Given: file_created evidence type without files
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
      const itemId = checklist?.items.find(i => i.id === 'write-code')?.id || 'write-code';
      
      const evidence = {
        type: 'file_created' as const,
        description: 'Created files',
        timestamp: new Date().toISOString()
        // Missing files array
      };
      
      // When: checklist check called with invalid evidence
      // Then: Throws validation error
      await expect(
        service.markItemComplete('IMPLEMENTING', itemId, evidence as any)
      ).rejects.toThrow('File-based evidence must include files array');
    }, getTestTimeout());

    /**
     * @requirement Checklist Evidence System - CLI Integration - Display
     * @isolation Uses unique test directory via getUniqueAIContextDir()
     * @performance Should complete within getTestTimeout() limit
     */
    it('should show updated checklist after marking complete', async () => {
      // Given: Active task, checklist
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
      const itemId = checklist?.items.find(i => i.id === 'write-code')?.id || 'write-code';
      
      // When: checklist check called with evidence
      const evidence = {
        type: 'file_created' as const,
        description: 'Created authentication module',
        files: ['src/auth.ts'],
        timestamp: new Date().toISOString()
      };
      
      await service.markItemComplete('IMPLEMENTING', itemId, evidence);
      
      // Then: Updated checklist shows completed item
      const updatedChecklist = await service.loadStateChecklist('IMPLEMENTING');
      const updatedItem = updatedChecklist?.items.find(i => i.id === itemId);
      expect(updatedItem?.completed).toBe(true);
      expect(updatedChecklist).not.toBeNull();
      
      // Display should not throw
      expect(() => service.displayChecklist(updatedChecklist!, 'IMPLEMENTING')).not.toThrow();
    }, getTestTimeout());
  });
});

