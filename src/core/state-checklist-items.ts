/**
 * State-Specific Checklist Items
 * 
 * Defines default checklist items for each workflow state.
 * These items are registered in ChecklistRegistry and filtered
 * based on current task state.
 * 
 * Phase 1.3: Foundation for dynamic state checklists
 */

import { ChecklistItem } from './checklist-registry.js';
import { WorkflowState } from '@shadel/workflow-core';

/**
 * UNDERSTANDING State Checklist Items
 * 
 * Focus: Requirements analysis and understanding
 */
export const UNDERSTANDING_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'understand-requirements',
    title: 'Understand Requirements',
    description: 'Read and understand all requirements. Ask clarifying questions if needed.',
    required: true,
    priority: 'high',
    applicableStates: ['UNDERSTANDING']
  },
  {
    id: 'identify-ambiguities',
    title: 'Identify Ambiguities',
    description: 'Identify any ambiguities or unclear requirements. Document them for clarification.',
    required: true,
    priority: 'high',
    applicableStates: ['UNDERSTANDING']
  },
  {
    id: 'confirm-understanding',
    title: 'Confirm Understanding',
    description: 'Confirm understanding with user. Summarize requirements and approach before proceeding.',
    required: true,
    priority: 'high',
    applicableStates: ['UNDERSTANDING']
  }
];

/**
 * DESIGNING State Checklist Items
 * 
 * Focus: Design and architecture planning
 */
export const DESIGNING_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'create-design-doc',
    title: 'Create Design Document',
    description: 'Create or update design document with architecture, approach, and alternatives considered.',
    required: true,
    priority: 'high',
    applicableStates: ['DESIGNING']
  },
  {
    id: 'design-approval',
    title: 'Get Design Approval',
    description: 'Get user approval on design before starting implementation.',
    required: true,
    priority: 'high',
    applicableStates: ['DESIGNING']
  },
  {
    id: 'plan-implementation',
    title: 'Plan Implementation',
    description: 'Break down implementation into steps. Identify files to create/modify.',
    required: false,
    priority: 'medium',
    applicableStates: ['DESIGNING']
  }
];

/**
 * IMPLEMENTING State Checklist Items
 * 
 * Focus: Code implementation and development
 */
export const IMPLEMENTING_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'write-code',
    title: 'Write Production Code',
    description: 'Implement the feature according to design. Follow coding standards and conventions.',
    required: true,
    priority: 'high',
    applicableStates: ['IMPLEMENTING']
  },
  {
    id: 'add-requirement-tags',
    title: 'Add Requirement Tags',
    description: 'Add @requirement tags to link code to requirements. Ensure 100% traceability.',
    required: true,
    priority: 'high',
    applicableStates: ['IMPLEMENTING']
  },
  {
    id: 'follow-patterns',
    title: 'Follow Project Patterns',
    description: 'Follow existing patterns and conventions. Check for duplicate functionality before writing new code.',
    required: false,
    priority: 'medium',
    applicableStates: ['IMPLEMENTING']
  }
];

/**
 * TESTING State Checklist Items
 * 
 * Focus: Test creation and execution
 */
export const TESTING_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'create-test-plan',
    title: 'Create Test Plan',
    description: 'Create test plan document before writing tests. Define test cases and expected results.',
    required: true,
    priority: 'high',
    applicableStates: ['TESTING']
  },
  {
    id: 'write-tests',
    title: 'Write Tests',
    description: 'Write comprehensive unit and integration tests. Ensure coverage >= 80%.',
    required: true,
    priority: 'high',
    applicableStates: ['TESTING']
  },
  {
    id: 'run-tests',
    title: 'Run Tests',
    description: 'Run all tests and verify they pass. Fix any failing tests before proceeding.',
    required: true,
    priority: 'high',
    applicableStates: ['TESTING']
  }
];

/**
 * REVIEWING State Checklist Items
 * 
 * Focus: Code review and quality validation
 * 
 * NOTE: These are additional state-level items. The existing review checklist
 * (ReviewChecklistManager.createDefaultChecklist) has 7 detailed items that
 * will be preserved and integrated.
 */
export const REVIEWING_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'run-validation',
    title: 'Run Validation',
    description: 'Run automated validation: npx ai-workflow validate. Ensure all checks pass.',
    required: true,
    priority: 'high',
    applicableStates: ['REVIEWING']
  },
  {
    id: 'code-quality-review',
    title: 'Code Quality Review',
    description: 'Review code for quality, style, and adherence to project conventions.',
    required: true,
    priority: 'high',
    applicableStates: ['REVIEWING']
  },
  {
    id: 'requirements-verification',
    title: 'Verify Requirements',
    description: 'Verify all requirements are satisfied and properly linked to code.',
    required: true,
    priority: 'high',
    applicableStates: ['REVIEWING']
  }
];

/**
 * READY_TO_COMMIT State Checklist Items
 * 
 * Focus: Final checks before commit
 */
export const READY_TO_COMMIT_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'all-tests-passing',
    title: 'All Tests Passing',
    description: 'Verify all tests are passing. No failing tests or skipped tests.',
    required: true,
    priority: 'high',
    applicableStates: ['READY_TO_COMMIT']
  },
  {
    id: 'validation-passed',
    title: 'Validation Passed',
    description: 'Ensure validation passed (npx ai-workflow validate). All quality gates met.',
    required: true,
    priority: 'high',
    applicableStates: ['READY_TO_COMMIT']
  },
  {
    id: 'no-warnings',
    title: 'No Active Warnings',
    description: 'Check that there are no active warnings in .ai-context/WARNINGS.md.',
    required: false,
    priority: 'medium',
    applicableStates: ['READY_TO_COMMIT']
  }
];

/**
 * Get all state-specific checklist items
 */
export function getAllStateChecklistItems(): ChecklistItem[] {
  return [
    ...UNDERSTANDING_CHECKLIST_ITEMS,
    ...DESIGNING_CHECKLIST_ITEMS,
    ...IMPLEMENTING_CHECKLIST_ITEMS,
    ...TESTING_CHECKLIST_ITEMS,
    ...REVIEWING_CHECKLIST_ITEMS,
    ...READY_TO_COMMIT_CHECKLIST_ITEMS
  ];
}

/**
 * Get checklist items for a specific state
 */
export function getStateChecklistItems(state: WorkflowState): ChecklistItem[] {
  switch (state) {
    case 'UNDERSTANDING':
      return UNDERSTANDING_CHECKLIST_ITEMS;
    case 'DESIGNING':
      return DESIGNING_CHECKLIST_ITEMS;
    case 'IMPLEMENTING':
      return IMPLEMENTING_CHECKLIST_ITEMS;
    case 'TESTING':
      return TESTING_CHECKLIST_ITEMS;
    case 'REVIEWING':
      return REVIEWING_CHECKLIST_ITEMS;
    case 'READY_TO_COMMIT':
      return READY_TO_COMMIT_CHECKLIST_ITEMS;
    default:
      return [];
  }
}

