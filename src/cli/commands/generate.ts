/**
 * Generate CLI Command for Core Build
 * Generates test plans and other artifacts
 * @requirement REQ-V2-022 - Generate command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TestPlanGenerator } from '../../utils/test-plan-generator.js';
import path from 'path';

/**
 * Register generate command
 * @requirement REQ-V2-022 - CLI generate command
 */
export function registerGenerateCommand(program: Command): void {
  const generate = new Command('generate')
    .description('Generate test plans and artifacts');

  // generate test-plan
  generate
    .command('test-plan <file>')
    .description('Generate test plan for a source file')
    .option('-o, --output <path>', 'Output file path')
    .action(async (file: string, options: { output?: string }) => {
      try {
        const generator = new TestPlanGenerator();
        const plan = await generator.generateForFile(file);
        
        // Determine output path
        const outputPath = options.output || 
          `docs/test-plans/${path.basename(file, '.ts')}-test-plan.md`;
        
        await generator.save(plan, outputPath);
        
        console.log(chalk.green('✅ Test plan generated!'));
        console.log('');
        console.log(`  File: ${file}`);
        console.log(`  Tests: ${plan.totalTests} cases`);
        console.log(`  Output: ${outputPath}`);
        console.log('');
        console.log(chalk.gray('💡 Review and customize the generated test plan\n'));
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  program.addCommand(generate);
}

