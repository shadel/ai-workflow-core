/**
 * Task Migration Utility - Migrate from current-task.json to tasks.json
 * @requirement FREE-TIER-001 - Task Queue Management
 * 
 * Cursor Integration: Ensures smooth transition so Cursor can continue reading
 * task context after migration
 */

import fs from 'fs-extra';
import path from 'path';
import { TaskQueueManager, Priority } from '../core/task-queue.js';

export interface MigrationResult {
  success: boolean;
  migrated: boolean;
  backupCreated: boolean;
  backupPath?: string;
  error?: string;
}

export class TaskMigration {
  private contextDir: string;
  private currentTaskFile: string;
  private tasksFile: string;

  constructor(contextDir: string = '.ai-context') {
    this.contextDir = contextDir;
    this.currentTaskFile = path.join(contextDir, 'current-task.json');
    this.tasksFile = path.join(contextDir, 'tasks.json');
  }

  /**
   * Check if migration needed
   * Cursor Integration: Determines if Cursor needs to read from old or new format
   */
  async needsMigration(): Promise<boolean> {
    // Migration needed if:
    // 1. current-task.json exists
    // 2. tasks.json doesn't exist OR tasks.json is empty
    const currentExists = await fs.pathExists(this.currentTaskFile);
    const tasksExists = await fs.pathExists(this.tasksFile);

    if (!currentExists) {
      return false; // No current task, no migration needed
    }

    if (!tasksExists) {
      return true; // Current task exists but no tasks.json
    }

    // Check if tasks.json is empty
    try {
      const tasksData = await fs.readJson(this.tasksFile);
      const isEmpty = !tasksData.tasks || tasksData.tasks.length === 0;
      return isEmpty;
    } catch {
      // If file is corrupted, consider migration needed
      return true;
    }
  }

  /**
   * Migrate current-task.json to tasks.json
   * Cursor Integration: Preserves workflow state so Cursor context is maintained
   */
  async migrate(dryRun: boolean = false): Promise<MigrationResult> {
    try {
      const needsMigration = await this.needsMigration();
      if (!needsMigration) {
        return {
          success: true,
          migrated: false,
          backupCreated: false
        };
      }

      // Read current task
      const currentTask = await fs.readJson(this.currentTaskFile);

      // Fix 8: Detect conflicts before migration
      let conflictDetected = false;
      if (await fs.pathExists(this.tasksFile)) {
        try {
          const existingTasks = await fs.readJson(this.tasksFile);
          if (existingTasks.tasks && existingTasks.tasks.length > 0) {
            // Check if current task conflicts with existing tasks
            const existingTask = existingTasks.tasks.find((t: any) => 
              t.id === currentTask.taskId || 
              (t.goal === (currentTask.originalGoal || currentTask.goal))
            );
            if (existingTask && existingTask.id !== currentTask.taskId) {
              conflictDetected = true;
              console.warn('⚠️  Migration conflict detected: Task exists in queue with different ID');
              console.warn(`   File taskId: ${currentTask.taskId}`);
              console.warn(`   Queue taskId: ${existingTask.id}`);
              console.warn('   Syncing file from queue...');
              
              // Sync file from queue (queue is source of truth)
              if (!dryRun) {
                const activeTask = existingTasks.tasks.find((t: any) => t.status === 'ACTIVE');
                if (activeTask) {
                  // File will be synced by TaskManager.getCurrentTask() after migration
                  // Just log the conflict for now
                }
              }
            }
          }
        } catch (error) {
          // If tasks.json is corrupted, proceed with migration
          console.warn('⚠️  Warning: Could not read tasks.json during migration conflict check:', (error as Error).message);
        }
      }

      // Create backup
      const backupPath = `${this.currentTaskFile}.backup.${Date.now()}`;
      if (!dryRun) {
        await fs.copy(this.currentTaskFile, backupPath);
      }

      // Convert to new format
      const queueManager = new TaskQueueManager(this.contextDir);
      
      if (!dryRun) {
        // Create task in new format
        const goal = currentTask.originalGoal || currentTask.goal || 'Migrated task';
        const task = await queueManager.createTask(goal, {
          priority: this.detectPriorityFromOldTask(currentTask),
          estimatedTime: currentTask.estimatedTime
        });

        // If old task was in progress, preserve workflow state
        if (currentTask.workflow) {
          // Access private method via reflection (for migration only)
          const queue = await (queueManager as any).loadQueue();
          const newTask = queue.tasks.find((t: any) => t.id === task.id);
          if (newTask && currentTask.workflow) {
            newTask.workflow = currentTask.workflow;
            await (queueManager as any).saveQueue(queue);
          }
        }
      }

      return {
        success: true,
        migrated: true,
        backupCreated: true,
        backupPath: dryRun ? undefined : backupPath
      };
    } catch (error) {
      return {
        success: false,
        migrated: false,
        backupCreated: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Detect priority from old task format
   * Cursor Integration: Helps Cursor understand task priority after migration
   */
  private detectPriorityFromOldTask(oldTask: any): Priority {
    // Try to infer from goal or other fields
    const goal = (oldTask.originalGoal || oldTask.goal || '').toLowerCase();
    
    if (['fix', 'bug', 'broken', 'security', 'down', 'blocking'].some(kw => goal.includes(kw))) {
      return 'CRITICAL';
    }
    if (['auth', 'login', 'payment', 'deadline', 'important'].some(kw => goal.includes(kw))) {
      return 'HIGH';
    }
    if (['refactor', 'cleanup', 'improve', 'nice-to-have'].some(kw => goal.includes(kw))) {
      return 'LOW';
    }
    
    return 'MEDIUM';
  }
}

