/**
 * Task Completion Service - Centralized task completion logic
 * 
 * REFACTORED: Extracted from TaskManager.completeTask() for Phase 4.
 * Handles task completion, queue management, file sync, context cleanup, and next task activation.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4: Extract Task CRUD Services
 */

import fs from 'fs-extra';
import path from 'path';
import type { Task, WorkflowState } from '@shadel/workflow-core';
import { TaskQueueManager } from './task-queue.js';
import { TaskFileSync } from './task-file-sync.js';
import { ContextInjector } from './context-injector.js';
import { RoleSystem } from './role-system.js';
import { RuleManager } from '../utils/rule-manager.js';
import { TaskMigration } from '../utils/migration.js';

/**
 * Task completion result
 */
export interface TaskCompletionResult {
  alreadyCompleted: boolean;
}

/**
 * Task Completion Service
 * 
 * Centralizes task completion logic with queue management, file sync, context cleanup, and next task activation.
 */
export class TaskCompletionService {
  private queueManager: TaskQueueManager;
  private fileSync: TaskFileSync;
  private contextInjector: ContextInjector;
  private roleSystem: RoleSystem;
  private ruleManager: RuleManager;
  private migration: TaskMigration;
  private contextDir: string;
  private taskFile: string;
  private migrationChecked: boolean = false;
  private syncFileFromQueue: (queueTask: any, preserveFields: string[]) => Promise<void>;

  constructor(
    queueManager: TaskQueueManager,
    fileSync: TaskFileSync,
    contextInjector: ContextInjector,
    roleSystem: RoleSystem,
    ruleManager: RuleManager,
    migration: TaskMigration,
    contextDir: string,
    taskFile: string,
    syncFileFromQueueFn: (queueTask: any, preserveFields: string[]) => Promise<void>
  ) {
    this.queueManager = queueManager;
    this.fileSync = fileSync;
    this.contextInjector = contextInjector;
    this.roleSystem = roleSystem;
    this.ruleManager = ruleManager;
    this.migration = migration;
    this.contextDir = contextDir;
    this.taskFile = taskFile;
    this.syncFileFromQueue = syncFileFromQueueFn;
  }

  /**
   * Check and run migration if needed (only once per instance)
   */
  private async ensureMigration(): Promise<void> {
    if (this.migrationChecked) return;
    this.migrationChecked = true;

    if (await this.migration.needsMigration()) {
      const result = await this.migration.migrate();
      if (!result.success) {
        console.warn(`⚠️ Migration warning: ${result.error}`);
      }
    }
  }

  /**
   * Complete the current active task
   * 
   * Handles task completion with queue management, file sync, context cleanup, and next task activation.
   * 
   * @returns Completion result with alreadyCompleted flag
   * @throws Error if no active task or task not at READY_TO_COMMIT state
   */
  async completeTask(): Promise<TaskCompletionResult> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // Get active task from queue system
    let activeTask = await this.queueManager.getActiveTask();
    
    // FIX: Retry queue read if queue is null but file exists (handles timing issues)
    if (!activeTask && await fs.pathExists(this.taskFile)) {
      await new Promise(resolve => setTimeout(resolve, 10));
      activeTask = await this.queueManager.getActiveTask();
    }
    
    if (!activeTask) {
      // Fallback to old format for backward compatibility
      if (!await fs.pathExists(this.taskFile)) {
        throw new Error('No active task to complete');
      }
      const taskData = await fs.readJson(this.taskFile);
      
      // Check if task is already completed
      if (taskData.status === 'completed' || taskData.completedAt) {
        // Task already completed - return success (idempotent operation)
        return { alreadyCompleted: true };
      }
      
      const currentState = taskData.workflow?.currentState;
      
      // CRITICAL: Must be at READY_TO_COMMIT to complete task
      if (currentState !== 'READY_TO_COMMIT') {
        throw new Error(
          `Cannot complete task at ${currentState} state.\n\n` +
          `Task must be at READY_TO_COMMIT before completion.\n\n` +
          `Current state: ${currentState}\n` +
          `Required: READY_TO_COMMIT\n\n` +
          `Progress to READY_TO_COMMIT first, then complete.`
        );
      }
      
      taskData.status = 'completed';
      taskData.completedAt = new Date().toISOString();
      taskData.workflow.currentState = 'READY_TO_COMMIT';

      // Ensure directory exists before writing
      await fs.ensureDir(this.contextDir);
      
      await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
      
      // FIX: Force event loop to process file system flush
      await new Promise(resolve => setImmediate(resolve));
      
      // REFACTORED: Removed WorkflowEngine.completeTask() call
      // Task completion is handled by queue system - no need for engine
      
      // BUG-FIX-006: Clear context files after completion
      await fs.remove(path.join(this.contextDir, 'STATUS.txt'));
      await fs.remove(path.join(this.contextDir, 'NEXT_STEPS.md'));
      await fs.remove(path.join(this.contextDir, 'WARNINGS.md'));
      return { alreadyCompleted: false };
    }
    
    // Use queue system
    // Check if task is already completed
    // Also check the file in case queue is out of sync
    if (activeTask.status === 'DONE' || activeTask.completedAt) {
      // Task already completed - return success (idempotent operation)
      return { alreadyCompleted: true };
    }
    
    // Double-check file in case queue is out of sync with file
    if (await fs.pathExists(this.taskFile)) {
      try {
        const fileTaskData = await fs.readJson(this.taskFile);
        if (fileTaskData.status === 'completed' || fileTaskData.completedAt) {
          // File shows completed but queue doesn't - file is source of truth
          return { alreadyCompleted: true };
        }
      } catch (error) {
        // File read failed, continue with queue data
      }
    }
    
    const currentState = activeTask.workflow?.currentState;
    
    // CRITICAL: Must be at READY_TO_COMMIT to complete task
    if (currentState !== 'READY_TO_COMMIT') {
      throw new Error(
        `Cannot complete task at ${currentState} state.\n\n` +
        `Task must be at READY_TO_COMMIT before completion.\n\n` +
        `Current state: ${currentState}\n` +
        `Required: READY_TO_COMMIT\n\n` +
        `Progress to READY_TO_COMMIT first, then complete.`
      );
    }
    
    // Complete task using queue system
    const result = await this.queueManager.completeTask(activeTask.id);
    
    // REFACTORED: Use TaskFileSync to sync completed task (full sync, not partial)
    // IMPORTANT: Only sync completed task if no next task is auto-activated
    // If next task is auto-activated, file will be synced with next task instead
    if (!result.nextActive && await fs.pathExists(this.taskFile)) {
      // Sync completed task from queue (full sync ensures all data is synced)
      await this.fileSync.syncFromQueue(result.completed, {
        preserveFields: ['requirements'],
        backup: true
      });
    }
    
    // REFACTORED: Removed WorkflowEngine.completeTask() call
    // Task completion is handled by queue system - no need for engine
    
    // Fix 5: Update context for next task (if auto-activated) and sync file
    // Cursor Integration: Updates STATUS.txt and NEXT_STEPS.md for next task
    // NOTE: If next task is auto-activated, file will be updated to next task
    // This is expected behavior - file always reflects active task
    if (result.nextActive && result.nextActive.status === 'ACTIVE') {
      // Sync file with next task (this will overwrite completed task in file)
      // This is correct behavior - file should always show active task
      await this.syncFileFromQueue(result.nextActive, ['requirements']);
      
      const nextTask: Task = {
        id: result.nextActive.id,
        goal: result.nextActive.goal,
        status: result.nextActive.workflow?.currentState || 'UNDERSTANDING',
        startedAt: result.nextActive.createdAt,
        roleApprovals: []
      };
      
      const activeRoles = this.roleSystem.getActiveRoles({
        taskGoal: nextTask.goal
      });
      const localRules = await this.ruleManager.getRules();
      
      await this.contextInjector.updateAfterCommand('task.complete', {
        task: nextTask,
        warnings: [],
        blockers: [],
        activeRoles,
        localRules
      });
    } else {
      // No next task - sync completed task to file first, then clear context files
      if (await fs.pathExists(this.taskFile)) {
        // Sync completed task from queue (full sync ensures all data is synced)
        await this.fileSync.syncFromQueue(result.completed, {
          preserveFields: ['requirements'],
          backup: true
        });
      }
      
      // Clear context files (but keep current-task.json to show completed status)
      await fs.remove(path.join(this.contextDir, 'STATUS.txt'));
      await fs.remove(path.join(this.contextDir, 'NEXT_STEPS.md'));
      await fs.remove(path.join(this.contextDir, 'WARNINGS.md'));
      
      // Note: current-task.json is kept to show completed task status
      // This allows getCurrentTask() to return null (completed tasks are not "current")
      // but file still exists with completed status for reference
    }
    
    return { alreadyCompleted: false };
  }
}


