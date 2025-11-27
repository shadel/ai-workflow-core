/**
 * Task Queue Manager - Multi-task queue system for Free Tier
 * @requirement FREE-TIER-001 - Task Queue Management
 * 
 * Cursor Integration: This file defines data structures that Cursor will read
 * from tasks.json to understand the task queue state when reading STATUS.txt
 */

import type { WorkflowState } from '@shadel/workflow-core';
import fs from 'fs-extra';
import path from 'path';
import lockfile from 'proper-lockfile';
import { PriorityDetector } from './priority-detector.js';
import { TimeTracker } from './time-tracker.js';

/**
 * Workflow progress structure (matches existing system)
 * Cursor reads this to understand task workflow state
 */
export interface WorkflowProgress {
  currentState: WorkflowState;
  stateEnteredAt: string;
  stateHistory: Array<{
    state: WorkflowState;
    enteredAt: string;
  }>;
}

/**
 * Task status in queue system
 * QUEUED: Waiting to be activated
 * ACTIVE: Currently being worked on (only 1 can be ACTIVE)
 * DONE: Completed
 * ARCHIVED: Auto-archived after 30 days
 */
export type TaskStatus = 'QUEUED' | 'ACTIVE' | 'DONE' | 'ARCHIVED';

/**
 * Task priority levels
 * CRITICAL: Production bugs, security issues
 * HIGH: Important features, deadlines
 * MEDIUM: Standard work (default)
 * LOW: Refactoring, cleanup
 */
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Review checklist (for REVIEWING state)
 */
export interface ReviewChecklist {
  items: Array<{
    id: string;
    description: string;
    category: 'automated' | 'manual';
    completed: boolean;
    completedAt?: string;
    notes?: string;
  }>;
  completedAt?: string;
}

/**
 * Task in queue system
 * Cursor reads this from tasks.json to understand task context
 */
export interface Task {
  id: string;                    // task-{timestamp}
  goal: string;                  // Required, min 10, max 500 chars
  status: TaskStatus;            // QUEUED | ACTIVE | DONE | ARCHIVED
  priority?: Priority;           // CRITICAL | HIGH | MEDIUM | LOW
  tags?: string[];               // Auto-detected from goal
  createdAt: string;            // ISO timestamp
  activatedAt?: string;          // ISO timestamp (when became ACTIVE)
  completedAt?: string;          // ISO timestamp
  archivedAt?: string;           // ISO timestamp (auto after 30 days)
  estimatedTime?: string;        // "2 days", "4 hours", "1 week"
  actualTime?: number;           // hours (decimal, calculated)
  workflow?: WorkflowProgress;   // Existing workflow states (for Cursor context)
  reviewChecklist?: ReviewChecklist; // Review checklist for REVIEWING state
}

/**
 * Task queue structure
 * Stored in .ai-context/tasks.json
 * Cursor reads this file to understand full project context
 */
export interface TaskQueue {
  tasks: Task[];
  activeTaskId: string | null;
  metadata: {
    totalTasks: number;
    queuedCount: number;
    activeCount: number;
    completedCount: number;
    archivedCount: number;
    lastUpdated: string;
  };
}

/**
 * Type guard to check if value is valid TaskStatus
 */
export function isTaskStatus(value: string): value is TaskStatus {
  return ['QUEUED', 'ACTIVE', 'DONE', 'ARCHIVED'].includes(value);
}

/**
 * Type guard to check if value is valid Priority
 */
export function isPriority(value: string): value is Priority {
  return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(value);
}

/**
 * Validate Task structure
 * Used to ensure data integrity for Cursor reading
 */
export function validateTask(task: any): task is Task {
  if (!task || typeof task !== 'object') return false;
  if (typeof task.id !== 'string' || !task.id.startsWith('task-')) return false;
  if (typeof task.goal !== 'string' || task.goal.length < 10 || task.goal.length > 500) return false;
  if (!isTaskStatus(task.status)) return false;
  if (task.priority && !isPriority(task.priority)) return false;
  if (typeof task.createdAt !== 'string') return false;
  return true;
}

/**
 * Validate TaskQueue structure
 * Used to ensure data integrity for Cursor reading
 */
export function validateTaskQueue(queue: any): queue is TaskQueue {
  if (!queue || typeof queue !== 'object') return false;
  if (!Array.isArray(queue.tasks)) return false;
  if (queue.activeTaskId !== null && typeof queue.activeTaskId !== 'string') return false;
  if (!queue.metadata || typeof queue.metadata !== 'object') return false;
  if (typeof queue.metadata.totalTasks !== 'number') return false;
  return true;
}

/**
 * TaskQueueManager - Manages multi-task queue system
 * Cursor Integration: Updates tasks.json which Cursor reads for project context
 */
export class TaskQueueManager {
  private queueFile: string;
  private lockOptions: lockfile.LockOptions;

  constructor(contextDir: string = '.ai-context') {
    this.queueFile = path.join(contextDir, 'tasks.json');
    this.lockOptions = {
      retries: {
        retries: 30,  // Increased from 10 for better parallel execution at 75% maxWorkers
        minTimeout: 200,  // Increased from 100 for Windows file system
        maxTimeout: 3000  // Increased from 1000 for better lock acquisition
      }
    };
  }

  /**
   * File locking wrapper for concurrent access safety
   * Cursor Integration: Ensures data integrity when multiple processes access tasks.json
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Ensure directory exists before locking
    await fs.ensureDir(path.dirname(this.queueFile));
    
    // Create empty file if it doesn't exist (required for proper-lockfile on some platforms)
    if (!await fs.pathExists(this.queueFile)) {
      await fs.writeJson(this.queueFile, this.createEmptyQueue(), { spaces: 2 });
    }
    
    const release = await lockfile.lock(this.queueFile, this.lockOptions);
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  /**
   * Load queue from file
   * Cursor Integration: Reads tasks.json that Cursor uses for context
   */
  private async loadQueue(): Promise<TaskQueue> {
    if (!await fs.pathExists(this.queueFile)) {
      return this.createEmptyQueue();
    }

    const data = await fs.readJson(this.queueFile);
    return this.validateQueue(data);
  }

  /**
   * Save queue to file
   * Cursor Integration: Writes tasks.json that Cursor reads for project context
   */
  private async saveQueue(queue: TaskQueue): Promise<void> {
    // DEBUG: Log queue save
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] saveQueue() - Saving queue, activeTaskId:', queue.activeTaskId, 'tasks:', queue.tasks.length);
    }
    
    await fs.ensureDir(path.dirname(this.queueFile));
    await fs.writeJson(this.queueFile, queue, { spaces: 2 });
    
    // Set file permissions (600 = owner read/write only) for security
    // Only chmod if file exists (defensive check)
    if (await fs.pathExists(this.queueFile)) {
      await fs.chmod(this.queueFile, 0o600);
    }
    
    // FIX: Force event loop to process file system flush
    // This ensures file is written to disk before next read operation
    // Without this, Windows file system caching can cause timing issues
    await new Promise(resolve => setImmediate(resolve));
    
    // DEBUG: Log queue saved
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] saveQueue() - Queue saved and flushed');
    }
  }

  /**
   * Create empty queue structure
   */
  private createEmptyQueue(): TaskQueue {
    return {
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
  }

  /**
   * Validate queue structure
   * Cursor Integration: Ensures tasks.json structure is valid for Cursor reading
   */
  private validateQueue(data: any): TaskQueue {
    // Basic validation
    if (!data || typeof data !== 'object') {
      return this.createEmptyQueue();
    }

    // Ensure required fields
    if (!Array.isArray(data.tasks)) {
      data.tasks = [];
    }

    if (data.activeTaskId !== null && typeof data.activeTaskId !== 'string') {
      data.activeTaskId = null;
    }

    // Validate metadata
    if (!data.metadata) {
      data.metadata = {};
    }

    return data as TaskQueue;
  }

  /**
   * Update metadata
   * Cursor Integration: Updates metadata that Cursor reads for statistics
   */
  private updateMetadata(queue: TaskQueue): void {
    queue.metadata = {
      totalTasks: queue.tasks.length,
      queuedCount: queue.tasks.filter(t => t.status === 'QUEUED').length,
      activeCount: queue.tasks.filter(t => t.status === 'ACTIVE').length,
      completedCount: queue.tasks.filter(t => t.status === 'DONE').length,
      archivedCount: queue.tasks.filter(t => t.status === 'ARCHIVED').length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Create new task
   * - If no active task → Mark as ACTIVE
   * - If active task exists → Mark as QUEUED
   * Cursor Integration: Creates task that Cursor reads from tasks.json
   */
  async createTask(goal: string, options?: {
    priority?: Priority;
    tags?: string[];
    estimatedTime?: string;
  }): Promise<Task> {
    return await this.withLock(async () => {
      const queue = await this.loadQueue();
      
      // Validate goal
      if (!goal || typeof goal !== 'string') {
        throw new Error('Task goal is required and must be a string');
      }
      const trimmedGoal = goal.trim();
      if (trimmedGoal.length < 10) {
        throw new Error(`Task goal must be at least 10 characters (received: ${trimmedGoal.length})`);
      }
      if (trimmedGoal.length > 500) {
        throw new Error(`Task goal must be less than 500 characters (received: ${trimmedGoal.length})`);
      }
      
      // Validate priority if provided
      if (options?.priority) {
        const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        if (!validPriorities.includes(options.priority)) {
          throw new Error(`Invalid priority: ${options.priority}. Must be one of: ${validPriorities.join(', ')}`);
        }
      }
      
      // Validate tags if provided
      if (options?.tags) {
        if (!Array.isArray(options.tags)) {
          throw new Error('Tags must be an array');
        }
        if (options.tags.some(tag => typeof tag !== 'string' || tag.trim().length === 0)) {
          throw new Error('All tags must be non-empty strings');
        }
      }

      // Check if active task exists
      const hasActiveTask = queue.activeTaskId !== null;
      const TRACK = process.env.TRACK_TASK_ID === 'true';
      
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.createTask] hasActiveTask:', hasActiveTask, 'activeTaskId:', queue.activeTaskId);
      }
      
      // Auto-detect priority if not provided
      const priority = options?.priority || PriorityDetector.detect(goal);
      
      const taskStatus = hasActiveTask ? 'QUEUED' : 'ACTIVE';
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.createTask] Creating task with status:', taskStatus);
      }
      
      const task: Task = {
        id: `task-${Date.now()}`,
        goal: goal.trim(),
        status: taskStatus,
        priority,
        tags: options?.tags || [],
        createdAt: new Date().toISOString(),
        ...(hasActiveTask ? {} : { activatedAt: new Date().toISOString() }),
        estimatedTime: options?.estimatedTime,
        workflow: hasActiveTask ? undefined : {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: new Date().toISOString(),
          stateHistory: []
        }
      };

      if (TRACK) {
        console.log('[TRACK TaskQueueManager.createTask] Created task with id:', task.id, 'status:', task.status);
      }

      queue.tasks.push(task);
      
      if (!hasActiveTask) {
        queue.activeTaskId = task.id;
        if (TRACK) {
          console.log('[TRACK TaskQueueManager.createTask] Set activeTaskId to:', queue.activeTaskId);
        }
      } else {
        if (TRACK) {
          console.log('[TRACK TaskQueueManager.createTask] Task queued, activeTaskId remains:', queue.activeTaskId);
        }
      }

      await this.updateMetadata(queue);
      
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.createTask] About to save queue, activeTaskId:', queue.activeTaskId);
      }
      
      await this.saveQueue(queue);
      
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.createTask] Queue saved, returning task with id:', task.id, 'status:', task.status);
      }

      return task;
    });
  }

  /**
   * Activate a queued task
   * - Only 1 task can be ACTIVE at a time
   * - Previous active task → QUEUED (preserve state)
   * Cursor Integration: Updates active task that Cursor reads from tasks.json
   */
  async activateTask(taskId: string): Promise<Task> {
    const TRACK = process.env.TRACK_TASK_ID === 'true';
    
    // Validate taskId
    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      throw new Error('Task ID is required and must be a non-empty string');
    }
    
    if (TRACK) {
      console.log('[TRACK TaskQueueManager.activateTask] Activating taskId:', taskId);
    }
    
    return await this.withLock(async () => {
      const queue = await this.loadQueue();
      
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.activateTask] Current activeTaskId:', queue.activeTaskId);
      }
      
      const task = queue.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}. Use 'task list' to see available tasks.`);
      }

      if (task.status === 'ARCHIVED') {
        throw new Error(`Cannot activate archived task: ${taskId}`);
      }

      if (task.status === 'ACTIVE') {
        if (TRACK) {
          console.log('[TRACK TaskQueueManager.activateTask] Task already active, returning');
        }
        return task; // Already active
      }

      // Deactivate current active task
      if (queue.activeTaskId) {
        const currentActive = queue.tasks.find(t => t.id === queue.activeTaskId);
        if (currentActive) {
          if (TRACK) {
            console.log('[TRACK TaskQueueManager.activateTask] Deactivating current active task:', queue.activeTaskId);
          }
          currentActive.status = 'QUEUED';
          // Preserve workflow state
        }
      }

      // Activate new task
      task.status = 'ACTIVE';
      task.activatedAt = new Date().toISOString();
      queue.activeTaskId = task.id;
      
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.activateTask] New activeTaskId set to:', queue.activeTaskId);
      }

      // Initialize workflow if not exists
      if (!task.workflow) {
        task.workflow = {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: new Date().toISOString(),
          stateHistory: []
        };
      }

      await this.updateMetadata(queue);
      
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.activateTask] About to save queue with activeTaskId:', queue.activeTaskId);
      }
      
      await this.saveQueue(queue);
      
      if (TRACK) {
        console.log('[TRACK TaskQueueManager.activateTask] Queue saved, returning task with id:', task.id);
      }

      return task;
    });
  }

  /**
   * Complete active task
   * - Mark as DONE
   * - Calculate actual time
   * - Auto-activate next QUEUED task (by priority)
   * Cursor Integration: Updates task status that Cursor reads from tasks.json
   */
  async completeTask(taskId: string): Promise<{ completed: Task; nextActive?: Task }> {
    // Validate taskId
    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      throw new Error('Task ID is required and must be a non-empty string');
    }
    
    return await this.withLock(async () => {
      const queue = await this.loadQueue();
      
      const task = queue.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}. Use 'task list' to see available tasks.`);
      }
      
      if (task.status === 'ARCHIVED') {
        throw new Error(`Cannot complete archived task: ${taskId}`);
      }

      if (task.status !== 'ACTIVE') {
        throw new Error(`Task is not active: ${taskId}. Current status: ${task.status}. Only ACTIVE tasks can be completed.`);
      }

      // Mark as DONE
      task.status = 'DONE';
      task.completedAt = new Date().toISOString();

      // Calculate actual time
      if (task.activatedAt) {
        const start = new Date(task.activatedAt);
        const end = new Date();
        // Calculate actual time using TimeTracker
        task.actualTime = TimeTracker.calculateActualTime(start.toISOString(), end.toISOString());
      }

      // Clear active task
      queue.activeTaskId = null;

      // Auto-activate next QUEUED task (by priority)
      const nextTask = this.getNextQueuedTask(queue);
      let nextActive: Task | undefined;
      
      if (nextTask) {
        nextTask.status = 'ACTIVE';
        nextTask.activatedAt = new Date().toISOString();
        queue.activeTaskId = nextTask.id;
        
        if (!nextTask.workflow) {
          nextTask.workflow = {
            currentState: 'UNDERSTANDING',
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        
        nextActive = nextTask;
      }

      await this.updateMetadata(queue);
      await this.saveQueue(queue);

      return { completed: task, nextActive };
    });
  }

  /**
   * Get next queued task by priority
   * Cursor Integration: Used to determine which task Cursor should work on next
   */
  private getNextQueuedTask(queue: TaskQueue): Task | null {
    const queued = queue.tasks.filter(t => t.status === 'QUEUED');
    if (queued.length === 0) return null;

    // Sort by priority (CRITICAL → LOW), then by creation date (oldest first)
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    queued.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'MEDIUM'];
      const bPriority = priorityOrder[b.priority || 'MEDIUM'];
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return queued[0];
  }

  /**
   * Auto-archive DONE tasks older than 30 days
   * Cursor Integration: Keeps tasks.json manageable for Cursor reading
   */
  async archiveOldTasks(): Promise<number> {
    return await this.withLock(async () => {
      const queue = await this.loadQueue();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let archivedCount = 0;
      for (const task of queue.tasks) {
        if (task.status === 'DONE' && task.completedAt) {
          const completedDate = new Date(task.completedAt);
          if (completedDate < thirtyDaysAgo) {
            task.status = 'ARCHIVED';
            task.archivedAt = new Date().toISOString();
            archivedCount++;
          }
        }
      }

      if (archivedCount > 0) {
        await this.updateMetadata(queue);
        await this.saveQueue(queue);
      }

      return archivedCount;
    });
  }

  /**
   * Get active task
   * Cursor Integration: Returns task that Cursor should focus on
   */
  async getActiveTask(): Promise<Task | null> {
    const queue = await this.loadQueue();
    
    // FIX: Force event loop to process file system operations
    // This ensures file read is from disk, not cache
    await new Promise(resolve => setImmediate(resolve));
    
    // DEBUG: Log active task lookup
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] getActiveTask() - activeTaskId:', queue.activeTaskId, 'tasks:', queue.tasks.length);
    }
    
    if (!queue.activeTaskId) {
      // DEBUG: Log no active task ID
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getActiveTask() - No activeTaskId, returning null');
      }
      return null;
    }
    
    const task = queue.tasks.find(t => t.id === queue.activeTaskId) || null;
    
    // DEBUG: Log task found
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] getActiveTask() - Task found:', task ? task.id : 'null');
    }
    
    return task;
  }

  /**
   * List tasks (with filtering)
   * Cursor Integration: Returns tasks that Cursor can see in queue overview
   */
  async listTasks(options?: {
    status?: TaskStatus[];
    priority?: Priority[];
    includeArchived?: boolean;
    limit?: number;
  }): Promise<Task[]> {
    // Validate options
    if (options) {
      if (options.status && !Array.isArray(options.status)) {
        throw new Error('Status filter must be an array');
      }
      if (options.priority && !Array.isArray(options.priority)) {
        throw new Error('Priority filter must be an array');
      }
      if (options.limit !== undefined) {
        if (typeof options.limit !== 'number' || options.limit < 0) {
          throw new Error('Limit must be a non-negative number');
        }
      }
    }
    
    const queue = await this.loadQueue();
    let tasks = queue.tasks;

    // Filter by status
    if (options?.status) {
      tasks = tasks.filter(t => options.status!.includes(t.status));
    }

    // Filter by priority
    if (options?.priority) {
      tasks = tasks.filter(t => options.priority!.includes(t.priority || 'MEDIUM'));
    }

    // Exclude archived by default
    if (!options?.includeArchived) {
      tasks = tasks.filter(t => t.status !== 'ARCHIVED');
    }

    // Sort: ACTIVE first, then by priority, then by creation date
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    tasks.sort((a, b) => {
      // ACTIVE tasks first
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;

      // Then by priority
      const aPriority = priorityOrder[a.priority || 'MEDIUM'];
      const bPriority = priorityOrder[b.priority || 'MEDIUM'];
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Then by creation date (oldest first)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Limit
    if (options?.limit) {
      tasks = tasks.slice(0, options.limit);
    }

    return tasks;
  }
}

