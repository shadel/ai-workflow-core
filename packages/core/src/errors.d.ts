/**
 * Error Classes and Codes for Workflow Engine
 * @requirement REQ-V2-002
 */
import { WorkflowState } from './types.js';
/**
 * Base workflow error
 * @requirement REQ-V2-002 - Standardized error handling
 */
export declare class WorkflowError extends Error {
    code: string;
    details?: any;
    constructor(code: string, message: string, details?: any);
}
/**
 * Validation error
 */
export declare class ValidationError extends WorkflowError {
    constructor(message: string, details?: any);
}
/**
 * State transition error
 * @requirement REQ-V2-002 - State transition validation
 */
export declare class StateTransitionError extends WorkflowError {
    from: WorkflowState;
    to: WorkflowState;
    constructor(from: WorkflowState, to: WorkflowState, message?: string);
}
/**
 * Plugin error
 * @requirement REQ-V2-002 - Plugin system error handling
 */
export declare class PluginError extends WorkflowError {
    pluginId: string;
    constructor(pluginId: string, message: string, details?: any);
}
/**
 * Task error
 */
export declare class TaskError extends WorkflowError {
    taskId?: string;
    constructor(message: string, taskId?: string, details?: any);
}
/**
 * Error codes enumeration
 */
export declare enum ErrorCode {
    NO_ACTIVE_TASK = "ERR_NO_ACTIVE_TASK",
    INVALID_STATE_TRANSITION = "ERR_INVALID_TRANSITION",
    VALIDATION_FAILED = "ERR_VALIDATION_FAILED",
    PLUGIN_ERROR = "ERR_PLUGIN",
    TASK_ERROR = "ERR_TASK",
    FILE_NOT_FOUND = "ERR_FILE_NOT_FOUND",
    PERMISSION_DENIED = "ERR_PERMISSION_DENIED"
}
//# sourceMappingURL=errors.d.ts.map