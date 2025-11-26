/**
 * Context Injector for AI Memory
 * Auto-updates context files after every workflow command
 * @requirement REQ-V2-010 - Context Injection System
 */

import fs from 'fs-extra';
import path from 'path';
import type { Task, WorkflowState } from '@shadel/workflow-core';
import { Role } from '../roles/role-definitions.js';
import { RuleManager } from '../utils/rule-manager.js';
import { PatternProvider } from './pattern-provider.js';
import { TaskQueueManager } from './task-queue.js';

/**
 * Context for injection
 * @requirement REQ-V2-010 - AI Memory context structure
 * @requirement REQ-V2-011 - Include active roles
 */
export interface ContextInjectionContext {
  task: Task;
  warnings?: string[];
  nextSteps?: string[];
  blockers?: string[];
  activeRoles?: Role[];  // Phase 2.3 - Role checklists
  localRules?: any[];  // v3.0.3 - Local project rules from rules.json
}

interface NextStep {
  action: string;
  command?: string;
  why: string;
}

/**
 * Context Injector - Auto-updates context files for AI
 * @requirement REQ-V2-010 - Core value proposition: AI memory
 */
export class ContextInjector {
  private contextDir: string;
  private ruleManager: RuleManager;
  private patternProvider: PatternProvider;
  private queueManager: TaskQueueManager;

  constructor(contextDir = '.ai-context') {
    this.contextDir = contextDir;
    this.ruleManager = new RuleManager();  // v3.0.3 - Rules integration
    this.patternProvider = new PatternProvider();  // State-based pattern system
    this.queueManager = new TaskQueueManager(contextDir);
  }

  /**
   * Update all context files after workflow command
   * @requirement REQ-V2-010 - Auto-update after every command
   */
  async updateAfterCommand(
    command: string,
    context: ContextInjectionContext
  ): Promise<void> {
    await fs.ensureDir(this.contextDir);

    // Validate context.task matches queue active task
    try {
      const activeTask = await this.queueManager.getActiveTask();
      
      if (activeTask && context.task.id !== activeTask.id) {
        console.warn(`⚠️  Warning: context.task.id (${context.task.id}) != queue activeTask.id (${activeTask.id})`);
        console.warn(`   Using queue active task for context files`);
        
        // Use queue task instead of context.task
        context.task = {
          id: activeTask.id,
          goal: activeTask.goal,
          status: activeTask.workflow?.currentState || 'UNDERSTANDING',
          startedAt: activeTask.createdAt,
          roleApprovals: []
        };
      }
    } catch (error) {
      // Fallback to context.task if queue read fails
      console.warn(`⚠️  Warning: Could not validate context.task against queue: ${(error as Error).message}`);
      console.warn(`   Using context.task as-is`);
    }

    // Update STATUS.txt
    await this.generateStatusFile(context);

    // Update NEXT_STEPS.md
    await this.generateNextStepsFile(command, context);

    // Update WARNINGS.md (if warnings exist)
    if (context.warnings && context.warnings.length > 0) {
      await this.generateWarningsFile(context);
    } else {
      // Clear warnings if none
      await this.clearWarnings();
    }
  }

  /**
   * Generate STATUS.txt - Always current workflow status
   * @requirement REQ-V2-010 - Rich visual output with borders, emojis
   * @requirement FREE-TIER-001 - Show task queue information for Cursor
   */
  private async generateStatusFile(
    context: ContextInjectionContext
  ): Promise<void> {
    const now = new Date().toISOString();

    // Get queue information for Cursor
    let queueInfo = '';
    let activeTaskPriority = '';
    try {
      const queueTasks = await this.queueManager.listTasks({ limit: 5 });
      const queueMetadata = await this.queueManager.listTasks({});
      const activeTask = await this.queueManager.getActiveTask();
      
      if (activeTask?.priority) {
        activeTaskPriority = `\n  Priority: ${activeTask.priority} ${this.getPriorityEmoji(activeTask.priority)}`;
      }
      
      if (queueTasks.length > 0) {
        const queuedTasks = queueTasks.filter(t => t.status === 'QUEUED');
        const completedTasks = queueMetadata.filter(t => t.status === 'DONE').slice(0, 3);
        
        queueInfo = `
Task Queue:
  Queued: ${queuedTasks.length} task(s)
${queuedTasks.length > 0 ? `  Next: ${queuedTasks[0].goal.substring(0, 50)}${queuedTasks[0].goal.length > 50 ? '...' : ''}${queuedTasks[0].priority ? ` ${this.getPriorityEmoji(queuedTasks[0].priority)} ${queuedTasks[0].priority}` : ''}` : ''}
${completedTasks.length > 0 ? `  Recently Completed: ${completedTasks.length} task(s)` : ''}

`;
      }
    } catch (error) {
      // Queue system not available, skip queue info
    }

    const content = `
╔══════════════════════════════════════════════════════════════════════╗
║ 🤖 AI WORKFLOW ENGINE - Current Status                               ║
║ Last Updated: ${now.padEnd(50)} ║
╚══════════════════════════════════════════════════════════════════════╝

⚠️  ACTIVE WORKFLOW IN PROGRESS

Current Task:
  ID: ${context.task.id}
  Goal: ${context.task.goal}
  State: ${context.task.status}${activeTaskPriority}
  
${queueInfo}${context.nextSteps && context.nextSteps.length > 0 ? `
Next Steps:
${context.nextSteps.map(step => `  - ${step}`).join('\n')}
` : ''}

${context.warnings && context.warnings.length > 0 ? `
⚠️  Warnings:
${context.warnings.map(w => `  - ${w}`).join('\n')}
` : ''}

${context.blockers && context.blockers.length > 0 ? `
🚫 Blockers:
${context.blockers.map(b => `  - ${b}`).join('\n')}
` : ''}

${context.localRules && context.localRules.length > 0 ? `
📚 Active Project Rules:
  ${context.localRules.length} rule(s) - See NEXT_STEPS.md for details
  ⚠️  AI must follow all project rules!
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 CURSOR VERIFICATION PROTOCOL:

If you (Cursor/AI) read this file, your FIRST response must include:

  "✓ Workflow Context:
    Task: ${context.task.goal}
    State: ${context.task.status}"

This confirms you loaded workflow context successfully.

If user doesn't see this confirmation in your response:
  ⚠️  YOU DIDN'T READ THIS FILE!
  ⚠️  User will tag manually: @.ai-context/STATUS.txt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANT FOR AI ASSISTANTS:

This file is auto-updated after every workflow command.
Check this file frequently to stay synchronized!

Commands:
  npx ai-workflow task status    # Full status
  npx ai-workflow sync           # Update state
  npx ai-workflow validate       # Check quality
  npx ai-workflow task complete  # Complete when done

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    // Ensure directory exists before writing
    await fs.ensureDir(this.contextDir);
    
    await fs.writeFile(
      path.join(this.contextDir, 'STATUS.txt'),
      content,
      'utf-8'
    );
  }

  /**
   * Generate NEXT_STEPS.md - Context-aware next actions
   * @requirement REQ-V2-010 - Actionable guidance for AI
   * @requirement FREE-TIER-001 - Show task queue overview for Cursor
   */
  private async generateNextStepsFile(
    command: string,
    context: ContextInjectionContext
  ): Promise<void> {
    const nextSteps = await this.calculateNextSteps(command, context);

    // Get queue overview for Cursor
    let queueOverview = '';
    try {
      const queueTasks = await this.queueManager.listTasks({ limit: 5 });
      const allTasks = await this.queueManager.listTasks({});
      
      if (queueTasks.length > 0) {
        const queued = queueTasks.filter(t => t.status === 'QUEUED');
        const completed = allTasks.filter(t => t.status === 'DONE').length;
        const total = allTasks.length;
        
        queueOverview = `
## 📋 Task Queue Overview

**Total Tasks:** ${total}
**Queued:** ${queued.length}
**Completed:** ${completed}

${queued.length > 0 ? `**Next in Queue:**
${queued.slice(0, 3).map((t, i) => {
  const priorityEmoji = t.priority ? this.getPriorityEmoji(t.priority) : '';
  return `${i + 1}. ${t.goal.substring(0, 60)}${t.goal.length > 60 ? '...' : ''}${t.priority ? ` ${priorityEmoji} ${t.priority}` : ''}`;
}).join('\n')}` : ''}

---
`;
      }
    } catch (error) {
      // Queue system not available, skip queue overview
    }

    let content = `# Next Steps

**Current State:** ${context.task.status}  
**Last Command:** ${command}  
**Updated:** ${new Date().toISOString()}

---

## 🎯 What to Do Next

${nextSteps.map((step, i) => `${i + 1}. **${step.action}**${step.command ? `\n   \`${step.command}\`` : ''}\n   ${step.why}`).join('\n\n')}

${queueOverview}---
`;

    // Add role checklists if roles are active
    // BUG-FIX-ROLES-2: Filter checklist items by current state
    if (context.activeRoles && context.activeRoles.length > 0) {
      content += `
## 👥 Active Roles

${context.activeRoles.map(role => {
  // Filter checklist items relevant to current state
  const relevantItems = this.filterChecklistByState(role.checklist, context.task.status);
  
  return `### ${role.icon} ${role.name}

${role.description}

**Checklist:**
${relevantItems.map(item => `- [ ] ${item}`).join('\n')}
`;
}).join('\n')}

---
`;
    }

    // Add state-based patterns section (State-Based Pattern System)
    // Tool provides state-filtered patterns, Cursor enforces compliance
    try {
      const statePatterns = await this.patternProvider.getPatternsForState(context.task.status);
      const patternSection = this.patternProvider.generateContextSection(statePatterns, context.task.status);
      
      if (patternSection) {
        content += patternSection;
      }
      // Removed noisy fallback that dumped all patterns when none matched the state.
    } catch (error) {
      // If pattern provider fails, fall back to old behavior (backward compatibility)
      if (context.localRules && context.localRules.length > 0) {
        content += `
## 📚 Project Patterns

**${context.localRules.length} pattern(s) apply to this project:**

${context.localRules.map((rule: any) => {
          const scoreStars = '⭐'.repeat(rule.score || 5);
          let ruleContent = `### ${rule.id}: ${rule.title} ${scoreStars}\n\n`;
          ruleContent += `${rule.content}\n`;
          if (rule.source) {
            ruleContent += `\n*Learned from: ${rule.source}*\n`;
          }
          return ruleContent;
        }).join('\n')}

**⚠️ AI: You MUST follow all project patterns above!**

---
`;
      }
    }

    content += `
## 📊 Workflow Progress

${this.getWorkflowProgress(context.task.status)}

---

## 💡 Quick Commands

\`\`\`bash
# Check status
npx ai-workflow task status

# Sync state after changes
npx ai-workflow sync

# Validate before commit
npx ai-workflow validate

# Complete task
npx ai-workflow task complete
\`\`\`

---

**⚠️ This file is auto-updated after every workflow command.**
`;

    // Ensure directory exists before writing
    await fs.ensureDir(this.contextDir);
    
    await fs.writeFile(
      path.join(this.contextDir, 'NEXT_STEPS.md'),
      content,
      'utf-8'
    );
  }

  /**
   * Generate WARNINGS.md - Active warnings and blockers
   * @requirement REQ-V2-010 - Warnings/blockers highlighted
   */
  private async generateWarningsFile(
    context: ContextInjectionContext
  ): Promise<void> {
    const content = `# Active Warnings

**Task:** ${context.task.goal}  
**State:** ${context.task.status}  
**Updated:** ${new Date().toISOString()}

---

## ⚠️  Current Warnings

${context.warnings?.map(w => `- ${w}`).join('\n') || 'No warnings'}

${context.blockers && context.blockers.length > 0 ? `
## 🚫 Blockers

${context.blockers.map(b => `- ${b}`).join('\n')}
` : ''}

---

## 💡 How to Resolve

1. Review warnings above
2. Fix issues in code
3. Run: \`npx ai-workflow validate\`
4. When clear: \`git commit\`

---

**⚠️ This file is auto-updated when warnings are detected.**
`;

    await fs.writeFile(
      path.join(this.contextDir, 'WARNINGS.md'),
      content,
      'utf-8'
    );
  }

  /**
   * Calculate next steps based on command and state
   * @requirement REQ-V2-010 - Context-aware guidance
   * @requirement BUG-FIX-ROLES-1 - State-aware next steps suggestions
   */
  private async calculateNextSteps(
    command: string,
    context: ContextInjectionContext
  ): Promise<NextStep[]> {
    const steps: NextStep[] = [];

    // After task create - BUG-FIX-ROLES-1: State-aware guidance
    if (command === 'task.create') {
      const state = context.task.status;
      
      // State-specific guidance map
      const stateGuidance: Record<WorkflowState, NextStep> = {
        'UNDERSTANDING': {
          action: 'Analyze requirements thoroughly',
          why: 'Ask clarifying questions, read code for context, document assumptions'
        },
        'DESIGNING': {
          action: 'Begin implementation per approved design',
          why: 'Follow architecture plan and create planned files'
        },
        'IMPLEMENTING': {
          action: 'Write comprehensive tests',
          why: 'Ensure code quality with unit and integration tests'
        },
        'TESTING': {
          action: 'Review code quality',
          why: 'Check requirements satisfied and look for improvements'
        },
        'REVIEWING': {
          action: 'Run validation',
          command: 'npx ai-workflow validate',
          why: 'Verify all quality gates before commit'
        },
        'READY_TO_COMMIT': {
          action: 'Commit your changes',
          command: 'git commit -m "your message"',
          why: 'All quality gates passed, safe to commit'
        }
      };
      
      const guidance = stateGuidance[state] || stateGuidance['UNDERSTANDING'];
      steps.push(guidance);
      
      steps.push({
        action: 'Sync state after significant changes',
        command: 'npx ai-workflow sync',
        why: 'Keep workflow state current'
      });
    }

    // After sync - state-specific guidance
    if (command === 'sync') {
      const state = context.task.status;

      if (state === 'DESIGNING') {
        steps.push({
          action: 'Start implementation',
          why: 'Design is approved, begin coding'
        });
      }

      if (state === 'IMPLEMENTING') {
        steps.push({
          action: 'Add tests for your implementation',
          why: 'Ensure code quality and coverage'
        });
      }

      if (state === 'TESTING') {
        steps.push({
          action: 'Review and validate',
          command: 'npx ai-workflow validate',
          why: 'Check all quality gates before commit'
        });
      }

      if (state === 'REVIEWING') {
        // Check if review checklist exists
        try {
          const taskManager = new (await import('./task-manager.js')).TaskManager();
          const checklist = await (taskManager as any).loadReviewChecklist();
          
          if (checklist) {
            const { ReviewChecklistManager } = await import('./review-checklist.js');
            const percentage = ReviewChecklistManager.getCompletionPercentage(checklist);
            const completed = checklist.items.filter((item: any) => item.completed).length;
            const total = checklist.items.length;
            
            steps.push({
              action: `Complete review checklist (${completed}/${total} - ${percentage}%)`,
              command: 'npx ai-workflow review status',
              why: 'Review checklist must be 100% complete before proceeding'
            });
            
            // Show incomplete items
            const incompleteItems = checklist.items.filter((item: any) => !item.completed);
            if (incompleteItems.length > 0) {
              incompleteItems.forEach((item: any) => {
                steps.push({
                  action: `Mark "${item.description}" as complete`,
                  command: `npx ai-workflow review check ${item.id}`,
                  why: `Required checklist item: ${item.category === 'automated' ? '[AUTO]' : '[MANUAL]'}`
                });
              });
            }
          } else {
            steps.push({
              action: 'Initialize review checklist',
              command: 'npx ai-workflow sync --state REVIEWING',
              why: 'Review checklist will be auto-initialized with validation'
            });
          }
        } catch {
          // Fallback if checklist not available
          steps.push({
            action: 'Validate for commit',
            command: 'npx ai-workflow validate',
            why: 'Final check before committing'
          });
        }
      }

      steps.push({
        action: 'Continue working or validate',
        command: 'npx ai-workflow validate',
        why: 'Prepare for commit when ready'
      });
    }

    // After validate
    if (command === 'validate') {
      if (!context.warnings || context.warnings.length === 0) {
        steps.push({
          action: 'Commit your changes',
          command: 'git commit -m "your message"',
          why: 'All quality gates passed!'
        });
        // BUG-FIX: Add task completion reminder
        steps.push({
          action: 'Complete your task',
          command: 'npx ai-workflow task complete',
          why: 'Mark task as finished after committing'
        });
        steps.push({
          action: 'Create next task',
          command: 'npx ai-workflow task create "<next goal>"',
          why: 'Start your next task'
        });
      } else {
        steps.push({
          action: 'Fix validation issues',
          why: 'Address warnings before committing'
        });
        steps.push({
          action: 'Run validate again',
          command: 'npx ai-workflow validate',
          why: 'Ensure all issues resolved'
        });
      }
    }

    // After task complete
    if (command === 'task.complete') {
      steps.push({
        action: 'Commit your work',
        command: 'git commit',
        why: 'Task complete, ready to commit'
      });
      steps.push({
        action: 'Create next task',
        command: 'npx ai-workflow task create "<goal>"',
        why: 'Start your next task'
      });
    }

    // Default
    if (steps.length === 0) {
      steps.push({
        action: 'Check current status',
        command: 'npx ai-workflow task status',
        why: 'See full task details and progress'
      });
    }

    return steps;
  }

  /**
   * Get workflow progress visualization
   * @requirement REQ-V2-010 - Visual workflow progress
   */
  private getWorkflowProgress(currentState: WorkflowState): string {
    const states: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];

    const currentIndex = states.indexOf(currentState);

    return states
      .map((state, index) => {
        const icon =
          index < currentIndex ? '✅' : index === currentIndex ? '⏳' : '⏸️';
        const status =
          index < currentIndex
            ? 'Complete'
            : index === currentIndex
              ? 'Current'
              : 'Pending';

        return `${icon} ${state.padEnd(25)} [${status}]`;
      })
      .join('\n');
  }

  /**
   * Clear warning file
   * @requirement REQ-V2-010 - Clean up when no warnings
   */
  async clearWarnings(): Promise<void> {
    const warningFile = path.join(this.contextDir, 'WARNINGS.md');
    if (await fs.pathExists(warningFile)) {
      await fs.remove(warningFile);
    }
  }

  /**
   * Get priority emoji indicator
   * @requirement FREE-TIER-002 - Priority display
   */
  private getPriorityEmoji(priority: string): string {
    const emojiMap: Record<string, string> = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    };
    return emojiMap[priority] || '⚪';
  }

  /**
   * Filter role checklist items by current workflow state
   * @requirement BUG-FIX-ROLES-2 - State-aware role checklist filtering
   * @param checklist - Full checklist items from role
   * @param state - Current workflow state
   * @returns Filtered checklist items relevant to current state
   */
  private filterChecklistByState(checklist: string[], state: WorkflowState): string[] {
    // State-specific keywords map
    const stateKeywords: Record<WorkflowState, string[]> = {
      'UNDERSTANDING': [
        'requirement', 'understand', 'analyze', 'question', 'document',
        'assumption', 'clarify', 'ambiguity', 'research'
      ],
      'DESIGNING': [
        'design', 'architecture', 'plan', 'pattern', 'structure',
        'component', 'interface', 'api', 'approach'
      ],
      'IMPLEMENTING': [
        'code', 'implement', 'function', 'error handling', 'comment',
        'naming', 'convention', 'dependency', 'debug', 'backwards compatible'
      ],
      'TESTING': [
        'test', 'coverage', 'edge case', 'integration', 'unit',
        'regression', 'manual', 'data', 'scenario'
      ],
      'REVIEWING': [
        'review', 'quality', 'refactor', 'optimize', 'improvement',
        'performance', 'security', 'documentation'
      ],
      'READY_TO_COMMIT': [
        'commit', 'message', 'change', 'version', 'documentation',
        'complete', 'ready'
      ]
    };

    const keywords = stateKeywords[state] || [];

    // If no filtering keywords, return all (fallback)
    if (keywords.length === 0) {
      return checklist;
    }

    // Filter items that match any state keyword
    const filtered = checklist.filter(item =>
      keywords.some(keyword =>
        item.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    // If no items match (edge case), return first 3 items as fallback
    // This prevents empty checklists which could confuse AI
    if (filtered.length === 0) {
      return checklist.slice(0, 3);
    }

    return filtered;
  }
}

