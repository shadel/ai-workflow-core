/**
 * Task Manager - Core task management logic
 * @requirement REQ-V2-003
 */

import { WorkflowEngine, Task, WorkflowState, normalizeState } from '@shadel/workflow-core';
import fs from 'fs-extra';
import path from 'path';
import { ContextInjector } from './context-injector.js';
import { RoleSystem } from './role-system.js';
import { RuleManager } from '../utils/rule-manager.js';

export class TaskManager {
  private engine: WorkflowEngine;
  private contextDir: string;
  private taskFile: string;
  private contextInjector: ContextInjector;
  private roleSystem: RoleSystem;
  private ruleManager: RuleManager;

  constructor(contextDir = '.ai-context') {
    this.engine = new WorkflowEngine();
    this.contextDir = contextDir;
    this.taskFile = path.join(contextDir, 'current-task.json');
    this.contextInjector = new ContextInjector(contextDir);  // BUG FIX: Pass contextDir
    this.roleSystem = new RoleSystem();
    this.ruleManager = new RuleManager();  // v3.0.3 - Rules integration
  }

  /**
   * Create a new task
   * @requirement REQ-V2-003 - Task management CRUD operations
   * @requirement REQ-V2-010 - Auto-inject context after command
   * @requirement BUG-FIX-004 - Prevent overwriting existing task
   */
  async createTask(goal: string, requirements?: string[], force = false): Promise<Task> {
    await fs.ensureDir(this.contextDir);
    
    // BUG-FIX-007: Validate goal quality
    if (!goal || goal.trim().length < 10) {
      throw new Error(
        `Task goal must be at least 10 characters and descriptive.\n\n` +
        `Received: "${goal}"\n` +
        `Length: ${goal?.length || 0} characters\n\n` +
        `Example: "Implement user authentication with JWT"\n` +
        `Bad: "fix bug" (too vague)\n` +
        `Bad: "a" (too short)`
      );
    }
    
    // CRITICAL: Check for existing task
    const existingTask = await this.getCurrentTask();
    if (existingTask && !force) {
      throw new Error(
        `Active task already exists!\n\n` +
        `Current task: "${existingTask.goal}"\n` +
        `State: ${existingTask.status}\n\n` +
        `Complete it first:\n` +
        `  npx ai-workflow task complete\n\n` +
        `Or force overwrite (will lose current task):\n` +
        `  npx ai-workflow task create "<goal>" --force`
      );
    }
    
    const task = await this.engine.createTask(goal);
    
    // Add requirements if provided
    const taskData = {
      taskId: task.id,
      originalGoal: goal,
      status: 'in_progress',
      startedAt: task.startedAt,
      workflow: {
        currentState: task.status,
        stateEnteredAt: new Date().toISOString(),
        stateHistory: []
      },
      requirements: requirements || []
    };

    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    
    // Activate roles based on task context
    const activeRoles = this.roleSystem.getActiveRoles({
      taskGoal: goal,
      linkedRequirements: requirements?.map(id => ({ id }))
    });
    
    // Load local rules (v3.0.3)
    const localRules = await this.ruleManager.getRules();
    
    // Auto-inject context for AI
    await this.contextInjector.updateAfterCommand('task.create', {
      task,
      warnings: [],
      blockers: [],
      activeRoles,
      localRules  // v3.0.3 - Include project rules
    });
    
    // USER-INSIGHT-11: Auto-generate state enforcement .mdc file
    // DISABLED: Now using static hybrid file (v2.1.0-hybrid)
    // The file .cursor/rules/000-current-state-enforcement.mdc is now static
    // and contains instructions + quick reference for all states
    // try {
    //   await this.generateStateEnforcementMDC(task.status);
    // } catch (error) {
    //   console.warn(`⚠️ Failed to generate state enforcement file: ${(error as Error).message}`);
    //   // Don't fail the whole command if file generation fails
    // }
    
    return task;
  }

  /**
   * Get current task
   * @requirement REQ-V2-003 - Task status retrieval
   */
  async getCurrentTask(): Promise<Task | null> {
    if (!await fs.pathExists(this.taskFile)) {
      return null;
    }

    try {
      const taskData = await fs.readJson(this.taskFile);
      
      // BUG-FIX-011: Don't return completed tasks as "current"
      // A completed task should not be considered active
      if (taskData.status === 'completed') {
        return null;
      }
      
      return {
        id: taskData.taskId,
        goal: taskData.originalGoal,
        status: taskData.workflow.currentState,
        startedAt: taskData.startedAt,
        completedAt: taskData.completedAt,
        roleApprovals: []
      };
    } catch (error) {
      throw new Error(`Failed to load task: ${error}`);
    }
  }

  /**
   * Update task state
   * @requirement REQ-V2-002 - State machine integration
   * @requirement REQ-V2-010 - Auto-inject context after state change
   * @requirement BUG-FIX-001 - Validate state transitions
   * @requirement BUG-FIX-009 - Validate state history integrity
   */
  async updateTaskState(state: WorkflowState): Promise<void> {
    const taskData = await fs.readJson(this.taskFile);
    const currentState = taskData.workflow.currentState;
    
    // BUG-FIX-009: Validate state history integrity BEFORE accepting update
    await this.validateStateHistory(taskData);
    
    // CRITICAL: Validate state transition is allowed
    if (!this.isValidTransition(currentState, state)) {
      throw new Error(
        `Invalid state transition: ${currentState} → ${state}\n\n` +
        `Workflow states must progress sequentially:\n` +
        `  UNDERSTANDING → DESIGNING → IMPLEMENTING → \n` +
        `  TESTING → REVIEWING → READY_TO_COMMIT\n\n` +
        `Current state: ${currentState}\n` +
        `You tried to jump to: ${state}\n` +
        `Next valid state: ${this.getNextState(currentState)}`
      );
    }
    
    // Validate prerequisites for target state
    await this.validateStatePrerequisites(state);
    
    // BUG-FIX-010: Warn if state changes too rapidly
    this.checkRapidStateChange(taskData);
    
    // BUG-FIX-012: Record OLD state in history BEFORE updating to new state
    // History should track completed steps, not current step
    const oldState = currentState;
    const oldStateEnteredAt = taskData.workflow.stateEnteredAt || new Date().toISOString();
    
    // Add OLD state to history (if not already there)
    if (!taskData.workflow.stateHistory) {
      taskData.workflow.stateHistory = [];
    }
    
    const alreadyInHistory = taskData.workflow.stateHistory.some(
      (entry: any) => entry.state === oldState
    );
    
    if (!alreadyInHistory) {
      taskData.workflow.stateHistory.push({
        state: oldState,  // ✅ OLD state (step being completed)
        enteredAt: oldStateEnteredAt
      });
    }
    
    // NOW update to new state
    taskData.workflow.currentState = state;
    taskData.workflow.stateEnteredAt = new Date().toISOString();

    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    
    // Try to transition engine state (not critical, state already saved in file)
    try {
      await this.engine.transitionTo(state);
    } catch (error) {
      // Engine transition failed, but state is already saved in file, so continue
      console.warn(`⚠️ Engine transition warning: ${(error as Error).message}`);
    }
    
    // USER-INSIGHT-11: Auto-generate state enforcement .mdc file
    // DISABLED: Now using static hybrid file (v2.1.0-hybrid)
    // The file .cursor/rules/000-current-state-enforcement.mdc is now static
    // and contains instructions + quick reference for all states
    // try {
    //   await this.generateStateEnforcementMDC(state);
    // } catch (error) {
    //   console.warn(`⚠️ Failed to generate state enforcement file: ${(error as Error).message}`);
    //   // Don't fail the whole command if file generation fails
    // }
    
    // Auto-inject context for AI
    const currentTask = await this.getCurrentTask();
    if (currentTask) {
      // BUG-FIX-ROLES-3: Re-activate roles during sync to ensure checklists are shown
      const activeRoles = this.roleSystem.getActiveRoles({
        taskGoal: currentTask.goal,
        workflowState: state
      });
      
      // Load local rules (v3.0.3)
      const localRules = await this.ruleManager.getRules();
      
      await this.contextInjector.updateAfterCommand('sync', {
        task: currentTask,
        warnings: [],
        blockers: [],
        activeRoles,
        localRules  // v3.0.3 - Include project rules
      });
    }
  }
  
  /**
   * Check if state transition is valid
   * @requirement BUG-FIX-001 - Sequential state progression
   */
  private isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    const fromIndex = sequence.indexOf(from);
    const toIndex = sequence.indexOf(to);
    
    // BUG-FIX-001: Only allow forward progression by 1 step
    // States must progress sequentially - no backward movement, no staying at same state
    return toIndex === fromIndex + 1;
  }
  
  /**
   * Get next valid state
   * @requirement BUG-FIX-001 - State progression guidance
   */
  private getNextState(current: WorkflowState): WorkflowState | string {
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    const index = sequence.indexOf(current);
    return sequence[index + 1] || 'Already at final state';
  }
  
  /**
   * Validate state history integrity
   * Detects manual file edits that forge invalid state progressions
   * @requirement BUG-FIX-009 - Prevent state forgery
   * @requirement BUG-FIX-009-AI - Public API for AI flow correction
   * @public API for reuse across commands and hooks
   */
  public async validateStateHistory(taskData?: any): Promise<void> {
    // Load task data if not provided
    if (!taskData) {
      if (!await fs.pathExists(this.taskFile)) {
        return; // No task, nothing to validate
      }
      taskData = await fs.readJson(this.taskFile);
    }
    
    const { currentState, stateHistory } = taskData.workflow;
    
    if (!stateHistory || stateHistory.length === 0) {
      // Empty history is valid for new tasks
      return;
    }
    
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    // Extract states from history
    const historyStates = stateHistory.map((entry: any) => entry.state);
    
    // BUG-FIX-012-VALIDATION: Check current state in history FIRST (most critical check)
    // Current state should NEVER be in history (it's current, not completed)
    if (historyStates.length > 0 && historyStates.includes(currentState)) {
      throw new Error(
        `🚨 STATE HISTORY CORRUPTION!\n\n` +
        `Current state found in history (should only have completed steps):\n` +
        `  Current: ${currentState}\n` +
        `  History: ${historyStates.join(', ')}\n\n` +
        `This indicates Bug #12 is still present or manual corruption.\n\n` +
        `ACTION: Verify Bug #12 fix is applied, or delete task and recreate.`
      );
    }
    
    // Validate: History must follow sequential progression
    for (let i = 1; i < historyStates.length; i++) {
      const prevState = historyStates[i - 1];
      const currState = historyStates[i];
      
      if (!this.isValidTransition(prevState, currState)) {
        throw new Error(
          `🚨 STATE HISTORY CORRUPTION DETECTED!\n\n` +
          `Invalid transition found in state history:\n` +
          `  ${prevState} → ${currState}\n\n` +
          `This usually means:\n` +
          `  1. Manual edit to .ai-context/current-task.json (NOT ALLOWED)\n` +
          `  2. State forgery attempt (SECURITY ISSUE)\n` +
          `  3. File corruption (INTEGRITY ISSUE)\n\n` +
          `ACTION REQUIRED:\n` +
          `  1. Use ONLY "npx ai-workflow sync --state <STATE>" to change states\n` +
          `  2. Do NOT manually edit current-task.json\n` +
          `  3. If file is corrupted, delete and create new task\n\n` +
          `Security: This validation prevents bypassing workflow quality gates.`
        );
      }
    }
    
    // BUG-FIX-012-VALIDATION: After fixing Bug #12, history contains COMPLETED states
    // Current state should be ONE step ahead of last history entry
    // Example: current=DESIGNING, history=[UNDERSTANDING] ← This is CORRECT!
    if (historyStates.length > 0) {
      const lastHistoryState = historyStates[historyStates.length - 1];
      
      // Verify last history entry is the PREVIOUS state (one step before current)
      const sequence: WorkflowState[] = [
        'UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING',
        'TESTING', 'REVIEWING', 'READY_TO_COMMIT'
      ];
      const currentIndex = sequence.indexOf(currentState);
      const expectedPrevious = currentIndex > 0 ? sequence[currentIndex - 1] : null;
      
      if (expectedPrevious && lastHistoryState !== expectedPrevious) {
        // Allow this - might be valid state skip or retroactive task
        console.warn(
          `⚠️  Note: Last history state (${lastHistoryState}) doesn't match ` +
          `expected previous (${expectedPrevious}). This may be normal for retroactive tasks.`
        );
      }
    }
    
    // Validate: No impossible state jumps in history
    const currentIndex = sequence.indexOf(currentState as WorkflowState);
    
    // Check if we're at a state that requires passing through earlier states
    if (currentIndex >= 3) { // TESTING or later
      const requiredStates = sequence.slice(0, currentIndex);
      
      for (const requiredState of requiredStates) {
        if (!historyStates.includes(requiredState)) {
          console.warn(
            `⚠️  WARNING: State history suspicious!\n\n` +
            `Current state: ${currentState}\n` +
            `Missing from history: ${requiredState}\n\n` +
            `This could indicate state skipping.\n` +
            `History: ${historyStates.join(' → ')}`
          );
        }
      }
    }
  }
  
  /**
   * Analyze workflow completeness for AI users
   * Detects missing phases and provides guidance for AI to complete them
   * @requirement BUG-FIX-009-AI - AI flow correction mechanism
   */
  public async analyzeWorkflowCompleteness(): Promise<{
    complete: boolean;
    currentState: WorkflowState;
    missingPhases: WorkflowState[];
    instructions?: string;
  }> {
    const taskData = await fs.readJson(this.taskFile);
    const { currentState, stateHistory } = taskData.workflow;
    
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    const currentIndex = sequence.indexOf(currentState as WorkflowState);
    
    // Required phases: All phases up to (not including) current
    // Note: UNDERSTANDING is the starting state and is implicitly complete
    const requiredPhases = sequence.slice(1, currentIndex); // Start from DESIGNING
    
    // Completed phases from history
    // BUG-FIX: Normalize state names for backward compatibility with v2.x data
    const historyStates = (stateHistory || []).map((e: any) => normalizeState(e.state));
    
    // Find missing phases (UNDERSTANDING not required in history as it's initial state)
    const missing = requiredPhases.filter(phase => !historyStates.includes(phase));
    
    if (missing.length === 0) {
      return {
        complete: true,
        currentState,
        missingPhases: []
      };
    }
    
    // Generate AI instructions for missing phases
    const instructions = this.generateAIFlowInstructions(missing, currentState);
    
    return {
      complete: false,
      currentState,
      missingPhases: missing,
      instructions
    };
  }
  
  /**
   * Generate AI-specific instructions for completing missing workflow phases
   * @requirement BUG-FIX-009-AI - AI guidance generation
   */
  private generateAIFlowInstructions(
    missing: WorkflowState[],
    current: WorkflowState
  ): string {
    let instructions = `🤖 AI FLOW CORRECTION NEEDED\n\n`;
    
    instructions += `Current State: ${current}\n`;
    instructions += `Missing Phases: ${missing.join(', ')}\n\n`;
    
    instructions += `You (AI) need to complete the following workflow phases:\n\n`;
    
    for (const phase of missing) {
      instructions += this.getPhaseInstructionsForAI(phase);
      instructions += `\n`;
    }
    
    instructions += `📋 WORKFLOW TO FOLLOW:\n\n`;
    
    // Generate step-by-step workflow
    for (let i = 0; i < missing.length; i++) {
      const phase = missing[i];
      const nextPhase = i < missing.length - 1 ? missing[i + 1] : current;
      
      instructions += `Step ${i + 1}: Complete ${phase} work\n`;
      instructions += `  Then run: npx ai-workflow sync\n`;
      instructions += `  Progress to: ${nextPhase}\n\n`;
    }
    
    instructions += `After completing all missing phases, your workflow will be complete and correct.\n`;
    
    return instructions;
  }
  
  /**
   * Get AI-specific instructions for a workflow phase
   * @requirement BUG-FIX-009-AI - Phase-specific AI guidance
   */
  private getPhaseInstructionsForAI(phase: WorkflowState): string {
    const instructions: Record<WorkflowState, string> = {
      'UNDERSTANDING': 
        `📋 MISSING PHASE: UNDERSTANDING\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Ask clarifying questions about the requirements\n` +
        `2. Identify key requirements and constraints\n` +
        `3. List assumptions\n` +
        `4. Confirm understanding with user\n` +
        `\n` +
        `AI Execution Time: 30-60 seconds\n` +
        `After completing: User will approve, then you sync to next state\n`,
        
      'DESIGNING':
        `🏗️  MISSING PHASE: DESIGN\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Propose architecture/design approach\n` +
        `2. Identify components and modules needed\n` +
        `3. Plan file structure\n` +
        `4. Get user approval on design\n` +
        `\n` +
        `AI Execution Time: 1-2 minutes\n` +
        `After completing: User will approve, then you sync to next state\n`,
        
      'IMPLEMENTING':
        `💻 MISSING PHASE: IMPLEMENTATION\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Write the actual code based on design\n` +
        `2. Implement all planned features\n` +
        `3. Follow best practices and code quality standards\n` +
        `4. Add inline documentation\n` +
        `\n` +
        `AI Execution Time: 2-10 minutes\n` +
        `After completing: You sync to next state\n`,
        
      'TESTING':
        `🧪 MISSING PHASE: TESTING (MANDATORY!)\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Write comprehensive unit tests\n` +
        `2. Write integration tests if needed\n` +
        `3. Test edge cases and error conditions\n` +
        `4. Ensure all tests pass\n` +
        `5. Achieve >70% test coverage\n` +
        `\n` +
        `⚠️  CRITICAL: Testing is MANDATORY and cannot be skipped!\n` +
        `AI Execution Time: 1-5 minutes\n` +
        `After completing: You sync to next state\n`,
        
      'REVIEWING':
        `👀 MISSING PHASE: REVIEW\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Review your code for quality issues\n` +
        `2. Verify all requirements are met\n` +
        `3. Check test coverage is adequate\n` +
        `4. Look for potential improvements\n` +
        `\n` +
        `AI Execution Time: 30-90 seconds\n` +
        `After completing: You sync to READY_TO_COMMIT\n`,
        
      'READY_TO_COMMIT':
        ``  // Should never be missing
    };
    
    return instructions[phase] || '';
  }
  
  /**
   * Check for rapid state changes (quality indicator)
   * @requirement BUG-FIX-010 - Detect suspiciously fast progression
   * @note For AI users, this is informational only (AI is fast!)
   */
  private checkRapidStateChange(taskData: any): void {
    const lastStateChange = taskData.workflow.stateEnteredAt;
    
    if (!lastStateChange) {
      return; // First state change, no warning
    }
    
    const timeSinceLastChange = Date.now() - new Date(lastStateChange).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    const oneMinute = 60 * 1000;
    
    if (timeSinceLastChange < oneMinute) {
      console.warn(
        `\n⚠️  RAPID STATE CHANGE DETECTED!\n\n` +
        `Time since last state change: ${Math.floor(timeSinceLastChange / 1000)} seconds\n\n` +
        `This is suspiciously fast. Real work typically takes:\n` +
        `  • Design: 10-60 minutes\n` +
        `  • Implementation: 30-240 minutes\n` +
        `  • Testing: 15-60 minutes\n` +
        `  • Review: 10-30 minutes\n\n` +
        `Are you sure the work is complete?\n` +
        `If you're just testing the workflow, this is fine.\n` +
        `But for real work, take your time!\n`
      );
    } else if (timeSinceLastChange < fiveMinutes) {
      console.warn(
        `\n⚠️  Warning: State changed recently (${Math.floor(timeSinceLastChange / 60000)} minutes ago)\n` +
        `Make sure the work for the previous state is complete.\n`
      );
    }
  }
  
  /**
   * Validate prerequisites for entering a state
   * @requirement BUG-FIX-001 - Quality gates
   */
  private async validateStatePrerequisites(state: WorkflowState): Promise<void> {
    switch (state) {
      case 'TESTING':
        // Check if tests exist (basic check)
        const hasTests = await fs.pathExists('__tests__') || 
                        await fs.pathExists('test') ||
                        await fs.pathExists('tests');
        if (!hasTests) {
          console.warn('⚠️  Warning: No test directory found. Consider adding tests.');
        }
        break;
        
      case 'READY_TO_COMMIT':
        // Should have completed all previous states
        // Validation will be done by validator
        break;
    }
  }

  /**
   * Complete task
   * @requirement REQ-V2-003 - Task lifecycle completion
   * @requirement REQ-V2-010 - Auto-inject context after completion
   * @requirement BUG-FIX-003 - Require READY_TO_COMMIT state
   */
  async completeTask(): Promise<void> {
    const taskData = await fs.readJson(this.taskFile);
    const currentState = taskData.workflow?.currentState;
    
    // CRITICAL: Must be at READY_TO_COMMIT to complete task
    if (currentState !== 'READY_TO_COMMIT') {
      throw new Error(
        `Cannot complete task at ${currentState} state.\n\n` +
        `Task must be at READY_TO_COMMIT before completion.\n\n` +
        `Current state: ${currentState}\n` +
        `Required: READY_TO_COMMIT\n\n` +
        `Progress to READY_TO_COMMIT first, then complete.`
      );
    }
    
    taskData.status = 'completed';
    taskData.completedAt = new Date().toISOString();
    taskData.workflow.currentState = 'READY_TO_COMMIT';

    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    await this.engine.completeTask();
    
    // BUG-FIX-006: Clear context files after completion
    await fs.remove(path.join(this.contextDir, 'STATUS.txt'));
    await fs.remove(path.join(this.contextDir, 'NEXT_STEPS.md'));
    await fs.remove(path.join(this.contextDir, 'WARNINGS.md'));
    
    // Auto-inject context for AI
    const currentTask = await this.getCurrentTask();
    if (currentTask) {
      const localRules = await this.ruleManager.getRules();  // v3.0.3
      await this.contextInjector.updateAfterCommand('task.complete', {
        task: currentTask,
        warnings: [],
        blockers: [],
        localRules  // v3.0.3 - Include project rules
      });
    }
  }

  /**
   * Get workflow progress
   */
  getProgress(): number {
    return this.engine.getProgress();
  }

  /**
   * List tasks (current + history)
   * @requirement REQ-V2-003 - Task listing (NEW v2.0)
   */
  async listTasks(statusFilter?: string, limit = 10): Promise<Task[]> {
    const tasks: Task[] = [];
    
    // Get current task
    const currentTask = await this.getCurrentTask();
    if (currentTask) {
      if (!statusFilter || currentTask.status === statusFilter) {
        tasks.push(currentTask);
      }
    }
    
    // Get task history
    const historyDir = path.join(this.contextDir, 'task-history');
    if (await fs.pathExists(historyDir)) {
      const files = await fs.readdir(historyDir);
      const historyFiles = files.filter(f => f.endsWith('.json'));
      
      // Sort by modification time (most recent first)
      const filesWithStats = await Promise.all(
        historyFiles.map(async (file) => {
          const filePath = path.join(historyDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );
      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Read historical tasks
      for (const { file } of filesWithStats) {
        if (tasks.length >= limit) break;
        
        try {
          const taskData = await fs.readJson(path.join(historyDir, file));
          
          // Convert task data to Task format
          const historicalTask: Task = {
            id: taskData.taskId || file.replace('.json', ''),
            goal: taskData.originalGoal || '',
            status: taskData.workflow?.currentState || 'UNDERSTANDING',
            startedAt: taskData.startedAt || '',
            completedAt: taskData.completedAt,
            roleApprovals: taskData.roleApprovals || []
          };
          
          if (!statusFilter || historicalTask.status === statusFilter) {
            tasks.push(historicalTask);
          }
        } catch (error) {
          // Skip invalid task files
          continue;
        }
      }
    }
    
    return tasks.slice(0, limit);
  }

  /**
   * Update task details
   * @requirement REQ-V2-003 - Task update (NEW v2.0)
   */
  async updateTask(
    taskId: string,
    updates: {
      goal?: string;
      addReq?: string;
    }
  ): Promise<void> {
    // Check if it's the current task
    const currentTask = await this.getCurrentTask();
    if (!currentTask || currentTask.id !== taskId) {
      throw new Error(`Task ${taskId} not found or not active`);
    }
    
    // Load task data
    const taskData = await fs.readJson(this.taskFile);
    
    // Apply updates
    if (updates.goal) {
      taskData.originalGoal = updates.goal;
    }
    
    if (updates.addReq) {
      if (!taskData.requirements) {
        taskData.requirements = [];
      }
      if (!taskData.requirements.includes(updates.addReq)) {
        taskData.requirements.push(updates.addReq);
      }
    }
    
    // Save updated task
    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    
    // Auto-inject context for AI
    const updatedTask = await this.getCurrentTask();
    if (updatedTask) {
      const localRules = await this.ruleManager.getRules();  // v3.0.3
      await this.contextInjector.updateAfterCommand('task.update', {
        task: updatedTask,
        warnings: [],
        blockers: [],
        localRules  // v3.0.3 - Include project rules
      });
    }
  }

  /**
   * Generate state enforcement .mdc file
   * @requirement USER-INSIGHT-11 - Auto-generate 000-current-state-enforcement.mdc
   * User proposed solution: Put 6-step workflow enforcement in .cursor/rules
   */
  private async generateStateEnforcementMDC(state: WorkflowState): Promise<void> {
    const currentTask = await this.getCurrentTask();
    const taskId = currentTask?.id || 'none';
    const taskGoal = currentTask?.goal || 'No current task (check status - may be completed)';
    
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
   */
  private getStateSummary(state: WorkflowState): string {
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

