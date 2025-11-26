/**
 * Tests for AI Flow Correction Mechanism
 * Bug #9 Complete Fix - AI-first design
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { TaskManager } from '../src/core/task-manager';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from './test-helpers';

describe('AI Flow Correction Mechanism', () => {
  let testContextDir: string;
  let taskFile: string;
  let taskManager: TaskManager;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    taskFile = path.join(testContextDir, 'current-task.json');
    // Ensure directory exists (don't remove - it's unique and doesn't exist yet)
    await fs.ensureDir(testContextDir);
    // Don't remove .ai-context - it might be used by other parallel tests
    taskManager = new TaskManager(testContextDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  // ============================================================================
  // PUBLIC API: validateStateHistory
  // ============================================================================
  
  describe('validateStateHistory (Public API)', () => {
    it('should be accessible as public method', () => {
      expect(typeof taskManager.validateStateHistory).toBe('function');
    });

    it('should accept optional taskData parameter', async () => {
      await taskManager.createTask('Test task for public API', [], true);
      const taskData = await fs.readJson(taskFile);
      
      // Should not throw with valid data
      await expect(
        taskManager.validateStateHistory(taskData)
      ).resolves.not.toThrow();
    });

    it('should load taskData if not provided', async () => {
      await taskManager.createTask('Test auto-load', [], true);
      
      // Should load from file
      await expect(
        taskManager.validateStateHistory()
      ).resolves.not.toThrow();
    });

    it('should handle missing task file gracefully', async () => {
      // No task file exists
      await expect(
        taskManager.validateStateHistory()
      ).resolves.not.toThrow(); // Just returns
    });
  });

  // ============================================================================
  // ANALYZE WORKFLOW COMPLETENESS
  // ============================================================================
  
  describe('analyzeWorkflowCompleteness', () => {
    it('should detect complete workflow (all phases present)', async () => {
      await taskManager.createTask('Complete workflow test', [], true);
      
      // Progress through all states
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      expect(analysis.complete).toBe(true);
      expect(analysis.currentState).toBe('IMPLEMENTING');
      expect(analysis.missingPhases).toEqual([]);
    });

    it('should detect missing DESIGN phase', async () => {
      await taskManager.createTask('Missing DESIGN test', [], true);
      
      // Manually set state to IMPLEMENTATION without DESIGN in history
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'IMPLEMENTING';
      taskData.workflow.stateHistory = []; // Empty history
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      expect(analysis.complete).toBe(false);
      expect(analysis.missingPhases).toContain('DESIGNING');
      expect(analysis.instructions).toBeDefined();
    });

    it('should detect missing TESTING phase (critical)', async () => {
      await taskManager.createTask('Missing TESTING test', [], true);
      
      // Skip TESTING, jump to REVIEWING
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'REVIEWING';
      taskData.workflow.stateHistory = [
        { state: 'DESIGNING', enteredAt: new Date().toISOString() },
        { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() }
        // Missing TESTING!
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      expect(analysis.complete).toBe(false);
      expect(analysis.missingPhases).toContain('TESTING');
      expect(analysis.instructions).toContain('TESTING');
      expect(analysis.instructions).toContain('MANDATORY');
    });

    it('should include AI-specific guidance in instructions', async () => {
      await taskManager.createTask('AI guidance test', [], true);
      
      // Set to IMPLEMENTING without DESIGN
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'IMPLEMENTING';
      taskData.workflow.stateHistory = [];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      expect(analysis.instructions).toContain('🤖 AI');
      expect(analysis.instructions).toContain('DESIGN');
      expect(analysis.instructions).toContain('npx ai-workflow sync');
    });
  });

  // ============================================================================
  // AI FLOW CORRECTION IN ACTION
  // ============================================================================
  
  describe('AI Flow Correction Workflow', () => {
    it('should guide AI through missing DESIGN phase', async () => {
      await taskManager.createTask('Test AI guided completion', [], true);
      
      // Skip to IMPLEMENTATION
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'IMPLEMENTING';
      taskData.workflow.stateHistory = []; // Empty
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Analyze
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      // Should detect missing phases
      expect(analysis.complete).toBe(false);
      expect(analysis.missingPhases.length).toBeGreaterThan(0);
      
      // Should provide instructions
      expect(analysis.instructions).toBeTruthy();
      expect(analysis.instructions).toContain('DESIGN');
    });

    it('should allow AI to complete missing phases naturally', async () => {
      await taskManager.createTask('Natural completion test', [], true);
      
      // Simulate: AI skipped DESIGN, now goes back to do it
      
      // Step 1: AI completes DESIGN work
      await taskManager.updateTaskState('DESIGNING');
      
      // Step 2: AI returns to IMPLEMENTATION
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Step 3: Check completeness
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      // Now should be complete
      expect(analysis.complete).toBe(true);
      expect(analysis.missingPhases).toEqual([]);
    });
  });

  // ============================================================================
  // AI VS HUMAN TIME CHARACTERISTICS
  // ============================================================================
  
  describe('AI Speed Characteristics', () => {
    it('should allow AI to complete workflow in 3 minutes', async () => {
      await taskManager.createTask('AI speed test task', [], true);
      
      const startTime = Date.now();
      
      // AI progresses through all states (3 minutes total)
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before transitioning to READY_TO_COMMIT
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for checklist initialization
      
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      
      // If checklist doesn't exist yet, wait a bit more
      if (!checklist) {
        await new Promise(resolve => setTimeout(resolve, 100));
        checklist = await (taskManager as any).loadReviewChecklist();
      }
      
      if (checklist && checklist.items) {
        // Mark all items as complete using ReviewChecklistManager
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        // Save the updated checklist
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for save
      }
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      const elapsed = Date.now() - startTime;
      
      // Should complete very fast (AI speed)
      // Windows/parallel execution may be slower - use higher threshold
      // Note: This test does full workflow (5 state transitions + checklist completion)
      const { getPerformanceThreshold } = await import('./test-helpers.js');
      const baseThreshold = getPerformanceThreshold('full-workflow');
      const threshold = baseThreshold * 2.5; // 2.5x multiplier for AI speed test with full workflow
      expect(elapsed).toBeLessThan(threshold);
      
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('READY_TO_COMMIT');
    });

    it('should not block fast AI progression', async () => {
      await taskManager.createTask('Fast AI progression test', [], true);
      
      // Rapid progression (normal for AI)
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).resolves.not.toThrow();
      
      await expect(
        taskManager.updateTaskState('IMPLEMENTING')
      ).resolves.not.toThrow();
      
      // No time-based blocking for AI
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('IMPLEMENTING');
    });
  });

  // ============================================================================
  // MISSING PHASE DETECTION
  // ============================================================================
  
  describe('Missing Phase Detection', () => {
    it('should allow DESIGNING with no prior history (UNDERSTANDING implicit)', async () => {
      await taskManager.createTask('DESIGN with implicit UNDERSTANDING', [], true);
      
      // Progress to DESIGNING normally (UNDERSTANDING will be added to history)
      await taskManager.updateTaskState('DESIGNING');
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      // Should be complete (UNDERSTANDING is implicit, DESIGNING is current)
      expect(analysis.complete).toBe(true);
      expect(analysis.missingPhases).toEqual([]);
    });

    it('should detect multiple missing phases', async () => {
      await taskManager.createTask('Multiple missing', [], true);
      
      // Jump directly to TESTING
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'TESTING';
      taskData.workflow.stateHistory = [];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      // Should detect missing phases
      expect(analysis.complete).toBe(false);
      expect(analysis.missingPhases.length).toBeGreaterThan(0);
      expect(analysis.instructions).toBeDefined();
    });

    it('should prioritize TESTING phase in instructions', async () => {
      await taskManager.createTask('Testing priority', [], true);
      
      // Missing TESTING specifically
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'REVIEWING';
      taskData.workflow.stateHistory = [
        { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
        { state: 'DESIGNING', enteredAt: new Date().toISOString() },
        { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() }
        // Missing TESTING
      ];
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      // Should detect missing TESTING
      expect(analysis.complete).toBe(false);
      expect(analysis.missingPhases).toContain('TESTING');
      expect(analysis.instructions).toContain('TESTING');
    });
  });

  // ============================================================================
  // INTEGRATION: Works with Existing Validation
  // ============================================================================
  
  describe('Integration with Existing Features', () => {
    it('should work alongside state transition validation', async () => {
      await taskManager.createTask('Integration test', [], true);
      
      // Try invalid transition (Bug #1 still enforced)
      await expect(
        taskManager.updateTaskState('READY_TO_COMMIT')
      ).rejects.toThrow(/Invalid state transition/);
      
      // Valid transition should work
      await expect(
        taskManager.updateTaskState('DESIGNING')
      ).resolves.not.toThrow();
    });

    it('should work with rate limiting warnings', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await taskManager.createTask('Rate limiting test', [], true);
      
      // Rapid transitions (AI speed)
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      
      // Rate limiting may warn, but doesn't block
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('IMPLEMENTING');
      
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  
  describe('Edge Cases', () => {
    it('should handle empty state history', async () => {
      await taskManager.createTask('Empty history test', [], true);
      
      // At UNDERSTANDING with empty history (normal for new task)
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      expect(analysis.complete).toBe(true); // UNDERSTANDING requires no prior phases
      expect(analysis.missingPhases).toEqual([]);
    });

    it('should handle task at READY_TO_COMMIT with full history', async () => {
      await taskManager.createTask('Complete workflow', [], true);
      
      // Progress through all states
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before transitioning to READY_TO_COMMIT
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for checklist initialization
      
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      
      // If checklist doesn't exist yet, wait a bit more
      if (!checklist) {
        await new Promise(resolve => setTimeout(resolve, 100));
        checklist = await (taskManager as any).loadReviewChecklist();
      }
      
      if (checklist && checklist.items) {
        // Mark all items as complete using ReviewChecklistManager
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        // Save the updated checklist
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for save
      }
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      // Task should reach READY_TO_COMMIT
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('READY_TO_COMMIT');
      
      // History should include all completed states (not current state)
      const taskData = await fs.readJson(taskFile);
      const historyStates = taskData.workflow.stateHistory.map((e: any) => e.state);
      expect(historyStates).toContain('UNDERSTANDING'); // From creation
      expect(historyStates).toContain('DESIGNING');
      expect(historyStates).toContain('IMPLEMENTING');
      expect(historyStates).toContain('TESTING');
      expect(historyStates).toContain('REVIEWING');
      // READY_TO_COMMIT is current state, not in history
      expect(historyStates).not.toContain('READY_TO_COMMIT');
      expect(taskData.workflow.currentState).toBe('READY_TO_COMMIT');
    });
  });

  // ============================================================================
  // BENEFITS VERIFICATION
  // ============================================================================
  
  describe('AI Flow Correction Benefits', () => {
    it('allows AI to work at AI speed (3-5 minutes total)', async () => {
      await taskManager.createTask('AI speed test', [], true);
      
      // Simulate AI workflow (very fast)
      const start = Date.now();
      
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // FIX: Complete review checklist before transitioning to READY_TO_COMMIT
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for checklist initialization
      
      const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
      let checklist = await (taskManager as any).loadReviewChecklist();
      
      // If checklist doesn't exist yet, wait a bit more
      if (!checklist) {
        await new Promise(resolve => setTimeout(resolve, 100));
        checklist = await (taskManager as any).loadReviewChecklist();
      }
      
      if (checklist && checklist.items) {
        // Mark all items as complete using ReviewChecklistManager
        for (const item of checklist.items) {
          checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
        }
        // Save the updated checklist
        await (taskManager as any).saveReviewChecklist(checklist);
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for save
      }
      
      await taskManager.updateTaskState('READY_TO_COMMIT');
      
      const elapsed = Date.now() - start;
      
      // Should complete very fast (AI speed)
      expect(elapsed).toBeLessThan(5000);
      
      // Task should reach READY_TO_COMMIT
      const task = await taskManager.getCurrentTask();
      expect(task?.status).toBe('READY_TO_COMMIT');
    });

    it('guides AI to complete actual work, not fake history', async () => {
      await taskManager.createTask('AI work completion', [], true);
      
      // Simulate: AI jumped to IMPLEMENTATION without DESIGN
      const taskData = await fs.readJson(taskFile);
      taskData.workflow.currentState = 'IMPLEMENTING';
      taskData.workflow.stateHistory = []; // No history
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      // Should guide AI to DO the design work
      expect(analysis.complete).toBe(false);
      expect(analysis.missingPhases).toContain('DESIGNING');
      expect(analysis.instructions).toContain('Propose architecture');
      expect(analysis.instructions).toContain('Plan file structure');
      
      // Not: "We'll fake it for you"
      // But: "You need to complete this work"
    });

    it('preserves all user work and context', async () => {
      await taskManager.createTask('Preserve context test with requirements', [], true);
      
      // Add some context
      const taskData = await fs.readJson(taskFile);
      taskData.requirements = ['req-1', 'req-2'];
      taskData.notes = 'Important notes here';
      taskData.workflow.currentState = 'IMPLEMENTING';
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Analyze (missing phases)
      const analysis = await taskManager.analyzeWorkflowCompleteness();
      
      // Should detect missing
      expect(analysis.complete).toBe(false);
      
      // But all data should still be there
      const currentData = await fs.readJson(taskFile);
      expect(currentData.requirements).toEqual(['req-1', 'req-2']);
      expect(currentData.notes).toBe('Important notes here');
      expect(currentData.originalGoal).toContain('requirements');
      
      // Nothing deleted!
    });
  });
});

