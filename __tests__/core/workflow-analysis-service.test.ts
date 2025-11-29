/**
 * Unit tests for WorkflowAnalysisService
 * @requirement REFACTOR-EXTRACT-WORKFLOW-ANALYSIS-SERVICE - Phase 6 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { WorkflowAnalysisService } from '../../src/core/workflow-analysis-service.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('WorkflowAnalysisService', () => {
  let service: WorkflowAnalysisService;
  let testContextDir: string;
  let taskFile: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskFile = path.join(testContextDir, 'current-task.json');
    service = new WorkflowAnalysisService(taskFile);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('analyzeWorkflowCompleteness()', () => {
    it('should detect complete workflow', async () => {
      const taskData = {
        id: 'task-1',
        goal: 'Test task',
        workflow: {
          currentState: 'READY_TO_COMMIT' as WorkflowState,
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' },
            { state: 'DESIGNING', enteredAt: '2025-01-01T01:00:00Z' },
            { state: 'IMPLEMENTING', enteredAt: '2025-01-01T02:00:00Z' },
            { state: 'TESTING', enteredAt: '2025-01-01T03:00:00Z' },
            { state: 'REVIEWING', enteredAt: '2025-01-01T04:00:00Z' },
            { state: 'READY_TO_COMMIT', enteredAt: '2025-01-01T05:00:00Z' }
          ]
        }
      };

      await fs.writeJson(taskFile, taskData);

      const result = await service.analyzeWorkflowCompleteness();

      expect(result.complete).toBe(true);
      expect(result.missingPhases).toHaveLength(0);
      expect(result.currentState).toBe('READY_TO_COMMIT');
    });

    it('should detect incomplete workflow with missing phases', async () => {
      // Test case: At IMPLEMENTING state but missing DESIGNING in history
      const taskData = {
        id: 'task-1',
        goal: 'Test task',
        workflow: {
          currentState: 'IMPLEMENTING' as WorkflowState,
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' },
            { state: 'IMPLEMENTING', enteredAt: '2025-01-01T02:00:00Z' }
            // Missing DESIGNING in history
          ]
        }
      };

      await fs.writeJson(taskFile, taskData);

      const result = await service.analyzeWorkflowCompleteness();

      expect(result.complete).toBe(false);
      expect(result.missingPhases).toContain('DESIGNING');
      expect(result.currentState).toBe('IMPLEMENTING');
    });

    it('should throw error when task file does not exist', async () => {
      await fs.remove(taskFile).catch(() => {});

      await expect(service.analyzeWorkflowCompleteness()).rejects.toThrow(/ENOENT|not found/i);
    });

    it('should throw error when task has no workflow data', async () => {
      await fs.writeJson(taskFile, { id: 'task-1', goal: 'Test' });

      await expect(service.analyzeWorkflowCompleteness()).rejects.toThrow();
    });
  });

  describe('analyzeWorkflowCompleteness() - instructions', () => {
    it('should include instructions for incomplete workflow', async () => {
      // Test case: At TESTING state but missing IMPLEMENTING in history
      const taskData = {
        id: 'task-1',
        goal: 'Test task',
        workflow: {
          currentState: 'TESTING' as WorkflowState,
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' },
            { state: 'DESIGNING', enteredAt: '2025-01-01T01:00:00Z' },
            { state: 'TESTING', enteredAt: '2025-01-01T03:00:00Z' }
            // Missing IMPLEMENTING in history
          ]
        }
      };

      await fs.writeJson(taskFile, taskData);

      const result = await service.analyzeWorkflowCompleteness();

      expect(result.complete).toBe(false);
      expect(result.instructions).toBeDefined();
      if (result.instructions) {
        expect(result.instructions).toContain('AI FLOW CORRECTION');
        expect(result.instructions).toContain('IMPLEMENTING');
      }
    });

    it('should not include instructions for complete workflow', async () => {
      const taskData = {
        id: 'task-1',
        goal: 'Test task',
        workflow: {
          currentState: 'READY_TO_COMMIT' as WorkflowState,
          stateHistory: [
            { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00Z' },
            { state: 'DESIGNING', enteredAt: '2025-01-01T01:00:00Z' },
            { state: 'IMPLEMENTING', enteredAt: '2025-01-01T02:00:00Z' },
            { state: 'TESTING', enteredAt: '2025-01-01T03:00:00Z' },
            { state: 'REVIEWING', enteredAt: '2025-01-01T04:00:00Z' },
            { state: 'READY_TO_COMMIT', enteredAt: '2025-01-01T05:00:00Z' }
          ]
        }
      };

      await fs.writeJson(taskFile, taskData);

      const result = await service.analyzeWorkflowCompleteness();

      expect(result.complete).toBe(true);
      expect(result.instructions).toBeUndefined();
    });
  });
});

