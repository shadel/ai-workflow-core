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
    .description('Create a new workflow task (auto-queued if active task exists)')
    .option('--satisfies <req>', 'Link to requirement (e.g., REQ-V2-003)')
    .option('--priority <priority>', 'Task priority: CRITICAL, HIGH, MEDIUM, LOW (auto-detected if not provided)')
    .option('--estimate <time>', 'Estimated time (e.g., "2 days", "4 hours", "1 week")')
    .option('--tags <tags>', 'Comma-separated tags (e.g., "auth,api,security")')
    .option('--force', 'Force switch to new task immediately (deactivates current active task)')
    .addHelpText('after', `
Examples:
  $ npx ai-workflow task create "Fix critical bug" --priority CRITICAL
  $ npx ai-workflow task create "Add feature" --estimate "2 days" --tags "api,frontend"
  $ npx ai-workflow task create "Refactor code" --priority LOW

Note:
  - If an active task exists, new tasks are automatically queued
  - Priority is auto-detected from goal text if not specified
  - Use "task switch <id>" to activate a queued task
  - Use "task list" to see all tasks`)
    .action(async (goal: string, options: { satisfies?: string; priority?: string; estimate?: string; tags?: string; force?: boolean }) => {
      try {
        const requirements = options.satisfies ? [options.satisfies] : [];
        const createdTask = await taskManager.createTask(goal, requirements, options.force || false);
        
        // Check queue status from TaskQueueManager (queueTask.status is QUEUED/ACTIVE, not WorkflowState)
        const { TaskQueueManager } = await import('../../core/task-queue.js');
        const queueManager = new TaskQueueManager();
        const queueTasks = await queueManager.listTasks({ limit: 100 });
        const queueTask = queueTasks.find(t => t.id === createdTask.id);
        const queueStatus = queueTask?.status || 'ACTIVE'; // Default to ACTIVE if not found
        
        // Check if task was queued (active task exists)
        const currentTask = await taskManager.getCurrentTask();
        const isQueued = queueStatus === 'QUEUED' || (currentTask && currentTask.id !== createdTask.id);
        
        console.log(chalk.green('✅ Task created!'));
        console.log('');
        console.log(`  ID: ${createdTask.id}`);
        console.log(`  Goal: ${goal}`);
        console.log(`  Status: ${queueStatus === 'QUEUED' ? chalk.yellow('QUEUED') : chalk.green('ACTIVE')}`);
        
        if (isQueued) {
          console.log('');
          console.log(chalk.yellow(`  ⚠️  Task queued (active task: "${currentTask?.goal}")`));
          console.log(chalk.gray(`  Use "npx ai-workflow task switch ${createdTask.id}" to activate`));
          console.log(chalk.gray(`  Or continue with current task and switch later`));
        } else {
          console.log(chalk.gray(`  State: ${createdTask.status}`));
        }
        if (requirements.length > 0) {
          console.log(`  🔗 Linked to requirements: ${requirements.join(', ')}`);
        }
        console.log('');
        
        // Cursor Integration: Print reload prompt so Cursor reads updated context
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.cyan('📢 FOR AI ASSISTANTS (Cursor/Copilot):'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('⚠️  Context files have been updated!'));
        console.log(chalk.cyan('   Please reload these files NOW:'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('   1. Read: .ai-context/STATUS.txt'));
        console.log(chalk.cyan('   2. Read: .ai-context/NEXT_STEPS.md'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('   (Files contain new task queue information)'));
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
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
        // Check file first to see if task is already completed
        // This handles cases where file shows completed but queue doesn't
        // Use TaskManager's taskFile but resolve relative to process.cwd() if it's relative
        let taskFile = (taskManager as any).taskFile;
        if (!path.isAbsolute(taskFile)) {
          taskFile = path.resolve(process.cwd(), taskFile);
        }
        
        if (await fs.pathExists(taskFile)) {
          try {
            const taskData = await fs.readJson(taskFile);
            if (taskData.status === 'completed' || taskData.completedAt) {
              // Task already completed - show success message
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
              process.exit(0);
            }
          } catch (error) {
            // Corrupted file, continue to normal flow
          }
        }
        
        const current = await taskManager.getCurrentTask();
        
        if (!current) {
          // Truly no active task
          console.error(chalk.red('❌ Error: No active task to complete'));
          console.error(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
          process.exit(1);
        }

        // Try to complete task - it will return status if already completed
        const result = await taskManager.completeTask();
        
        // If task was already completed, show appropriate message
        if (result.alreadyCompleted) {
          // Read task data to show completion info
          const contextDir = (taskManager as any).contextDir || '.ai-context';
          const taskFile = path.isAbsolute(contextDir)
            ? path.join(contextDir, 'current-task.json')
            : path.join(process.cwd(), contextDir, 'current-task.json');
          
          if (await fs.pathExists(taskFile)) {
            try {
              const taskData = await fs.readJson(taskFile);
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
              process.exit(0);
            } catch (error) {
              // Fall through to normal completion message
            }
          }
        }
        
        // Check if next task was auto-activated
        const nextTask = await taskManager.getCurrentTask();
        const wasAutoActivated = nextTask && nextTask.id !== current.id;
        
        console.log(chalk.green('✅ Task completed!'));
        console.log('');
        console.log(`  Task: ${current.goal}`);
        console.log(`  Completed at: ${new Date().toISOString()}`);
        console.log('');
        
        if (wasAutoActivated && nextTask) {
          console.log(chalk.cyan('🔄 Next task auto-activated:'));
          console.log(`  ID: ${nextTask.id}`);
          console.log(`  Goal: ${nextTask.goal}`);
          console.log(`  State: ${nextTask.status}`);
          console.log('');
        }
        
        // Cursor Integration: Print reload prompt
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.cyan('📢 FOR AI ASSISTANTS (Cursor/Copilot):'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('⚠️  Context files have been updated!'));
        console.log(chalk.cyan('   Please reload these files NOW:'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('   1. Read: .ai-context/STATUS.txt'));
        console.log(chalk.cyan('   2. Read: .ai-context/NEXT_STEPS.md'));
        console.log(chalk.cyan(''));
        if (wasAutoActivated) {
          console.log(chalk.cyan('   (Next task has been auto-activated)'));
        } else {
          console.log(chalk.cyan('   (No tasks in queue)'));
        }
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        
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
        
        // Helper function for priority emoji
        const getPriorityEmoji = (priority?: string) => {
          const emojiMap: Record<string, string> = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🟢'
          };
          return priority ? emojiMap[priority] || '⚪' : '';
        };
        
        // Get queue tasks for priority info
        let queueTasks: any[] = [];
        try {
          const { TaskQueueManager } = await import('../../core/task-queue.js');
          const queueManager = new TaskQueueManager();
          queueTasks = await queueManager.listTasks({ limit: 100 });
        } catch {
          // Queue not available, skip priority
        }
        
        for (const task of tasks) {
          const icon = task.status === 'READY_TO_COMMIT' ? '✅' :
                      task.status === 'IMPLEMENTING' ? '⏳' :
                      task.status === 'TESTING' ? '⏳' :
                      task.status === 'REVIEWING' ? '⏳' : '⏸️';
          
          const statusColor = task.status === 'READY_TO_COMMIT' ? chalk.green :
                             task.status === 'IMPLEMENTING' ? chalk.yellow :
                             task.status === 'TESTING' ? chalk.yellow :
                             task.status === 'REVIEWING' ? chalk.yellow : chalk.gray;
          
          // Get priority from queue
          const matchingTask = queueTasks.find(t => t.id === task.id);
          const priorityDisplay = matchingTask?.priority ? ` ${getPriorityEmoji(matchingTask.priority)} ${matchingTask.priority}` : '';
          
          console.log(`${icon} ${chalk.cyan(task.id)} ${statusColor('(' + task.status + ')')}${priorityDisplay}`);
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

  // task switch - NEW for Free Tier (v3.1.0+)
  task
    .command('switch <taskId>')
    .description('Switch active task (activate a queued task)')
    .addHelpText('after', `
Examples:
  $ npx ai-workflow task switch task-1234567890
  $ npx ai-workflow task list  # First, find task ID
  $ npx ai-workflow task switch task-1234567890

Note:
  - Only QUEUED tasks can be activated
  - Current active task will be moved back to QUEUED
  - Use "task list" to see all available tasks`)
    .action(async (taskId: string) => {
      try {
        const { TaskQueueManager } = await import('../../core/task-queue.js');
        const queueManager = new TaskQueueManager();
        
        const activatedTask = await queueManager.activateTask(taskId);
        
        console.log(chalk.green('✅ Task activated!'));
        console.log('');
        console.log(`  ID: ${activatedTask.id}`);
        console.log(`  Goal: ${activatedTask.goal}`);
        console.log(`  Priority: ${activatedTask.priority || 'MEDIUM'}`);
        console.log(`  Status: ${chalk.yellow('ACTIVE')}`);
        console.log('');
        
        // Fix 2 & 4: Sync file directly (don't call updateTaskState)
        // Get existing file data to preserve requirements
        const taskFile = path.join('.ai-context', 'current-task.json');
        const existingData = await fs.pathExists(taskFile)
          ? await fs.readJson(taskFile).catch(() => ({}))
          : {};
        const preserveFields = existingData.requirements ? ['requirements'] : [];
        
        // Use TaskManager's syncFileFromQueue method (via private access)
        // Since it's private, we'll sync manually here
        const taskData = {
          ...(preserveFields.length > 0 ? { requirements: existingData.requirements } : {}),
          taskId: activatedTask.id,
          originalGoal: activatedTask.goal,
          status: 'in_progress',
          startedAt: activatedTask.createdAt,
          workflow: activatedTask.workflow || {
            currentState: 'UNDERSTANDING',
            stateEnteredAt: activatedTask.createdAt,
            stateHistory: []
          }
        };
        await fs.writeJson(taskFile, taskData, { spaces: 2 });
        await new Promise(resolve => setImmediate(resolve));
        
        // Update context files
        await taskManager.getContextInjector().updateAfterCommand('task.switch', {
          task: {
            id: activatedTask.id,
            goal: activatedTask.goal,
            status: activatedTask.workflow?.currentState || 'UNDERSTANDING',
            startedAt: activatedTask.createdAt,
            roleApprovals: []
          },
          warnings: [],
          blockers: [],
          activeRoles: [],
          localRules: []
        });
        
        // Cursor Integration: Print reload prompt
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.cyan('📢 FOR AI ASSISTANTS (Cursor/Copilot):'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('⚠️  Context files have been updated!'));
        console.log(chalk.cyan('   Please reload these files NOW:'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('   1. Read: .ai-context/STATUS.txt'));
        console.log(chalk.cyan('   2. Read: .ai-context/NEXT_STEPS.md'));
        console.log(chalk.cyan(''));
        console.log(chalk.cyan('   (Active task has changed)'));
        console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
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

