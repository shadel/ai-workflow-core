/**
 * Unit tests for TaskQueueManager class structure
 * @requirement FREE-TIER-001 - Task Queue Management
 */

import { TaskQueueManager } from '../../src/core/task-queue.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('TaskQueueManager Structure', () => {
  let tempDir: string;
  let manager: TaskQueueManager;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `task-queue-test-${Date.now()}`);
    manager = new TaskQueueManager(tempDir);
  });

  afterEach(async () => {
    // Cleanup
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Class Instantiation', () => {
    it('should create TaskQueueManager instance with default contextDir', () => {
      const defaultManager = new TaskQueueManager();
      expect(defaultManager).toBeInstanceOf(TaskQueueManager);
    });

    it('should create TaskQueueManager instance with custom contextDir', () => {
      expect(manager).toBeInstanceOf(TaskQueueManager);
    });
  });

  describe('File Path Resolution', () => {
    it('should resolve tasks.json path correctly', async () => {
      // Access private property via reflection for testing
      const queueFile = (manager as any).queueFile;
      expect(queueFile).toBe(path.join(tempDir, 'tasks.json'));
    });

    it('should use default .ai-context directory when not specified', () => {
      const defaultManager = new TaskQueueManager();
      const queueFile = (defaultManager as any).queueFile;
      expect(queueFile).toBe(path.join('.ai-context', 'tasks.json'));
    });
  });

  describe('Lock Options Configuration', () => {
    it('should configure lock options with retry settings', () => {
      const lockOptions = (manager as any).lockOptions;
      expect(lockOptions).toBeDefined();
      expect(lockOptions.retries).toBeDefined();
      expect(lockOptions.retries.retries).toBe(10);
      expect(lockOptions.retries.minTimeout).toBe(100);
      expect(lockOptions.retries.maxTimeout).toBe(1000);
    });
  });

  describe('Empty Queue Creation', () => {
    it('should create empty queue when file does not exist', async () => {
      const queue = await (manager as any).loadQueue();
      
      expect(queue).toBeDefined();
      expect(queue.tasks).toEqual([]);
      expect(queue.activeTaskId).toBeNull();
      expect(queue.metadata.totalTasks).toBe(0);
      expect(queue.metadata.queuedCount).toBe(0);
      expect(queue.metadata.activeCount).toBe(0);
      expect(queue.metadata.completedCount).toBe(0);
      expect(queue.metadata.archivedCount).toBe(0);
      expect(queue.metadata.lastUpdated).toBeDefined();
    });
  });

  describe('Queue Validation', () => {
    it('should validate queue with valid structure', async () => {
      const validQueue = {
        tasks: [],
        activeTaskId: null,
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: new Date().toISOString()
        }
      };

      const validated = (manager as any).validateQueue(validQueue);
      expect(validated).toEqual(validQueue);
    });

    it('should create empty queue when data is null', () => {
      const result = (manager as any).validateQueue(null);
      expect(result.tasks).toEqual([]);
      expect(result.activeTaskId).toBeNull();
    });

    it('should create empty queue when data is undefined', () => {
      const result = (manager as any).validateQueue(undefined);
      expect(result.tasks).toEqual([]);
      expect(result.activeTaskId).toBeNull();
    });

    it('should fix invalid tasks array', () => {
      const invalidQueue = {
        tasks: 'not-an-array',
        activeTaskId: null,
        metadata: {}
      };

      const validated = (manager as any).validateQueue(invalidQueue);
      expect(Array.isArray(validated.tasks)).toBe(true);
      expect(validated.tasks).toEqual([]);
    });

    it('should fix invalid activeTaskId type', () => {
      const invalidQueue = {
        tasks: [],
        activeTaskId: 123, // should be string or null
        metadata: {}
      };

      const validated = (manager as any).validateQueue(invalidQueue);
      expect(validated.activeTaskId).toBeNull();
    });

    it('should add missing metadata', () => {
      const invalidQueue = {
        tasks: [],
        activeTaskId: null
        // missing metadata
      };

      const validated = (manager as any).validateQueue(invalidQueue);
      expect(validated.metadata).toBeDefined();
    });
  });

  describe('Metadata Update', () => {
    it('should update metadata correctly', () => {
      const queue = {
        tasks: [
          { id: 'task-1', goal: 'Task 1', status: 'ACTIVE', createdAt: '2025-11-17T09:00:00.000Z' },
          { id: 'task-2', goal: 'Task 2', status: 'QUEUED', createdAt: '2025-11-17T09:00:00.000Z' },
          { id: 'task-3', goal: 'Task 3', status: 'DONE', createdAt: '2025-11-17T09:00:00.000Z' },
          { id: 'task-4', goal: 'Task 4', status: 'ARCHIVED', createdAt: '2025-11-17T09:00:00.000Z' }
        ],
        activeTaskId: 'task-1',
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: ''
        }
      };

      (manager as any).updateMetadata(queue);

      expect(queue.metadata.totalTasks).toBe(4);
      expect(queue.metadata.queuedCount).toBe(1);
      expect(queue.metadata.activeCount).toBe(1);
      expect(queue.metadata.completedCount).toBe(1);
      expect(queue.metadata.archivedCount).toBe(1);
      expect(queue.metadata.lastUpdated).toBeDefined();
    });

    it('should handle empty queue metadata', () => {
      const queue = {
        tasks: [],
        activeTaskId: null,
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: ''
        }
      };

      (manager as any).updateMetadata(queue);

      expect(queue.metadata.totalTasks).toBe(0);
      expect(queue.metadata.queuedCount).toBe(0);
      expect(queue.metadata.activeCount).toBe(0);
      expect(queue.metadata.completedCount).toBe(0);
      expect(queue.metadata.archivedCount).toBe(0);
    });
  });

  describe('File Operations', () => {
    it('should save queue to file', async () => {
      const queue = {
        tasks: [],
        activeTaskId: null,
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: new Date().toISOString()
        }
      };

      await (manager as any).saveQueue(queue);

      const filePath = path.join(tempDir, 'tasks.json');
      expect(await fs.pathExists(filePath)).toBe(true);

      const saved = await fs.readJson(filePath);
      expect(saved).toEqual(queue);
    });

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(tempDir, 'nested', 'path');
      const newManager = new TaskQueueManager(newDir);
      
      const queue = {
        tasks: [],
        activeTaskId: null,
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: new Date().toISOString()
        }
      };

      await (newManager as any).saveQueue(queue);

      expect(await fs.pathExists(path.join(newDir, 'tasks.json'))).toBe(true);
    });

    it('should set file permissions to 600', async () => {
      const queue = {
        tasks: [],
        activeTaskId: null,
        metadata: {
          totalTasks: 0,
          queuedCount: 0,
          activeCount: 0,
          completedCount: 0,
          archivedCount: 0,
          lastUpdated: new Date().toISOString()
        }
      };

      await (manager as any).saveQueue(queue);

      const filePath = path.join(tempDir, 'tasks.json');
      const stats = await fs.stat(filePath);
      
      // Check file permissions (mode & 0o777 gives permissions)
      // On Windows, permissions work differently, so we check if chmod was called
      // The actual permissions may vary by platform
      const permissions = stats.mode & 0o777;
      
      // On Unix-like systems, expect 0o600
      // On Windows, the permissions are set but may not match exactly
      if (process.platform !== 'win32') {
        expect(permissions).toBe(0o600);
      } else {
        // On Windows, just verify the file exists and was created
        // (chmod works but permissions are handled differently)
        expect(await fs.pathExists(filePath)).toBe(true);
      }
    });
  });
});

