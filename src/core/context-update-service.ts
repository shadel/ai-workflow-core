/**
 * Context Update Service - Centralized context update logic
 * 
 * REFACTORED: Extracted from TaskManager.updateContextAfterStateChange() for Phase 3.
 * Handles context updates after state changes, including role activation and rule loading.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Extract orchestration services
 */

import type { Task, WorkflowState } from '@shadel/workflow-core';
import { ContextInjector } from './context-injector.js';
import { RoleSystem } from './role-system.js';
import { RuleManager } from '../utils/rule-manager.js';

/**
 * Context Update Service
 * 
 * Centralizes context update logic after state changes.
 * Auto-injects context for AI, re-activates roles, and loads rules.
 */
export class ContextUpdateService {
  private contextInjector: ContextInjector;
  private roleSystem: RoleSystem;
  private ruleManager: RuleManager;

  constructor(
    contextInjector: ContextInjector,
    roleSystem: RoleSystem,
    ruleManager: RuleManager
  ) {
    this.contextInjector = contextInjector;
    this.roleSystem = roleSystem;
    this.ruleManager = ruleManager;
  }

  /**
   * Update context after state change
   * 
   * Auto-injects context for AI, re-activates roles, and loads rules.
   * Updates context files via ContextInjector.
   * 
   * @param state - New workflow state
   * @param currentTask - Current task (if available)
   */
  async updateAfterStateChange(state: WorkflowState, currentTask: Task | null): Promise<void> {
    if (!currentTask) {
      // No task available, skip context update
      return;
    }

    // BUG-FIX-ROLES-3: Re-activate roles during sync to ensure checklists are shown
    const activeRoles = this.roleSystem.getActiveRoles({
      taskGoal: currentTask.goal,
      workflowState: state
    });
    
    // Load local rules (v3.0.3)
    const localRules = await this.ruleManager.getRules();
    
    await this.contextInjector.updateAfterCommand('sync', {
      task: currentTask,
      warnings: [],
      blockers: [],
      activeRoles,
      localRules  // v3.0.3 - Include project rules
    });
  }
}


