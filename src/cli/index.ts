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
import { registerShellCommands } from './commands/shell.js';

const program = new Command();

program
  .name('ai-workflow')
  .description('AI Workflow Engine - Core Build')
  .version('2.0.0');

  // Register commands
  registerInitCommand(program); // Must be first for new projects
  registerTaskCommands(program);
  registerValidateCommand(program);
  registerSyncCommand(program);
  registerHelpCommand(program);
  registerUpgradeCommand(program);
registerGenerateCommand(program);
registerRuleCommands(program);
registerShellCommands(program);

// Parse arguments
program.parse(process.argv);

