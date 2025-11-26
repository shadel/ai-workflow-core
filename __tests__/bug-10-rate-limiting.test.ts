/**
 * Tests for Bug #10: Rate Limiting on State Changes
 * Detects suspiciously fast state progression
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { TaskManager } from '../src/core/task-manager';
import { getUniqueAIContextDir, cleanupWithRetry } from './test-helpers';

describe('Bug #10: Rate Limiting on State Changes', () => {
  let testContextDir: string;
  let taskFile: string;
  let taskManager: TaskManager;
  let consoleSpy: jest.SpiedFunction<typeof console.warn>;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    taskFile = path.join(testContextDir, 'current-task.json');
    // Ensure directory exists before creating manager
    await fs.ensureDir(testContextDir);
    taskManager = new TaskManager(testContextDir);
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  // ============================================================================
  // RAPID CHANGES: Detect Fast Progression
  // ============================================================================
  
  describe('Detect Rapid State Changes', () => {
    it('should WARN when states change < 1 minute apart', async () => {
      await taskManager.createTask('Rapid change test task', [], true);
      
      // First change
      await taskManager.updateTaskState('DESIGNING');
      
      // Immediate second change (< 1 minute)
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Should have warned about rapid change
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('RAPID STATE CHANGE DETECTED')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('seconds')
      );
    });

    it('should WARN when states change < 5 minutes apart', async () => {
      await taskManager.createTask('Test 5 minute warning', [], true);
      
      // First change
      await taskManager.updateTaskState('DESIGNING');
      
      // Manually set stateEnteredAt to 3 minutes ago
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Second change (3 minutes later, within 5 minute threshold)
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Should warn (but milder warning)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('State changed recently')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('minutes ago')
      );
    });

    it('should NOT warn when states change > 5 minutes apart', async () => {
      await taskManager.createTask('Test no warning after 5min', [], true);
      
      // First change
      await taskManager.updateTaskState('DESIGNING');
      
      // Manually set stateEnteredAt to 10 minutes ago
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      consoleSpy.mockClear(); // Clear any previous warnings
      
      // Second change (10 minutes later, outside threshold)
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Should NOT warn
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('RAPID STATE CHANGE')
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('State changed recently')
      );
    });

    it('should provide helpful guidance in rapid change warning', async () => {
      await taskManager.createTask('Test warning content', [], true);
      
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Check warning contains helpful info
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Real work typically takes')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Design: 10-60 minutes')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure the work is complete?')
      );
    });
  });

  // ============================================================================
  // NO BLOCKING: Warnings Only, Not Errors
  // ============================================================================
  
  describe('Non-Blocking Warnings', () => {
    it('should ALLOW rapid state changes (just warn)', async () => {
      await taskManager.createTask('Allow rapid changes', [], true);
      
      // Rapid changes should all succeed
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).resolves.not.toThrow();
      
      await expect(
        taskManager.updateTaskState('IMPLEMENTING')
      ).resolves.not.toThrow();
      
      await expect(
        taskManager.updateTaskState('TESTING')
      ).resolves.not.toThrow();
      
      // All succeed, just with warnings
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('TESTING');
    });

    it('should not prevent testing the workflow', async () => {
      await taskManager.createTask('Test workflow quickly', [], true);
      
      // Users testing the workflow will progress fast
      // This should be allowed
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('./test-helpers.js');
      await completeReviewChecklist(taskManager);
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      // All should succeed
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('READY_TO_COMMIT');
    });
  });

  // ============================================================================
  // FIRST STATE CHANGE: Warns if Immediate
  // ============================================================================
  
  describe('First State Change', () => {
    it('should WARN on immediate first state change (rapid after creation)', async () => {
      await taskManager.createTask('First state change test', [], true);
      
      consoleSpy.mockClear();
      
      // Immediate first state change from UNDERSTANDING (< 1 second after creation)
      await taskManager.updateTaskState('DESIGNING');
      
      // Should warn because it's too fast (< 1 minute since creation)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('RAPID STATE CHANGE')
      );
    });

    it('should handle missing stateEnteredAt gracefully', async () => {
      await taskManager.createTask('Missing timestamp test', [], true);
      
      // Manually remove stateEnteredAt
      const taskData = await fs.readJson(taskFile);
      delete taskData.workflow.stateEnteredAt;
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Should not crash
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // LEGITIMATE FAST CHANGES: No False Positives
  // ============================================================================
  
  describe('Legitimate Fast Changes', () => {
    it('should warn but allow quick design iterations', async () => {
      await taskManager.createTask('Quick design iteration', [], true);
      
      // Designer might quickly iterate forward (backward transitions not allowed)
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING'); // Forward only
      
      // Should warn about rapid change
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should warn when developer quickly moves through states', async () => {
      await taskManager.createTask('Fast developer workflow', [], true);
      
      // Fast developer might progress quickly for small tasks
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Should warn (they might be skipping work)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('RAPID STATE CHANGE')
      );
    });
  });

  // ============================================================================
  // REGRESSION: Doesn't Break Existing Functionality
  // ============================================================================
  
  describe('Regression Tests', () => {
    it('should not interfere with normal workflow', async () => {
      // Clear any warnings from previous tests
      consoleSpy.mockClear();
      
      await taskManager.createTask('Normal workflow test', [], true);
      
      // Set reasonable time gaps
      await taskManager.updateTaskState('DESIGNING');
      
      // Clear warnings from initial state changes
      consoleSpy.mockClear();
      
      // ARCHITECTURE COMPLIANCE: Update queue (source of truth), not file directly
      // Queue (tasks.json) is the source of truth - file (current-task.json) is just a cache
      // We need to update queue with old timestamp, then sync file from queue
      const oldTimestamp = new Date(Date.now() - 7 * 60 * 1000).toISOString();
      const currentTask = await taskManager.getCurrentTask();
      
      if (!currentTask) {
        throw new Error('No active task found');
      }
      
      // Use test helper to get queue manager (same instance as TaskManager uses)
      // Test helper creates a new TaskManager, but we can use its queueManager instance pattern
      // However, we need to use the same testDir, so we'll use test helper with same dir
      const { createTaskManagerTestContext } = await import('./task-manager-test-patterns.js');
      const ctx = createTaskManagerTestContext({ testDirName: testContextDir });
      await ctx.setup();
      
      // Get queue manager - but we need to use same TaskManager instance
      // So we'll get queue manager from the helper's TaskManager (same testDir = same queue)
      // Actually, both TaskManagers share same testDir, so queue is the same file
      const helperQueueManager = ctx.getQueueManager();
      const queue = await (helperQueueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === currentTask.id);
      
      if (!queueTask || !queueTask.workflow) {
        await ctx.cleanup();
        throw new Error('Queue task not found or workflow not initialized');
      }
      
      // Update queue with old timestamp (source of truth)
      queueTask.workflow.stateEnteredAt = oldTimestamp;
      await (helperQueueManager as any).saveQueue(queue);
      
      // Sync file from queue using public API (one-way sync: queue → file)
      // This ensures file matches queue exactly (architecture compliant)
      await taskManager.syncFileFromQueue(queueTask, ['requirements']);
      
      // Verify queue was updated correctly (source of truth)
      const verifyQueue = await (helperQueueManager as any).loadQueue();
      const verifyTask = verifyQueue.tasks.find((t: any) => t.id === currentTask.id);
      expect(verifyTask?.workflow?.stateEnteredAt).toBe(oldTimestamp);
      
      // Verify file was synced correctly from queue
      const verifyFileData = await fs.readJson(taskFile);
      expect(verifyFileData.workflow.stateEnteredAt).toBe(oldTimestamp);
      
      // Verify time since last change is > 5 minutes
      const currentTime = Date.now();
      const lastChangeTime = new Date(oldTimestamp).getTime();
      const timeSinceLastChange = currentTime - lastChangeTime;
      expect(timeSinceLastChange).toBeGreaterThan(5 * 60 * 1000); // Must be > 5 minutes
      
      // Note: Don't cleanup ctx here - it's just a helper to access queue manager
      // The ctx will be cleaned up in afterEach, but we need queue to remain accessible
      // Both TaskManager instances use same testDir, so queue is shared
      
      // Clear all warnings before state update
      consoleSpy.mockClear();
      
      // Update state - should not trigger rate limiting warning after 7 minutes
      // updateTaskState() uses fileTaskData for rate limiting check (line 676)
      // File data has timestamp 7 minutes ago, so no warning should be triggered
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Check only rate limiting warnings (ignore other warnings)
      const rateLimitWarnings = consoleSpy.mock.calls.filter(
        call => {
          const message = call[0]?.toString() || '';
          return message.includes('RAPID STATE CHANGE') ||
                 message.includes('State changed recently');
        }
      );
      
      // No rate limiting warnings after 7 minutes delay (normal operation)
      // Note: 7 minutes > 5 minute threshold, so no warning should be triggered
      expect(rateLimitWarnings.length).toBe(0);
      
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('IMPLEMENTING');
    });

    it('should still enforce state transition validation', async () => {
      await taskManager.createTask('Validation still works', [], true);
      
      // Invalid transition should still be blocked
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT') // Try to jump
      ).rejects.toThrow(/Invalid state transition/);
      
      // Rate limiting doesn't replace validation
    });

    it('should not add significant performance overhead', async () => {
      await taskManager.createTask('Performance test', [], true);
      
      const startTime = Date.now();
      
      // Multiple sequential state changes (forward only - valid transitions)
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      const duration = Date.now() - startTime;
      
      // Environment-aware performance threshold
      // Local: < 500ms for fast feedback, CI: < 3000ms for slower environments
      const { getPerformanceThreshold } = await import('./test-helpers.js');
      const threshold = getPerformanceThreshold('state-transition');
      expect(duration).toBeLessThan(threshold);
    });
  });

  // ============================================================================
  // BENEFITS: Why This Feature Matters
  // ============================================================================
  
  describe('Bug Fix Benefits', () => {
    it('helps detect when users skip actual work', async () => {
      await taskManager.createTask('Work skipping detection', [], true);
      
      // User rapidly progresses (suspicious)
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      
      // Multiple warnings should have been issued
      const warningCalls = consoleSpy.mock.calls.filter(
        call => call[0]?.toString().includes('RAPID STATE CHANGE') ||
                call[0]?.toString().includes('State changed recently')
      );
      
      expect(warningCalls.length).toBeGreaterThan(0);
    });

    it('provides educational guidance about realistic timelines', async () => {
      await taskManager.createTask('Educational guidance test', [], true);
      
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Warning includes educational content
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Implementation: 30-240 minutes')
      );
    });

    it('still allows fast progression (non-blocking)', async () => {
      await taskManager.createTask('Non-blocking test', [], true);
      
      // Even with warnings, all operations succeed
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('./test-helpers.js');
      await completeReviewChecklist(taskManager);
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('READY_TO_COMMIT');
      
      // Warnings issued but progression not blocked
    });
  });

  // ============================================================================
  // EDGE CASES: Different Scenarios
  // ============================================================================
  
  describe('Edge Cases', () => {
    it('should handle clock skew gracefully', async () => {
      await taskManager.createTask('Clock skew test', [], true);
      
      await taskManager.updateTaskState('DESIGNING');
      
      // Set stateEnteredAt to future (clock skew)
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Should not crash
      await expect(
        taskManager.updateTaskState('IMPLEMENTING')
      ).resolves.not.toThrow();
    });

    it('should differentiate between < 1min and < 5min warnings', async () => {
      await taskManager.createTask('Warning level test', [], true);
      
      await taskManager.updateTaskState('DESIGNING');
      
      // Test < 1 minute warning (strong)
      await taskManager.updateTaskState('IMPLEMENTING');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('RAPID STATE CHANGE DETECTED')
      );
      
      consoleSpy.mockClear();
      
      // Set to 3 minutes ago
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.stateEnteredAt = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Test < 5 minute warning (milder)
      await taskManager.updateTaskState('TESTING');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('State changed recently')
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('RAPID STATE CHANGE DETECTED')
      );
    });
  });
});

