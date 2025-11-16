/**
 * Task CLI Commands for Core Build
 * @requirement REQ-V2-003
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskManager } from '../../core/task-manager.js';
import { WorkflowState } from '@shadel/workflow-core';
import fs from 'fs-extra';
import path from 'path';

const taskManager = new TaskManager();

/**
 * Register task commands
 * @requirement REQ-V2-003 - Rich CLI for task management
 */
export function registerTaskCommands(program: Command): void {
  const task = new Command('task')
    .description('Manage workflow tasks');

  // task create
  task
    .command('create <goal>')
    .description('Create a new workflow task')
    .option('--satisfies <req>', 'Link to requirement (e.g., REQ-V2-003)')
    .action(async (goal: string, options: { satisfies?: string }) => {
      try {
        const requirements = options.satisfies ? [options.satisfies] : [];
        const createdTask = await taskManager.createTask(goal, requirements);
        
        console.log(chalk.green('✅ Task created!'));
        console.log('');
        console.log(`  ID: ${createdTask.id}`);
        console.log(`  Goal: ${goal}`);
        console.log(`  State: ${createdTask.status}`);
        if (requirements.length > 0) {
          console.log(`  🔗 Linked to requirements: ${requirements.join(', ')}`);
        }
        console.log('');
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // task status
  task
    .command('status')
    .description('Show current task status')
    .option('--json', 'Output in JSON format')
    .action(async (options: { json?: boolean }) => {
      try {
        const current = await taskManager.getCurrentTask();
        
        // BUG-FIX: Check for completed tasks when getCurrentTask returns null
        if (!current) {
          const taskFile = path.join('.ai-context', 'current-task.json');
          
          // Check if a completed task exists
          if (await fs.pathExists(taskFile)) {
            try {
              const taskData = await fs.readJson(taskFile);
              
              if (taskData.status === 'completed') {
                // Show completed task information
                if (options.json) {
                  console.log(JSON.stringify({
                    success: true,
                    data: {
                      id: taskData.taskId,
                      goal: taskData.originalGoal,
                      status: 'completed',
                      state: taskData.workflow?.currentState,
                      startedAt: taskData.startedAt,
                      completedAt: taskData.completedAt
                    }
                  }, null, 2));
                } else {
                  console.log(chalk.bold.green('\n✅ Task Completed\n'));
                  console.log(chalk.bold('Task Information:'));
                  console.log(`  ID: ${chalk.cyan(taskData.taskId)}`);
                  console.log(`  Goal: ${chalk.white(taskData.originalGoal)}`);
                  console.log(`  Started: ${chalk.gray(taskData.startedAt)}`);
                  console.log(`  Completed: ${chalk.green(taskData.completedAt)}`);
                  console.log('');
                  console.log(chalk.gray('💡 Create a new task: npx ai-workflow task create "<goal>"\n'));
                }
                return;
              }
            } catch (readError) {
              // If we can't read the task file, fall through to "No active task"
            }
          }
          
          // No active task and no completed task
          if (options.json) {
            console.log(JSON.stringify({ success: false, message: 'No active task' }));
          } else {
            console.log(chalk.yellow('⚠️  No active task'));
            console.log('');
            console.log('  Create one with: npx ai-workflow task create "<goal>"');
          }
          return;
        }

        const progress = taskManager.getProgress();
        
        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            data: {
              id: current.id,
              goal: current.goal,
              state: current.status,
              progress,
              startedAt: current.startedAt
            }
          }, null, 2));
          return;
        }

        // Rich text output (Phase 2.8 enhancement)
        console.log(chalk.bold.blue('\n📋 Current Task Status\n'));
        console.log(chalk.bold('Task Information:'));
        console.log(`  ID: ${chalk.cyan(current.id)}`);
        console.log(`  Goal: ${chalk.white(current.goal)}`);
        console.log(`  Started: ${chalk.gray(current.startedAt)}`);
        console.log('');
        
        console.log(chalk.bold('Workflow Progress:'));
        console.log(`  State: ${chalk.green(current.status)}`);
        console.log(`  Progress: ${chalk.yellow(progress + '%')}`);
        console.log('');
        
        // Show workflow visualization
        const states = [
          'UNDERSTANDING',
          'DESIGNING',
          'IMPLEMENTING',
          'TESTING',
          'REVIEWING',
          'READY_TO_COMMIT'
        ];
        
        console.log(chalk.bold('Workflow Steps:'));
        states.forEach(state => {
          const icon = state === current.status ? '⏳' :
                      states.indexOf(state) < states.indexOf(current.status as WorkflowState) ? '✅' : '⏸️';
          const color = state === current.status ? chalk.yellow :
                       states.indexOf(state) < states.indexOf(current.status as WorkflowState) ? chalk.green : chalk.gray;
          console.log(`  ${icon} ${color(state)}`);
        });
        console.log('');
        
        console.log(chalk.gray('💡 Tip: Check .ai-context/NEXT_STEPS.md for detailed guidance\n'));
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // task complete
  task
    .command('complete')
    .description('Complete current task')
    .action(async () => {
      try {
        const current = await taskManager.getCurrentTask();
        
      if (!current) {
        // BUG-FIX: Check if task already completed (better UX)
        const taskFile = path.join('.ai-context', 'current-task.json');
        
        if (await fs.pathExists(taskFile)) {
          try {
            const taskData = await fs.readJson(taskFile);
            
            if (taskData.status === 'completed') {
              // Task already completed - show success message (not error!)
              console.log(chalk.green('✅ Task already completed!'));
              console.log('');
              console.log(chalk.bold('Task Information:'));
              console.log(`  ID: ${chalk.cyan(taskData.taskId)}`);
              console.log(`  Goal: ${chalk.white(taskData.originalGoal)}`);
              console.log(`  Started: ${chalk.gray(taskData.startedAt)}`);
              console.log(`  Completed: ${chalk.green(taskData.completedAt)}`);
              console.log('');
              
              // Calculate and display duration
              if (taskData.startedAt && taskData.completedAt) {
                const start = new Date(taskData.startedAt);
                const end = new Date(taskData.completedAt);
                const diff = end.getTime() - start.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                
                console.log(chalk.bold('Duration:'));
                if (hours > 0) {
                  console.log(`  ${chalk.yellow(`${hours}h ${minutes}m`)}`);
                } else {
                  console.log(`  ${chalk.yellow(`${minutes}m`)}`);
                }
                console.log('');
              }
              
              console.log(chalk.gray('💡 Create a new task: npx ai-workflow task create "<goal>"\n'));
              process.exit(0); // Success exit code!
            }
          } catch (error) {
            // Corrupted task file, treat as no task
          }
        }
        
        // Truly no active task
        console.error(chalk.red('❌ Error: No active task to complete'));
        console.error(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
        process.exit(1);
      }

        await taskManager.completeTask();
        
        console.log(chalk.green('✅ Task completed!'));
        console.log('');
        console.log(`  Task: ${current.goal}`);
        console.log(`  Completed at: ${new Date().toISOString()}`);
        console.log('');
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // task list - NEW for v2.0
  task
    .command('list')
    .description('List all tasks (current and history)')
    .option('--status <status>', 'Filter by status')
    .option('--limit <n>', 'Limit results', '10')
    .option('--json', 'Output in JSON format')
    .action(async (options: { status?: string; limit?: string; json?: boolean }) => {
      try {
        const limit = parseInt(options.limit || '10', 10);
        const tasks = await taskManager.listTasks(options.status, limit);
        
        if (tasks.length === 0) {
          if (options.json) {
            console.log(JSON.stringify({ success: true, data: [] }));
          } else {
            console.log(chalk.yellow('⚠️  No tasks found'));
          }
          return;
        }

        if (options.json) {
          console.log(JSON.stringify({ success: true, data: tasks }, null, 2));
          return;
        }

        // Rich text output
        console.log(chalk.bold.blue('\n📋 Tasks\n'));
        
        for (const task of tasks) {
          const icon = task.status === 'READY_TO_COMMIT' ? '✅' :
                      task.status === 'IMPLEMENTING' ? '⏳' :
                      task.status === 'TESTING' ? '⏳' :
                      task.status === 'REVIEWING' ? '⏳' : '⏸️';
          
          const statusColor = task.status === 'READY_TO_COMMIT' ? chalk.green :
                             task.status === 'IMPLEMENTING' ? chalk.yellow :
                             task.status === 'TESTING' ? chalk.yellow :
                             task.status === 'REVIEWING' ? chalk.yellow : chalk.gray;
          
          console.log(`${icon} ${chalk.cyan(task.id)} ${statusColor('(' + task.status + ')')}`);
          console.log(`   ${chalk.white(task.goal)}`);
          console.log(`   ${chalk.gray('Started: ' + task.startedAt)}`);
          if (task.completedAt) {
            console.log(`   ${chalk.gray('Completed: ' + task.completedAt)}`);
          }
          console.log('');
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // task update - NEW for v2.0
  task
    .command('update [taskId]')
    .description('Update task details (defaults to current task)')
    .option('--goal <goal>', 'Update goal')
    .option('--add-req <req>', 'Link additional requirement')
    .action(async (taskId: string | undefined, options: { goal?: string; addReq?: string }) => {
      try {
        // If no taskId provided, use current task
        let targetTask;
        if (!taskId) {
          targetTask = await taskManager.getCurrentTask();
          if (!targetTask) {
            console.log(chalk.yellow('⚠️  No active task to update'));
            return;
          }
          taskId = targetTask.id;
        }

        // Check if any updates provided
        if (!options.goal && !options.addReq) {
          console.error(chalk.red('❌ Error: No updates provided'));
          console.log('');
          console.log('Available options:');
          console.log('  --goal <goal>      Update task goal');
          console.log('  --add-req <req>    Link additional requirement');
          console.log('');
          process.exit(1);
        }

        // Perform update
        await taskManager.updateTask(taskId, options);
        
        console.log(chalk.green('✅ Task updated!'));
        console.log('');
        console.log(`  Task ID: ${taskId}`);
        if (options.goal) {
          console.log(`  New goal: ${options.goal}`);
        }
        if (options.addReq) {
          console.log(`  Added requirement: ${options.addReq}`);
        }
        console.log('');
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  program.addCommand(task);
}

