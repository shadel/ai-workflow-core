/**
 * Utility exports for @workflow/core
 * @requirement REQ-V2-002
 * @requirement REFACTOR-STATE-NAMES - v3.0 migration utilities
 */

export { PathValidator } from './path-validator.js';

// State migration utilities (v3.0)
// Note: WorkflowState types exported from types.js to avoid ambiguity
export {
  normalizeState,
  toLegacyState,
  isLegacyState,
  warnIfLegacy,
  getAllValidStates,
  isValidState,
  LEGACY_TO_NEW,
  NEW_TO_LEGACY
} from './state-mapper.js';

export { migrateUserData } from './migrate-user-data.js';
export type { MigrationResult } from './migrate-user-data.js';

