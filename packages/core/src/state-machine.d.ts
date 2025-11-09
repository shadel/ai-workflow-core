/**
 * StateMachine - Pure workflow state management
 * Extracted from v1.x for @workflow/core package
 * @requirement REQ-V2-002
 */
import { WorkflowState } from './types.js';
export declare class StateMachine {
    private currentState;
    private readonly WORKFLOW_STEPS;
    /**
     * Get current state
     * @requirement REQ-V2-002 - State machine core functionality
     */
    getCurrentState(): WorkflowState;
    /**
     * Set state (with validation)
     * @requirement REQ-V2-002 - State transitions with validation
     */
    setState(state: WorkflowState): void;
    /**
     * Check if transition is valid
     * @requirement REQ-V2-002 - State transition validation
     */
    canTransitionTo(targetState: WorkflowState): boolean;
    /**
     * Get next state
     * @requirement REQ-V2-002 - Workflow progression
     */
    getNextState(): WorkflowState | null;
    /**
     * Check if at final state
     */
    isComplete(): boolean;
    /**
     * Reset to initial state
     */
    reset(): void;
    /**
     * Get all workflow steps
     */
    getAllSteps(): WorkflowState[];
    /**
     * Get progress percentage (0-100)
     */
    getProgress(): number;
    /**
     * Get state index
     */
    getStateIndex(state: WorkflowState): number;
}
//# sourceMappingURL=state-machine.d.ts.map