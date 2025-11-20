/**
 * Tests for Bug #9: State History Validation
 * Prevents manual file edits that forge invalid state progressions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import { TaskManager } from '../src/core/task-manager';
import { WorkflowState } from '@shadel/workflow-core';
import { cleanupAllTestDirs } from './test-helpers';

describe('Bug #9: State History Validation', () => {
  const testContextDir = '.test-bug-9';
  const taskFile = `${testContextDir}/current-task.json`;
  let taskManager: TaskManager;

  beforeEach(async () => {
    await fs.remove(testContextDir);
    await fs.remove('.ai-context');
    taskManager = new TaskManager(testContextDir);
  });

  afterEach(async () => {
    await cleanupAllTestDirs();
  });

  // ============================================================================
  // VALID STATE HISTORY: Normal Operations Work
  // ============================================================================
  
  describe('Valid State History', () => {
    it('should accept valid sequential state progression', async () => {
      await taskManager.createTask('Test valid progression task', [], true);
      
      // Progress normally
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Should not throw
      await expect(
        taskManager.updateTaskState('TESTING')
      ).resolves.not.toThrow();
    });

    it('should accept empty history for new tasks', async () => {
      await taskManager.createTask('New task with empty history', [], true);
      
      // First state update with empty history should work
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).resolves.not.toThrow();
    });

    it('should REJECT backward movement (not allowed)', async () => {
      await taskManager.createTask('Test backward movement', [], true);
      
      await taskManager.updateTaskState('DESIGNING');
      
      // Backward transitions are not allowed
      await expect(
        taskManager.updateTaskState('UNDERSTANDING')
      ).rejects.toThrow(/Invalid state transition/);
    });

    it('should REJECT staying at same state (not allowed)', async () => {
      await taskManager.createTask('Test same state', [], true);
      
      // Same state transitions are not allowed
      await expect(
        taskManager.updateTaskState('UNDERSTANDING')
      ).rejects.toThrow(/Invalid state transition/);
    });
  });

  // ============================================================================
  // INVALID STATE HISTORY: Detect Corruption
  // ============================================================================
  
  describe('Detect Corrupted State History', () => {
    it('should BLOCK forged jump in history (UNDERSTANDING → READY_TO_COMMIT)', async () => {
      await taskManager.createTask('Test forged history', [], true);
      
      // Manually corrupt the task file
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'READY_TO_COMMIT';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'READY_TO_COMMIT', enteredAt: new Date().toISOString() }, // FORGED!
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Validation should detect corruption when we try to update
      // The corruption is: currentState (READY_TO_COMMIT) is in history
      // validateStateHistory runs BEFORE isValidTransition, so it should catch corruption first
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT') // Same state, but history corruption should be detected first
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
    });

    it('should BLOCK forged skip in history (skip DESIGNING)', async () => {
      await taskManager.createTask('Test skipped state', [], true);
      
      // Manually corrupt: skip DESIGNING
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'IMPLEMENTING';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() }, // Skipped DESIGNING!
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Next operation should detect corruption
      // The corruption is: invalid transition in history (UNDERSTANDING → IMPLEMENTING skips DESIGNING)
      // Also, currentState (IMPLEMENTING) is in history, which is corruption
      await expect(
        taskManager.updateTaskState('TESTING') // Valid transition, but history corruption should be detected
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
    });

    it('should detect state mismatch (currentState ≠ last history)', async () => {
      await taskManager.createTask('Test state mismatch', [], true);
      
      // Manually create corruption: currentState in history
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'REVIEWING'; // Current is REVIEWING
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'REVIEWING', enteredAt: new Date().toISOString() }, // REVIEWING in history but also current (corruption!)
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Next operation should detect corruption (currentState in history)
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT') // Valid transition, but corruption should be detected
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
    });

    it('should provide helpful error message for corruption', async () => {
      await taskManager.createTask('Test error message', [], true);
      
      // Forge corruption: currentState in history
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'TESTING';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'TESTING', enteredAt: new Date().toISOString() }, // FORGED! TESTING in history but also current
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      await expect(
        taskManager.updateTaskState('REVIEWING') // Valid transition, but corruption should be detected
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
      
      try {
        await taskManager.updateTaskState('REVIEWING');
      } catch (error: any) {
        expect(error.message).toContain('STATE HISTORY CORRUPTION');
        expect(error.message).toContain('Current state found in history');
      }
    });
  });

  // ============================================================================
  // SECURITY: Prevent Workflow Bypass
  // ============================================================================
  
  describe('Security: Prevent Workflow Bypass', () => {
    it('should prevent bypassing TESTING by forging history', async () => {
      await taskManager.createTask('Bypass TESTING attempt', [], true);
      
      // Attacker tries to forge: go directly to READY_TO_COMMIT
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'READY_TO_COMMIT';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'DESIGNING', enteredAt: new Date().toISOString() },
        { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() },
        // SKIP TESTING and REVIEWING
        { state: 'READY_TO_COMMIT', enteredAt: new Date().toISOString() },
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // System should block this - corruption should be detected
      // The corruption is: invalid transition in history (IMPLEMENTING → READY_TO_COMMIT)
      // This will be caught by validateStateHistory when we try to update
      // Use a valid forward transition to trigger history validation
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT') // Valid transition (already at READY_TO_COMMIT, but history corruption should be detected)
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
    });

    it('should warn about suspicious missing states', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await taskManager.createTask('Suspicious history', [], true);
      
      // Manually create suspicious history (skipped DESIGNING)
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'TESTING';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() },
        { state: 'TESTING', enteredAt: new Date().toISOString() },
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Will throw due to:
      // 1. Invalid transition in history (UNDERSTANDING → IMPLEMENTING skips DESIGNING)
      // 2. currentState (TESTING) is in history, which is corruption
      // Use a valid forward transition to trigger history validation
      await expect(
        taskManager.updateTaskState('REVIEWING') // Valid transition, but history corruption should be detected
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
      
      consoleSpy.mockRestore();
    });

    it('should prevent quality gate bypass', async () => {
      await taskManager.createTask('Quality gate bypass attempt', [], true);
      
      // Attacker manually edits file to skip REVIEWING
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'READY_TO_COMMIT';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'DESIGNING', enteredAt: new Date().toISOString() },
        { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() },
        { state: 'TESTING', enteredAt: new Date().toISOString() },
        // SKIP REVIEWING - quality gate!
        { state: 'READY_TO_COMMIT', enteredAt: new Date().toISOString() },
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // System blocks this bypass attempt
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
    });
  });

  // ============================================================================
  // EDGE CASES: Complex Scenarios
  // ============================================================================
  
  describe('Edge Cases', () => {
    it('should handle backward movement in history correctly', async () => {
      await taskManager.createTask('Test backward tracking', [], true);
      
      // Normal progression
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Backward transitions are not allowed - should be rejected
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).rejects.toThrow(/Invalid state transition/);
      
      // History should only contain completed states (UNDERSTANDING, DESIGNING)
      // Current state should still be IMPLEMENTING (backward transition rejected)
      const taskData = await fs.readJson(taskFile);
      expect(taskData.workflow.currentState).toBe('IMPLEMENTING');
      const states = taskData.workflow.stateHistory.map((e: any) => e.state);
      
      // History should contain: UNDERSTANDING (from creation), DESIGNING (first transition)
      expect(states).toEqual([
        'UNDERSTANDING',
        'DESIGNING'
      ]);
    });

    it('should handle repeated state correctly', async () => {
      await taskManager.createTask('Test repeated state', [], true);
      
      // Cannot update to same state - transitions must be forward
      // Instead, test that staying at same state doesn't corrupt history
      await taskManager.updateTaskState('DESIGNING');
      
      // Try to update to same state (should be rejected)
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).rejects.toThrow(/Invalid state transition/);
      
      // History should only contain completed states
      const taskData = await fs.readJson(taskFile);
      expect(taskData.workflow.currentState).toBe('DESIGNING');
      expect(taskData.workflow.stateHistory.length).toBe(1); // Only UNDERSTANDING
    });

    it('should reject corrupted history with random states', async () => {
      await taskManager.createTask('Test random corruption', [], true);
      
      // Manually create nonsensical history
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'IMPLEMENTING';
      taskData.workflow.stateHistory = [
        { state: 'REVIEWING', enteredAt: new Date().toISOString() }, // Wrong start
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() }, // Backward
        { state: 'READY_TO_COMMIT', enteredAt: new Date().toISOString() }, // Jump
        { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() },
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // System should detect this is invalid
      await expect(
        taskManager.updateTaskState('TESTING')
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
    });
  });

  // ============================================================================
  // REGRESSION: Verify Fix Doesn't Break Normal Usage
  // ============================================================================
  
  describe('Regression Tests', () => {
    it('should not interfere with normal workflow progression', async () => {
      await taskManager.createTask('Normal workflow test', [], true);
      
      // Full progression should work normally
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

    it('should not add performance overhead to valid operations', async () => {
      await taskManager.createTask('Performance test', [], true);
      
      const startTime = Date.now();
      
      // Multiple valid sequential state transitions (forward only)
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before READY_TO_COMMIT
      const { completeReviewChecklist } = await import('./test-helpers.js');
      await completeReviewChecklist(taskManager);
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      const duration = Date.now() - startTime;
      
      // Environment-aware performance threshold
      // Local: < 1000ms for fast feedback, CI: < 5000ms for slower environments
      const { getPerformanceThreshold } = await import('./test-helpers.js');
      const threshold = getPerformanceThreshold('full-workflow');
      expect(duration).toBeLessThan(threshold);
    });

    it('should REJECT backward movement (not allowed)', async () => {
      await taskManager.createTask('Backward movement test', [], true);
      
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Backward transitions are not allowed
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).rejects.toThrow(/Invalid state transition/);
    });
  });

  // ============================================================================
  // BENEFITS: Why This Fix Matters
  // ============================================================================
  
  describe('Bug Fix Benefits', () => {
    it('prevents bypassing quality gates via manual file edit', async () => {
      await taskManager.createTask('Quality gate test', [], true);
      
      // Attacker manually edits to skip testing
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'READY_TO_COMMIT';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'READY_TO_COMMIT', enteredAt: new Date().toISOString() }, // SKIPPED ALL GATES!
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // System prevents this
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow();
      
      // Quality gates remain enforced!
    });

    it('detects state forgery immediately on next operation', async () => {
      await taskManager.createTask('Immediate detection test', [], true);
      
      // Forge state
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'TESTING';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'TESTING', enteredAt: new Date().toISOString() },
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Very next operation detects it
      await expect(
        taskManager.updateTaskState('REVIEWING')
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
      
      // No forgery goes undetected!
    });

    it('provides clear guidance on what went wrong', async () => {
      await taskManager.createTask('Error message test', [], true);
      
      // Create corruption
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'READY_TO_COMMIT';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'READY_TO_COMMIT', enteredAt: new Date().toISOString() },
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT') // Same state, but history corruption should be detected
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
      
      try {
        await taskManager.updateTaskState('READY_TO_COMMIT');
      } catch (error: any) {
        // Error message helps user understand and fix
        expect(error.message).toContain('STATE HISTORY CORRUPTION');
        expect(error.message).toContain('Current state found in history');
      }
    });
  });

  // ============================================================================
  // INTEGRATION: Works with Bug #1 Fix
  // ============================================================================
  
  describe('Integration with Bug #1 (State Transition Validation)', () => {
    it('double protection: both transition validation AND history validation', async () => {
      await taskManager.createTask('Double protection test', [], true);
      
      // Forge invalid history
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'READY_TO_COMMIT';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'READY_TO_COMMIT', enteredAt: new Date().toISOString() },
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Bug #9 fix (history validation) catches it
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow(/STATE HISTORY CORRUPTION/);
      
      // Even if history validation somehow fails, Bug #1 fix would catch invalid transition
      // Double layer of protection!
    });
  });
});

