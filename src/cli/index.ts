#!/usr/bin/env node

/**
 * CLI Entry Point for @ai-workflow/core
 * @requirement REQ-V2-003
 */

import { Command } from 'commander';
import { registerTaskCommands } from './commands/task.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerSyncCommand } from './commands/sync.js';
import { registerHelpCommand } from './commands/help.js';
import { registerUpgradeCommand } from './commands/upgrade.js';
import { registerInitCommand } from './commands/init.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerRuleCommands } from './commands/rule.js';
import { registerPatternCommands } from './commands/pattern.js';
import { registerMigrateCommand } from './commands/migrate.js';
import { registerShellCommands } from './commands/shell.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerReviewCommand } from './commands/review.js';
import { getPackageInfo } from './utils/package-info.js';

// Get version from package.json (using shared utility to avoid duplication)
const packageInfo = getPackageInfo();

const program = new Command();

program
  .name('ai-workflow')
  .description('AI Workflow Engine - Core Build')
  .version(packageInfo.version);

  // Register commands
  registerInitCommand(program); // Must be first for new projects
  registerTaskCommands(program);
  registerDashboardCommand(program); // FREE-TIER-003: Dashboard command
  registerValidateCommand(program);
  registerSyncCommand(program);
  registerReviewCommand(program); // REVIEW-CHECKLIST-001: Review checklist command
  registerHelpCommand(program);
  registerUpgradeCommand(program);
registerGenerateCommand(program);
registerRuleCommands(program);
registerPatternCommands(program); // v3.1.0: New pattern commands
registerMigrateCommand(program); // v3.1.0: Migration tool
registerShellCommands(program);

// Handle unhandled promise rejections in async actions
// Commander.js doesn't automatically handle these, so we need to catch them
process.on('unhandledRejection', (error: Error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Parse arguments and handle async errors
// Commander.js requires parseAsync() for async actions to properly handle errors
program.parseAsync(process.argv).catch((error: Error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

