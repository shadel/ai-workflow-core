/**
 * Core Types for AI Workflow Engine
 * @requirement REQ-V2-002
 * @requirement REFACTOR-STATE-NAMES - v3.0 state name migration
 */

// Import and re-export workflow state types from state-mapper (single source of truth)
import type { 
  WorkflowState as WS,
  LegacyWorkflowState,
  AnyWorkflowState
} from './utils/state-mapper.js';

export type WorkflowState = WS;
export type { LegacyWorkflowState, AnyWorkflowState };

export type RoleTier = 'tier1' | 'tier2' | 'tier3';

export type RoleStatus = 'pending' | 'approved' | 'rejected';

export interface Role {
  id: string;
  name: string;
  icon: string;
  tier: RoleTier;
  description: string;
  responsibilities: string[];
  activeSteps?: WorkflowState[];
  triggers?: string[];
}

export interface RoleApproval {
  roleId: string;
  status: RoleStatus;
  timestamp: string;
  comment?: string;
}

export interface Task {
  id: string;
  goal: string;
  status: WorkflowState;
  startedAt: string;
  completedAt?: string;
  roleApprovals: RoleApproval[];
}

export interface WorkflowConfig {
  assistant: 'cursor' | 'copilot' | 'claude' | 'gpt' | 'other';
  roles: {
    tier1: string[];
    tier2: string[];
    tier3: string[];
  };
  workflow: {
    steps: string[];
  };
  hooks: string[];
  projectType?: string;
  teamSize?: string;
  enableHooks?: boolean;
  enableMeetings?: boolean;
  enableQualityGates?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

