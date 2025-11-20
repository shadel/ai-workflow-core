/**
 * Task Manager New Features Tests
 * Tests for listTasks() and updateTask()
 * @requirement REQ-V2-003
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskManager } from '../src/core/task-manager.js';

describe('TaskManager - New Features', () => {
  let taskManager: TaskManager;
  let testContextDir: string;

  beforeEach(async () => {
    testContextDir = path.join(os.tmpdir(), `task-test-${Date.now()}`);
    await fs.ensureDir(testContextDir);
    taskManager = new TaskManager(testContextDir);
  });

  afterEach(async () => {
    try {
      await fs.remove(testContextDir);
    } catch (error) {
      // Ignore cleanup errors on Windows
    }
  });

  describe('listTasks()', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await taskManager.listTasks();
      expect(tasks).toEqual([]);
    });

    it('should list current task', async () => {
      await taskManager.createTask('Test task for listing functionality', []);
      
      const tasks = await taskManager.listTasks();
      
      expect(tasks.length).toBe(1);
      expect(tasks[0].goal).toBe('Test task for listing functionality');
    });

    it('should filter by status', async () => {
      await taskManager.createTask('Test task for filtering by status', []);
      
      const tasks = await taskManager.listTasks('UNDERSTANDING');
      
      expect(tasks.length).toBeGreaterThan(0);
      tasks.forEach(task => {
        expect(task.status).toBe('UNDERSTANDING');
      });
    });

    it('should limit results', async () => {
      await taskManager.createTask('Test task one for limit testing', []);
      
      const tasks = await taskManager.listTasks(undefined, 1);
      
      expect(tasks.length).toBeLessThanOrEqual(1);
    });
  });

  describe('updateTask()', () => {
    it('should update task goal', async () => {
      const task = await taskManager.createTask('Original goal for task update test', []);
      
      await taskManager.updateTask(task.id, { goal: 'Updated goal for task update test' });
      
      const currentTask = await taskManager.getCurrentTask();
      expect(currentTask?.goal).toBe('Updated goal for task update test');
    });

    it('should add requirement to task', async () => {
      const task = await taskManager.createTask('Test task for adding requirements', ['REQ-001']);
      
      await taskManager.updateTask(task.id, { addReq: 'REQ-002' });
      
      // Verify in file
      const taskData = await fs.readJson(path.join(testContextDir, 'current-task.json'));
      expect(taskData.requirements).toContain('REQ-001');
      expect(taskData.requirements).toContain('REQ-002');
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        taskManager.updateTask('fake-id', { goal: 'New' })
      ).rejects.toThrow();
    });
  });
});

