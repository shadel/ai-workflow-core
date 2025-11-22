/**
 * Role Activator - Context-based role activation for Tier 2/3
 * Simplified version for v2.0 Core build
 * @requirement REQ-V2-011 - Context-based triggers
 */

/**
 * Context for role activation
 * @requirement REQ-V2-011 - Activation context
 * @requirement BUG-FIX-8 - State-aware activation
 */
export interface RoleActivationContext {
  taskGoal: string;
  taskDescription?: string;
  linkedRequirements?: Array<{
    id: string;
    category?: string;
    priority?: string;
  }>;
  workflowState?: 'UNDERSTANDING' | 'DESIGNING' | 'IMPLEMENTING' | 'TESTING' | 'REVIEWING' | 'READY_TO_COMMIT';
}

/**
 * Role trigger configuration
 */
interface RoleTrigger {
  roleId: string;
  keywords: string[];
  requirementCategories?: string[];
  minPriority?: 'P0' | 'P1' | 'P2' | 'P3';
}

/**
 * Role activation triggers for Tier 2/3
 * @requirement REQ-V2-011 - Keyword-based triggers
 */
const ROLE_TRIGGERS: Record<string, RoleTrigger> = {
  // Tier 2: Conditional activation
  security: {
    roleId: 'security',
    keywords: [
      'auth', 'authentication', 'authorization', 'password', 'token',
      'security', 'encrypt', 'decrypt', 'permission', 'access control',
      'vulnerability', 'xss', 'csrf', 'injection', 'sanitize',
      'oauth', 'jwt', 'session', 'cookie', 'secure', 'hash',
      'credential', 'secret', 'api key', 'private key'
    ],
    requirementCategories: ['security', 'auth', 'authentication'],
  },

  performance: {
    roleId: 'performance',
    keywords: [
      'performance', 'optimize', 'speed', 'cache', 'caching',
      'load time', 'latency', 'throughput', 'memory', 'cpu',
      'bottleneck', 'profiling', 'benchmark', 'scalability', 'scale',
      'indexing', 'query optimization', 'lazy load', 'memoize',
      'pagination', 'batch', 'async', 'parallel'
    ],
    requirementCategories: ['performance', 'optimization', 'speed'],
  },

  architect: {
    roleId: 'architect',
    keywords: [
      'architecture', 'design pattern', 'system design', 'refactor',
      'refactoring', 'restructure', 'scalability', 'maintainability',
      'microservice', 'monolith', 'pattern', 'solid', 'clean architecture',
      'dependency injection', 'separation of concerns', 'modular',
      'technical debt', 'code quality', 'best practices', 'api design'
    ],
    requirementCategories: ['architecture', 'design', 'infrastructure'],
    minPriority: 'P1', // Activate for P0/P1 complex tasks
  },

  // Tier 3: Specialized activation
  'product-manager': {
    roleId: 'product-manager',
    keywords: [
      'feature', 'roadmap', 'requirement', 'specification', 'spec',
      'user story', 'acceptance criteria', 'mvp', 'milestone',
      'release', 'planning', 'priority', 'stakeholder',
      'product backlog', 'epic', 'sprint planning', 'user need'
    ],
    requirementCategories: ['feature', 'requirement', 'planning'],
  },

  ux: {
    roleId: 'ux',
    keywords: [
      'ui', 'ux', 'user interface', 'user experience', 'design',
      'usability', 'accessibility', 'responsive', 'mobile',
      'frontend', 'css', 'styling', 'layout', 'component',
      'wireframe', 'mockup', 'prototype', 'user flow'
    ],
    requirementCategories: ['ui', 'ux', 'design', 'frontend'],
  },

  'data-scientist': {
    roleId: 'data-scientist',
    keywords: [
      'machine learning', 'ml', 'ai', 'model', 'training',
      'prediction', 'classification', 'regression', 'clustering',
      'data analysis', 'analytics', 'statistics', 'dataset',
      'feature engineering', 'algorithm', 'neural network',
      'data science', 'visualization', 'insight'
    ],
    requirementCategories: ['ml', 'ai', 'analytics', 'data'],
  },

  devops: {
    roleId: 'devops',
    keywords: [
      'deploy', 'deployment', 'ci/cd', 'pipeline', 'docker',
      'kubernetes', 'k8s', 'infrastructure', 'aws', 'azure', 'gcp',
      'terraform', 'ansible', 'monitoring', 'logging',
      'devops', 'container', 'orchestration', 'cloud'
    ],
    requirementCategories: ['infrastructure', 'devops', 'deployment'],
  },

  'business-analyst': {
    roleId: 'business-analyst',
    keywords: [
      'business', 'process', 'workflow', 'compliance', 'regulation',
      'policy', 'procedure', 'requirement', 'analysis',
      'roi', 'cost', 'benefit', 'stakeholder', 'change management',
      'business case', 'kpi', 'metric'
    ],
    requirementCategories: ['business', 'compliance', 'process'],
  },
};

/**
 * Role Activator - Determines which Tier 2/3 roles should be activated
 * @requirement REQ-V2-011 - Role activation logic
 */
export class RoleActivator {
  private readonly ACTIVATION_THRESHOLD = 2; // Minimum keyword matches

  /**
   * Analyze context and return role IDs to activate
   * @requirement REQ-V2-011 - Context analysis
   * @requirement BUG-FIX-8 - State-aware filtering
   */
  public analyzeContext(context: RoleActivationContext): string[] {
    const activatedRoles: Set<string> = new Set();
    const combinedText = this.getCombinedText(context);

    // Check each role's triggers
    for (const [roleId, trigger] of Object.entries(ROLE_TRIGGERS)) {
      if (this.shouldActivateRole(trigger, context, combinedText)) {
        activatedRoles.add(roleId);
      }
    }

    // Filter by state relevance (BUG-FIX-8)
    const activatedRolesArray = Array.from(activatedRoles);
    // DEBUG: Temporary logging to investigate test failures
    if (process.env.DEBUG_ROLE_ACTIVATOR === 'true') {
      console.log('[DEBUG] analyzeContext:', {
        activatedRoles: activatedRolesArray,
        workflowState: context.workflowState,
        taskGoal: context.taskGoal?.substring(0, 50) + '...',
      });
    }
    const stateFilteredRoles = this.filterByState(activatedRolesArray, context.workflowState);
    if (process.env.DEBUG_ROLE_ACTIVATOR === 'true') {
      console.log('[DEBUG] filterByState result:', stateFilteredRoles);
    }
    
    return stateFilteredRoles;
  }

  /**
   * Check if a specific role should be activated
   * @requirement REQ-V2-011 - Activation logic
   */
  private shouldActivateRole(
    trigger: RoleTrigger,
    context: RoleActivationContext,
    combinedText: string
  ): boolean {
    let score = 0;

    // Check keywords in task goal/description
    score += this.countKeywordMatches(trigger.keywords, combinedText);

    // Check requirement categories
    if (trigger.requirementCategories && context.linkedRequirements) {
      for (const req of context.linkedRequirements) {
        if (req.category && trigger.requirementCategories.includes(req.category)) {
          score += 3; // Category match is strong signal
        }
      }
    }

    // Check priority threshold
    if (trigger.minPriority) {
      const hasHighPriority = context.linkedRequirements?.some(req => 
        this.isPriorityHighEnough(req.priority, trigger.minPriority!)
      );
      if (!hasHighPriority) {
        return false; // Priority requirement not met
      }
    }

    return score >= this.ACTIVATION_THRESHOLD;
  }

  /**
   * Count keyword matches in text
   */
  private countKeywordMatches(keywords: string[], text: string): number {
    const lowerText = text.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return matches;
  }

  /**
   * Get combined text from context for analysis
   */
  private getCombinedText(context: RoleActivationContext): string {
    const parts: string[] = [context.taskGoal];

    if (context.taskDescription) {
      parts.push(context.taskDescription);
    }

    if (context.linkedRequirements) {
      const categories = context.linkedRequirements
        .map(req => req.category)
        .filter((cat): cat is string => !!cat);
      parts.push(...categories);
    }

    return parts.join(' ');
  }

  /**
   * Check if priority is high enough
   */
  private isPriorityHighEnough(
    priority: string | undefined,
    minPriority: 'P0' | 'P1' | 'P2' | 'P3'
  ): boolean {
    if (!priority) return false;

    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const actual = priorityOrder[priority as keyof typeof priorityOrder];
    const required = priorityOrder[minPriority];

    return actual !== undefined && actual <= required;
  }

  /**
   * Filter roles by workflow state relevance
   * @requirement BUG-FIX-8 - State-aware role activation
   */
  private filterByState(roles: string[], state?: string): string[] {
    // If no state provided, return all roles (backward compatibility)
    if (!state) {
      return roles;
    }

    // Define which roles are relevant at each state
    const stateRelevantRoles: Record<string, string[]> = {
      'UNDERSTANDING': [
        'architect',         // Design phase
        'product-manager',   // Requirements phase
        'business-analyst',  // Requirements phase
        'security',          // Early security consideration
      ],
      'DESIGNING': [
        'architect',         // Still reviewing design
        'security',          // Security design review
        'ux',                // UI/UX design
        'devops',            // Infrastructure design
      ],
      'IMPLEMENTING': [
        'security',          // Security code review
        'performance',       // Performance optimization
        'qa',                // Ready to test
        'devops',            // Deployment prep
      ],
      'TESTING': [
        'qa',                // Test review
        'security',          // Security testing
        'performance',       // Performance testing
      ],
      'REVIEWING': [
        'architect',         // Final architecture review
        'security',          // Final security check
        'qa',                // Final QA check
      ],
      'READY_TO_COMMIT': [
        'devops',            // Ready for deployment
        'qa',                // Final validation
      ],
    };

    const relevantRoles = stateRelevantRoles[state] || [];
    
    // Keep only roles that are relevant for this state
    // If a role is activated but not relevant for the state, it should be filtered out
    // Use strict comparison to ensure state matches exactly
    const filtered = roles.filter(roleId => relevantRoles.includes(roleId));
    
    // Return filtered roles (may be empty if no roles are relevant for this state)
    return filtered;
  }

  /**
   * Get activation explanation (for debugging/testing)
   */
  public explainActivation(context: RoleActivationContext): Record<string, number> {
    const scores: Record<string, number> = {};
    const combinedText = this.getCombinedText(context);

    for (const [roleId, trigger] of Object.entries(ROLE_TRIGGERS)) {
      let score = 0;
      score += this.countKeywordMatches(trigger.keywords, combinedText);

      if (trigger.requirementCategories && context.linkedRequirements) {
        for (const req of context.linkedRequirements) {
          if (req.category && trigger.requirementCategories.includes(req.category)) {
            score += 3;
          }
        }
      }

      scores[roleId] = score;
    }

    return scores;
  }
}

