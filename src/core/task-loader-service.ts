/**
 * Task Loader Service - Centralized task loading logic
 * 
 * REFACTORED: Extracted from TaskManager.loadTaskForStateUpdate() for Phase 3.
 * Handles loading tasks from queue (preferred) or file (fallback).
 * Includes retry logic for timing issues.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Extract orchestration services
 */

import fs from 'fs-extra';
import { normalizeState, type WorkflowState } from '@shadel/workflow-core';
import { TaskQueueManager } from './task-queue.js';

/**
 * Task loading result
 */
export interface TaskLoadResult {
  activeQueueTask: any;
  fileTaskData: any;
  validationData: any;
  currentState: WorkflowState;
  taskId: string;
  taskData: any;
}

/**
 * Task Loader Service
 * 
 * Centralizes task loading logic with retry and fallback mechanisms.
 */
export class TaskLoaderService {
  private queueManager: TaskQueueManager;
  private taskFile: string;

  constructor(queueManager: TaskQueueManager, taskFile: string) {
    this.queueManager = queueManager;
    this.taskFile = taskFile;
  }

  /**
   * Load task data for state update operation
   * 
   * Handles loading task from queue (preferred) or file (fallback).
   * Includes retry logic for timing issues.
   * 
   * @returns Object containing activeQueueTask, fileTaskData, validationData, currentState, taskId, taskData
   * @throws Error if no active task found
   */
  async loadTaskForStateUpdate(): Promise<TaskLoadResult> {
    // Try to get active task from queue first
    let activeQueueTask = await this.queueManager.getActiveTask();

    // CRITICAL: For history validation, always check the actual file if it exists
    // This ensures we catch manual file corruption (tests, manual edits, etc.)
    let fileTaskData: any = null;
    if (await fs.pathExists(this.taskFile)) {
      try {
        fileTaskData = await fs.readJson(this.taskFile);
      } catch (error) {
        // File exists but can't be read - will use queue data
      }
    }

    // FIX: Retry queue read if queue is null but file exists (handles timing issues)
    // This ensures we don't fail when queue write hasn't completed yet
    // Also handle case where file was manually updated (tests, etc.)
    if (!activeQueueTask && fileTaskData) {
      // Small delay to allow queue write to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      activeQueueTask = await this.queueManager.getActiveTask();
      
      // FIX: If queue still doesn't have task but file does, try to reload from file
      // This handles cases where file was manually updated (tests, etc.)
      if (!activeQueueTask && fileTaskData.taskId) {
        // Try to get task from queue by ID
        const queue = await (this.queueManager as any).loadQueue();
        activeQueueTask = queue.tasks.find((t: any) => t.id === fileTaskData.taskId);
        
        // If found, ensure it's set as active
        if (activeQueueTask && queue.activeTaskId !== fileTaskData.taskId) {
          queue.activeTaskId = fileTaskData.taskId;
          activeQueueTask.status = 'ACTIVE';
          await (this.queueManager as any).saveQueue(queue);
        }
      }
    }
    
    // CRITICAL: For validation, ALWAYS prefer file data to catch manual corruption
    // File data is the source of truth for validation (may be manually corrupted)
    // Queue data is used for operations, but file data is used for validation
    let validationData: any = null;
    let currentState: WorkflowState = 'UNDERSTANDING'; // Default, will be set from file or queue
    let taskId: string | null = null;
    let taskData: any;
    
    // ALWAYS use file data for validation if it exists (may be corrupted)
    // This is critical to catch manual file edits BEFORE they cause issues
    if (fileTaskData && fileTaskData.workflow) {
      // File exists and has workflow - use it for validation (may be corrupted)
      validationData = fileTaskData;
      currentState = normalizeState(fileTaskData.workflow.currentState) || 'UNDERSTANDING';
      taskId = fileTaskData.taskId;
    }
    
    // FIX: Try queue first (preferred), then file (fallback), then error
    if (activeQueueTask) {
      // Use queue system for operations (preferred)
      taskId = activeQueueTask.id;
      
      // FIX: Preserve existing fields from file (requirements, startedAt, etc.)
      // Start with file data if available, then merge queue data
      const existingTaskData = fileTaskData || {};
      taskData = {
        ...existingTaskData, // Preserve all existing fields
        taskId: activeQueueTask.id,
        originalGoal: activeQueueTask.goal,
        workflow: activeQueueTask.workflow || existingTaskData.workflow || {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: new Date().toISOString(),
          stateHistory: []
        }
      };
      
      // If we don't have file data for validation, use queue data
      if (!validationData) {
        validationData = taskData;
        currentState = normalizeState(taskData.workflow.currentState) || 'UNDERSTANDING';
      }
    } else if (fileTaskData) {
      // Fallback to file format (backward compatibility)
      taskData = fileTaskData;
      taskId = taskData.taskId;
      
      // Use file data for validation
      if (!validationData) {
        validationData = fileTaskData;
        currentState = normalizeState(fileTaskData.workflow?.currentState) || 'UNDERSTANDING';
      }
    } else {
      // Both queue and file are missing - cannot proceed
      throw new Error('No active task to update state');
    }
    
    return {
      activeQueueTask,
      fileTaskData,
      validationData,
      currentState,
      taskId: taskId!,
      taskData
    };
  }
}


