/**
 * Validate CLI Command for Core Build
 * Basic quality gates validation
 * @requirement REQ-V2-003 - Validation command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Validator } from '../../core/validator.js';

/**
 * Register validate command
 * @requirement REQ-V2-003 - CLI validation command
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate workflow state and quality gates')
    .option('--json', 'Output in JSON format')
    .action(async (options: { json?: boolean }) => {
      try {
        const validator = new Validator();
        const results = await validator.validateAll();

        if (options.json) {
          console.log(JSON.stringify({
            success: results.overall,
            data: results
          }, null, 2));
          
          if (!results.overall) {
            process.exit(1);
          }
          return;
        }

        // Text output
        console.log(chalk.bold.blue('\n🔍 AI Workflow Validation (Core)\n'));

        // 1. Workflow State
        console.log(chalk.bold('1. Workflow State'));
        if (results.workflow.passed) {
          console.log(chalk.green(`   ✅ ${results.workflow.message}`));
          if (results.workflow.details?.currentState) {
            console.log(chalk.gray(`   State: ${results.workflow.details.currentState}`));
          }
        } else {
          console.log(chalk.red(`   ❌ ${results.workflow.message}`));
          if (results.workflow.details?.suggestion) {
            console.log(chalk.yellow(`   💡 ${results.workflow.details.suggestion}`));
          }
        }

        // 2. Required Files
        console.log(chalk.bold('\n2. Required Files'));
        if (results.files.passed) {
          console.log(chalk.green(`   ✅ ${results.files.message}`));
        } else {
          console.log(chalk.red(`   ❌ ${results.files.message}`));
          if (results.files.details?.missingFiles) {
            console.log(chalk.yellow(`   Missing: ${results.files.details.missingFiles.join(', ')}`));
          }
        }

        // Overall
        console.log(chalk.bold('\n3. Overall Status'));
        if (results.overall) {
          console.log(chalk.green('   ✅ All validations passed!'));
          console.log(chalk.gray('\n💡 Ready to commit\n'));
        } else {
          console.log(chalk.red('   ❌ Validation failed'));
          console.log(chalk.yellow('\n💡 Fix issues above before committing\n'));
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

