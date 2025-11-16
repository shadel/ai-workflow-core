/**
 * WorkflowEngine - Core workflow orchestrator
 * Pure implementation without CLI dependencies
 * @requirement REQ-V2-002
 */

import { WorkflowConfig, Task, WorkflowState, ValidationResult } from './types.js';
import { StateMachine } from './state-machine.js';

export interface WorkflowEngineConfig {
  onStateChange?: (from: WorkflowState, to: WorkflowState) => void | Promise<void>;
  onTaskCreate?: (task: Task) => void | Promise<void>;
  onTaskComplete?: (task: Task) => void | Promise<void>;
}

export class WorkflowEngine {
  private stateMachine: StateMachine;
  private currentTask: Task | null = null;
  private config: WorkflowEngineConfig;

  constructor(config?: WorkflowEngineConfig) {
    this.stateMachine = new StateMachine();
    this.config = config || {};
  }

  /**
   * Create a new task
   * @requirement REQ-V2-003 - Task management CRUD
   */
  async createTask(goal: string): Promise<Task> {
    const task: Task = {
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
  getCurrentTask(): Task | null {
    return this.currentTask;
  }

  /**
   * Get current state
   */
  getCurrentState(): WorkflowState {
    return this.stateMachine.getCurrentState();
  }

  /**
   * Transition to next state
   * @requirement REQ-V2-002 - State machine integration
   */
  async transitionTo(state: WorkflowState): Promise<boolean> {
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
  getProgress(): number {
    return this.stateMachine.getProgress();
  }

  /**
   * Check if can transition to state
   */
  canTransitionTo(state: WorkflowState): boolean {
    return this.stateMachine.canTransitionTo(state);
  }

  /**
   * Complete current task
   * @requirement REQ-V2-003 - Task lifecycle management
   */
  async completeTask(): Promise<void> {
    if (!this.currentTask) {
      throw new Error('No active task');
    }

    this.currentTask.completedAt = new Date().toISOString();
    this.currentTask.status = 'READY_TO_COMMIT';  // v3.0: renamed from READY_TO_COMMIT

    if (this.config.onTaskComplete) {
      await this.config.onTaskComplete(this.currentTask);
    }

    this.currentTask = null;
    this.stateMachine.reset();
  }

  /**
   * Get all workflow steps
   */
  getAllSteps(): WorkflowState[] {
    return this.stateMachine.getAllSteps();
  }

  /**
   * Check if workflow is complete
   */
  isComplete(): boolean {
    return this.stateMachine.isComplete();
  }

  /**
   * Reset workflow
   */
  reset(): void {
    this.stateMachine.reset();
    this.currentTask = null;
  }
}

