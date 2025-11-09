/**
 * Basic Pre-Commit Hook for Core Build
 * Simplified version - validates workflow state only
 * @requirement REQ-V2-003 - Git hooks (basic)
 */

import { Validator } from '../core/validator.js';
import chalk from 'chalk';

/**
 * Pre-commit hook - validates before allowing commit
 * @requirement REQ-V2-003 - Basic pre-commit validation
 */
export async function preCommitHook(): Promise<number> {
  console.log(chalk.bold.blue('\n🔍 Pre-Commit Validation (Core)\n'));

  try {
    const validator = new Validator();
    const results = await validator.validateAll();

    if (results.overall) {
      console.log(chalk.green('✅ Validation passed - commit allowed\n'));
      return 0; // Allow commit
    }

    // Validation failed
    console.log(chalk.red('❌ Validation failed\n'));

    if (!results.workflow.passed) {
      console.log(chalk.yellow(`  Workflow: ${results.workflow.message}`));
    }
    if (!results.files.passed) {
      console.log(chalk.yellow(`  Files: ${results.files.message}`));
    }

    console.log(chalk.yellow('\n💡 Fix issues and try again, or use --no-verify to bypass\n'));
    
    return 1; // Block commit
    
  } catch (error) {
    console.error(chalk.red('❌ Hook error:'), (error as Error).message);
    console.log(chalk.yellow('\n💡 Use --no-verify to bypass if needed\n'));
    return 1;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  preCommitHook().then(code => process.exit(code));
}

