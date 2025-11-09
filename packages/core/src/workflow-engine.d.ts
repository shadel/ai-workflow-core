/**
 * WorkflowEngine - Core workflow orchestrator
 * Pure implementation without CLI dependencies
 * @requirement REQ-V2-002
 */
import { Task, WorkflowState } from './types.js';
export interface WorkflowEngineConfig {
    onStateChange?: (from: WorkflowState, to: WorkflowState) => void | Promise<void>;
    onTaskCreate?: (task: Task) => void | Promise<void>;
    onTaskComplete?: (task: Task) => void | Promise<void>;
}
export declare class WorkflowEngine {
    private stateMachine;
    private currentTask;
    private config;
    constructor(config?: WorkflowEngineConfig);
    /**
     * Create a new task
     * @requirement REQ-V2-003 - Task management CRUD
     */
    createTask(goal: string): Promise<Task>;
    /**
     * Get current task
     */
    getCurrentTask(): Task | null;
    /**
     * Get current state
     */
    getCurrentState(): WorkflowState;
    /**
     * Transition to next state
     * @requirement REQ-V2-002 - State machine integration
     */
    transitionTo(state: WorkflowState): Promise<boolean>;
    /**
     * Get workflow progress (0-100%)
     */
    getProgress(): number;
    /**
     * Check if can transition to state
     */
    canTransitionTo(state: WorkflowState): boolean;
    /**
     * Complete current task
     * @requirement REQ-V2-003 - Task lifecycle management
     */
    completeTask(): Promise<void>;
    /**
     * Get all workflow steps
     */
    getAllSteps(): WorkflowState[];
    /**
     * Check if workflow is complete
     */
    isComplete(): boolean;
    /**
     * Reset workflow
     */
    reset(): void;
}
//# sourceMappingURL=workflow-engine.d.ts.map