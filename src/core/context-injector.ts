/**
 * Context Injector for AI Memory
 * Auto-updates context files after every workflow command
 * @requirement REQ-V2-010 - Context Injection System
 */

import fs from 'fs-extra';
import path from 'path';
import { Task, WorkflowState } from '@workflow/core';
import { Role } from '../roles/role-definitions.js';

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
  // importedRules?: ... // Full build
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

  constructor(contextDir = '.ai-context') {
    this.contextDir = contextDir;
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
   */
  private async generateStatusFile(
    context: ContextInjectionContext
  ): Promise<void> {
    const now = new Date().toISOString();

    const content = `
╔══════════════════════════════════════════════════════════════════════╗
║ 🤖 AI WORKFLOW ENGINE - Current Status                               ║
║ Last Updated: ${now.padEnd(50)} ║
╚══════════════════════════════════════════════════════════════════════╝

⚠️  ACTIVE WORKFLOW IN PROGRESS

Current Task:
  ID: ${context.task.id}
  Goal: ${context.task.goal}
  State: ${context.task.status}
  
${context.nextSteps && context.nextSteps.length > 0 ? `
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANT FOR AI ASSISTANTS:

This file is auto-updated after every workflow command.
Check this file frequently to stay synchronized!

Commands:
  npx ai-workflow task status    # Full status
  npx ai-workflow sync           # Update state
  npx ai-workflow validate       # Check quality

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    await fs.writeFile(
      path.join(this.contextDir, 'STATUS.txt'),
      content,
      'utf-8'
    );
  }

  /**
   * Generate NEXT_STEPS.md - Context-aware next actions
   * @requirement REQ-V2-010 - Actionable guidance for AI
   */
  private async generateNextStepsFile(
    command: string,
    context: ContextInjectionContext
  ): Promise<void> {
    const nextSteps = this.calculateNextSteps(command, context);

    let content = `# Next Steps

**Current State:** ${context.task.status}  
**Last Command:** ${command}  
**Updated:** ${new Date().toISOString()}

---

## 🎯 What to Do Next

${nextSteps.map((step, i) => `${i + 1}. **${step.action}**${step.command ? `\n   \`${step.command}\`` : ''}\n   ${step.why}`).join('\n\n')}

---
`;

    // Add role checklists if roles are active
    if (context.activeRoles && context.activeRoles.length > 0) {
      content += `
## 👥 Active Roles

${context.activeRoles.map(role => `### ${role.icon} ${role.name}

${role.description}

**Checklist:**
${role.checklist.map(item => `- [ ] ${item}`).join('\n')}
`).join('\n')}

---
`;
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
   */
  private calculateNextSteps(
    command: string,
    context: ContextInjectionContext
  ): NextStep[] {
    const steps: NextStep[] = [];

    // After task create
    if (command === 'task.create') {
      steps.push({
        action: 'Start working on your task',
        why: 'Begin implementation or research'
      });
      steps.push({
        action: 'Sync state after significant changes',
        command: 'npx ai-workflow sync',
        why: 'Keep workflow state current'
      });
    }

    // After sync - state-specific guidance
    if (command === 'sync') {
      const state = context.task.status;

      if (state === 'DESIGN_COMPLETE') {
        steps.push({
          action: 'Start implementation',
          why: 'Design is approved, begin coding'
        });
      }

      if (state === 'IMPLEMENTATION_COMPLETE') {
        steps.push({
          action: 'Add tests for your implementation',
          why: 'Ensure code quality and coverage'
        });
      }

      if (state === 'TESTING_COMPLETE') {
        steps.push({
          action: 'Review and validate',
          command: 'npx ai-workflow validate',
          why: 'Check all quality gates before commit'
        });
      }

      if (state === 'REVIEW_COMPLETE') {
        steps.push({
          action: 'Validate for commit',
          command: 'npx ai-workflow validate',
          why: 'Final check before committing'
        });
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
      'DESIGN_COMPLETE',
      'IMPLEMENTATION_COMPLETE',
      'TESTING_COMPLETE',
      'REVIEW_COMPLETE',
      'COMMIT_READY'
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
}

