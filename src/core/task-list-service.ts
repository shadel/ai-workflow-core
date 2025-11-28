/**
 * Task List Service - Centralized task listing logic
 * 
 * REFACTORED: Extracted from TaskManager.listTasks() for Phase 4.
 * Handles task listing with filtering and history reading.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4: Extract Task CRUD Services
 */

import fs from 'fs-extra';
import path from 'path';
import type { Task, WorkflowState } from '@shadel/workflow-core';
import { TaskQueueManager } from './task-queue.js';
import { TaskMigration } from '../utils/migration.js';

/**
 * Task List Service
 * 
 * Centralizes task listing logic with filtering and history reading.
 */
export class TaskListService {
  private queueManager: TaskQueueManager;
  private migration: TaskMigration;
  private contextDir: string;
  private migrationChecked: boolean = false;
  private getCurrentTask?: () => Promise<Task | null>;

  constructor(
    queueManager: TaskQueueManager,
    migration: TaskMigration,
    contextDir: string,
    getCurrentTaskFn?: () => Promise<Task | null>
  ) {
    this.queueManager = queueManager;
    this.migration = migration;
    this.contextDir = contextDir;
    this.getCurrentTask = getCurrentTaskFn;
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
   * List tasks with optional filtering
   * 
   * Lists tasks from queue system and task history.
   * 
   * @param statusFilter Optional workflow state filter
   * @param limit Maximum number of tasks to return (default: 10)
   * @returns Array of tasks
   */
  async listTasks(statusFilter?: string, limit = 10): Promise<Task[]> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // Use queue system to list tasks
    // Note: statusFilter is WorkflowState, but we list all tasks and filter by workflow state
    const queueTasks = await this.queueManager.listTasks({
      limit
    });
    
    // Convert queue tasks to WorkflowEngine Task format and filter by workflow state
    let tasks: Task[] = queueTasks.map(queueTask => ({
      id: queueTask.id,
      goal: queueTask.goal,
      status: queueTask.workflow?.currentState || 'UNDERSTANDING',
      startedAt: queueTask.createdAt,
      completedAt: queueTask.completedAt,
      roleApprovals: []
    }));
    
    // Filter by workflow state if specified
    if (statusFilter) {
      tasks = tasks.filter(t => t.status === statusFilter);
    }
    
    // Apply limit
    tasks = tasks.slice(0, limit);
    
    // Fallback to old format if no queue tasks
    if (tasks.length === 0 && this.getCurrentTask) {
      const currentTask = await this.getCurrentTask();
      if (currentTask) {
        if (!statusFilter || currentTask.status === statusFilter) {
          tasks.push(currentTask);
        }
      }
    }
    
    // Get task history
    const historyDir = path.join(this.contextDir, 'task-history');
    if (await fs.pathExists(historyDir)) {
      const files = await fs.readdir(historyDir);
      const historyFiles = files.filter(f => f.endsWith('.json'));
      
      // Sort by modification time (most recent first)
      const filesWithStats = await Promise.all(
        historyFiles.map(async (file) => {
          const filePath = path.join(historyDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );
      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Read historical tasks
      for (const { file } of filesWithStats) {
        if (tasks.length >= limit) break;
        
        try {
          const taskData = await fs.readJson(path.join(historyDir, file));
          
          // Convert task data to Task format
          const historicalTask: Task = {
            id: taskData.taskId || file.replace('.json', ''),
            goal: taskData.originalGoal || '',
            status: taskData.workflow?.currentState || 'UNDERSTANDING',
            startedAt: taskData.startedAt || '',
            completedAt: taskData.completedAt,
            roleApprovals: taskData.roleApprovals || []
          };
          
          if (!statusFilter || historicalTask.status === statusFilter) {
            tasks.push(historicalTask);
          }
        } catch (error) {
          // Skip corrupted history files
          continue;
        }
      }
    }
    
    return tasks.slice(0, limit);
  }
}

