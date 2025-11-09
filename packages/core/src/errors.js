/**
 * Error Classes and Codes for Workflow Engine
 * @requirement REQ-V2-002
 */
/**
 * Base workflow error
 * @requirement REQ-V2-002 - Standardized error handling
 */
export class WorkflowError extends Error {
    code;
    details;
    constructor(code, message, details) {
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
    constructor(message, details) {
        super('ERR_VALIDATION_FAILED', message, details);
        this.name = 'ValidationError';
    }
}
/**
 * State transition error
 * @requirement REQ-V2-002 - State transition validation
 */
export class StateTransitionError extends WorkflowError {
    from;
    to;
    constructor(from, to, message) {
        super('ERR_INVALID_TRANSITION', message || `Invalid state transition: ${from} -> ${to}`, { from, to });
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
    pluginId;
    constructor(pluginId, message, details) {
        super('ERR_PLUGIN', message, details);
        this.name = 'PluginError';
        this.pluginId = pluginId;
    }
}
/**
 * Task error
 */
export class TaskError extends WorkflowError {
    taskId;
    constructor(message, taskId, details) {
        super('ERR_TASK', message, details);
        this.name = 'TaskError';
        this.taskId = taskId;
    }
}
/**
 * Error codes enumeration
 */
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["NO_ACTIVE_TASK"] = "ERR_NO_ACTIVE_TASK";
    ErrorCode["INVALID_STATE_TRANSITION"] = "ERR_INVALID_TRANSITION";
    ErrorCode["VALIDATION_FAILED"] = "ERR_VALIDATION_FAILED";
    ErrorCode["PLUGIN_ERROR"] = "ERR_PLUGIN";
    ErrorCode["TASK_ERROR"] = "ERR_TASK";
    ErrorCode["FILE_NOT_FOUND"] = "ERR_FILE_NOT_FOUND";
    ErrorCode["PERMISSION_DENIED"] = "ERR_PERMISSION_DENIED";
})(ErrorCode || (ErrorCode = {}));
//# sourceMappingURL=errors.js.map