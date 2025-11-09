/**
 * WorkflowEngine - Core workflow orchestrator
 * Pure implementation without CLI dependencies
 * @requirement REQ-V2-002
 */
import { StateMachine } from './state-machine.js';
export class WorkflowEngine {
    stateMachine;
    currentTask = null;
    config;
    constructor(config) {
        this.stateMachine = new StateMachine();
        this.config = config || {};
    }
    /**
     * Create a new task
     * @requirement REQ-V2-003 - Task management CRUD
     */
    async createTask(goal) {
        const task = {
            id: `task-${Date.now()}`,
            goal,
            status: 'UNDERSTANDING',
            startedAt: new Date().toISOString(),
            roleApprovals: [],
        };
        this.currentTask = task;
        this.stateMachine.setState('UNDERSTANDING');
        if (this.config.onTaskCreate) {
            await this.config.onTaskCreate(task);
        }
        return task;
    }
    /**
     * Get current task
     */
    getCurrentTask() {
        return this.currentTask;
    }
    /**
     * Get current state
     */
    getCurrentState() {
        return this.stateMachine.getCurrentState();
    }
    /**
     * Transition to next state
     * @requirement REQ-V2-002 - State machine integration
     */
    async transitionTo(state) {
        if (!this.currentTask) {
            throw new Error('No active task');
        }
        if (!this.stateMachine.canTransitionTo(state)) {
            return false;
        }
        const fromState = this.stateMachine.getCurrentState();
        this.stateMachine.setState(state);
        this.currentTask.status = state;
        if (this.config.onStateChange) {
            await this.config.onStateChange(fromState, state);
        }
        return true;
    }
    /**
     * Get workflow progress (0-100%)
     */
    getProgress() {
        return this.stateMachine.getProgress();
    }
    /**
     * Check if can transition to state
     */
    canTransitionTo(state) {
        return this.stateMachine.canTransitionTo(state);
    }
    /**
     * Complete current task
     * @requirement REQ-V2-003 - Task lifecycle management
     */
    async completeTask() {
        if (!this.currentTask) {
            throw new Error('No active task');
        }
        this.currentTask.completedAt = new Date().toISOString();
        this.currentTask.status = 'COMMIT_READY';
        if (this.config.onTaskComplete) {
            await this.config.onTaskComplete(this.currentTask);
        }
        this.currentTask = null;
        this.stateMachine.reset();
    }
    /**
     * Get all workflow steps
     */
    getAllSteps() {
        return this.stateMachine.getAllSteps();
    }
    /**
     * Check if workflow is complete
     */
    isComplete() {
        return this.stateMachine.isComplete();
    }
    /**
     * Reset workflow
     */
    reset() {
        this.stateMachine.reset();
        this.currentTask = null;
    }
}
//# sourceMappingURL=workflow-engine.js.map