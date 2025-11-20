/**
 * Test Helper Utilities
 * Shared utilities for all test files
 */

import { jest } from '@jest/globals';
import fs from 'fs-extra';

/**
 * Complete review checklist before READY_TO_COMMIT
 * Helper function to avoid code duplication in tests
 */
export async function completeReviewChecklist(taskManager: any): Promise<void> {
  const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
  
  // Wait a bit for checklist initialization to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  let checklist = await taskManager.loadReviewChecklist();
  if (!checklist || !checklist.items || checklist.items.length === 0) {
    // If checklist doesn't exist or is empty, wait a bit more and try again
    await new Promise(resolve => setTimeout(resolve, 100));
    checklist = await taskManager.loadReviewChecklist();
  }
  
  if (checklist && checklist.items && checklist.items.length > 0) {
    for (const item of checklist.items) {
      checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
    }
    await taskManager.saveReviewChecklist(checklist);
    // Wait for file system to sync
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Clean up all test directories
 * Use this in afterEach to ensure clean test environment
 */
export async function cleanupAllTestDirs(): Promise<void> {
  const testDirs = [
    '.test-bug-fixes',
    '.test-bug-8',
    '.test-bug-9',
    '.test-bug-10',
    '.test-context',
    '.test-ai-context',
    '.test-ai-context-validator',
    '.test-ai-flow',
    '.test-ai-context-taskmanager',
    '.test-pattern-provider',
    '.test-context-injector-patterns',
    '.test-validate-patterns',
    '.test-manual-scenarios',
    '.ai-context',
    '.test-validator',
    '.test-sync',
    '.test-task-manager',
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.remove(dir);
    } catch (error) {
      // Ignore errors - directory might not exist
    }
  }
  
  // Small delay to let file system settle (Windows)
  await new Promise(resolve => setTimeout(resolve, 10));
}

/**
 * Mock console.warn and filter out rate limiting warnings
 * Returns a spy that only captures non-rate-limiting warnings
 */
export function mockConsoleWarnFiltered(): jest.SpiedFunction<typeof console.warn> {
  const originalWarn = console.warn;
  const spy = jest.spyOn(console, 'warn');
  
  spy.mockImplementation((...args: any[]) => {
    const message = args[0]?.toString() || '';
    
    // Filter out rate limiting warnings
    if (message.includes('RAPID STATE CHANGE') || 
        message.includes('State changed recently')) {
      // Don't capture rate limiting warnings
      return;
    }
    
    // Capture other warnings
    originalWarn.apply(console, args);
  });
  
  return spy;
}

/**
 * Advance time safely for tests
 * Useful for time-sensitive tests
 */
export async function advanceTime(ms: number): Promise<void> {
  if (jest.isMockFunction(Date.now)) {
    jest.advanceTimersByTime(ms);
  } else {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create task with time delay to avoid rate limiting warnings
 */
export async function createTaskWithDelay(
  taskManager: any,
  goal: string,
  requirements: string[] = [],
  force = false
): Promise<any> {
  const task = await taskManager.createTask(goal, requirements, force);
  
  // Add delay to avoid rate limiting warnings in subsequent state changes
  await advanceTime(100);
  
  return task;
}

/**
 * Update state with time manipulation to avoid rate limiting
 */
export async function updateStateAvoidingRateLimit(
  taskManager: any,
  state: string,
  taskFile: string
): Promise<void> {
  // Read current task data
  const taskData = await fs.readJson(taskFile);
  
  // Set stateEnteredAt to 6 minutes ago (beyond rate limiting threshold)
  taskData.workflow.stateEnteredAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  await fs.writeJson(taskFile, taskData, { spaces: 2 });
  
  // Now update state (won't trigger rate limiting warning)
  await taskManager.updateTaskState(state);
}

/**
 * Detect if running in CI environment
 * Checks multiple environment variables that CI systems typically set
 */
export function isCI(): boolean {
  return !!(
    process.env.CI || // Generic CI flag (GitHub Actions, GitLab CI, etc.)
    process.env.GITHUB_ACTIONS || // GitHub Actions specific
    process.env.GITLAB_CI || // GitLab CI
    process.env.CIRCLECI || // CircleCI
    process.env.TRAVIS || // Travis CI
    process.env.JENKINS_URL || // Jenkins
    process.env.BUILDKITE || // Buildkite
    process.env.TF_BUILD // Azure Pipelines
  );
}

/**
 * Get environment-aware test timeout
 * Local: Faster timeout for quick feedback (optimized for speed)
 * CI: Longer timeout to account for slower file system and resource constraints
 */
export function getTestTimeout(): number {
  return isCI() ? 15000 : 5000; // CI: 15s, Local: 5s (optimized for speed)
}

/**
 * Get environment-aware performance threshold (in milliseconds)
 * Local: Stricter threshold for fast local development
 * CI: More lenient threshold for slower CI environments
 */
export function getPerformanceThreshold(operation: 'state-transition' | 'file-operation' | 'full-workflow'): number {
  if (isCI()) {
    // CI thresholds (more lenient)
    switch (operation) {
      case 'state-transition':
        return 3000; // 4 state transitions: < 3000ms on CI
      case 'file-operation':
        return 2000; // File operations: < 2000ms on CI
      case 'full-workflow':
        return 5000; // Full workflow (5 operations): < 5000ms on CI
      default:
        return 3000;
    }
  } else {
    // Local thresholds (stricter for fast feedback)
    switch (operation) {
      case 'state-transition':
        return 1000; // 4 state transitions: < 1000ms locally (increased for file I/O and context injection)
      case 'file-operation':
        return 300; // File operations: < 300ms locally
      case 'full-workflow':
        return 1000; // Full workflow (5 operations): < 1000ms locally
      default:
        return 500;
    }
  }
}

