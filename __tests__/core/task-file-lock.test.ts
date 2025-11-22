/**
 * Unit tests for TaskFileLock
 * @requirement REQ-V2-003 - Concurrency safety tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskFileLock, LockTimeoutError } from '../../src/core/task-file-lock.js';

describe('TaskFileLock', () => {
  let testContextDir: string;
  let fileLock: TaskFileLock;

  beforeEach(async () => {
    testContextDir = path.join(os.tmpdir(), `test-task-file-lock-${Date.now()}`);
    await fs.ensureDir(testContextDir);
    fileLock = new TaskFileLock(testContextDir);
  });

  afterEach(async () => {
    await fs.remove(testContextDir).catch(() => {});
  });

  describe('acquire() and release()', () => {
    it('should acquire and release lock', async () => {
      await fileLock.acquire();
      await fileLock.release();
      // Should not throw
    });

    it('should throw error if lock already acquired', async () => {
      await fileLock.acquire();
      await expect(fileLock.acquire()).rejects.toThrow('Lock already acquired');
      await fileLock.release();
    });

    it('should allow re-acquiring after release', async () => {
      await fileLock.acquire();
      await fileLock.release();
      await fileLock.acquire(); // Should not throw
      await fileLock.release();
    });
  });

  describe('withLock()', () => {
    it('should execute function with lock', async () => {
      let executed = false;
      await fileLock.withLock(async () => {
        executed = true;
      });
      expect(executed).toBe(true);
    });

    it('should release lock even if function throws', async () => {
      await expect(
        fileLock.withLock(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Lock should be released, can acquire again
      await fileLock.acquire();
      await fileLock.release();
    });

    it('should return function result', async () => {
      const result = await fileLock.withLock(async () => {
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });
  });
});


