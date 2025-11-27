/**
 * Unit tests for TaskLoaderService
 * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskLoaderService } from '../../src/core/task-loader-service.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('TaskLoaderService', () => {
  let service: TaskLoaderService;
  let testContextDir: string;
  let taskFile: string;
  let queueManager: TaskQueueManager;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskFile = path.join(testContextDir, 'current-task.json');
    
    queueManager = new TaskQueueManager(testContextDir);
    service = new TaskLoaderService(queueManager, taskFile);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('loadTaskForStateUpdate()', () => {
    it('should throw error when no task exists', async () => {
      await expect(service.loadTaskForStateUpdate()).rejects.toThrow('No active task to update state');
    });

    it('should load task from queue when queue has active task', async () => {
      const task = await queueManager.createTask('Test task loader');
      const taskId = task.id;
      
      const result = await service.loadTaskForStateUpdate();
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(taskId);
      expect(result.activeQueueTask).not.toBeNull();
      expect(result.currentState).toBe('UNDERSTANDING');
    });

    it('should load task from file when file exists but queue does not', async () => {
      const fileTask = {
        taskId: 'file-task-123',
        originalGoal: 'File task',
        workflow: {
          currentState: 'IMPLEMENTING' as WorkflowState,
          stateEnteredAt: new Date().toISOString(),
          stateHistory: []
        }
      };
      await fs.writeJson(taskFile, fileTask);
      
      const result = await service.loadTaskForStateUpdate();
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe('file-task-123');
      expect(result.fileTaskData).not.toBeNull();
      expect(result.currentState).toBe('IMPLEMENTING');
    });

    it('should prefer queue task over file when both exist', async () => {
      // Create file task
      const fileTask = {
        taskId: 'file-task-789',
        originalGoal: 'File task',
        workflow: {
          currentState: 'UNDERSTANDING' as WorkflowState,
          stateEnteredAt: new Date().toISOString(),
          stateHistory: []
        }
      };
      await fs.writeJson(taskFile, fileTask);
      
      // Create queue task
      const queueTask = await queueManager.createTask('Queue task description');
      const queueTaskId = queueTask.id;
      
      const result = await service.loadTaskForStateUpdate();
      
      // Should prefer queue task
      expect(result.taskId).toBe(queueTaskId);
      expect(result.activeQueueTask).not.toBeNull();
    });

    it('should include validation data from file when file exists', async () => {
      const fileTask = {
        taskId: 'file-task-123',
        originalGoal: 'File task',
        workflow: {
          currentState: 'IMPLEMENTING' as WorkflowState,
          stateEnteredAt: new Date().toISOString(),
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' },
            { state: 'DESIGNING', enteredAt: '2025-01-01T01:00:00Z' },
            { state: 'IMPLEMENTING', enteredAt: '2025-01-01T02:00:00Z' }
          ]
        }
      };
      await fs.writeJson(taskFile, fileTask);
      
      const result = await service.loadTaskForStateUpdate();
      
      expect(result.validationData).toBeDefined();
      expect(result.validationData.workflow).toBeDefined();
    });

    it('should handle retry logic when queue is null but file exists', async () => {
      // Ensure directory exists
      await fs.ensureDir(testContextDir);
      
      const fileTask = {
        taskId: 'file-task-123',
        originalGoal: 'File task description',
        workflow: {
          currentState: 'UNDERSTANDING' as WorkflowState,
          stateEnteredAt: new Date().toISOString(),
          stateHistory: []
        }
      };
      await fs.writeJson(taskFile, fileTask);
      
      // Create queue task after file (simulates timing issue)
      const queueTaskPromise = new Promise<void>(resolve => {
        setTimeout(async () => {
          await queueManager.createTask('Queue task description');
          resolve();
        }, 20);
      });
      
      // Wait a bit for queue task to be created
      await new Promise(resolve => setTimeout(resolve, 50));
      await queueTaskPromise;
      
      const result = await service.loadTaskForStateUpdate();
      
      // Should eventually get queue task or file task
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
    });
  });
});

