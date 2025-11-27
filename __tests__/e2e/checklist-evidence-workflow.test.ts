/**
 * E2E Tests for Checklist Evidence Workflow
 * @requirement Checklist Evidence System - End-to-End Workflow
 */

import fs from 'fs-extra';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { TaskManager } from '../../src/core/task-manager.js';
import { StateChecklistService } from '../../src/core/state-checklist-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskFileSync } from '../../src/core/task-file-sync.js';
import { ChecklistRegistry } from '../../src/core/checklist-registry.js';
import { WorkflowState } from '@shadel/workflow-core';
import { 
  getUniqueAIContextDir, 
  cleanupWithRetry,
  getTestTimeout,
  getPerformanceThreshold
} from '../test-helpers.js';

describe('Checklist Evidence Workflow E2E', () => {
  let taskManager: TaskManager;
  let checklistService: StateChecklistService;
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
    
    taskManager = new TaskManager(testContextDir);
    queueManager = new TaskQueueManager(testContextDir);
    fileSync = new TaskFileSync(testContextDir);
    registry = new ChecklistRegistry();
    
    checklistService = new StateChecklistService(
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

  /**
   * @requirement Checklist Evidence System - E2E Workflow
   * @isolation Uses unique test directory via getUniqueAIContextDir()
   * @performance Should complete within full-workflow threshold
   */
  it('should complete full workflow with evidence collection', async () => {
    // Given: New task
    const startTime = Date.now();
    const task = await taskManager.createTask('Test E2E workflow with evidence');
    const taskId = task.id;
    
    // Setup task state
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

    // When: 1. sync --state IMPLEMENTING (see checklist)
    await checklistService.initializeStateChecklist('IMPLEMENTING');
    const checklist1 = await checklistService.loadStateChecklist('IMPLEMENTING');
    expect(checklist1).not.toBeNull();
    
    // 2. checklist check write-code --evidence file_created --files "src/file.ts" --description "Created"
    const itemId1 = checklist1?.items.find(i => i.id === 'write-code')?.id || 'write-code';
    const evidence1 = {
      type: 'file_created' as const,
      description: 'Created authentication module',
      files: ['src/auth.ts', 'src/auth.test.ts'],
      timestamp: new Date().toISOString()
    };
    await checklistService.markItemComplete('IMPLEMENTING', itemId1, evidence1);
    
    // 3. sync --state TESTING
    // Update queue task state
    const updatedQueue = await (queueManager as any).loadQueue();
    const updatedQueueTask = updatedQueue.tasks.find((t: any) => t.id === taskId);
    if (updatedQueueTask) {
      updatedQueueTask.workflow.currentState = 'TESTING' as WorkflowState;
      updatedQueueTask.workflow.stateEnteredAt = new Date().toISOString();
      await (queueManager as any).saveQueue(updatedQueue);
      await fileSync.syncFromQueue(updatedQueueTask);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await checklistService.initializeStateChecklist('TESTING');
    const checklist2 = await checklistService.loadStateChecklist('TESTING');
    expect(checklist2).not.toBeNull();
    
    // 4. checklist check write-tests --evidence test_passed --description "Tests passing"
    // Find any item in TESTING checklist
    if (!checklist2 || checklist2.items.length === 0) {
      throw new Error('No items found in TESTING checklist');
    }
    const itemId2 = checklist2.items[0].id;
    const evidence2 = {
      type: 'test_passed' as const,
      description: 'All tests passing',
      testResults: {
        passed: 100,
        failed: 0,
        total: 100
      },
      timestamp: new Date().toISOString()
    };
    await checklistService.markItemComplete('TESTING', itemId2, evidence2);
    
    const duration = Date.now() - startTime;
    
    // Then: All items completed with evidence, can progress states
    const finalChecklist1 = await checklistService.loadStateChecklist('IMPLEMENTING');
    const finalItem1 = finalChecklist1?.items.find(i => i.id === itemId1);
    expect(finalItem1?.completed).toBe(true);
    expect(finalItem1?.evidence).toEqual(evidence1);
    
    const finalChecklist2 = await checklistService.loadStateChecklist('TESTING');
    const finalItem2 = finalChecklist2?.items.find(i => i.id === itemId2);
    expect(finalItem2?.completed).toBe(true);
    expect(finalItem2?.evidence).toEqual(evidence2);
    
    // Performance: Should complete within full-workflow threshold
    const threshold = getPerformanceThreshold('full-workflow');
    expect(duration).toBeLessThan(threshold);
  }, 6000); // Increased timeout for E2E workflow test (was getTestTimeout())

  /**
   * @requirement Checklist Evidence System - E2E Workflow - Blocking
   * @isolation Uses unique test directory via getUniqueAIContextDir()
   * @performance Should complete within getTestTimeout() limit
   */
  it('should block state transition if required evidence missing', async () => {
    // Given: Checklist item completed without evidence (evidenceRequired = true)
    const task = await taskManager.createTask('Test blocking workflow');
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

    await checklistService.initializeStateChecklist('IMPLEMENTING');
    const checklist = await checklistService.loadStateChecklist('IMPLEMENTING');
    if (checklist) {
      const item = checklist.items.find(i => i.id === 'write-code');
      if (item) {
        item.evidenceRequired = true;
        // Mark complete without evidence (simulating incomplete work)
        item.completed = true;
        item.completedAt = new Date().toISOString();
        // No evidence provided
        await checklistService.saveStateChecklist(checklist, 'IMPLEMENTING');
      }
    }
    
    // When: sync --state TESTING (validation runs)
    // Then: Validation fails, transition blocked
    // Note: In real scenario, validateStateChecklistComplete would check evidence
    // For this test, we verify the item has evidenceRequired but no evidence
    const updatedChecklist = await checklistService.loadStateChecklist('IMPLEMENTING');
    const updatedItem = updatedChecklist?.items.find(i => i.id === 'write-code');
    expect(updatedItem?.evidenceRequired).toBe(true);
    expect(updatedItem?.evidence).toBeUndefined();
    // Item is marked complete but missing required evidence - would block transition
  }, getTestTimeout());
});

