/**
 * State Mapper - Backward compatibility for state name migration
 * Supports both legacy (v2.x) and new (v3.0) state names
 * @requirement REFACTOR-STATE-NAMES - v3.0 state rename support
 */

// New state names (v3.0 - Gerund pattern for consistency)
export type WorkflowState = 
  | 'UNDERSTANDING'
  | 'DESIGNING'
  | 'IMPLEMENTING'
  | 'TESTING'
  | 'REVIEWING'
  | 'READY_TO_COMMIT';

// Legacy state names (v2.x - deprecated but supported)
export type LegacyWorkflowState = 
  | 'DESIGNING'
  | 'IMPLEMENTING'
  | 'TESTING'
  | 'REVIEWING'
  | 'READY_TO_COMMIT';

// Accept both formats during migration period
export type AnyWorkflowState = WorkflowState | LegacyWorkflowState;

/**
 * Mapping from legacy to new state names
 */
export const LEGACY_TO_NEW: Record<string, WorkflowState> = {
  // No change
  'UNDERSTANDING': 'UNDERSTANDING',
  
  // Renames
  'DESIGNING': 'DESIGNING',
  'IMPLEMENTING': 'IMPLEMENTING',
  'TESTING': 'TESTING',
  'REVIEWING': 'REVIEWING',
  'READY_TO_COMMIT': 'READY_TO_COMMIT'
};

/**
 * Reverse mapping from new to legacy state names
 * Used for backward compatibility output
 */
export const NEW_TO_LEGACY: Record<WorkflowState, string> = {
  'UNDERSTANDING': 'UNDERSTANDING',
  'DESIGNING': 'DESIGNING',
  'IMPLEMENTING': 'IMPLEMENTING',
  'TESTING': 'TESTING',
  'REVIEWING': 'REVIEWING',
  'READY_TO_COMMIT': 'READY_TO_COMMIT'
};

/**
 * Normalize any state name to new format
 * Accepts both legacy and new names
 * Always returns new format
 * 
 * @param state - State name in any format
 * @returns Normalized state in new format
 * 
 * @example
 * normalizeState('DESIGNING')  // Returns 'DESIGNING'
 * normalizeState('DESIGNING')        // Returns 'DESIGNING'
 */
export function normalizeState(state: string): WorkflowState {
  const normalized = LEGACY_TO_NEW[state];
  
  if (normalized) {
    return normalized;
  }
  
  // If not in map, assume it's already new format (or invalid)
  return state as WorkflowState;
}

/**
 * Convert new state to legacy format
 * Used when outputting to systems that expect old names
 * 
 * @param state - State name in new format
 * @returns State in legacy format
 * 
 * @example
 * toLegacyState('DESIGNING')  // Returns 'DESIGNING'
 */
export function toLegacyState(state: WorkflowState): string {
  return NEW_TO_LEGACY[state] || state;
}

/**
 * Check if state name is in legacy format
 * 
 * @param state - State name to check
 * @returns true if legacy format, false if new format
 */
export function isLegacyState(state: string): boolean {
  return state in LEGACY_TO_NEW && state !== LEGACY_TO_NEW[state];
}

/**
 * Emit deprecation warning for legacy states
 * Should be called when legacy state names are detected
 * 
 * @param state - State name to check
 */
export function warnIfLegacy(state: string): void {
  if (isLegacyState(state)) {
    console.warn(
      `\n⚠️  DEPRECATED: State name '${state}' is deprecated.\n` +
      `   New name: '${LEGACY_TO_NEW[state]}'\n` +
      `   Legacy support will be removed in v4.0.0\n` +
      `   Run: npx ai-workflow migrate-states (to update your files)\n`
    );
  }
}

/**
 * Get all valid state names (both legacy and new)
 * Used for validation
 */
export function getAllValidStates(): string[] {
  return [
    ...Object.keys(LEGACY_TO_NEW),
    ...Object.values(LEGACY_TO_NEW)
  ].filter((v, i, a) => a.indexOf(v) === i); // Unique
}

/**
 * Check if a state name is valid (legacy or new)
 */
export function isValidState(state: string): boolean {
  return getAllValidStates().includes(state);
}

