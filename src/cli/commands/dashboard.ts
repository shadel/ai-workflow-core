/**
 * Dashboard CLI Command
 * @requirement FREE-TIER-003 - CLI Dashboard
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskQueueManager } from '../../core/task-queue.js';
import { DashboardGenerator } from '../../core/dashboard-generator.js';
import { DashboardRenderer } from '../../utils/dashboard-renderer.js';

/**
 * Register dashboard command
 */
export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .alias('dash')
    .description('Show project dashboard with task overview')
    .option('--json', 'Output in JSON format')
    .action(async (options: { json?: boolean }) => {
      try {
        const queueManager = new TaskQueueManager();
        const generator = new DashboardGenerator(queueManager);
        const renderer = new DashboardRenderer();

        const data = await generator.generate();

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        // Render rich dashboard
        const output = renderer.render(data);
        console.log(output);
        console.log(''); // Extra line for spacing
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

