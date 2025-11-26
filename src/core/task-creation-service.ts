/**
 * Task Creation Service - Centralized task creation logic
 * 
 * REFACTORED: Extracted from TaskManager.createTask() for Phase 4.
 * Handles task creation, queue management, file sync, and context injection.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4: Extract Task CRUD Services
 */

import fs from 'fs-extra';
import type { Task } from '@shadel/workflow-core';
import { TaskQueueManager } from './task-queue.js';
import { ContextInjector } from './context-injector.js';
import { RoleSystem } from './role-system.js';
import { RuleManager } from '../utils/rule-manager.js';
import { TaskMigration } from '../utils/migration.js';

/**
 * Task Creation Service
 * 
 * Centralizes task creation logic with queue management, file sync, and context injection.
 */
export class TaskCreationService {
  private queueManager: TaskQueueManager;
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
    contextInjector: ContextInjector,
    roleSystem: RoleSystem,
    ruleManager: RuleManager,
    migration: TaskMigration,
    contextDir: string,
    taskFile: string,
    syncFileFromQueueFn: (queueTask: any, preserveFields: string[]) => Promise<void>
  ) {
    this.queueManager = queueManager;
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
   * Create a new task
   * 
   * @requirement REQ-V2-003 - Task management CRUD operations
   * @requirement REQ-V2-010 - Auto-inject context after command
   * @requirement BUG-FIX-004 - Prevent overwriting existing task
   * @requirement FREE-TIER-001 - Use TaskQueueManager for multi-task support
   * 
   * @param goal Task goal/description
   * @param requirements Optional requirement IDs
   * @param force Force activation if task is queued
   * @returns Created task
   * @throws Error if goal is invalid or task creation fails
   */
  async createTask(goal: string, requirements?: string[], force = false): Promise<Task> {
    const DEBUG = process.env.DEBUG_TASK_MANAGER === 'true';
    
    if (DEBUG) console.log('[DEBUG createTask] Starting, goal:', goal, 'contextDir:', this.contextDir);
    
    await fs.ensureDir(this.contextDir);
    
    // Check and run migration if needed
    await this.ensureMigration();
    
    // BUG-FIX-007: Validate goal quality
    if (!goal || goal.trim().length < 10) {
      throw new Error(
        `Task goal must be at least 10 characters and descriptive.\n\n` +
        `Received: "${goal}"\n` +
        `Length: ${goal?.length || 0} characters\n\n` +
        `Example: "Implement user authentication with JWT"\n` +
        `Bad: "fix bug" (too vague)\n` +
        `Bad: "a" (too short)`
      );
    }
    
    // Allow auto-queue: TaskQueueManager will handle queuing if active task exists
    // Use TaskQueueManager to create task (auto-queues if active task exists)
    if (DEBUG) console.log('[DEBUG createTask] Calling queueManager.createTask...');
    let queueTask;
    try {
      queueTask = await this.queueManager.createTask(goal);
      if (DEBUG) console.log('[DEBUG createTask] queueTask received:', queueTask ? `id=${queueTask.id}, status=${queueTask.status}` : 'UNDEFINED');
    } catch (error) {
      if (DEBUG) console.log('[DEBUG createTask] queueManager.createTask failed:', (error as Error).message);
      throw error;
    }
    
    if (!queueTask) {
      const errorMsg = `queueManager.createTask returned undefined. Goal: "${goal}", contextDir: "${this.contextDir}"`;
      if (DEBUG) console.log('[DEBUG createTask] ERROR:', errorMsg);
      throw new Error(errorMsg);
    }
    
    // If force=true, switch to new task immediately
    if (force && queueTask.status !== 'ACTIVE') {
      // activateTask will deactivate old active task and preserve its state
      const activatedTask = await this.queueManager.activateTask(queueTask.id);
      // Use the activated task
      Object.assign(queueTask, activatedTask);
    }
    
    // Convert queue task to WorkflowEngine Task format for compatibility
    const task: Task = {
      id: queueTask.id,
      goal: queueTask.goal,
      status: queueTask.workflow?.currentState || 'UNDERSTANDING',
      startedAt: queueTask.createdAt,
      roleApprovals: []
    };
    
    if (DEBUG) console.log('[DEBUG createTask] Created task object:', `id=${task.id}, status=${task.status}`);
    
    // Fix 1: Only sync file if task is ACTIVE
    // If QUEUED, don't sync - file will be synced when activated
    if (queueTask.status === 'ACTIVE') {
      if (DEBUG) console.log('[DEBUG createTask] Task is ACTIVE, syncing file...');
      
      // REFACTORED: Update queue task with requirements first, then sync
      // Always set requirements in queue (even if empty array) for consistency
      const queue = await (this.queueManager as any).loadQueue();
      const queueTaskInQueue = queue.tasks.find((t: any) => t.id === queueTask.id);
      if (queueTaskInQueue) {
        (queueTaskInQueue as any).requirements = requirements || [];
        await (this.queueManager as any).saveQueue(queue);
        // Update local reference - IMPORTANT: Update queueTask object that will be synced
        (queueTask as any).requirements = requirements || [];
      } else {
        // If not found in queue, still set on queueTask for sync
        (queueTask as any).requirements = requirements || [];
      }
      
      // REFACTORED: Use TaskFileSync to sync (removed redundant write)
      // Don't preserve requirements - always sync from queue
      await this.syncFileFromQueue(queueTask, []);
      
      if (DEBUG) console.log('[DEBUG createTask] File synced successfully');
    } else {
      if (DEBUG) console.log('[DEBUG createTask] Task is QUEUED, skipping file sync');
    }
    
    if (DEBUG) console.log('[DEBUG createTask] Task file written, verifying...');
    const fileExists = await fs.pathExists(this.taskFile);
    if (DEBUG) console.log('[DEBUG createTask] Task file exists:', fileExists);
    
    // Activate roles based on task context
    const activeRoles = this.roleSystem.getActiveRoles({
      taskGoal: goal,
      linkedRequirements: requirements?.map(id => ({ id }))
    });
    
    // Load local rules (v3.0.3)
    const localRules = await this.ruleManager.getRules();
    
    // Auto-inject context for AI
    // Cursor Integration: Updates STATUS.txt and NEXT_STEPS.md that Cursor reads
    if (DEBUG) console.log('[DEBUG createTask] Updating context...');
    try {
      await this.contextInjector.updateAfterCommand('task.create', {
        task,
        warnings: [],
        blockers: [],
        activeRoles,
        localRules  // v3.0.3 - Include project rules
      });
      if (DEBUG) console.log('[DEBUG createTask] Context updated successfully');
    } catch (error) {
      if (DEBUG) console.log('[DEBUG createTask] Context update failed (non-fatal):', (error as Error).message);
      // Don't throw - context update failure shouldn't prevent task creation
    }
    
    if (DEBUG) console.log('[DEBUG createTask] Returning task:', `id=${task.id}`);
    return task;
  }
}


