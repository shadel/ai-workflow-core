/**
 * Test Helper Utilities
 * Shared utilities for all test files
 */

import { jest } from '@jest/globals';
import fs from 'fs-extra';

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

