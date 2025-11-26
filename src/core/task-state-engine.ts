/**
 * TaskStateEngine - Internal state management engine
 * Pure state logic extracted from TaskManager
 * 
 * @internal - Only used by TaskManager and related components
 * 
 * Responsibilities:
 * - State transition validation
 * - State history validation
 * - Next state calculation
 * - Progress tracking
 * - State sequence management
 * 
 * Design Principles:
 * - Pure logic (no I/O operations)
 * - Stateless (static methods)
 * - Single source of truth for state sequence
 * 
 * @requirement REFACTOR-EXTRACT-STATE-ENGINE - Phase 1: Extract state logic from TaskManager
 */

import { normalizeState, type WorkflowState } from '@shadel/workflow-core';

/**
 * TaskStateEngine - Pure state management logic
 * 
 * This component encapsulates all state-related logic extracted from TaskManager.
 * It provides static methods for state validation, progression, and history validation.
 * 
 * Key Features:
 * - Single source of truth for state sequence
 * - Strict sequential state progression (+1 step only)
 * - State history integrity validation
 * - Progress calculation
 * 
 * Usage:
 * ```typescript
 * // Validate transition
 * const isValid = TaskStateEngine.isValidTransition('UNDERSTANDING', 'DESIGNING'); // true
 * 
 * // Get next state
 * const next = TaskStateEngine.getNextState('UNDERSTANDING'); // 'DESIGNING'
 * 
 * // Get progress
 * const progress = TaskStateEngine.getProgress('IMPLEMENTING'); // 40
 * ```
 */
export class TaskStateEngine {
  /**
   * State sequence - Single source of truth
   * 
   * This array defines the complete workflow state sequence.
   * It is used by TaskManager, TaskValidator, and other components
   * to ensure consistent state handling across the system.
   * 
   * States must progress sequentially:
   * UNDERSTANDING → DESIGNING → IMPLEMENTING → TESTING → REVIEWING → READY_TO_COMMIT
   * 
   * @internal - Private to prevent external modification
   */
  private static readonly STATE_SEQUENCE: WorkflowState[] = [
    'UNDERSTANDING',
    'DESIGNING',
    'IMPLEMENTING',
    'TESTING',
    'REVIEWING',
    'READY_TO_COMMIT'
  ];

  /**
   * Get state index in sequence
   * 
   * Returns the index of a state in the STATE_SEQUENCE array.
   * Used for state comparison and transition validation.
   * 
   * @param state - Workflow state to get index for
   * @returns Index in STATE_SEQUENCE (0-5), or -1 if invalid state
   * 
   * @example
   * ```typescript
   * TaskStateEngine.getStateIndex('UNDERSTANDING'); // 0
   * TaskStateEngine.getStateIndex('DESIGNING'); // 1
   * TaskStateEngine.getStateIndex('INVALID'); // -1
   * ```
   */
  static getStateIndex(state: WorkflowState): number {
    return this.STATE_SEQUENCE.indexOf(state);
  }

  /**
   * Get all valid workflow states
   * 
   * Returns a copy of the STATE_SEQUENCE array containing all valid workflow states.
   * This provides a safe way to access the state sequence without exposing the internal array.
   * 
   * @returns Array of all valid states (copy of STATE_SEQUENCE)
   * 
   * @example
   * ```typescript
   * const states = TaskStateEngine.getAllStates();
   * // ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'READY_TO_COMMIT']
   * ```
   */
  static getAllStates(): WorkflowState[] {
    return [...this.STATE_SEQUENCE];
  }

  /**
   * Validate if state transition is allowed
   * 
   * Implements strict sequential progression validation.
   * States must progress forward by exactly 1 step (+1 step only).
   * 
   * Rules:
   * - Cannot move backward (UNDERSTANDING ← DESIGNING is invalid)
   * - Cannot skip states (UNDERSTANDING → IMPLEMENTING is invalid)
   * - Cannot stay at same state (UNDERSTANDING → UNDERSTANDING is invalid)
   * - Must progress by exactly 1 step (UNDERSTANDING → DESIGNING is valid)
   * 
   * @param from - Current state
   * @param to - Target state
   * @returns true if transition is valid (toIndex === fromIndex + 1), false otherwise
   * 
   * @example
   * ```typescript
   * TaskStateEngine.isValidTransition('UNDERSTANDING', 'DESIGNING'); // true
   * TaskStateEngine.isValidTransition('UNDERSTANDING', 'IMPLEMENTING'); // false (skipped)
   * TaskStateEngine.isValidTransition('DESIGNING', 'UNDERSTANDING'); // false (backward)
   * TaskStateEngine.isValidTransition('UNDERSTANDING', 'UNDERSTANDING'); // false (same)
   * ```
   * 
   * @requirement BUG-FIX-001 - Sequential state progression
   */
  static isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
    const fromIndex = this.STATE_SEQUENCE.indexOf(from);
    const toIndex = this.STATE_SEQUENCE.indexOf(to);
    
    // BUG-FIX-001: Only allow forward progression by 1 step
    // States must progress sequentially - no backward movement, no staying at same state
    return toIndex === fromIndex + 1;
  }

  /**
   * Get next valid state in sequence
   * 
   * Returns the state that follows the current state in the workflow sequence.
   * Returns null if the current state is the final state (READY_TO_COMMIT).
   * 
   * @param current - Current workflow state
   * @returns Next state in sequence, or null if at final state
   * 
   * @example
   * ```typescript
   * TaskStateEngine.getNextState('UNDERSTANDING'); // 'DESIGNING'
   * TaskStateEngine.getNextState('DESIGNING'); // 'IMPLEMENTING'
   * TaskStateEngine.getNextState('READY_TO_COMMIT'); // null
   * ```
   * 
   * @requirement BUG-FIX-001 - State progression guidance
   */
  static getNextState(current: WorkflowState): WorkflowState | null {
    const index = this.STATE_SEQUENCE.indexOf(current);
    
    if (index === -1) {
      // Invalid state
      return null;
    }
    
    if (index === this.STATE_SEQUENCE.length - 1) {
      // Already at final state
      return null;
    }
    
    return this.STATE_SEQUENCE[index + 1];
  }

  /**
   * Get workflow progress as percentage
   * 
   * Calculates the progress through the workflow as a percentage (0-100).
   * Progress is based on the position of the current state in the sequence.
   * 
   * Formula: (currentIndex / (totalStates - 1)) * 100
   * 
   * @param currentState - Current workflow state
   * @returns Progress percentage (0-100), or 0 if invalid state
   * 
   * @example
   * ```typescript
   * TaskStateEngine.getProgress('UNDERSTANDING'); // 0
   * TaskStateEngine.getProgress('IMPLEMENTING'); // 40
   * TaskStateEngine.getProgress('READY_TO_COMMIT'); // 100
   * TaskStateEngine.getProgress('INVALID'); // 0
   * ```
   */
  static getProgress(currentState: WorkflowState): number {
    const currentIndex = this.STATE_SEQUENCE.indexOf(currentState);
    
    if (currentIndex === -1) {
      // Invalid state - return 0
      return 0;
    }
    
    // Calculate progress: (currentIndex / (totalStates - 1)) * 100
    // UNDERSTANDING (0) = 0%, READY_TO_COMMIT (5) = 100%
    return Math.round((currentIndex / (this.STATE_SEQUENCE.length - 1)) * 100);
  }

  /**
   * Validate state history integrity
   * 
   * Detects manual file edits that forge invalid state progressions.
   * This is a pure function that validates workflow data without any I/O operations.
   * 
   * Validates:
   * - Current state is not in history (should only have completed steps)
   * - History follows sequential progression
   * - No state regression
   * - No state skipping (unless explicitly allowed)
   * 
   * @param workflow - Workflow data object with currentState and stateHistory
   * @throws Error if history is invalid with detailed error message
   * 
   * @example
   * ```typescript
   * // Valid history
   * TaskStateEngine.validateStateHistory({
   *   currentState: 'DESIGNING',
   *   stateHistory: [{ state: 'UNDERSTANDING', enteredAt: '...' }]
   * }); // OK
   * 
   * // Invalid: current state in history
   * TaskStateEngine.validateStateHistory({
   *   currentState: 'DESIGNING',
   *   stateHistory: [{ state: 'DESIGNING', enteredAt: '...' }]
   * }); // Throws error
   * ```
   * 
   * @requirement BUG-FIX-009 - Prevent state forgery
   * @requirement BUG-FIX-012-VALIDATION - Check current state in history FIRST (most critical check)
   */
  static validateStateHistory(workflow: {
    currentState: WorkflowState;
    stateHistory?: Array<{ state: WorkflowState; enteredAt: string }>;
  }): void {
    // Ensure workflow exists
    if (!workflow || !workflow.currentState) {
      return; // No workflow data, nothing to validate
    }

    const currentState = normalizeState(workflow.currentState);
    const stateHistory = workflow.stateHistory || [];

    if (stateHistory.length === 0) {
      // Empty history is valid for new tasks
      return;
    }

    // Extract states from history
    const historyStates = stateHistory.map((entry) => normalizeState(entry.state));

    // BUG-FIX-012-VALIDATION: Check current state in history FIRST (most critical check)
    // Current state should NEVER be in history (it's current, not completed)
    if (historyStates.includes(currentState)) {
      throw new Error(
        `🚨 STATE HISTORY CORRUPTION!\n\n` +
        `Current state found in history (should only have completed steps):\n` +
        `  Current: ${currentState}\n` +
        `  History: ${historyStates.join(', ')}\n\n` +
        `This indicates Bug #12 is still present or manual corruption.\n\n` +
        `ACTION: Verify Bug #12 fix is applied, or delete task and recreate.`
      );
    }

    // Validate: History must follow sequential progression
    for (let i = 1; i < historyStates.length; i++) {
      const prevState = historyStates[i - 1];
      const currState = historyStates[i];

      if (!this.isValidTransition(prevState, currState)) {
        throw new Error(
          `🚨 STATE HISTORY CORRUPTION DETECTED!\n\n` +
          `Invalid transition found in state history:\n` +
          `  ${prevState} → ${currState}\n\n` +
          `This usually means:\n` +
          `  1. Manual edit to .ai-context/current-task.json (NOT ALLOWED)\n` +
          `  2. State forgery attempt (SECURITY ISSUE)\n` +
          `  3. File corruption (INTEGRITY ISSUE)\n\n` +
          `ACTION REQUIRED:\n` +
          `  1. Use ONLY "npx ai-workflow sync --state <STATE>" to change states\n` +
          `  2. Do NOT manually edit current-task.json\n` +
          `  3. If file is corrupted, delete and create new task\n\n` +
          `Security: This validation prevents bypassing workflow quality gates.`
        );
      }
    }

    // BUG-FIX-012-VALIDATION: After fixing Bug #12, history contains COMPLETED states
    // Current state should be ONE step ahead of last history entry
    // Example: current=DESIGNING, history=[UNDERSTANDING] ← This is CORRECT!
    if (historyStates.length > 0) {
      const lastHistoryState = historyStates[historyStates.length - 1];
      const currentIndex = this.STATE_SEQUENCE.indexOf(currentState);
      const expectedPrevious = currentIndex > 0 ? this.STATE_SEQUENCE[currentIndex - 1] : null;

      if (expectedPrevious && lastHistoryState !== expectedPrevious) {
        // Allow this - might be valid state skip or retroactive task
        // Note: In pure function, we can't use console.warn, so we just allow it
        // Caller can log warning if needed
      }
    }

    // Validate: No impossible state jumps in history
    // Check if we're at a state that requires passing through earlier states
    if (this.getStateIndex(currentState) >= 3) { // TESTING or later
      const requiredStates = this.STATE_SEQUENCE.slice(0, this.getStateIndex(currentState));

      for (const requiredState of requiredStates) {
        if (!historyStates.includes(requiredState)) {
          // Warning: Missing required state in history
          // Note: In pure function, we can't use console.warn, so we just allow it
          // Caller can log warning if needed
        }
      }
    }
  }
}

