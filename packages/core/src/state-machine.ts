/**
 * StateMachine - Pure workflow state management
 * Extracted from v1.x for @workflow/core package
 * @requirement REQ-V2-002
 */

import { WorkflowState } from './types.js';

export class StateMachine {
  private currentState: WorkflowState = 'UNDERSTANDING';

  private readonly WORKFLOW_STEPS: WorkflowState[] = [
    'UNDERSTANDING',
    'DESIGN_COMPLETE',
    'IMPLEMENTATION_COMPLETE',
    'TESTING_COMPLETE',
    'REVIEW_COMPLETE',
    'COMMIT_READY',
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
   * @requirement REQ-V2-002 - State transitions with validation
   */
  setState(state: WorkflowState): void {
    if (!this.canTransitionTo(state)) {
      throw new Error(`Invalid state transition: ${this.currentState} -> ${state}`);
    }

    this.currentState = state;
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
    return this.currentState === 'COMMIT_READY';
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

