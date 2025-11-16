/**
 * Help CLI Command for Core Build
 * Comprehensive help and documentation
 * @requirement REQ-V2-003 - Help system
 */

import { Command } from 'commander';
import chalk from 'chalk';

/**
 * Register help command
 * @requirement REQ-V2-003 - CLI help command
 */
export function registerHelpCommand(program: Command): void {
  program
    .command('help [command]')
    .description('Show help for commands')
    .action(async (command?: string) => {
      if (command) {
        showCommandHelp(command);
      } else {
        showGeneralHelp();
      }
    });
}

/**
 * Show general help
 */
function showGeneralHelp(): void {
  console.log(chalk.bold.blue('\n📚 AI Workflow Engine - Core Build Help\n'));
  
  console.log(chalk.bold('AVAILABLE COMMANDS:\n'));
  
  console.log(chalk.cyan('  task'));
  console.log('    Manage workflow tasks');
  console.log(chalk.gray('    Commands: create, status, complete\n'));
  
  console.log(chalk.cyan('  validate'));
  console.log('    Validate workflow state and quality gates');
  console.log(chalk.gray('    Options: --json\n'));
  
  console.log(chalk.cyan('  sync'));
  console.log('    Sync workflow state and update context files\n');
  
  console.log(chalk.bold('\nCOMMON WORKFLOWS:\n'));
  
  console.log(chalk.yellow('  Start new task:'));
  console.log('    npx ai-workflow task create "<goal>"');
  console.log('    # Work on your task');
  console.log('    npx ai-workflow sync');
  console.log('    npx ai-workflow validate');
  console.log('    git commit -m "your message"\n');
  
  console.log(chalk.yellow('  Check status:'));
  console.log('    npx ai-workflow task status');
  console.log('    cat .ai-context/STATUS.txt');
  console.log('    cat .ai-context/NEXT_STEPS.md\n');
  
  console.log(chalk.bold('\nLEARN MORE:\n'));
  console.log('  npx ai-workflow help task');
  console.log('  npx ai-workflow help validate');
  console.log('  npx ai-workflow --help\n');
}

/**
 * Show command-specific help
 */
function showCommandHelp(command: string): void {
  const helps: Record<string, () => void> = {
    task: showTaskHelp,
    validate: showValidateHelp,
    sync: showSyncHelp,
  };

  const helpFn = helps[command];
  if (helpFn) {
    helpFn();
  } else {
    console.log(chalk.red(`\n❌ Unknown command: ${command}\n`));
    console.log(chalk.gray('Available commands: task, validate, sync\n'));
  }
}

function showTaskHelp(): void {
  console.log(chalk.bold.blue('\n📋 Task Management\n'));
  
  console.log(chalk.bold('COMMANDS:\n'));
  
  console.log(chalk.cyan('  task create <goal>'));
  console.log('    Create a new workflow task');
  console.log(chalk.gray('    Options: --satisfies <REQ-ID>\n'));
  
  console.log(chalk.cyan('  task status'));
  console.log('    Show current task status and progress\n');
  
  console.log(chalk.cyan('  task complete'));
  console.log('    Mark current task as complete\n');
  
  console.log(chalk.bold('EXAMPLES:\n'));
  console.log('  npx ai-workflow task create "Fix authentication bug"');
  console.log('  npx ai-workflow task create "Add caching" --satisfies REQ-123');
  console.log('  npx ai-workflow task status');
  console.log('  npx ai-workflow task complete\n');
}

function showValidateHelp(): void {
  console.log(chalk.bold.blue('\n🔍 Validation\n'));
  
  console.log(chalk.bold('USAGE:\n'));
  console.log('  npx ai-workflow validate [options]\n');
  
  console.log(chalk.bold('OPTIONS:\n'));
  console.log('  --json    Output in JSON format\n');
  
  console.log(chalk.bold('CHECKS:\n'));
  console.log('  ✅ Workflow state valid');
  console.log('  ✅ Required context files exist');
  console.log('  ✅ Task is active\n');
  
  console.log(chalk.bold('EXAMPLES:\n'));
  console.log('  npx ai-workflow validate');
  console.log('  npx ai-workflow validate --json\n');
}

function showSyncHelp(): void {
  console.log(chalk.bold.blue('\n🔄 Sync\n'));
  
  console.log(chalk.bold('USAGE:\n'));
  console.log('  npx ai-workflow sync\n');
  
  console.log(chalk.bold('WHAT IT DOES:\n'));
  console.log('  ✅ Confirms workflow state is current');
  console.log('  ✅ Updates context files (STATUS.txt, NEXT_STEPS.md)');
  console.log('  ✅ Shows current state\n');
  
  console.log(chalk.bold('WHEN TO USE:\n'));
  console.log('  • After making significant changes');
  console.log('  • After completing a workflow step');
  console.log('  • Before validating or committing\n');
}

