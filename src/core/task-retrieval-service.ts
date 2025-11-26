/**
 * Task Retrieval Service - Centralized task retrieval logic
 * 
 * REFACTORED: Extracted from TaskManager.getCurrentTask() for Phase 4.
 * Handles retrieving current task from queue (preferred) or file (fallback).
 * Includes retry logic, file sync, validation, and backward compatibility.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-TASK-CRUD-SERVICES - Phase 4: Extract Task CRUD Services
 */

import fs from 'fs-extra';
import type { Task, WorkflowState } from '@shadel/workflow-core';
import { TaskQueueManager } from './task-queue.js';
import { TaskFileSync } from './task-file-sync.js';
import { TaskValidator } from './task-validator.js';
import { TaskMigration } from '../utils/migration.js';

/**
 * Task Retrieval Service
 * 
 * Centralizes task retrieval logic with queue/file sync, validation, and backward compatibility.
 */
export class TaskRetrievalService {
  private queueManager: TaskQueueManager;
  private fileSync: TaskFileSync;
  private validator: TaskValidator;
  private migration: TaskMigration;
  private taskFile: string;
  private migrationChecked: boolean = false;
  private syncFileFromQueue: (queueTask: any, preserveFields: string[]) => Promise<void>;

  constructor(
    queueManager: TaskQueueManager,
    fileSync: TaskFileSync,
    validator: TaskValidator,
    migration: TaskMigration,
    taskFile: string,
    syncFileFromQueueFn: (queueTask: any, preserveFields: string[]) => Promise<void>
  ) {
    this.queueManager = queueManager;
    this.fileSync = fileSync;
    this.validator = validator;
    this.migration = migration;
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
   * Get current active task
   * 
   * Retrieves task from queue (preferred) or file (fallback).
   * Handles queue/file sync, validation, and backward compatibility.
   * 
   * @returns Current task or null if no active task
   * @throws Error if task loading fails
   */
  async getCurrentTask(): Promise<Task | null> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // DEBUG: Log getCurrentTask call
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] getCurrentTask() called');
    }
    
    // Try to get active task from queue system first
    let activeQueueTask = await this.queueManager.getActiveTask();
    
    // DEBUG: Log queue task result
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] getCurrentTask() - activeQueueTask:', activeQueueTask ? `Found: ${activeQueueTask.id}` : 'null');
    }
    
    // FIX: Retry queue read if queue is null but file exists (handles timing issues)
    // This ensures we don't fail when queue write hasn't completed yet
    if (!activeQueueTask && await fs.pathExists(this.taskFile)) {
      // DEBUG: Log retry attempt
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - Retrying queue read, file exists');
      }
      
      // Use setImmediate instead of setTimeout for faster retry
      await new Promise(resolve => setImmediate(resolve));
      activeQueueTask = await this.queueManager.getActiveTask();
      
      // DEBUG: Log retry result
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - After retry, activeQueueTask:', activeQueueTask ? `Found: ${activeQueueTask.id}` : 'null');
      }
      
      // FIX: If queue still doesn't have task but file does, try to reload from file
      // This handles cases where file was manually updated (tests, etc.)
      if (!activeQueueTask) {
        try {
          const fileTaskData = await fs.readJson(this.taskFile);
          if (fileTaskData.taskId && fileTaskData.status !== 'completed') {
            // DEBUG: Log file task data found
            if (process.env.DEBUG_TASK_MANAGER) {
              console.log('[DEBUG] getCurrentTask() - File task found, taskId:', fileTaskData.taskId);
            }
            
            // Try to get task from queue by ID
            const queue = await (this.queueManager as any).loadQueue();
            activeQueueTask = queue.tasks.find((t: any) => t.id === fileTaskData.taskId);
            
            // DEBUG: Log queue lookup result
            if (process.env.DEBUG_TASK_MANAGER) {
              console.log('[DEBUG] getCurrentTask() - Queue lookup, found:', activeQueueTask ? 'yes' : 'no');
            }
            
            // SECURITY FIX: Don't fix queue from file (P0 security issue)
            // If queue and file are out of sync, validate file data first
            if (activeQueueTask && queue.activeTaskId !== fileTaskData.taskId) {
              // Validate file data before trusting it
              try {
                const validation = await this.validator.validateStateHistory(fileTaskData);
                if (!validation.valid) {
                  // File data is invalid, don't trust it
                  console.warn(`⚠️  File data validation failed: ${validation.error}. Not fixing queue from file.`);
                  activeQueueTask = null; // Don't use corrupted file data
                } else {
                  // File data is valid, but still don't auto-fix queue (security risk)
                  // Let user manually fix or sync from queue
                  console.warn(`⚠️  Queue and file out of sync. Use 'npx ai-workflow sync' to fix.`);
                }
              } catch (error) {
                // Validation failed, don't trust file
                console.warn(`⚠️  File validation error: ${(error as Error).message}. Not fixing queue from file.`);
                activeQueueTask = null;
              }
            } else if (!activeQueueTask) {
              // DEBUG: Log task not in queue
              if (process.env.DEBUG_TASK_MANAGER) {
                console.log('[DEBUG] getCurrentTask() - Task not found in queue, will fallback to file');
              }
            }
          }
        } catch (error) {
          // DEBUG: Log file read error
          if (process.env.DEBUG_TASK_MANAGER) {
            console.log('[DEBUG] getCurrentTask() - File read failed:', (error as Error).message);
          }
          // File read failed, continue with null
        }
      }
    }
    
    if (activeQueueTask) {
      const DEBUG = process.env.DEBUG_TASK_MANAGER === 'true' || process.env.DEBUG_TASK_FILE_SYNC === 'true';
      
      if (DEBUG) {
        console.log('[DEBUG TaskManager.getCurrentTask] Active queue task:', {
          id: activeQueueTask.id,
          goal: activeQueueTask.goal,
          status: activeQueueTask.status
        });
      }
      
      // REFACTORED: Use content-based detection instead of timestamp
      if (await fs.pathExists(this.taskFile)) {
        try {
          // Read file first to check taskId match
          const fileData = await fs.readJson(this.taskFile);
          
          // TRACK: Log taskId comparison
          const TRACK = process.env.TRACK_TASK_ID === 'true';
          if (TRACK) {
            console.log('[TRACK TaskManager.getCurrentTask] Comparing taskIds - File:', fileData.taskId, 'Queue:', activeQueueTask.id);
          }
          
          // CRITICAL FIX: Only sync if file taskId doesn't match queue taskId
          // If they match, file is already correct (no need to sync)
          if (fileData.taskId !== activeQueueTask.id) {
            if (TRACK) {
              console.log('[TRACK TaskManager.getCurrentTask] ⚠️ File taskId MISMATCH! File:', fileData.taskId, 'Queue:', activeQueueTask.id, '- Will sync from queue');
            }
            if (DEBUG) {
              console.log('[DEBUG TaskManager.getCurrentTask] File taskId mismatch, syncing from queue:', {
                fileTaskId: fileData.taskId,
                queueTaskId: activeQueueTask.id
              });
            }
            // File has different task - sync from queue
            await this.fileSync.backupFile();
            await this.syncFileFromQueue(activeQueueTask, ['requirements']);
            
            if (TRACK) {
              // Verify after sync
              const fileDataAfterSync = await fs.readJson(this.taskFile);
              console.log('[TRACK TaskManager.getCurrentTask] File taskId AFTER sync:', fileDataAfterSync.taskId, 'Expected:', activeQueueTask.id);
            }
          } else {
            if (TRACK) {
              console.log('[TRACK TaskManager.getCurrentTask] ✓ File taskId matches queue, no sync needed');
            }
            // File taskId matches queue - check for manual edit (content changes)
            const manualEditDetected = await this.fileSync.detectManualEdit(activeQueueTask);
            
            if (manualEditDetected) {
              if (DEBUG) {
                console.log('[DEBUG TaskManager.getCurrentTask] Manual edit detected (same taskId), syncing from queue');
              }
              console.warn('⚠️  Warning: current-task.json was manually edited. Syncing from queue...');
              // Backup before sync
              await this.fileSync.backupFile();
              await this.syncFileFromQueue(activeQueueTask, ['requirements']);
            } else {
              // File matches queue - validate consistency
              const validation = await this.validator.validateBoth(activeQueueTask, fileData);
              
              if (!validation.valid) {
                if (DEBUG) {
                  console.log('[DEBUG TaskManager.getCurrentTask] Validation failed, syncing from queue:', {
                    queueTaskId: activeQueueTask.id,
                    fileTaskId: fileData.taskId,
                    error: validation.error
                  });
                }
                console.error(`❌ Validation failed: ${validation.error}`);
                // Auto-fix: sync from queue
                await this.fileSync.backupFile();
                await this.syncFileFromQueue(activeQueueTask, ['requirements']);
              }
            }
          }
        } catch (error) {
          // If file read fails, continue with queue task (non-fatal)
          if (DEBUG) {
            console.log('[DEBUG] getCurrentTask() - File read failed during manual edit check:', (error as Error).message);
          }
        }
      } else {
        // File doesn't exist but queue has task - sync file
        if (DEBUG) {
          console.log('[DEBUG TaskManager.getCurrentTask] File doesn\'t exist, syncing from queue');
        }
        await this.syncFileFromQueue(activeQueueTask, ['requirements']);
      }
      
      // DEBUG: Log returning queue task
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - Returning queue task:', activeQueueTask.id, 'state:', activeQueueTask.workflow?.currentState);
      }
      
      // BUG-FIX-011: Don't return completed tasks as "current"
      // A completed task should not be considered active
      // Check both queue task status (DONE for queue) and completedAt field
      if (activeQueueTask.status === 'DONE' || 
          activeQueueTask.completedAt) {
        if (process.env.DEBUG_TASK_MANAGER) {
          console.log('[DEBUG] getCurrentTask() - Queue task is completed, returning null');
        }
        return null;
      }
      
      return {
        id: activeQueueTask.id,
        goal: activeQueueTask.goal,
        status: activeQueueTask.workflow?.currentState || 'UNDERSTANDING',
        startedAt: activeQueueTask.createdAt,
        completedAt: activeQueueTask.completedAt,
        roleApprovals: []
      };
    }
    
    // Fallback to old format for backward compatibility
    if (!await fs.pathExists(this.taskFile)) {
      // DEBUG: Log no file
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - No task file, returning null');
      }
      return null;
    }

    try {
      const taskData = await fs.readJson(this.taskFile);
      
      // DEBUG: Log file task
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - Returning file task:', taskData.taskId, 'state:', taskData.workflow?.currentState);
      }
      
      // BUG-FIX-011: Don't return completed tasks as "current"
      // A completed task should not be considered active
      // Check both status field and completedAt field
      if (taskData.status === 'completed' || taskData.completedAt) {
        return null;
      }
      
      return {
        id: taskData.taskId,
        goal: taskData.originalGoal,
        status: taskData.workflow?.currentState || 'UNDERSTANDING',
        startedAt: taskData.startedAt,
        completedAt: taskData.completedAt,
        roleApprovals: []
      };
    } catch (error) {
      throw new Error(`Failed to load task: ${error}`);
    }
  }
}

