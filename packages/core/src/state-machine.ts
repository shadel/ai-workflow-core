/**
 * StateMachine - Pure workflow state management
 * Extracted from v1.x for @workflow/core package
 * @requirement REQ-V2-002
 * @requirement REFACTOR-STATE-NAMES - v3.0 backward compatibility
 */

import { WorkflowState } from './types.js';
import { normalizeState, warnIfLegacy } from './utils/state-mapper.js';

export class StateMachine {
  private currentState: WorkflowState = 'UNDERSTANDING';

  private readonly WORKFLOW_STEPS: WorkflowState[] = [
    'UNDERSTANDING',
    'DESIGNING',              // v3.0: renamed from DESIGNING
    'IMPLEMENTING',           // v3.0: renamed from IMPLEMENTING
    'TESTING',                // v3.0: renamed from TESTING
    'REVIEWING',              // v3.0: renamed from REVIEWING
    'READY_TO_COMMIT',        // v3.0: renamed from READY_TO_COMMIT
  ];

  /**
   * Get current state
   * @requirement REQ-V2-002 - State machine core functionality
   */
  getCurrentState(): WorkflowState {
    return this.currentState;
  }

  /**
   * Set state (with validation)
   * Accepts both legacy (v2.x) and new (v3.0) state names
   * @requirement REQ-V2-002 - State transitions with validation
   * @requirement REFACTOR-STATE-NAMES - Backward compatibility
   */
  setState(state: string): void {
    // Warn if legacy format
    warnIfLegacy(state);
    
    // Normalize to new format
    const normalized = normalizeState(state);
    
    if (!this.canTransitionTo(normalized)) {
      throw new Error(`Invalid state transition: ${this.currentState} -> ${normalized}`);
    }

    this.currentState = normalized;
  }

  /**
   * Check if transition is valid
   * @requirement REQ-V2-002 - State transition validation
   */
  canTransitionTo(targetState: WorkflowState): boolean {
    const currentIndex = this.WORKFLOW_STEPS.indexOf(this.currentState);
    const targetIndex = this.WORKFLOW_STEPS.indexOf(targetState);

    // Can move forward or stay same
    return targetIndex >= currentIndex;
  }

  /**
   * Get next state
   * @requirement REQ-V2-002 - Workflow progression
   */
  getNextState(): WorkflowState | null {
    const currentIndex = this.WORKFLOW_STEPS.indexOf(this.currentState);
    
    if (currentIndex === this.WORKFLOW_STEPS.length - 1) {
      return null; // Already at final state
    }

    return this.WORKFLOW_STEPS[currentIndex + 1];
  }

  /**
   * Check if at final state
   */
  isComplete(): boolean {
    return this.currentState === 'READY_TO_COMMIT';
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentState = 'UNDERSTANDING';
  }

  /**
   * Get all workflow steps
   */
  getAllSteps(): WorkflowState[] {
    return [...this.WORKFLOW_STEPS];
  }

  /**
   * Get progress percentage (0-100)
   */
  getProgress(): number {
    const currentIndex = this.WORKFLOW_STEPS.indexOf(this.currentState);
    return Math.round((currentIndex / (this.WORKFLOW_STEPS.length - 1)) * 100);
  }

  /**
   * Get state index
   */
  getStateIndex(state: WorkflowState): number {
    return this.WORKFLOW_STEPS.indexOf(state);
  }
}

