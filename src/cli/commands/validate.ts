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
  const validateCommand = program
    .command('validate')
    .description('Validate workflow state and quality gates')
    .option('--json', 'Output in JSON format')
    .option('--save', 'Save results to context for Cursor verification')
    .option('--use-cache', 'Use cached results if available')
    .action(async (options: { json?: boolean; save?: boolean; useCache?: boolean }) => {
      try {
        const validator = new Validator();
        const results = await validator.validateAll({
          saveToContext: options.save,
          useCachedResults: options.useCache || false
        });

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

        // 3. Pattern Compliance (Use patterns from validateAll results, not fresh validation)
        console.log(chalk.bold('\n3. Pattern Compliance'));
        if (results.patterns && results.patterns.length > 0) {
          // Use patterns from validateAll results (already includes verifications)
          const violations = results.patterns.filter(p => !p.passed);
          
          if (violations.length === 0) {
            console.log(chalk.green('   ✅ All patterns compliant'));
          } else {
            // Separate errors from warnings/info
            const errorViolations = violations.filter(v => v.severity === 'error');
            const otherViolations = violations.filter(v => v.severity !== 'error');
            
            // Report error violations (BLOCK commit)
            if (errorViolations.length > 0) {
              console.log(chalk.red(`   ❌ ${errorViolations.length} critical pattern violation(s) found:`));
              for (const violation of errorViolations) {
                const safeAction = violation.pattern.action || 'Follow pattern guidelines';
                
                console.log(chalk.red(`   ❌ ${violation.pattern.title}: ${violation.message}`));
                console.log(chalk.gray(`      Action: ${safeAction}`));
                console.log(chalk.gray(`      Check: ${violation.pattern.validation.rule}`));
              }
              // Don't override results.overall here - it's already calculated in validateAll
            }
            
            // Report other violations (non-blocking)
            if (otherViolations.length > 0) {
              for (const violation of otherViolations) {
                const severityColor = violation.severity === 'warning' 
                  ? chalk.yellow 
                  : chalk.blue;
                
                const severityIcon = violation.severity === 'warning' 
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
              if (errorViolations.length === 0) {
                console.log(chalk.dim('\n   💡 These are reported for your awareness. Cursor decides what to do.'));
              }
            }
            
            if (errorViolations.length > 0) {
              console.log(chalk.red('\n   ❌ Critical violations must be fixed before commit!'));
            }
          }
        } else {
          console.log(chalk.green('   ✅ No patterns to check'));
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
          
          // Show hint about Cursor verification if custom patterns failed
          if (results.patterns && results.patterns.some(p => !p.passed && p.pattern.validation.type === 'custom')) {
            console.log(chalk.cyan('\n💡 Tip: If custom patterns are compliant, verify them:'));
            console.log(chalk.gray('   npx ai-workflow validate verify <pattern-id> --notes "reason"'));
            console.log(chalk.gray('   Then run: npx ai-workflow validate --use-cache\n'));
          }
          
          process.exit(1);
        }

        // Show save confirmation if --save was used
        if (options.save) {
          console.log(chalk.green('💾 Results saved to .ai-context/validation-results.json'));
          console.log(chalk.gray('   Review and verify patterns: npx ai-workflow validate verify <pattern-id>\n'));
        }

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // Add verify subcommand
  validateCommand
    .command('verify <pattern-id>')
    .description('Mark a pattern as verified by Cursor')
    .option('--notes <notes>', 'Add verification notes')
    .action(async (patternId: string, options: { notes?: string }) => {
      try {
        const validator = new Validator();
        await validator.verifyPattern(patternId, options.notes);
        
        console.log(chalk.green(`\n✅ Pattern ${patternId} marked as verified`));
        if (options.notes) {
          console.log(chalk.gray(`   Notes: ${options.notes}`));
        }
        console.log(chalk.gray(`   Verified at: ${new Date().toISOString()}\n`));
        console.log(chalk.cyan('💡 Verification saved to .ai-context/validation-results.json'));
        console.log(chalk.gray('   Pre-commit hook will use this verification\n'));
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // Add status subcommand
  validateCommand
    .command('status')
    .description('Show validation and verification status')
    .action(async () => {
      try {
        const validator = new Validator();
        const cached = await validator.loadValidationResults();
        
        if (!cached) {
          console.log(chalk.yellow('\n⚠️  No cached validation results found\n'));
          console.log(chalk.gray('   Run: npx ai-workflow validate --save\n'));
          return;
        }

        console.log(chalk.bold.blue('\n📊 Validation Results Status\n'));
        console.log(chalk.gray(`   Timestamp: ${cached.timestamp}`));
        console.log(chalk.gray(`   Task ID: ${cached.taskId || 'N/A'}`));
        console.log(chalk.gray(`   Commit Hash: ${cached.commitHash || 'N/A'}`));
        console.log(chalk.gray(`   Overall: ${cached.overall ? chalk.green('✅ Passed') : chalk.red('❌ Failed')}\n`));

        const verifiedCount = Object.keys(cached.cursorVerified).length;
        if (verifiedCount > 0) {
          console.log(chalk.bold('Verified Patterns:'));
          for (const [patternId, verification] of Object.entries(cached.cursorVerified)) {
            console.log(chalk.green(`   ✅ ${patternId}`));
            if (verification.notes) {
              console.log(chalk.gray(`      Notes: ${verification.notes}`));
            }
            console.log(chalk.gray(`      Verified at: ${verification.verifiedAt}`));
          }
          console.log('');
        } else {
          console.log(chalk.yellow('   No patterns verified yet\n'));
        }

        // Check staleness
        const isStale = await validator.isResultsStale(cached);
        if (isStale) {
          console.log(chalk.yellow('⚠️  Results are stale (code/task changed or >30 min old)'));
          console.log(chalk.gray('   Run: npx ai-workflow validate --save to refresh\n'));
        } else {
          console.log(chalk.green('✅ Results are fresh and ready to use\n'));
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

