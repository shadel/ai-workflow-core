/**
 * Test Helper Utilities
 * Shared utilities for all test files
 */

import { jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Complete review checklist before READY_TO_COMMIT
 * Helper function to avoid code duplication in tests
 * OPTIMIZED: Reduced delays for faster test execution
 */
export async function completeReviewChecklist(taskManager: any): Promise<void> {
  const { ReviewChecklistManager } = await import('../src/core/review-checklist.js');
  
  // Reduced delay for faster tests (was 100ms, now 10ms)
  await new Promise(resolve => setTimeout(resolve, 10));
  
  let checklist = await taskManager.loadReviewChecklist();
  if (!checklist || !checklist.items || checklist.items.length === 0) {
    // Reduced delay (was 100ms, now 10ms)
    await new Promise(resolve => setTimeout(resolve, 10));
    checklist = await taskManager.loadReviewChecklist();
  }
  
  if (checklist && checklist.items && checklist.items.length > 0) {
    for (const item of checklist.items) {
      checklist = ReviewChecklistManager.markItemComplete(checklist, item.id, 'Test completion');
    }
    await taskManager.saveReviewChecklist(checklist);
    // Reduced delay (was 100ms, now 10ms) - file system sync is usually fast enough
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Clean up all test directories
 * Use this in afterEach to ensure clean test environment
 * IMPROVED: Better isolation with retry logic
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
  
  // Clean up with retry logic for better isolation
  for (const dir of testDirs) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (await fs.pathExists(dir)) {
          await fs.remove(dir);
        }
        break; // Success, exit retry loop
      } catch (error: any) {
        if (attempt === 2) {
          // Last attempt failed, ignore
        } else {
          // Wait before retry (Windows file locking)
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
  }
  
  // Longer delay to let file system settle (Windows file locking)
  await new Promise(resolve => setTimeout(resolve, 50));
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
  
  // Ensure directory exists before writing
  await fs.ensureDir(path.dirname(taskFile));
  
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
  const isWindows = process.platform === 'win32';
  const isCIEnv = isCI();
  const baseTimeout = isCIEnv ? 15000 : 5000;
  
  // Windows file I/O is slower, multiply timeout by 2
  // CI is slower, already handled by baseTimeout
  return isWindows ? baseTimeout * 2 : baseTimeout;
  // Windows + CI: 30s, Windows + Local: 10s, Unix + CI: 15s, Unix + Local: 5s
}

/**
 * Get environment-aware performance threshold (in milliseconds)
 * Local: Stricter threshold for fast local development
 * CI: More lenient threshold for slower CI environments
 */
export function getPerformanceThreshold(operation: 'state-transition' | 'file-operation' | 'full-workflow'): number {
  const isWindows = process.platform === 'win32';
  const isCIEnv = isCI();
  
  if (isCIEnv) {
    // CI thresholds (more lenient, based on actual observed values)
    switch (operation) {
      case 'state-transition':
        return 600; // Based on observed 506ms - allow 600ms with margin
      case 'file-operation':
        return 800; // Based on observed 623ms - allow 800ms with margin
      case 'full-workflow':
        return 2000; // Full workflow operations on CI
      default:
        return 800;
    }
  } else {
    // Local thresholds (Windows slower, +margin for parallel execution overhead)
    if (isWindows) {
      switch (operation) {
        case 'state-transition':
          return 800; // Windows: 800ms (observed 765ms + margin for conversion overhead)
        case 'file-operation':
          return 750; // Windows: 750ms (observed 623ms + margin)
        case 'full-workflow':
          return 3000; // Windows: 3000ms for full workflow (accounts for conversion overhead + checklist completion)
        default:
          return 800;
      }
    } else {
      // Unix thresholds (faster)
      switch (operation) {
        case 'state-transition':
          return 300; // Unix: 300ms
        case 'file-operation':
          return 500; // Unix: 500ms
        case 'full-workflow':
          return 1500; // Unix: 1500ms for full workflow
        default:
          return 500;
      }
    }
  }
}

/**
 * Generate unique test directory per worker/test
 * Uses worker ID (if available), process ID, timestamp, and random number
 * This ensures test isolation when running tests in parallel
 * 
 * @param baseName - Base name for the test directory (e.g., 'test-ai-context')
 * @returns Unique test directory path
 */
export function getUniqueTestDir(baseName: string): string {
  // REQUIREMENT: Must achieve 100% pass rate at 75% maxWorkers
  // Enhanced isolation: Always include worker ID, process ID, and high-resolution timestamp
  const workerId = process.env.JEST_WORKER_ID || '0';
  const processId = process.pid;
  const timestamp = Date.now();
  const highResTime = process.hrtime.bigint().toString(36); // High-resolution time for uniqueness
  const random = Math.random().toString(36).substring(2, 9);
  
  // Include worker ID, process ID, and high-res timestamp for complete isolation
  const dirName = `.${baseName}-worker${workerId}-pid${processId}-${timestamp}-${highResTime}-${random}`;
  
  // Return absolute path in current working directory
  return path.resolve(process.cwd(), dirName);
}

/**
 * Get unique .ai-context directory for tests
 * Ensures each test worker has its own isolated .ai-context directory
 * 
 * @returns Unique .ai-context directory path
 */
export function getUniqueAIContextDir(): string {
  return getUniqueTestDir('.test-ai-context');
}

/**
 * Cleanup directory with retry logic and exponential backoff
 * Handles Windows file locking and transient errors
 * 
 * @param dir - Directory path to cleanup
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise that resolves when cleanup succeeds or all retries exhausted
 */
export async function cleanupWithRetry(dir: string, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (await fs.pathExists(dir)) {
        await fs.remove(dir);
        return; // Success
      }
      return; // Directory doesn't exist, nothing to clean
    } catch (error: any) {
      if (i === maxRetries - 1) {
        // Last attempt failed, log warning but don't throw
        console.warn(`⚠️ Failed to cleanup ${dir} after ${maxRetries} attempts: ${error.message}`);
        return; // Don't throw - allow test to continue
      }
      // Exponential backoff: 50ms, 100ms, 200ms
      const delay = 50 * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Enhanced cleanup that handles worker-specific directories
 * Cleans up both standard test directories and worker-specific ones
 * IMPROVED: Better isolation with retry logic and more thorough cleanup
 */
export async function cleanupAllTestDirsEnhanced(): Promise<void> {
  const standardTestDirs = [
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
  
  // Clean up standard directories with retry logic
  for (const dir of standardTestDirs) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (await fs.pathExists(dir)) {
          await fs.remove(dir);
        }
        break; // Success, exit retry loop
      } catch (error: any) {
        if (attempt === 2) {
          // Last attempt failed, log but don't throw
          // Ignore errors - directory might be locked or in use
        } else {
          // Wait before retry (Windows file locking)
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
  }
  
  // Clean up worker-specific directories (pattern: .test-*-worker*-*)
  try {
    const cwd = process.cwd();
    const entries = await fs.readdir(cwd);
    
    for (const entry of entries) {
      // Match worker-specific test directories
      if (entry.startsWith('.test-') && entry.includes('-worker')) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const fullPath = path.join(cwd, entry);
            if (await fs.pathExists(fullPath)) {
              const stat = await fs.stat(fullPath);
              if (stat.isDirectory()) {
                await fs.remove(fullPath);
              }
            }
            break; // Success, exit retry loop
          } catch (error) {
            if (attempt === 2) {
              // Last attempt failed, ignore
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors - might not have permission or directory doesn't exist
  }
  
  // Longer delay to let file system settle (Windows file locking issues)
  // Increased delay for better isolation between parallel tests at 75% maxWorkers
  // REQUIREMENT: Must achieve 100% pass rate at 75% maxWorkers without reducing workers
  // Increased to 400ms for parallel execution to reduce file system contention
  await new Promise(resolve => setTimeout(resolve, 400));
}

/**
 * Wait for task to be fully created and synchronized between queue and file
 * OPTIMIZED: Centralized helper to avoid duplication across test files
 * 
 * @param manager - TaskManager instance
 * @param taskFile - Path to current-task.json file
 * @param maxRetries - Maximum number of retry attempts (default: 30)
 * @param delay - Delay between retries in milliseconds (default: 100)
 */
export async function waitForTask(
  manager: any,
  taskFile: string,
  maxRetries = 30,
  delay = 100
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    const fileExists = await fs.pathExists(taskFile);
    const task = await manager.getCurrentTask();
    
    if (task && fileExists) {
      // Additional check: ensure file content matches queue
      try {
        const fileData = await fs.readJson(taskFile);
        if (fileData && fileData.taskId === task.id) {
          return; // Task fully synchronized
        }
      } catch (error) {
        // File exists but not readable yet, continue waiting
      }
    }
    
    // Linear delay (100ms per retry) - simpler than exponential for file I/O
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // If we get here, task wasn't found - provide detailed error
  const finalTask = await manager.getCurrentTask();
  const finalFileExists = await fs.pathExists(taskFile);
  throw new Error(
    `Task not available after ${maxRetries} retries. ` +
    `getCurrentTask: ${finalTask ? 'found' : 'null'}, ` +
    `file exists: ${finalFileExists}`
  );
}

