/**
 * Task Update Service - Centralized task update logic
 * 
 * REFACTORED: Extracted from TaskManager.updateTask() for Phase 4.
 * Handles task updates, queue management, file sync, and context injection.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4: Extract Task CRUD Services
 */

import fs from 'fs-extra';
import path from 'path';
import type { Task } from '@shadel/workflow-core';
import { TaskQueueManager } from './task-queue.js';
import { ContextInjector } from './context-injector.js';
import { RuleManager } from '../utils/rule-manager.js';
import { TaskMigration } from '../utils/migration.js';

/**
 * Task update options
 */
export interface TaskUpdateOptions {
  goal?: string;
  addReq?: string;
}

/**
 * Task Update Service
 * 
 * Centralizes task update logic with queue management, file sync, and context injection.
 */
export class TaskUpdateService {
  private queueManager: TaskQueueManager;
  private contextInjector: ContextInjector;
  private ruleManager: RuleManager;
  private migration: TaskMigration;
  private taskFile: string;
  private migrationChecked: boolean = false;
  private getCurrentTask: () => Promise<Task | null>;
  private syncFileFromQueue: (queueTask: any, preserveFields: string[]) => Promise<void>;

  constructor(
    queueManager: TaskQueueManager,
    contextInjector: ContextInjector,
    ruleManager: RuleManager,
    migration: TaskMigration,
    taskFile: string,
    getCurrentTaskFn: () => Promise<Task | null>,
    syncFileFromQueueFn: (queueTask: any, preserveFields: string[]) => Promise<void>
  ) {
    this.queueManager = queueManager;
    this.contextInjector = contextInjector;
    this.ruleManager = ruleManager;
    this.migration = migration;
    this.taskFile = taskFile;
    this.getCurrentTask = getCurrentTaskFn;
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
   * Update task details
   * 
   * @requirement REQ-V2-003 - Task update (NEW v2.0)
   * 
   * @param taskId Task ID to update
   * @param updates Update options (goal, addReq)
   * @throws Error if task not found or not active
   */
  async updateTask(
    taskId: string,
    updates: TaskUpdateOptions
  ): Promise<void> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // Check if it's the current task
    const currentTask = await this.getCurrentTask();
    if (!currentTask || currentTask.id !== taskId) {
      throw new Error(`Task ${taskId} not found or not active`);
    }
    
    // REFACTORED: Update queue first, then sync from queue to file (no direct file write)
    const activeQueueTask = await this.queueManager.getActiveTask();
    if (activeQueueTask && activeQueueTask.id === taskId) {
      const queue = await (this.queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        // Update queue task
        if (updates.goal) {
          queueTask.goal = updates.goal;
        }
        
        // Update requirements in queue
        if (updates.addReq) {
          if (!(queueTask as any).requirements) {
            (queueTask as any).requirements = [];
          }
          if (!(queueTask as any).requirements.includes(updates.addReq)) {
            (queueTask as any).requirements.push(updates.addReq);
          }
        }
        
        await (this.queueManager as any).saveQueue(queue);
        
        // REFACTORED: Sync from queue to file (no direct file write)
        await this.syncFileFromQueue(queueTask, []);
      }
    } else {
      // Fallback: If no queue task, update file directly (backward compatibility)
      if (await fs.pathExists(this.taskFile)) {
        const taskData = await fs.readJson(this.taskFile);
        
        // Apply updates
        if (updates.goal) {
          taskData.originalGoal = updates.goal;
        }
        
        if (updates.addReq) {
          if (!taskData.requirements) {
            taskData.requirements = [];
          }
          if (!taskData.requirements.includes(updates.addReq)) {
            taskData.requirements.push(updates.addReq);
          }
        }
        
        // Save updated task
        // Ensure directory exists before writing
        await fs.ensureDir(path.dirname(this.taskFile));
        
        await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
        
        // FIX: Force event loop to process file system flush
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Auto-inject context for AI
    const updatedTask = await this.getCurrentTask();
    if (updatedTask) {
      const localRules = await this.ruleManager.getRules();  // v3.0.3
      await this.contextInjector.updateAfterCommand('task.update', {
        task: updatedTask,
        warnings: [],
        blockers: [],
        localRules  // v3.0.3 - Include project rules
      });
    }
  }
}


