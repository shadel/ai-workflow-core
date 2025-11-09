/**
 * StateMachine - Pure workflow state management
 * Extracted from v1.x for @workflow/core package
 * @requirement REQ-V2-002
 */
export class StateMachine {
    currentState = 'UNDERSTANDING';
    WORKFLOW_STEPS = [
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
    getCurrentState() {
        return this.currentState;
    }
    /**
     * Set state (with validation)
     * @requirement REQ-V2-002 - State transitions with validation
     */
    setState(state) {
        if (!this.canTransitionTo(state)) {
            throw new Error(`Invalid state transition: ${this.currentState} -> ${state}`);
        }
        this.currentState = state;
    }
    /**
     * Check if transition is valid
     * @requirement REQ-V2-002 - State transition validation
     */
    canTransitionTo(targetState) {
        const currentIndex = this.WORKFLOW_STEPS.indexOf(this.currentState);
        const targetIndex = this.WORKFLOW_STEPS.indexOf(targetState);
        // Can move forward or stay same
        return targetIndex >= currentIndex;
    }
    /**
     * Get next state
     * @requirement REQ-V2-002 - Workflow progression
     */
    getNextState() {
        const currentIndex = this.WORKFLOW_STEPS.indexOf(this.currentState);
        if (currentIndex === this.WORKFLOW_STEPS.length - 1) {
            return null; // Already at final state
        }
        return this.WORKFLOW_STEPS[currentIndex + 1];
    }
    /**
     * Check if at final state
     */
    isComplete() {
        return this.currentState === 'COMMIT_READY';
    }
    /**
     * Reset to initial state
     */
    reset() {
        this.currentState = 'UNDERSTANDING';
    }
    /**
     * Get all workflow steps
     */
    getAllSteps() {
        return [...this.WORKFLOW_STEPS];
    }
    /**
     * Get progress percentage (0-100)
     */
    getProgress() {
        const currentIndex = this.WORKFLOW_STEPS.indexOf(this.currentState);
        return Math.round((currentIndex / (this.WORKFLOW_STEPS.length - 1)) * 100);
    }
    /**
     * Get state index
     */
    getStateIndex(state) {
        return this.WORKFLOW_STEPS.indexOf(state);
    }
}
//# sourceMappingURL=state-machine.js.map