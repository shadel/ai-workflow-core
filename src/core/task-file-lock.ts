/**
 * Task File Lock - File locking for concurrency safety
 * @requirement REQ-V2-003 - Concurrency safety
 * 
 * Provides file locking to prevent race conditions when multiple
 * processes access current-task.json simultaneously.
 */

import path from 'path';
import fs from 'fs-extra';
import lockfile from 'proper-lockfile';

/**
 * Lock timeout error
 */
export class LockTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockTimeoutError';
  }
}

/**
 * Task File Lock - File locking for concurrency safety
 * 
 * Responsibilities:
 * - Acquire/release file locks
 * - Handle lock timeouts
 * - Provide withLock() helper for automatic lock management
 */
export class TaskFileLock {
  private lockFile: string;
  private lockRelease: (() => Promise<void>) | null = null;
  private lockOptions: lockfile.LockOptions;

  constructor(contextDir: string = '.ai-context') {
    this.lockFile = path.join(contextDir, 'current-task.json.lock');
    this.lockOptions = {
      retries: {
        retries: 30,  // Increased from 10 for better parallel execution at 75% maxWorkers
        minTimeout: 200,  // Increased from 100 for Windows file system
        maxTimeout: 3000  // Increased from 1000 for better lock acquisition
      }
    };
  }

  /**
   * Acquire file lock
   * 
   * @throws LockTimeoutError if lock cannot be acquired after retries
   */
  async acquire(): Promise<void> {
    if (this.lockRelease) {
      throw new Error('Lock already acquired');
    }

    // Ensure lock file directory exists
    const lockDir = path.dirname(this.lockFile);
    await fs.ensureDir(lockDir);

    // Create empty lock file if it doesn't exist (required for proper-lockfile)
    if (!await fs.pathExists(this.lockFile)) {
      await fs.writeFile(this.lockFile, '');
    }

    try {
      this.lockRelease = await lockfile.lock(this.lockFile, this.lockOptions);
    } catch (error: any) {
      if (error.code === 'ELOCKED' || error.message?.includes('timeout')) {
        throw new LockTimeoutError(
          `Failed to acquire lock after 10 retries. ` +
          `Another process may be holding the lock.`
        );
      }
      throw new Error(`Lock acquisition failed: ${(error as Error).message}`);
    }
  }

  /**
   * Release file lock
   */
  async release(): Promise<void> {
    if (this.lockRelease) {
      try {
        await this.lockRelease();
      } catch (error) {
        console.warn(`⚠️ Failed to release lock: ${(error as Error).message}`);
      } finally {
        this.lockRelease = null;
      }
    }
  }

  /**
   * Execute function with lock
   * 
   * Automatically acquires lock before execution and releases after.
   * 
   * @param fn - Function to execute
   * @returns Result of function execution
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}

