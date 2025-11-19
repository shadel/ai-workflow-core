/**
 * @workflow/core - Foundation package
 * Shared utilities, state machine, and plugin system
 * @requirement REQ-V2-002
 * @requirement REFACTOR-STATE-NAMES - v3.0 state mapper exports
 */

export const version = '1.0.0';

// Core exports
export * from './types.js';
export { StateMachine } from './state-machine.js';
export { WorkflowEngine } from './workflow-engine.js';
export * from './plugin-system.js';
export * from './errors.js';
export * from './utils/index.js';

// Re-export state mapper functions for external use
export {
  normalizeState,
  toLegacyState,
  isLegacyState,
  warnIfLegacy,
  getAllValidStates,
  isValidState
} from './utils/state-mapper.js';

