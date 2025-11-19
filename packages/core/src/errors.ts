/**
 * Error Classes and Codes for Workflow Engine
 * @requirement REQ-V2-002
 */

import { WorkflowState } from './types.js';

/**
 * Base workflow error
 * @requirement REQ-V2-002 - Standardized error handling
 */
export class WorkflowError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.details = details;
    
    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error
 */
export class ValidationError extends WorkflowError {
  constructor(message: string, details?: any) {
    super('ERR_VALIDATION_FAILED', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * State transition error
 * @requirement REQ-V2-002 - State transition validation
 */
export class StateTransitionError extends WorkflowError {
  from: WorkflowState;
  to: WorkflowState;

  constructor(from: WorkflowState, to: WorkflowState, message?: string) {
    super(
      'ERR_INVALID_TRANSITION',
      message || `Invalid state transition: ${from} -> ${to}`,
      { from, to }
    );
    this.name = 'StateTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Plugin error
 * @requirement REQ-V2-002 - Plugin system error handling
 */
export class PluginError extends WorkflowError {
  pluginId: string;

  constructor(pluginId: string, message: string, details?: any) {
    super('ERR_PLUGIN', message, details);
    this.name = 'PluginError';
    this.pluginId = pluginId;
  }
}

/**
 * Task error
 */
export class TaskError extends WorkflowError {
  taskId?: string;

  constructor(message: string, taskId?: string, details?: any) {
    super('ERR_TASK', message, details);
    this.name = 'TaskError';
    this.taskId = taskId;
  }
}

/**
 * Error codes enumeration
 */
export enum ErrorCode {
  NO_ACTIVE_TASK = 'ERR_NO_ACTIVE_TASK',
  INVALID_STATE_TRANSITION = 'ERR_INVALID_TRANSITION',
  VALIDATION_FAILED = 'ERR_VALIDATION_FAILED',
  PLUGIN_ERROR = 'ERR_PLUGIN',
  TASK_ERROR = 'ERR_TASK',
  FILE_NOT_FOUND = 'ERR_FILE_NOT_FOUND',
  PERMISSION_DENIED = 'ERR_PERMISSION_DENIED',
}

