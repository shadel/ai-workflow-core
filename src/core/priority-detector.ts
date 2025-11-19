/**
 * Priority Detector - Auto-detect task priority from goal text
 * @requirement FREE-TIER-002 - Priority System
 * 
 * Cursor Integration: Helps Cursor understand task priority for better context
 */

import { Priority } from './task-queue.js';

const PRIORITY_KEYWORDS: Record<Priority, string[]> = {
  CRITICAL: [
    'fix', 'bug', 'broken', 'security', 'down', 'blocking', 
    'critical', 'urgent', 'hotfix', 'crash', 'error', 'exception',
    'fatal', 'outage', 'breach', 'vulnerability', 'exploit'
  ],
  HIGH: [
    'auth', 'login', 'payment', 'deadline', 'important', 
    'feature', 'customer', 'production', 'release', 'deploy',
    'api', 'endpoint', 'database', 'migration', 'upgrade'
  ],
  LOW: [
    'refactor', 'cleanup', 'improve', 'nice-to-have', 
    'optimization', 'tech-debt', 'documentation', 'comment',
    'style', 'formatting', 'lint', 'polish', 'enhancement'
  ],
  MEDIUM: [] // default - everything else
};

export class PriorityDetector {
  /**
   * Auto-detect priority from goal text
   * Cursor Integration: Cursor can use this to understand task urgency
   * 
   * @param goal - Task goal text
   * @returns Detected priority level
   */
  static detect(goal: string): Priority {
    if (!goal || typeof goal !== 'string') {
      return 'MEDIUM';
    }

    const lowerGoal = goal.toLowerCase();

    // Check CRITICAL keywords first (highest priority)
    for (const keyword of PRIORITY_KEYWORDS.CRITICAL) {
      if (lowerGoal.includes(keyword)) {
        return 'CRITICAL';
      }
    }

    // Check HIGH keywords
    for (const keyword of PRIORITY_KEYWORDS.HIGH) {
      if (lowerGoal.includes(keyword)) {
        return 'HIGH';
      }
    }

    // Check LOW keywords
    for (const keyword of PRIORITY_KEYWORDS.LOW) {
      if (lowerGoal.includes(keyword)) {
        return 'LOW';
      }
    }

    // Default to MEDIUM
    return 'MEDIUM';
  }

  /**
   * Get all keywords for a priority level
   * Useful for documentation or UI
   */
  static getKeywords(priority: Priority): string[] {
    return PRIORITY_KEYWORDS[priority] || [];
  }

  /**
   * Get all priority keywords
   * Useful for documentation
   */
  static getAllKeywords(): Record<Priority, string[]> {
    return { ...PRIORITY_KEYWORDS };
  }
}

