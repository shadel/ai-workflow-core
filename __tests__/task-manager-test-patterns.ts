/**
 * Task Manager Test Patterns
 * 
 * Best practices and patterns for testing TaskManager to avoid common pitfalls.
 * 
 * Lessons Learned:
 * 1. NEVER create separate queueManager instance - use taskManager's internal instance
 * 2. ALWAYS verify test assumptions match actual behavior
 * 3. ALWAYS use same instance for file operations to avoid timing issues
 * 4. ALWAYS wait for file flush on Windows
 * 
 * @example
 * ```typescript
 * import { createTaskManagerTestContext } from './task-manager-test-patterns';
 * 
 * describe('My Test', () => {
 *   const ctx = createTaskManagerTestContext();
 *   
 *   beforeEach(async () => {
 *     await ctx.setup();
 *   });
 *   
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *   
 *   it('should work', async () => {
 *     const task = await ctx.taskManager.createTask('Test');
 *     const queueManager = ctx.getQueueManager(); // Same instance!
 *   });
 * });
 * ```
 */

import fs from 'fs-extra';
import path from 'path';
import { TaskManager } from '../src/core/task-manager.js';
import { TaskQueueManager } from '../src/core/task-queue.js';

/**
 * Test context for TaskManager tests
 * Ensures consistent setup and proper instance management
 */
export interface TaskManagerTestContext {
  /** TaskManager instance */
  taskManager: TaskManager;
  /** Test directory path */
  testDir: string;
  /** Setup test environment */
  setup(): Promise<void>;
  /** Cleanup test environment */
  cleanup(): Promise<void>;
  /** Get queueManager from taskManager (same instance) */
  getQueueManager(): TaskQueueManager;
  /** Wait for file operations to complete (Windows-safe) */
  waitForFlush(ms?: number): Promise<void>;
  /** Verify task is active in queue */
  verifyTaskActive(taskId: string): Promise<void>;
  /** Verify task is queued */
  verifyTaskQueued(taskId: string): Promise<void>;
  /** Get active task from queue */
  getActiveTask(): Promise<any>;
}

/**
 * Create a test context for TaskManager tests
 * 
 * Pattern: Use this instead of manually creating TaskManager and queueManager
 * 
 * @param options - Test options
 * @returns Test context
 */
export function createTaskManagerTestContext(options?: {
  /** Custom test directory name (default: auto-generated) */
  testDirName?: string;
  /** Enable debug logging */
  debug?: boolean;
}): TaskManagerTestContext {
  let taskManager: TaskManager | null = null;
  let testDir: string = '';

  const context: TaskManagerTestContext = {
    get taskManager() {
      if (!taskManager) {
        throw new Error('TaskManager not initialized. Call setup() first.');
      }
      return taskManager;
    },
    get testDir() {
      return testDir;
    },

    async setup() {
      const dirName = options?.testDirName || `.test-task-manager-${Date.now()}`;
      testDir = path.join(process.cwd(), dirName);
      await fs.ensureDir(testDir);
      taskManager = new TaskManager(testDir);
      
      if (options?.debug) {
        process.env.DEBUG_TASK_MANAGER = 'true';
        process.env.TRACK_TASK_ID = 'true';
      }
    },

    async cleanup() {
      if (testDir && await fs.pathExists(testDir)) {
        await fs.remove(testDir);
      }
      if (options?.debug) {
        delete process.env.DEBUG_TASK_MANAGER;
        delete process.env.TRACK_TASK_ID;
      }
    },

    /**
     * Get queueManager from taskManager (CRITICAL: Same instance!)
     * 
     * Pattern: NEVER create new TaskQueueManager(testDir)
     * Always use taskManager's internal instance to avoid timing issues
     */
    getQueueManager(): TaskQueueManager {
      if (!taskManager) {
        throw new Error('Test context not setup. Call setup() first.');
      }
      return (taskManager as any).queueManager as TaskQueueManager;
    },

    /**
     * Wait for file operations to complete
     * 
     * Pattern: Always wait after file operations, especially on Windows
     * 
     * @param ms - Milliseconds to wait (default: 150ms for Windows safety)
     */
    async waitForFlush(ms = 150) {
      await new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Verify task is active in queue
     * 
     * Pattern: Use this to verify task state instead of manual checks
     */
    async verifyTaskActive(taskId: string) {
      const queueManager = this.getQueueManager();
      const activeTask = await queueManager.getActiveTask();
      if (!activeTask || activeTask.id !== taskId) {
        throw new Error(
          `Expected task ${taskId} to be active, but got: ${activeTask?.id || 'null'}`
        );
      }
      if (activeTask.status !== 'ACTIVE') {
        throw new Error(
          `Expected task ${taskId} status to be ACTIVE, but got: ${activeTask.status}`
        );
      }
    },

    /**
     * Verify task is queued
     * 
     * Pattern: Use this to verify task is queued (not active)
     */
    async verifyTaskQueued(taskId: string) {
      const queueManager = this.getQueueManager();
      const queue = await (queueManager as any).loadQueue();
      const task = queue.tasks.find((t: any) => t.id === taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found in queue`);
      }
      if (task.status !== 'QUEUED') {
        throw new Error(
          `Expected task ${taskId} status to be QUEUED, but got: ${task.status}`
        );
      }
    },

    /**
     * Get active task from queue
     * 
     * Pattern: Use this instead of creating separate queueManager
     */
    async getActiveTask() {
      const queueManager = this.getQueueManager();
      return await queueManager.getActiveTask();
    },
  };
  
  return context;
}

/**
 * Test pattern: Task creation behavior
 * 
 * IMPORTANT: New tasks are QUEUED if active task exists, ACTIVE if no active task
 * 
 * @example
 * ```typescript
 * // Create first task - will be ACTIVE (no active task exists)
 * const task1 = await ctx.taskManager.createTask('First task');
 * await ctx.verifyTaskActive(task1.id);
 * 
 * // Create second task - will be QUEUED (task1 is active)
 * const task2 = await ctx.taskManager.createTask('Second task');
 * await ctx.verifyTaskQueued(task2.id);
 * await ctx.verifyTaskActive(task1.id); // task1 still active
 * 
 * // Activate task2 - task1 becomes QUEUED
 * await ctx.getQueueManager().activateTask(task2.id);
 * await ctx.verifyTaskActive(task2.id);
 * await ctx.verifyTaskQueued(task1.id);
 * ```
 */
export const TASK_CREATION_PATTERN = {
  /**
   * First task created: ACTIVE (no active task exists)
   */
  FIRST_TASK_ACTIVE: 'FIRST_TASK_ACTIVE',
  
  /**
   * Subsequent tasks: QUEUED (if active task exists)
   */
  SUBSEQUENT_TASKS_QUEUED: 'SUBSEQUENT_TASKS_QUEUED',
  
  /**
   * Use force=true to activate immediately
   */
  FORCE_ACTIVATE: 'FORCE_ACTIVATE',
} as const;

/**
 * Test pattern: File synchronization
 * 
 * IMPORTANT: Always wait for flush after sync operations
 * 
 * @example
 * ```typescript
 * // Sync file from queue
 * await ctx.taskManager.syncFileFromQueue(activeTask, []);
 * await ctx.waitForFlush(); // CRITICAL: Wait for file flush
 * 
 * // Verify file content
 * const fileData = await fs.readJson(path.join(ctx.testDir, 'current-task.json'));
 * expect(fileData.taskId).toBe(activeTask.id);
 * ```
 */
export const FILE_SYNC_PATTERN = {
  /**
   * Always wait after sync operations
   */
  WAIT_AFTER_SYNC: true,
  
  /**
   * Wait time in milliseconds (Windows-safe)
   */
  FLUSH_WAIT_MS: 150,
} as const;

/**
 * Test pattern: Instance management
 * 
 * CRITICAL: Always use same instance for queue operations
 * 
 * @example
 * ```typescript
 * // ✅ CORRECT: Use taskManager's queueManager
 * const queueManager = ctx.getQueueManager();
 * await queueManager.activateTask(taskId);
 * 
 * // ❌ WRONG: Don't create separate instance
 * const queueManager = new TaskQueueManager(testDir); // WRONG!
 * ```
 */
export const INSTANCE_PATTERN = {
  /**
   * Always use taskManager's internal queueManager
   */
  USE_TASKMANAGER_QUEUE: true,
  
  /**
   * Never create separate TaskQueueManager instance
   */
  NO_SEPARATE_INSTANCE: true,
} as const;

/**
 * Common test assertions
 */
export const assertions = {
  /**
   * Assert task is active
   */
  async taskIsActive(
    ctx: TaskManagerTestContext,
    taskId: string,
    message?: string
  ) {
    await ctx.verifyTaskActive(taskId);
  },

  /**
   * Assert task is queued
   */
  async taskIsQueued(
    ctx: TaskManagerTestContext,
    taskId: string,
    message?: string
  ) {
    await ctx.verifyTaskQueued(taskId);
  },

  /**
   * Assert file has correct taskId
   */
  async fileHasTaskId(
    ctx: TaskManagerTestContext,
    expectedTaskId: string,
    message?: string
  ) {
    const filePath = path.join(ctx.testDir, 'current-task.json');
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const fileData = await fs.readJson(filePath);
    if (fileData.taskId !== expectedTaskId) {
      throw new Error(
        message || `Expected file taskId ${expectedTaskId}, got ${fileData.taskId}`
      );
    }
  },
};

