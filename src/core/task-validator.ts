/**
 * Task Validator - Validation logic for task operations
 * @requirement REQ-V2-003 - Task validation
 * 
 * Provides validation for:
 * - State transitions
 * - State history integrity
 * - Queue and file consistency
 */

import { normalizeState, type WorkflowState } from '@shadel/workflow-core';
import type { Task as QueueTask } from './task-queue.js';
import type { TaskFileData } from './task-file-sync.js';
import { TaskStateEngine } from './task-state-engine.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  source?: 'queue' | 'file';
}

/**
 * Task Validator - Validation logic for task operations
 * 
 * Responsibilities:
 * - Validate state transitions
 * - Validate state history integrity
 * - Validate queue and file consistency
 */
export class TaskValidator {
  /**
   * Valid state transitions map
   */
  private readonly validTransitions: Map<WorkflowState, WorkflowState[]> = new Map([
    ['UNDERSTANDING', ['DESIGNING']],
    ['DESIGNING', ['IMPLEMENTING']],
    ['IMPLEMENTING', ['TESTING']],
    ['TESTING', ['REVIEWING']],
    ['REVIEWING', ['READY_TO_COMMIT']],
    ['READY_TO_COMMIT', []] // Terminal state
  ]);

  // REFACTORED: Use TaskStateEngine for state sequence (single source of truth)
  // Removed stateSequence duplication - using TaskStateEngine.getAllStates() instead

  /**
   * Validate state transition
   * 
   * @param currentState - Current workflow state
   * @param newState - New workflow state
   * @throws Error if transition is invalid
   */
  async validateStateTransition(
    currentState: WorkflowState,
    newState: WorkflowState
  ): Promise<void> {
    const normalizedCurrent = normalizeState(currentState);
    const normalizedNew = normalizeState(newState);

    // Check if transition is valid
    const validTransitions = this.validTransitions.get(normalizedCurrent) || [];

    if (!validTransitions.includes(normalizedNew)) {
      const validList = validTransitions.length > 0 
        ? validTransitions.join(', ')
        : 'none (terminal state)';
      
      throw new Error(
        `Invalid state transition: ${normalizedCurrent} → ${normalizedNew}\n` +
        `Valid transitions from ${normalizedCurrent}: ${validList}`
      );
    }
  }

  /**
   * Validate state history integrity
   * 
   * Checks for:
   * - State regression (going backwards)
   * - State skipping (unless explicitly allowed)
   * - Invalid states in history
   * 
   * @param task - Task from queue or file
   * @returns Validation result
   */
  async validateStateHistory(
    task: QueueTask | TaskFileData
  ): Promise<ValidationResult> {
    const workflow = (task as QueueTask).workflow || (task as TaskFileData).workflow;
    
    if (!workflow) {
      return { valid: false, error: 'No workflow data' };
    }

    const currentState = normalizeState(workflow.currentState);
    const history = workflow.stateHistory || [];

    // REFACTORED: Use TaskStateEngine for state sequence
    const stateSequence = TaskStateEngine.getAllStates();
    
    // Validate current state is in sequence
    if (TaskStateEngine.getStateIndex(currentState) === -1) {
      return {
        valid: false,
        error: `Invalid current state: ${currentState}`
      };
    }

    // Validate state sequence
    if (history.length > 0) {
      const lastHistoryState = history[history.length - 1].state;
      const normalizedLast = normalizeState(lastHistoryState);
      const currentIndex = TaskStateEngine.getStateIndex(currentState);
      const lastIndex = TaskStateEngine.getStateIndex(normalizedLast);

      // Check for state mismatch (currentState ≠ last history state)
      // This is a critical corruption indicator - current state should be next after last history
      // Exception: If current state is same as last history, that's also corruption (state should not be in history)
      if (currentState === normalizedLast) {
        // Current state is in history - this is corruption
        return {
          valid: false,
          error: `🚨 STATE HISTORY CORRUPTION!\n\nCurrent state found in history: currentState=${currentState} is in history (corruption!)\n\nThis indicates the state history may have been manually edited or corrupted.`
        };
      }

      // Check if current state is not the next state after last history
      if (currentIndex !== lastIndex + 1) {
        // Check for state regression (security issue)
        if (currentIndex < lastIndex) {
          return {
            valid: false,
            error: `🚨 STATE HISTORY CORRUPTION!\n\nState regression detected: ${normalizedLast} → ${currentState} (security issue)\n\nThis indicates the state history may have been manually edited or corrupted.`
          };
        }

        // Check for large skips (potential forgery)
        // Allow skipping one state (e.g., UNDERSTANDING → IMPLEMENTING) but warn
        if (currentIndex - lastIndex > 1) {
          return {
            valid: false,
            error: `🚨 STATE HISTORY CORRUPTION!\n\nState skip detected: ${normalizedLast} → ${currentState} (potential forgery)\n\nThis indicates the state history may have been manually edited or corrupted.`
          };
        }
      }

      // REFACTORED: Use TaskStateEngine for validation
      // Validate all history states are in sequence
      for (let i = 0; i < history.length; i++) {
        const historyState = normalizeState(history[i].state);
        if (TaskStateEngine.getStateIndex(historyState) === -1) {
          return {
            valid: false,
            error: `🚨 STATE HISTORY CORRUPTION!\n\nInvalid state in history: ${historyState}\n\nThis indicates the state history may have been manually edited or corrupted.`
          };
        }

        // Check history sequence is valid using TaskStateEngine
        if (i > 0) {
          const prevState = normalizeState(history[i - 1].state);
          const prevIndex = TaskStateEngine.getStateIndex(prevState);
          const currIndex = TaskStateEngine.getStateIndex(historyState);

          if (currIndex < prevIndex) {
            return {
              valid: false,
              error: `🚨 STATE HISTORY CORRUPTION!\n\nHistory sequence invalid: ${prevState} → ${historyState}\n\nThis indicates the state history may have been manually edited or corrupted.`
            };
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate both queue and file data
   * 
   * Validates:
   * - Queue data integrity
   * - File data integrity
   * - Consistency between queue and file
   * 
   * @param queueTask - Task from queue
   * @param fileData - Task from file
   * @returns Validation result
   */
  async validateBoth(
    queueTask: QueueTask,
    fileData: TaskFileData
  ): Promise<ValidationResult> {
    // Validate queue
    const queueResult = await this.validateStateHistory(queueTask);
    if (!queueResult.valid) {
      return { ...queueResult, source: 'queue' };
    }

    // Validate file
    const fileResult = await this.validateStateHistory(fileData);
    if (!fileResult.valid) {
      return { ...fileResult, source: 'file' };
    }

    // Validate consistency
    const queueState = normalizeState(queueTask.workflow?.currentState || 'UNDERSTANDING');
    const fileState = normalizeState(fileData.workflow?.currentState || 'UNDERSTANDING');

    if (queueState !== fileState) {
      return {
        valid: false,
        error: `State inconsistency between queue and file: queue=${queueState}, file=${fileState}`
      };
    }

    // Validate taskId consistency
    if (queueTask.id !== fileData.taskId) {
      return {
        valid: false,
        error: `TaskId inconsistency: queue=${queueTask.id}, file=${fileData.taskId}`
      };
    }

    // Validate goal consistency
    if (queueTask.goal !== fileData.originalGoal) {
      return {
        valid: false,
        error: `Goal inconsistency: queue="${queueTask.goal}", file="${fileData.originalGoal}"`
      };
    }

    return { valid: true };
  }

  /**
   * Get valid transitions from a state
   * 
   * @param state - Current state
   * @returns Array of valid next states
   */
  getValidTransitions(state: WorkflowState): WorkflowState[] {
    const normalized = normalizeState(state);
    return this.validTransitions.get(normalized) || [];
  }
}

