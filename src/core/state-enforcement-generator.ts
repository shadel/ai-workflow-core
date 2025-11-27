/**
 * State Enforcement Generator - Centralized state enforcement MDC generation
 * 
 * REFACTORED: Extracted from TaskManager state enforcement methods for Phase 7.
 * Handles generation of state enforcement MDC files for Cursor integration.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-STATE-ENFORCEMENT-GENERATOR - Phase 7: Extract State Enforcement Generator
 */

import fs from 'fs-extra';
import path from 'path';
import type { WorkflowState } from '@shadel/workflow-core';

/**
 * State Enforcement Generator
 * 
 * Centralizes state enforcement MDC file generation for Cursor integration.
 */
export class StateEnforcementGenerator {
  /**
   * Generate state enforcement .mdc file
   * 
   * @requirement USER-INSIGHT-11 - Auto-generate 000-current-state-enforcement.mdc
   * User proposed solution: Put 6-step workflow enforcement in .cursor/rules
   * 
   * @param state Current workflow state
   * @param taskId Current task ID
   * @param taskGoal Current task goal
   */
  async generateStateEnforcementMDC(
    state: WorkflowState,
    taskId: string,
    taskGoal: string
  ): Promise<void> {
    const content = `---
description: "CURRENT STATE ENFORCEMENT - Auto-generated on state change"
globs: "**/*"
alwaysApply: true
priority: 0
version: dynamic-${Date.now()}
tags: [state-enforcement, auto-generated, critical, ${state}]
generatedAt: ${new Date().toISOString()}
currentState: ${state}
taskId: ${taskId}
---

# 🚨 CURRENT WORKFLOW STATE: ${state}

⚠️  **This file is AUTO-GENERATED and updates when workflow state changes!**
⚠️  **Last updated:** ${new Date().toISOString()}
⚠️  **Current task:** ${taskId}
⚠️  **Do NOT manually edit - changes will be overwritten!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔴 MANDATORY EXECUTION PROTOCOL

**You are at ${state} state.**

At the START of this conversation, you MUST:

### ☑️ CHECKPOINT: Load State-Specific Behavior

Execute in EXACT order:

1. ✅ You are reading this file (000-current-state-enforcement.mdc) ← Automatic (priority 0!)
2. ✅ Current state from metadata: **${state}**
3. ✅ Task: ${taskGoal}
4. ✅ Call tool: \`read_file('.cursor/rules/state-behaviors/${state}.md')\`
5. ✅ Read ALL behavior rules from that file
6. ✅ Respond with verification:

**Required first response:**
\`\`\`
✓ Workflow State Enforcement Loaded:
  State: ${state}
  Task: ${taskGoal}
  Behavior file: state-behaviors/${state}.md
  I have loaded state-specific allowed/forbidden actions.
  I will follow ONLY allowed actions for this state.
\`\`\`

🚫 DO NOT respond until checkpoint complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 STATE-SPECIFIC BEHAVIOR RULES

**Full rules:** \`.cursor/rules/state-behaviors/${state}.md\`

**You MUST read that file before proceeding!**

${this.getStateSummary(state)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Priority:** 0 (HIGHEST - Read FIRST before all other .mdc files!)  
**Updates:** Automatically when state changes  
**Purpose:** Enforce proper workflow state behavior
`;

    // Write to .cursor/rules/
    const rulesDir = path.join(process.cwd(), '.cursor', 'rules');
    await fs.ensureDir(rulesDir);
    await fs.writeFile(
      path.join(rulesDir, '000-current-state-enforcement.mdc'),
      content,
      'utf-8'
    );
    
    console.log(`✅ Generated state enforcement: ${state}`);
    console.log(`   File: .cursor/rules/000-current-state-enforcement.mdc`);
    console.log(`   Priority: 0 (highest)`);
  }

  /**
   * Get state summary for 000 file
   * 
   * @param state Workflow state
   * @returns State summary string
   */
  getStateSummary(state: WorkflowState): string {
    const summaries: Record<WorkflowState, string> = {
      'UNDERSTANDING': `
**Quick Summary:**
- ✅ Allowed: Ask questions, read code, analyze
- 🚫 Forbidden: Write code, modify files, commit
- 🎯 Next: Progress to DESIGNING when requirements clear
`,
      'DESIGNING': `
**Quick Summary:**
- ✅ Allowed: Design solution, plan architecture, create pseudocode
- 🚫 Forbidden: Write production code, run tests, commit
- 🎯 Next: Progress to IMPLEMENTING when design approved
`,
      'IMPLEMENTING': `
**Quick Summary:**
- ✅ Allowed: Write code, implement features, build
- 🚫 Forbidden: Write tests (next step!), make commits
- 🎯 Next: Progress to TESTING when implementation done
`,
      'TESTING': `
**Quick Summary:**
- ✅ Allowed: Write tests, run test suites, verify coverage
- 🚫 Forbidden: Modify production code (tests only!), commit
- 🎯 Next: Progress to REVIEWING when tests pass
`,
      'REVIEWING': `
**Quick Summary:**
- ✅ Allowed: Review code, check quality, run validation
- 🚫 Forbidden: Major changes, commits without validation
- 🎯 Next: Run validation to progress to READY_TO_COMMIT
`,
      'READY_TO_COMMIT': `
**Quick Summary:**
- ✅ Allowed: Make commit, complete task
- 🚫 Forbidden: Skip validation, use --no-verify
- 🎯 Final: Commit and complete task

**⚠️ TASK COMPLETION REMINDER:**
After committing your changes, remember to complete your task:
\`\`\`bash
npx ai-workflow task complete
\`\`\`
This marks your task as finished and allows starting next task.
`
    };
    
    return summaries[state] || '';
  }
}


