/**
 * Unit tests for ReviewChecklistService
 * @requirement REFACTOR-EXTRACT-REVIEW-CHECKLIST-SERVICE - Phase 5 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ReviewChecklistService } from '../../src/core/review-checklist-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskFileSync } from '../../src/core/task-file-sync.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('ReviewChecklistService', () => {
  let service: ReviewChecklistService;
  let testContextDir: string;
  let taskFile: string;
  let queueManager: TaskQueueManager;
  let fileSync: TaskFileSync;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskFile = path.join(testContextDir, 'current-task.json');
    
    queueManager = new TaskQueueManager(testContextDir);
    fileSync = new TaskFileSync(testContextDir);
    
    service = new ReviewChecklistService(
      queueManager,
      fileSync,
      taskFile
    );
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('initializeReviewChecklist()', () => {
    it('should create default checklist when entering REVIEWING state', async () => {
      // Create a task in REVIEWING state
      const task = await queueManager.createTask('Test task review checklist');
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
        queueTask.workflow.currentState = 'REVIEWING' as WorkflowState;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeReviewChecklist();

      const checklist = await service.loadReviewChecklist();
      expect(checklist).not.toBeNull();
      expect(checklist?.items).toBeDefined();
      expect(checklist?.items.length).toBeGreaterThan(0);
    });

    it('should save checklist to queue and file', async () => {
      const task = await queueManager.createTask('Test task review checklist');
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
        queueTask.workflow.currentState = 'REVIEWING' as WorkflowState;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await service.initializeReviewChecklist();

      // Verify checklist is in file
      const fileData = await fs.readJson(taskFile);
      expect(fileData.reviewChecklist).toBeDefined();
    });
  });

  describe('loadReviewChecklist()', () => {
    it('should return null when no checklist exists', async () => {
      const checklist = await service.loadReviewChecklist();
      expect(checklist).toBeNull();
    });

    it('should load checklist from queue', async () => {
      const task = await queueManager.createTask('Test task review checklist');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        const { ReviewChecklistManager } = await import('../../src/core/review-checklist.js');
        const checklist = ReviewChecklistManager.createDefaultChecklist();
        (queueTask as any).reviewChecklist = checklist;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const checklist = await service.loadReviewChecklist();
      expect(checklist).not.toBeNull();
    });

    it('should load checklist from file when queue has none', async () => {
      const { ReviewChecklistManager } = await import('../../src/core/review-checklist.js');
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      await fs.writeJson(taskFile, {
        taskId: 'test-task',
        originalGoal: 'Test',
        reviewChecklist: checklist
      });

      const loadedChecklist = await service.loadReviewChecklist();
      expect(loadedChecklist).not.toBeNull();
      expect(loadedChecklist?.items.length).toBe(checklist.items.length);
    });
  });

  describe('saveReviewChecklist()', () => {
    it('should save checklist to queue and file', async () => {
      const task = await queueManager.createTask('Test task review checklist');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const { ReviewChecklistManager } = await import('../../src/core/review-checklist.js');
      const checklist = ReviewChecklistManager.createDefaultChecklist();

      await service.saveReviewChecklist(checklist);

      // Verify in file
      const fileData = await fs.readJson(taskFile);
      expect(fileData.reviewChecklist).toBeDefined();
    });
  });

  describe('validateReviewChecklistComplete()', () => {
    it('should throw error when checklist not found', async () => {
      await expect(service.validateReviewChecklistComplete()).rejects.toThrow('Review checklist not found');
    });

    it('should throw error when checklist incomplete', async () => {
      const task = await queueManager.createTask('Test task review checklist');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        const { ReviewChecklistManager } = await import('../../src/core/review-checklist.js');
        const checklist = ReviewChecklistManager.createDefaultChecklist();
        (queueTask as any).reviewChecklist = checklist;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await expect(service.validateReviewChecklistComplete()).rejects.toThrow('Review checklist is');
    });

    it('should not throw when checklist is complete', async () => {
      const task = await queueManager.createTask('Test task review checklist');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        const { ReviewChecklistManager } = await import('../../src/core/review-checklist.js');
        const checklist = ReviewChecklistManager.createDefaultChecklist();
        // Mark all items as complete
        let completedChecklist = checklist;
        for (const item of checklist.items) {
          completedChecklist = ReviewChecklistManager.markItemComplete(completedChecklist, item.id, 'Test completion');
        }
        (queueTask as any).reviewChecklist = completedChecklist;
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await expect(service.validateReviewChecklistComplete()).resolves.not.toThrow();
    });
  });
});

