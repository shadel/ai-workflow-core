/**
 * Workflow Analysis Service - Centralized workflow analysis logic
 * 
 * REFACTORED: Extracted from TaskManager workflow analysis methods for Phase 6.
 * Handles workflow completeness analysis and AI instruction generation.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-WORKFLOW-ANALYSIS-SERVICE - Phase 6: Extract Workflow Analysis Service
 */

import fs from 'fs-extra';
import { normalizeState, type WorkflowState } from '@shadel/workflow-core';
import { TaskStateEngine } from './task-state-engine.js';

/**
 * Workflow completeness analysis result
 */
export interface WorkflowCompletenessResult {
  complete: boolean;
  currentState: WorkflowState;
  missingPhases: WorkflowState[];
  instructions?: string;
}

/**
 * Workflow Analysis Service
 * 
 * Centralizes workflow analysis logic with completeness checking and AI instruction generation.
 */
export class WorkflowAnalysisService {
  private taskFile: string;

  constructor(taskFile: string) {
    this.taskFile = taskFile;
  }

  /**
   * Analyze workflow completeness for AI users
   * Detects missing phases and provides guidance for AI to complete them
   * 
   * @requirement BUG-FIX-009-AI - AI flow correction mechanism
   * 
   * @returns Workflow completeness analysis result
   */
  async analyzeWorkflowCompleteness(): Promise<WorkflowCompletenessResult> {
    const taskData = await fs.readJson(this.taskFile);
    const { currentState, stateHistory } = taskData.workflow;
    
    // REFACTORED: Use TaskStateEngine for state sequence (single source of truth)
    const sequence = TaskStateEngine.getAllStates();
    
    const currentIndex = TaskStateEngine.getStateIndex(currentState as WorkflowState);
    
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
   * 
   * @requirement BUG-FIX-009-AI - AI guidance generation
   * 
   * @param missing Missing workflow phases
   * @param current Current workflow state
   * @returns AI instruction string
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
   * 
   * @requirement BUG-FIX-009-AI - Phase-specific AI guidance
   * 
   * @param phase Workflow phase
   * @returns Phase-specific instruction string
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
        `AI Execution Time: 1-3 minutes\n` +
        `After completing: You sync to READY_TO_COMMIT\n`,
        
      'READY_TO_COMMIT':
        ``  // Should never be missing
    };
    
    return instructions[phase] || '';
  }
}


