/**
 * Pattern Verification Service
 * 
 * Verifies pattern checklist items by checking if patterns are being followed.
 * Supports multiple verification types: response checks, code checks, file checks, command checks.
 * 
 * Phase 2.2: Pattern verification with caching
 */

import fs from 'fs-extra';
import { PatternChecklistItem, ChecklistItem } from './checklist-registry.js';
import { PatternVerificationStep } from './pattern-checklist-generator.js';

/**
 * Verification result for a step
 */
export interface VerificationStepResult {
  passed: boolean;
  message: string;
  verifiedAt: string;
}

/**
 * Verification result for a pattern item
 */
export interface VerificationResult {
  itemId: string;
  patternId: string;
  passed: boolean;
  steps: VerificationStepResult[];
  overallPassed: boolean;
  verifiedAt: string;
}

/**
 * Cached verification result
 */
interface CachedVerification {
  result: VerificationResult;
  expiresAt: number;
}

/**
 * Pattern Verification Service
 * 
 * Verifies pattern compliance with caching support.
 */
export class PatternVerificationService {
  private cache: Map<string, CachedVerification> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Verify a pattern checklist item
   */
  async verifyPatternItem(item: PatternChecklistItem): Promise<VerificationResult> {
    const cacheKey = `pattern-${item.patternId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    // Generate verification steps (simplified - actual steps would come from PatternChecklistGenerator)
    const steps = await this.generateVerificationSteps(item);
    
    // Verify each step
    const stepResults: VerificationStepResult[] = [];
    for (const step of steps) {
      const stepResult = await this.verifyStep(step, item.patternId);
      stepResults.push(stepResult);
    }

    const overallPassed = stepResults.every(s => s.passed);
    
    const result: VerificationResult = {
      itemId: item.id,
      patternId: item.patternId,
      passed: overallPassed,
      steps: stepResults,
      overallPassed,
      verifiedAt: new Date().toISOString()
    };

    // Cache result
    this.cache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.cacheTTL
    });

    return result;
  }

  /**
   * Verify a single verification step
   */
  async verifyStep(step: PatternVerificationStep, patternId: string): Promise<VerificationStepResult> {
    switch (step.verificationType) {
      case 'response_check':
        return this.verifyResponseCheck(step, patternId);
      case 'code_check':
        return this.verifyCodeCheck(step, patternId);
      case 'file_check':
        return this.verifyFileCheck(step, patternId);
      case 'command_check':
        return this.verifyCommandCheck(step, patternId);
      default:
        return {
          passed: false,
          message: `Unknown verification type: ${(step as any).verificationType}`,
          verifiedAt: new Date().toISOString()
        };
    }
  }

  /**
   * Verify response check (read/understand verification)
   * Note: Response checks are indirect - they check if AI response mentions the pattern
   * This is a simplified implementation - actual verification would require response history
   */
  private async verifyResponseCheck(step: PatternVerificationStep, patternId: string): Promise<VerificationStepResult> {
    // Simplified: Response checks are manual/indirect
    // In a real implementation, this would check conversation history or response patterns
    // For now, return a result that indicates manual verification needed
    
    return {
      passed: false, // Default to false (requires manual verification)
      message: `${step.description}. Manual verification required - check if pattern was mentioned in conversation.`,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Verify code check (implementation verification)
   * Checks if code complies with pattern requirements
   */
  private async verifyCodeCheck(step: PatternVerificationStep, patternId: string): Promise<VerificationStepResult> {
    // Simplified implementation
    // In a real implementation, this would:
    // 1. Parse code files
    // 2. Check for pattern compliance markers
    // 3. Analyze code structure
    
    // For now, return result indicating code check needs to be performed
    return {
      passed: false, // Default to false (requires code analysis)
      message: `${step.description}. Code check requires analysis of codebase for pattern compliance.`,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Verify file check (file exists verification)
   * Checks if required files exist
   */
  private async verifyFileCheck(step: PatternVerificationStep, patternId: string): Promise<VerificationStepResult> {
    if (!step.verificationRule) {
      return {
        passed: false,
        message: 'File check requires verification rule (file path)',
        verifiedAt: new Date().toISOString()
      };
    }

    try {
      const filePath = step.verificationRule;
      const exists = await fs.pathExists(filePath);
      
      return {
        passed: exists,
        message: exists 
          ? `File exists: ${filePath}`
          : `File not found: ${filePath}`,
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        passed: false,
        message: `File check error: ${(error as Error).message}`,
        verifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Verify command check (command execution verification)
   * Checks if command was run successfully
   */
  private async verifyCommandCheck(step: PatternVerificationStep, patternId: string): Promise<VerificationStepResult> {
    // Simplified: Command checks require execution history
    // In a real implementation, this would check command execution logs or results
    
    return {
      passed: false, // Default to false (requires command execution history)
      message: `${step.description}. Command check requires execution history verification.`,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Generate verification steps for a pattern item
   * Helper method to create steps (would normally come from PatternChecklistGenerator)
   */
  private async generateVerificationSteps(item: PatternChecklistItem): Promise<PatternVerificationStep[]> {
    // Simplified: Return basic steps
    // In actual implementation, this would use PatternChecklistGenerator
    return [
      {
        stepType: 'read',
        description: `Read pattern: ${item.title}`,
        verificationType: 'response_check'
      },
      {
        stepType: 'understand',
        description: `Understand pattern: ${item.description}`,
        verificationType: 'response_check'
      },
      {
        stepType: 'implement',
        description: `Implement pattern: ${item.description}`,
        verificationType: 'code_check'
      }
    ];
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific pattern
   */
  invalidateCache(patternId: string): void {
    this.cache.delete(`pattern-${patternId}`);
  }

  /**
   * Invalidate all expired cache entries
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

