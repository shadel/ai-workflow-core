/**
 * Checklist CLI Commands
 * 
 * Phase 4.3: CLI commands for checklist management
 * Commands for viewing, marking, and managing state checklists
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskManager } from '../../core/task-manager.js';
import { StateChecklistService } from '../../core/state-checklist-service.js';
import { ChecklistRegistry } from '../../core/checklist-registry.js';
import { PatternProvider } from '../../core/pattern-provider.js';
import { TaskQueueManager } from '../../core/task-queue.js';
import { TaskFileSync } from '../../core/task-file-sync.js';
import type { WorkflowState } from '@shadel/workflow-core';
import fs from 'fs-extra';
import path from 'path';

const taskManager = new TaskManager();
const contextDir = '.ai-context';
const taskFile = path.join(contextDir, 'current-task.json');

/**
 * Get StateChecklistService instance
 */
function getChecklistService(): StateChecklistService {
  const queueManager = new TaskQueueManager(contextDir);
  const fileSync = new TaskFileSync(contextDir);
  const registry = new ChecklistRegistry();
  
  // Get PatternProvider from ContextInjector (via TaskManager's contextInjector)
  const contextInjector = taskManager.getContextInjector();
  const patternProvider = contextInjector.getPatternProvider();
  
  return new StateChecklistService(
    queueManager,
    fileSync,
    taskFile,
    registry,
    patternProvider
  );
}

/**
 * Register checklist commands
 * Phase 4.3: Checklist management commands
 */
export function registerChecklistCommands(program: Command): void {
  const checklist = new Command('checklist')
    .description('Manage state checklists');

  // checklist status
  checklist
    .command('status')
    .description('Show current state checklist status')
    .option('--state <state>', 'Show checklist for specific state (default: current state)')
    .addHelpText('after', `
Examples:
  $ npx ai-workflow checklist status
  $ npx ai-workflow checklist status --state TESTING

Shows checklist items for the current or specified state, including:
  - Required vs optional items
  - Completion status
  - Pattern-based items
`)
    .action(async (options: { state?: string }) => {
      try {
        const checklistService = getChecklistService();
        
        // Get current state if not specified
        let state: WorkflowState;
        if (options.state) {
          state = options.state.toUpperCase() as WorkflowState;
        } else {
          // Get current state from task
          if (!await fs.pathExists(taskFile)) {
            console.error(chalk.red('❌ No active task found. Create a task first:'));
            console.error(chalk.gray('  npx ai-workflow task create "<goal>"'));
            process.exit(1);
          }
          
          const taskData = await fs.readJson(taskFile);
          state = (taskData.workflow?.currentState || 'UNDERSTANDING') as WorkflowState;
        }
        
        // Load checklist for state
        const checklist = await checklistService.loadStateChecklist(state);
        
        if (!checklist) {
          console.log(chalk.yellow(`⚠️  No checklist found for ${state} state.`));
          console.log(chalk.gray(`   Initializing checklist...`));
          
          await checklistService.initializeStateChecklist(state);
          
          // Reload after initialization
          const newChecklist = await checklistService.loadStateChecklist(state);
          if (newChecklist) {
            checklistService.displayChecklist(newChecklist, state);
          }
        } else {
          console.log(chalk.cyan(`\n📋 Checklist for ${state} State\n`));
          checklistService.displayChecklist(checklist, state);
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // checklist check
  checklist
    .command('check <item-id>')
    .description('Mark a checklist item as complete (evidence required)')
    .option('--state <state>', 'State for the checklist item (default: current state)')
    .option('--evidence <type>', 'Evidence type: file_created, file_modified, command_run, test_passed, validation_passed, manual, other')
    .option('--files <files>', 'Comma-separated file paths (for file_created/file_modified)')
    .option('--command <command>', 'Command that was run (for command_run)')
    .option('--output <output>', 'Command output (for command_run)')
    .option('--description <description>', 'Evidence description (required)')
    .option('--manual-notes <notes>', 'Manual notes (for manual evidence)')
    .addHelpText('after', `
Examples:
  $ npx ai-workflow checklist check understand-requirements --evidence manual --description "Discussed requirements with user"
  $ npx ai-workflow checklist check write-code --evidence file_created --files "src/auth.ts,src/auth.test.ts" --description "Created authentication module"
  $ npx ai-workflow checklist check run-tests --state TESTING --evidence test_passed --description "All tests passing"

Evidence is REQUIRED for all checklist items. Evidence types:
  - file_created: Files were created (requires --files)
  - file_modified: Files were modified (requires --files)
  - command_run: Command was executed (requires --command)
  - test_passed: Tests passed (auto-detected from test output)
  - validation_passed: Validation passed (auto-detected)
  - manual: Manual completion with notes (requires --manual-notes)
  - other: Other evidence type (requires --description)
`)
    .action(async (itemId: string, options: { 
      state?: string;
      evidence?: string;
      files?: string;
      command?: string;
      output?: string;
      description?: string;
      manualNotes?: string;
    }) => {
      try {
        const checklistService = getChecklistService();
        
        // Get current state if not specified
        let state: WorkflowState;
        if (options.state) {
          state = options.state.toUpperCase() as WorkflowState;
        } else {
          if (!await fs.pathExists(taskFile)) {
            console.error(chalk.red('❌ No active task found.'));
            process.exit(1);
          }
          
          const taskData = await fs.readJson(taskFile);
          state = (taskData.workflow?.currentState || 'UNDERSTANDING') as WorkflowState;
        }
        
        // Load checklist to check if evidence is required
        const checklist = await checklistService.loadStateChecklist(state);
        if (!checklist) {
          console.error(chalk.red(`❌ No checklist found for ${state} state.`));
          process.exit(1);
        }
        
        const item = checklist.items.find(i => i.id === itemId);
        if (!item) {
          console.error(chalk.red(`❌ Checklist item "${itemId}" not found.`));
          process.exit(1);
        }
        
        // Build evidence object
        let evidence: any = undefined;
        
        if (options.evidence || item.evidenceRequired) {
          if (!options.evidence) {
            console.error(chalk.red(`❌ Evidence is REQUIRED for item "${item.title}"`));
            console.error(chalk.yellow(`   Use: --evidence <type> [options]`));
            console.error(chalk.gray(`   Example: --evidence file_created --files "src/file.ts" --description "Created file"`));
            process.exit(1);
          }
          
          const evidenceType = options.evidence as any;
          
          // Validate required fields based on evidence type
          if (!options.description && evidenceType !== 'test_passed' && evidenceType !== 'validation_passed') {
            console.error(chalk.red(`❌ --description is required for evidence type "${evidenceType}"`));
            process.exit(1);
          }
          
          evidence = {
            type: evidenceType,
            description: options.description || `Evidence for ${item.title}`,
            timestamp: new Date().toISOString()
          };
          
          // Add type-specific fields
          if (evidenceType === 'file_created' || evidenceType === 'file_modified') {
            if (!options.files) {
              console.error(chalk.red(`❌ --files is required for evidence type "${evidenceType}"`));
              process.exit(1);
            }
            evidence.files = options.files.split(',').map((f: string) => f.trim());
          }
          
          if (evidenceType === 'command_run') {
            if (!options.command) {
              console.error(chalk.red(`❌ --command is required for evidence type "${evidenceType}"`));
              process.exit(1);
            }
            evidence.command = options.command;
            if (options.output) {
              evidence.output = options.output;
            }
          }
          
          if (evidenceType === 'manual') {
            if (!options.manualNotes) {
              console.error(chalk.red(`❌ --manual-notes is required for evidence type "manual"`));
              process.exit(1);
            }
            evidence.manualNotes = options.manualNotes;
          }
        }
        
        // Mark item complete with evidence
        await checklistService.markItemComplete(state, itemId, evidence);
        
        console.log(chalk.green(`✅ Checklist item "${item.title}" marked as complete.`));
        if (evidence) {
          console.log(chalk.gray(`   Evidence: ${evidence.type} - ${evidence.description}`));
        }
        
        // Show updated checklist
        const updatedChecklist = await checklistService.loadStateChecklist(state);
        if (updatedChecklist) {
          console.log(chalk.cyan(`\n📋 Updated Checklist for ${state} State\n`));
          checklistService.displayChecklist(updatedChecklist, state);
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // checklist execute (for automated items - placeholder)
  checklist
    .command('execute <item-id>')
    .description('Execute an automated checklist item')
    .option('--state <state>', 'State for the checklist item (default: current state)')
    .addHelpText('after', `
Examples:
  $ npx ai-workflow checklist execute run-validation
  $ npx ai-workflow checklist execute generate-tests --state TESTING

Executes an automated checklist item (if supported).
Currently, most items require manual completion.
`)
    .action(async (itemId: string, options: { state?: string }) => {
      try {
        const checklistService = getChecklistService();
        
        // Get current state if not specified
        let state: WorkflowState;
        if (options.state) {
          state = options.state.toUpperCase() as WorkflowState;
        } else {
          if (!await fs.pathExists(taskFile)) {
            console.error(chalk.red('❌ No active task found.'));
            process.exit(1);
          }
          
          const taskData = await fs.readJson(taskFile);
          state = (taskData.workflow?.currentState || 'UNDERSTANDING') as WorkflowState;
        }
        
        // Check if item is automated
        const checklist = await checklistService.loadStateChecklist(state);
        if (!checklist) {
          console.error(chalk.red(`❌ No checklist found for ${state} state.`));
          process.exit(1);
        }
        
        const item = checklist.items.find(i => i.id === itemId);
        if (!item) {
          console.error(chalk.red(`❌ Checklist item "${itemId}" not found.`));
          process.exit(1);
        }
        
        // For now, automated execution is not implemented
        // This is a placeholder for future enhancement
        console.log(chalk.yellow(`⚠️  Automated execution not yet implemented for "${itemId}".`));
        console.log(chalk.gray(`   Please complete this item manually using:`));
        console.log(chalk.gray(`   npx ai-workflow checklist check ${itemId}`));
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  program.addCommand(checklist);
}

