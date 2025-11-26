/**
 * Help CLI Command for Core Build
 * Comprehensive help and documentation
 * @requirement REQ-V2-003 - Help system
 */

import { Command } from 'commander';
import { COMMAND_HELPS, CATEGORIES } from './help-data.js';
import { 
  renderGeneralHelp, 
  renderHelp, 
  getPackageType,
  filterCommandsByPackage 
} from './help-renderer.js';
import type { HelpOptions } from './help-types.js';

/**
 * Register help command
 * @requirement REQ-V2-003 - CLI help command
 */
export function registerHelpCommand(program: Command): void {
  const helpCommand = program
    .command('help [command]')
    .description('Show help for commands')
    .option('--all', 'Show all commands (not just top ones)')
    .option('--json', 'Output in JSON format')
    .action(async function(this: Command, command?: string) {
      // Get options from command context (Commander.js pattern)
      // Use regular function (not arrow) to access 'this'
      const options: HelpOptions = {
        all: this.opts().all || false,
        json: this.opts().json || false,
        command: command
      };
      
      if (command) {
        showCommandHelp(command, options);
      } else {
        showGeneralHelp(options);
      }
    });
}

/**
 * Show general help using data-driven approach
 */
function showGeneralHelp(options: HelpOptions): void {
  const packageType = getPackageType();
  const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, packageType, options);
  console.log(output);
}

/**
 * Show command-specific help using data-driven approach
 */
function showCommandHelp(command: string, options: HelpOptions): void {
  const packageType = getPackageType();
  const filteredCommands = filterCommandsByPackage(COMMAND_HELPS, packageType);
  const commandHelp = filteredCommands.find(cmd => cmd.name === command);
  
  if (commandHelp) {
    const output = renderHelp(commandHelp, options.json ? 'json' : 'text');
    console.log(output);
  } else {
    // Unknown command
    console.log(`\nNo detailed help found for: ${command}\n`);
    console.log('Available commands:');
    const commandNames = filteredCommands
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)
      .map(cmd => `  - ${cmd.name}`);
    console.log(commandNames.join('\n'));
    console.log('\nUse --all to see all commands, or npx ai-workflow help <command> for details.\n');
  }
}

// Legacy help functions removed - now using data-driven approach via renderHelp()

