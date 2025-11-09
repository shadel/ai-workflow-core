/**
 * @ai-workflow/core - Core Build
 * Lightweight task management and validation (14 features)
 * @requirement REQ-V2-003
 */

export const version = '2.0.0-beta.1';
export const edition = 'core';

// Re-export @workflow/core types
export * from '@workflow/core';

// Core exports
export { TaskManager } from './core/task-manager.js';
export { ContextInjector, ContextInjectionContext } from './core/context-injector.js';
export { RoleSystem, RoleSystemConfig } from './core/role-system.js';
export { RoleActivator, RoleActivationContext } from './core/role-activator.js';
export { Role, ROLES, getRole, getRoles } from './roles/role-definitions.js';
export { Validator, ValidationResult, CompleteValidationResult } from './core/validator.js';
export { installGitHooks, uninstallGitHooks, areHooksInstalled } from './hooks/install-hooks.js';
export { preCommitHook } from './hooks/pre-commit.js';

// CLI command exports (for Full Build to reuse)
export { registerInitCommand } from './cli/commands/init.js';
export { registerTaskCommands } from './cli/commands/task.js';
export { registerValidateCommand } from './cli/commands/validate.js';
export { registerSyncCommand } from './cli/commands/sync.js';
export { registerHelpCommand } from './cli/commands/help.js';
export { registerUpgradeCommand } from './cli/commands/upgrade.js';
export { registerGenerateCommand } from './cli/commands/generate.js';
export { registerRuleCommands } from './cli/commands/rule.js';

