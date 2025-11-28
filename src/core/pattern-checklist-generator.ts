/**
 * Pattern Checklist Generator
 * 
 * Converts state-based patterns into checklist items for verification.
 * Each pattern becomes one or more checklist items with verification steps.
 * 
 * Phase 2.1: Pattern-based checklist generation
 */

import { StateBasedPattern } from './pattern-provider.js';
import { PatternChecklistItem } from './checklist-registry.js';
import { WorkflowState } from '@shadel/workflow-core';

/**
 * Pattern verification step structure
 */
export interface PatternVerificationStep {
  stepType: 'read' | 'understand' | 'implement';
  description: string;
  verificationType: 'response_check' | 'code_check' | 'file_check' | 'command_check';
  verificationRule?: string;
}

/**
 * Pattern Checklist Generator
 * 
 * Generates checklist items from patterns with verification steps.
 */
export class PatternChecklistGenerator {
  /**
   * Generate checklist items from patterns
   * Each pattern becomes a checklist item with verification steps
   */
  generateChecklistItems(patterns: StateBasedPattern[]): PatternChecklistItem[] {
    return patterns.map(pattern => this.patternToChecklistItem(pattern));
  }

  /**
   * Convert a pattern to a checklist item
   */
  private patternToChecklistItem(pattern: StateBasedPattern): PatternChecklistItem {
    // Create verification steps based on pattern validation type
    const verificationSteps = this.createVerificationSteps(pattern);

    // Determine if pattern is required based on requiredStates
    const isRequired = !!(pattern.requiredStates && pattern.requiredStates.length > 0);

    return {
      id: `pattern-${pattern.id}`,
      title: pattern.title,
      description: pattern.description || pattern.action || 'Follow pattern guidelines',
      required: isRequired,
      priority: isRequired ? 'high' : 'medium',
      applicableStates: pattern.applicableStates,
      patternId: pattern.id,
      // Store verification steps as metadata (can be extended later)
      condition: (context) => {
        // Pattern applies if current state is in applicableStates
        return pattern.applicableStates.includes(context.state);
      }
    } as PatternChecklistItem;
  }

  /**
   * Create verification steps for a pattern
   * Based on pattern validation type, creates appropriate verification steps
   */
  private createVerificationSteps(pattern: StateBasedPattern): PatternVerificationStep[] {
    const steps: PatternVerificationStep[] = [];

    // Step 1: Read verification (always present)
    steps.push({
      stepType: 'read',
      description: `Read and understand pattern: ${pattern.title}`,
      verificationType: 'response_check',
      verificationRule: `Response should mention: ${pattern.title}`
    });

    // Step 2: Understand verification (always present)
    steps.push({
      stepType: 'understand',
      description: `Understand pattern requirements: ${pattern.action || pattern.description}`,
      verificationType: 'response_check',
      verificationRule: `Response should demonstrate understanding of: ${pattern.action || pattern.description}`
    });

    // Step 3: Implement verification (based on validation type)
    const implementStep = this.createImplementStep(pattern);
    if (implementStep) {
      steps.push(implementStep);
    }

    return steps;
  }

  /**
   * Create implementation verification step based on pattern validation type
   */
  private createImplementStep(pattern: StateBasedPattern): PatternVerificationStep | null {
    const validation = pattern.validation;

    switch (validation.type) {
      case 'file_exists':
        return {
          stepType: 'implement',
          description: `Ensure file exists: ${validation.rule}`,
          verificationType: 'file_check',
          verificationRule: validation.rule
        };

      case 'command_run':
        return {
          stepType: 'implement',
          description: `Run command: ${validation.rule}`,
          verificationType: 'command_check',
          verificationRule: validation.rule
        };

      case 'code_check':
        return {
          stepType: 'implement',
          description: `Implement code compliance: ${validation.message || validation.rule}`,
          verificationType: 'code_check',
          verificationRule: validation.rule
        };

      case 'custom':
        return {
          stepType: 'implement',
          description: `Follow pattern: ${validation.message || pattern.action}`,
          verificationType: 'response_check',
          verificationRule: validation.rule || pattern.action
        };

      default:
        // Default implementation step
        return {
          stepType: 'implement',
          description: `Implement pattern: ${pattern.action || pattern.title}`,
          verificationType: 'code_check',
          verificationRule: pattern.action || pattern.title
        };
    }
  }

  /**
   * Map pattern validation to checklist verification
   * Helper method to convert validation rules to checklist format
   */
  mapPatternValidationToChecklist(validation: StateBasedPattern['validation']): {
    verificationType: PatternVerificationStep['verificationType'];
    rule: string;
  } {
    switch (validation.type) {
      case 'file_exists':
        return {
          verificationType: 'file_check',
          rule: validation.rule
        };

      case 'command_run':
        return {
          verificationType: 'command_check',
          rule: validation.rule
        };

      case 'code_check':
        return {
          verificationType: 'code_check',
          rule: validation.rule
        };

      case 'custom':
      default:
        return {
          verificationType: 'response_check',
          rule: validation.rule || validation.message
        };
    }
  }
}

