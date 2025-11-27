/**
 * Automatic Workflow State Detection
 * @requirement FR-004: Automatic Workflow State Detection
 * 
 * Detects workflow state from work signals (files, commits, etc.)
 */

export interface WorkSignals {
  newFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  linesAdded: number;
  linesDeleted: number;
  testsAdded: number;
  commits: Array<{
    hash: string;
    message: string;
    timestamp: string;
  }>;
  timeElapsed: number;
  hasDesignDocs: boolean;
  hasTests: boolean;
  hasImplementation: boolean;
}

export type WorkflowState = 
  | 'UNDERSTANDING'
  | 'DESIGNING'
  | 'IMPLEMENTING'
  | 'TESTING'
  | 'REVIEWING'
  | 'READY_TO_COMMIT';

/**
 * State order for progression
 */
const STATE_ORDER: WorkflowState[] = [
  'UNDERSTANDING',
  'DESIGNING',
  'IMPLEMENTING',
  'TESTING',
  'REVIEWING',
  'READY_TO_COMMIT'
];

/**
 * Get state index
 */
function getStateIndex(state: string): number {
  const index = STATE_ORDER.indexOf(state as WorkflowState);
  return index >= 0 ? index : 0;
}

/**
 * Check if commit message is proper format (conventional commit)
 */
function isProperCommitFormat(message: string): boolean {
  // Check for conventional commit format: type: subject
  const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?(!)?:\s+.+$/i;
  return conventionalPattern.test(message.trim());
}

/**
 * Detect workflow state from current state and work signals
 */
export function detectWorkflowState(
  currentState: string,
  signals: WorkSignals
): WorkflowState {
  const currentIndex = getStateIndex(currentState);
  let newState: WorkflowState = currentState as WorkflowState;
  
  // Heuristic 1: UNDERSTANDING → DESIGNING
  if (currentState === 'UNDERSTANDING' && signals.hasDesignDocs) {
    newState = 'DESIGNING';
  }
  
  // Heuristic 2: DESIGNING → IMPLEMENTING
  if (currentState === 'DESIGNING' && signals.hasImplementation) {
    newState = 'IMPLEMENTING';
  }
  
  // Heuristic 3: IMPLEMENTING → TESTING
  if (currentState === 'IMPLEMENTING' && (signals.testsAdded > 0 || signals.hasTests)) {
    newState = 'TESTING';
  }
  
  // Heuristic 4: TESTING → REVIEWING or READY_TO_COMMIT
  if (currentState === 'TESTING') {
    const hasProperCommit = signals.commits.some(c => isProperCommitFormat(c.message));
    if (hasProperCommit && signals.hasTests && signals.hasImplementation) {
      // With proper commit, tests, and implementation, might skip to READY_TO_COMMIT
      newState = 'READY_TO_COMMIT';
    } else if (hasProperCommit) {
      newState = 'REVIEWING';
    }
  }
  
  // Heuristic 5: REVIEWING → READY_TO_COMMIT
  if (currentState === 'REVIEWING') {
    const hasProperCommit = signals.commits.some(c => isProperCommitFormat(c.message));
    if (hasProperCommit) {
      newState = 'READY_TO_COMMIT';
    }
  }
  
  // Allow skipping states when appropriate
  // If from UNDERSTANDING and have both implementation and tests, can skip to TESTING
  if (currentState === 'UNDERSTANDING' && signals.hasImplementation && signals.hasTests) {
    const newIndex = getStateIndex(newState);
    const testingIndex = getStateIndex('TESTING');
    if (newIndex < testingIndex) {
      newState = 'TESTING';
    }
  }
  
  // Don't move backward - ensure new state is >= current state
  const newIndex = getStateIndex(newState);
  if (newIndex < currentIndex) {
    newState = currentState as WorkflowState;
  }
  
  return newState;
}

/**
 * Collect work signals from git and file system
 * (Placeholder - would need git integration)
 */
export function collectWorkSignals(): Promise<WorkSignals> {
  // This would collect actual signals from git status, file changes, etc.
  // For now, return empty signals
  return Promise.resolve({
    newFiles: [],
    modifiedFiles: [],
    deletedFiles: [],
    linesAdded: 0,
    linesDeleted: 0,
    testsAdded: 0,
    commits: [],
    timeElapsed: 0,
    hasDesignDocs: false,
    hasTests: false,
    hasImplementation: false
  });
}

/**
 * Check if state is in sync with actual work
 */
export function checkStateSync(
  currentState: string,
  signals: WorkSignals
): { inSync: boolean; suggestedState?: WorkflowState } {
  const detectedState = detectWorkflowState(currentState, signals);
  const inSync = detectedState === currentState;
  
  return {
    inSync,
    suggestedState: inSync ? undefined : detectedState
  };
}


