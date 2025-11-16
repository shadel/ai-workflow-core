/**
 * Validate CLI Command for Core Build
 * Basic quality gates validation
 * @requirement REQ-V2-003 - Validation command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Validator } from '../../core/validator.js';
import { PatternProvider } from '../../core/pattern-provider.js';
import { TaskManager } from '../../core/task-manager.js';

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

        // 3. Pattern Compliance (Reporting only - Cursor decides what to do)
        try {
          const taskManager = new TaskManager();
          const task = await taskManager.getCurrentTask();
          
          if (task) {
            const patternProvider = new PatternProvider();
            const violations = await patternProvider.validateStatePatterns(
              task.status,
              { task }
            );

            console.log(chalk.bold('\n3. Pattern Compliance'));
            if (violations.length === 0) {
              console.log(chalk.green('   ✅ All patterns compliant'));
            } else {
              // Report violations (DO NOT block commit)
              for (const violation of violations) {
                const severityColor = violation.severity === 'error' 
                  ? chalk.red 
                  : violation.severity === 'warning' 
                  ? chalk.yellow 
                  : chalk.blue;
                
                const severityIcon = violation.severity === 'error' 
                  ? '❌' 
                  : violation.severity === 'warning' 
                  ? '⚠️' 
                  : 'ℹ️';

                const vType = violation.pattern.validation.type;
                const nonBlocking = (vType === 'command_run' || vType === 'code_check' || vType === 'custom');
                const nonBlockingNote = nonBlocking ? chalk.dim(' (non-blocking, Cursor verifies)') : '';
                const safeAction = violation.pattern.action || 'Follow pattern guidelines';
                
                console.log(severityColor(`   ${severityIcon} ${violation.pattern.title}: ${violation.message}${nonBlockingNote}`));
                console.log(chalk.gray(`      Action: ${safeAction}`));
                console.log(chalk.gray(`      Check: ${violation.pattern.validation.rule}`));
              }
              console.log(chalk.dim('\n   💡 These are reported for your awareness. Cursor decides what to do.'));
            }
          }
        } catch (error) {
          // If pattern validation fails, don't block - just skip
          // This ensures backward compatibility
        }

        // Overall
        console.log(chalk.bold('\n4. Overall Status'));
        if (results.overall) {
          console.log(chalk.green('   ✅ All validations passed!'));
          console.log(chalk.gray('\n💡 Ready to commit\n'));
          
          // BUG-FIX: Remind user to complete task after commit
          console.log(chalk.bold.cyan('📝 Workflow reminder:'));
          console.log(chalk.gray('  1. git commit -m "your message"'));
          console.log(chalk.gray('  2. npx ai-workflow task complete  ← Complete your task!'));
          console.log(chalk.gray('  3. npx ai-workflow task create "<next goal>"'));
          console.log('');
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

