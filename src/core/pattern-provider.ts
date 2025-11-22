/**
 * Pattern Provider - State-Based Pattern System
 * Provides state-filtered patterns for Cursor to read and enforce
 * @requirement State-Based Pattern System (Cursor-Centric Design)
 * 
 * Key Principle: Tool provides information, Cursor enforces compliance
 * - Tool: Organizes patterns by state, provides structured data
 * - Cursor: Reads patterns, validates compliance, enforces rules
 */

import fs from 'fs-extra';
import { WorkflowState, Task } from '@shadel/workflow-core';
import { RuleManager } from '../utils/rule-manager.js';

/**
 * Pattern validation rule structure
 * Machine-readable validation rules for Cursor to check compliance
 */
export interface PatternValidation {
  /**
   * Validation type
   * - file_exists: Check if file exists
   * - command_run: Check if command was run (guidance only, Cursor checks)
   * - code_check: Check code compliance (guidance only, Cursor checks)
   * - custom: Custom validation (guidance only, Cursor checks)
   */
  type: 'file_exists' | 'command_run' | 'code_check' | 'custom';
  
  /**
   * Machine-readable rule
   * For file_exists: File path (supports ${task.id} interpolation)
   * For others: Guidance for Cursor
   */
  rule: string;
  
  /**
   * Human-readable message
   * What to show if pattern is violated
   */
  message: string;
  
  /**
   * Severity level
   * - error: Critical violation (Cursor should fix)
   * - warning: Important but not critical
   * - info: Informational
   */
  severity: 'error' | 'warning' | 'info';
}

/**
 * State-Based Pattern
 * Extended pattern structure with state association and validation rules
 */
export interface StateBasedPattern {
  /**
   * Pattern ID (e.g., "RULE-1763115867072")
   */
  id: string;
  
  /**
   * Pattern title
   */
  title: string;
  
  /**
   * States where this pattern applies
   * If pattern applies to multiple states, include all
   */
  applicableStates: WorkflowState[];
  
  /**
   * States where this pattern is mandatory
   * If undefined or empty, pattern is recommended but not mandatory
   */
  requiredStates?: WorkflowState[];
  
  /**
   * Short description (for context injection)
   */
  description: string;
  
  /**
   * Action instruction (what Cursor should do)
   * Clear, actionable instruction for Cursor
   */
  action: string;
  
  /**
   * Validation rule (how Cursor checks compliance)
   */
  validation: PatternValidation;
  
  /**
   * Full content (for backward compatibility)
   * Original pattern content from Rule interface
   */
  content: string;
  
  /**
   * Source project or context (optional)
   */
  source?: string;
  
  /**
   * Pattern score (1-5, optional)
   */
  score?: number;
  
  /**
   * Creation timestamp
   */
  createdAt: string;
}

/**
 * State pattern map structure
 * Organizes patterns by state (mandatory vs recommended)
 */
export type StatePatternMap = {
  [K in WorkflowState]: {
    mandatory: StateBasedPattern[];
    recommended: StateBasedPattern[];
  };
};

/**
 * Validation context for pattern compliance checking
 */
export interface ValidationContext {
  task: Task;
  changedFiles?: string[];
}

/**
 * Pattern validation result
 */
export interface PatternValidationResult {
  pattern: StateBasedPattern;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Pattern Provider
 * Provides state-filtered patterns for context injection
 * 
 * Key Principle: Tool provides, Cursor enforces
 * - Tool: Filters patterns by state, organizes by mandatory/recommended
 * - Cursor: Reads patterns, validates compliance, takes actions
 */
export class PatternProvider {
  private ruleManager: RuleManager;

  constructor() {
    this.ruleManager = new RuleManager();
  }

  /**
   * Get patterns for specific state
   * Returns patterns organized by mandatory/recommended
   * 
   * @param state - Current workflow state
   * @returns Patterns organized by mandatory/recommended
   */
  async getPatternsForState(state: WorkflowState): Promise<{
    mandatory: StateBasedPattern[];
    recommended: StateBasedPattern[];
  }> {
    const allPatterns = await this.ruleManager.getRules();
    
    // Convert to StateBasedPattern (with backward compatibility)
    const stateBasedPatterns: StateBasedPattern[] = allPatterns.map(rule => 
      this.convertToStateBased(rule)
    );
    
    // Filter by state
    const stateRelevant = stateBasedPatterns.filter(p => 
      p.applicableStates.includes(state) || 
      p.requiredStates?.includes(state)
    );
    
    // Separate mandatory and recommended
    const mandatory = stateRelevant.filter(p => 
      p.requiredStates?.includes(state)
    );
    const recommended = stateRelevant.filter(p => 
      !p.requiredStates?.includes(state)
    );
    
    return { mandatory, recommended };
  }

  /**
   * Get state pattern map
   * Groups all patterns by state
   * 
   * @returns Pattern map organized by state
   */
  async getStatePatternMap(): Promise<StatePatternMap> {
    const allPatterns = await this.ruleManager.getRules();
    const stateBasedPatterns: StateBasedPattern[] = allPatterns.map(rule => 
      this.convertToStateBased(rule)
    );
    
    const states: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    const map: Partial<StatePatternMap> = {};
    
    for (const state of states) {
      const stateRelevant = stateBasedPatterns.filter(p => 
        p.applicableStates.includes(state) || 
        p.requiredStates?.includes(state)
      );
      
      map[state] = {
        mandatory: stateRelevant.filter(p => p.requiredStates?.includes(state)),
        recommended: stateRelevant.filter(p => !p.requiredStates?.includes(state))
      };
    }
    
    // Fill in missing states with empty arrays
    const fullMap: StatePatternMap = {
      UNDERSTANDING: map.UNDERSTANDING || { mandatory: [], recommended: [] },
      DESIGNING: map.DESIGNING || { mandatory: [], recommended: [] },
      IMPLEMENTING: map.IMPLEMENTING || { mandatory: [], recommended: [] },
      TESTING: map.TESTING || { mandatory: [], recommended: [] },
      REVIEWING: map.REVIEWING || { mandatory: [], recommended: [] },
      READY_TO_COMMIT: map.READY_TO_COMMIT || { mandatory: [], recommended: [] }
    };
    
    return fullMap;
  }

  /**
   * Generate context section for NEXT_STEPS.md
   * Creates markdown content with state-filtered patterns
   * 
   * @param patterns - Patterns organized by mandatory/recommended
   * @param state - Current workflow state
   * @returns Markdown content for context injection
   */
  generateContextSection(
    patterns: { mandatory: StateBasedPattern[]; recommended: StateBasedPattern[] },
    state: WorkflowState
  ): string {
    if (patterns.mandatory.length === 0 && patterns.recommended.length === 0) {
      return ''; // No patterns for this state
    }

    let content = `
## 📋 Patterns for ${state} State

`;

    // Mandatory patterns
    if (patterns.mandatory.length > 0) {
      content += `### ⚠️ MANDATORY (You MUST comply)

`;
      
      for (const pattern of patterns.mandatory) {
        const safeAction = pattern.action || 'Follow pattern guidelines';
        // Use full content instead of truncated description
        // Normalize newlines to handle escaped \n strings
        const rawContent = pattern.content || pattern.description || '';
        const fullContent = this.normalizeNewlines(rawContent);
        
        // Include description if different from content (for test compatibility)
        const descriptionText = pattern.description && pattern.description !== rawContent 
          ? `${pattern.description}\n\n` 
          : '';
        
        content += `#### ${pattern.title}

${descriptionText}${fullContent}

**YOU MUST:**
1. ${safeAction}
2. Verify: ${pattern.validation.rule}

**Validation:**
- Type: ${pattern.validation.type}
- Check: ${pattern.validation.rule}
- Severity: ${pattern.validation.severity}

**If you don't:**
${pattern.validation.message}

`;
      }
    }

    // Recommended patterns (show after mandatory patterns)
    if (patterns.recommended.length > 0) {
      content += `### 💡 RECOMMENDED

`;
      
      for (const pattern of patterns.recommended) {
        const safeAction = pattern.action || 'Follow pattern guidelines';
        // Use full content instead of truncated description
        // Normalize newlines to handle escaped \n strings
        const rawContent = pattern.content || pattern.description || '';
        const fullContent = this.normalizeNewlines(rawContent);
        
        // Include description if different from content (for test compatibility)
        const descriptionText = pattern.description && pattern.description !== rawContent 
          ? `${pattern.description}\n\n` 
          : '';
        
        content += `#### ${pattern.title}

${descriptionText}${fullContent}

**Action:** ${safeAction}
**Check:** ${pattern.validation.rule}
**Severity:** ${pattern.validation.severity}

`;
      }
    }

    content += `---
`;

    return content;
  }

  /**
   * Convert Rule to StateBasedPattern
   * Handles backward compatibility for existing patterns
   * 
   * @param rule - Existing rule/pattern
   * @returns State-based pattern
   */
  private convertToStateBased(rule: any): StateBasedPattern {
    // If already state-based, enrich missing description/action/validation
    if (rule.applicableStates && Array.isArray(rule.applicableStates)) {
      const description =
        typeof rule.description === 'string' && rule.description.trim().length > 0
          ? rule.description
          : this.extractDescription(rule.content || '');
      const action =
        typeof rule.action === 'string' && rule.action.trim().length > 0
          ? rule.action
          : this.extractAction(rule.content || '') || 'Follow pattern guidelines';
      const validation: PatternValidation =
        rule.validation && typeof rule.validation === 'object'
          ? rule.validation
          : {
              type: 'custom',
              rule: 'Check pattern compliance',
              message: `Pattern "${rule.title}" should be followed`,
              severity: 'warning'
            };

      return {
        ...rule,
        description,
        action,
        validation
      } as StateBasedPattern;
    }

    // Convert legacy pattern to state-based
    // Default: Apply to all states (backward compatibility)
    const allStates: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];

    // Extract description from content (first paragraph)
    const description = this.extractDescription(rule.content);

    // Extract action from content (look for action keywords)
    const action = this.extractAction(rule.content) || 'Follow pattern guidelines';

    // Create default validation
    const validation: PatternValidation = {
      type: 'custom',
      rule: 'Check pattern compliance',
      message: `Pattern "${rule.title}" should be followed`,
      severity: 'warning'
    };

    return {
      id: rule.id,
      title: rule.title,
      applicableStates: allStates, // Default: all states
      requiredStates: undefined, // Default: not mandatory
      description,
      action,
      validation,
      content: rule.content,
      source: rule.source,
      score: rule.score,
      createdAt: rule.createdAt
    };
  }

  /**
   * Normalize newlines in pattern content
   * Handles multiple escape formats:
   * - \\n (double escaped) → \n (single escaped) → actual newline
   * - \n (single escaped) → actual newline
   * - Preserves actual newlines
   */
  private normalizeNewlines(content: string): string {
    if (!content) return '';
    
    // Handle double-escaped newlines (\\n in JSON string)
    // First pass: \\n → \n
    let normalized = content.replace(/\\\\n/g, '\n');
    
    // Handle single-escaped newlines (\n in JSON string)
    // Second pass: \n → actual newline (if not already)
    normalized = normalized.replace(/\\n/g, '\n');
    
    return normalized;
  }

  /**
   * Extract description from content
   * Gets first paragraph or first 200 characters
   */
  private extractDescription(content: string): string {
    // Try to find first paragraph
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 0) {
      const first = paragraphs[0].trim();
      // Remove markdown headers
      const cleaned = first.replace(/^#+\s+/, '').trim();
      if (cleaned.length > 0 && cleaned.length <= 200) {
        return cleaned;
      }
    }
    
    // Fallback: first 200 characters
    return content.substring(0, 200).trim() + (content.length > 200 ? '...' : '');
  }

  /**
   * Extract action from content
   * Looks for action keywords or patterns
   */
  private extractAction(content: string): string | null {
    // Look for common action patterns
    const actionPatterns = [
      /(?:Action|YOU MUST|Do|Execute|Run|Create|Write|Add|Implement):\s*(.+)/i,
      /`([^`]+)`/g, // Code blocks (commands)
      /npx\s+ai-workflow\s+([\w-]+)/i // ai-workflow commands (word chars only)
    ];

    for (const pattern of actionPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Validate pattern compliance
   * Tool reports violations, Cursor decides what to do
   * 
   * @param pattern - Pattern to validate
   * @param context - Validation context
   * @returns Validation result (DO NOT throw errors)
   */
  async validatePatternCompliance(
    pattern: StateBasedPattern,
    context: ValidationContext
  ): Promise<PatternValidationResult> {
    switch (pattern.validation.type) {
      case 'file_exists': {
        // Interpolate rule with task context
        let filePath = pattern.validation.rule;
        if (context.task.id) {
          filePath = filePath.replace(/\$\{task\.id\}/g, context.task.id);
        }
        if (context.task.goal) {
          filePath = filePath.replace(/\$\{task\.goal\}/g, context.task.goal);
        }
        
        const exists = await fs.pathExists(filePath);
        return {
          pattern,
          passed: exists,
          message: exists ? 'OK' : pattern.validation.message,
          severity: pattern.validation.severity
        };
      }
      
      case 'command_run':
        // For command_run, we can't verify if command was actually run
        // Return guidance for Cursor to check
        // Note: These patterns are designed for Cursor to verify, not tool to auto-verify
        return {
          pattern,
          passed: false, // Cursor needs to verify
          message: pattern.validation.message,
          severity: pattern.validation.severity
        };
      
      case 'code_check':
      case 'custom':
        // For code_check and custom, return guidance for Cursor
        // Note: These patterns are designed for Cursor to verify, not tool to auto-verify
        // The tool reports violations, Cursor decides what to do based on severity
        return {
          pattern,
          passed: false, // Cursor needs to check
          message: pattern.validation.message,
          severity: pattern.validation.severity
        };
      
      default:
        return {
          pattern,
          passed: false,
          message: `Unknown validation type: ${(pattern.validation as any).type}`,
          severity: 'warning'
        };
    }
  }

  /**
   * Validate all patterns for a state
   * Returns violations (DO NOT block)
   * 
   * @param state - Workflow state
   * @param context - Validation context
   * @returns Array of validation results (violations only)
   */
  async validateStatePatterns(
    state: WorkflowState,
    context: ValidationContext
  ): Promise<PatternValidationResult[]> {
    const patterns = await this.getPatternsForState(state);
    const allPatterns = [...patterns.mandatory, ...patterns.recommended];
    
    const results: PatternValidationResult[] = [];
    
    for (const pattern of allPatterns) {
      const result = await this.validatePatternCompliance(pattern, context);
      if (!result.passed) {
        results.push(result);
      }
    }
    
    return results;
  }
}

