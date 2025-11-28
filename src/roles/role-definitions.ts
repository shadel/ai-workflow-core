/**
 * Role Definitions for 3-Tier Activation System
 * Simplified checklists for Core build (advisory guidance only)
 * @requirement REQ-V2-011 - Role System with 3-Tier Activation
 */

/**
 * Role interface
 * @requirement REQ-V2-011 - Role structure
 */
export interface Role {
  id: string;
  name: string;
  icon: string;
  tier: 1 | 2 | 3;
  description: string;
  checklist: string[];
}

/**
 * All available roles organized by tier
 * @requirement REQ-V2-011 - 3-tier role activation
 */
export const ROLES: Record<string, Role> = {
  // ===== TIER 1: Always Active =====
  
  developer: {
    id: 'developer',
    name: 'Developer',
    icon: '💻',
    tier: 1,
    description: 'Core development responsibilities and best practices',
    checklist: [
      'Code follows project naming conventions and style guide',
      'Functions are small, focused, and do one thing well',
      'Error handling is comprehensive with meaningful messages',
      'Code is well-commented explaining why, not what',
      'No commented-out code or debug statements left',
      'Dependencies are minimal and justified',
      'Changes are backwards compatible or properly versioned'
    ]
  },

  qa: {
    id: 'qa',
    name: 'QA Engineer',
    icon: '🧪',
    tier: 1,
    description: 'Quality assurance and testing responsibilities',
    checklist: [
      'Unit tests written for new functionality',
      'Edge cases and error conditions tested',
      'Integration tests added for API changes',
      'Test coverage >= 80% for modified code',
      'Manual testing performed where applicable',
      'Regression tests verify existing functionality',
      'Test data is realistic and comprehensive'
    ]
  },

  // ===== TIER 2: Conditional Activation =====

  security: {
    id: 'security',
    name: 'Security Engineer',
    icon: '👮',
    tier: 2,
    description: 'Security best practices and vulnerability prevention',
    checklist: [
      'Input validation and sanitization implemented',
      'Authentication and authorization checked',
      'No hardcoded secrets or credentials in code',
      'SQL injection prevention (parameterized queries)',
      'XSS prevention (output escaping)',
      'CSRF protection enabled for state-changing operations',
      'Sensitive data encrypted at rest and in transit',
      'Password hashing using bcrypt/argon2',
      'Rate limiting applied to sensitive endpoints',
      'Security headers configured (CSP, HSTS, etc.)'
    ]
  },

  performance: {
    id: 'performance',
    name: 'Performance Engineer',
    icon: '⚡',
    tier: 2,
    description: 'Performance optimization and efficiency',
    checklist: [
      'No N+1 query problems in database access',
      'Caching strategy defined and implemented',
      'Database queries use proper indexes',
      'Large datasets handled with pagination',
      'Expensive operations run asynchronously',
      'Memory leaks prevented (no circular references)',
      'Bundle size impact considered for frontend',
      'API response times acceptable (<200ms)',
      'Resource cleanup (connections, listeners) handled',
      'Load testing performed for high-traffic features'
    ]
  },

  architect: {
    id: 'architect',
    name: 'Software Architect',
    icon: '🏗️',
    tier: 2,
    description: 'System design and architecture quality',
    checklist: [
      'Design follows SOLID principles',
      'Separation of concerns maintained',
      'Dependencies point inward (clean architecture)',
      'Interfaces used for abstraction where needed',
      'Code is modular and reusable',
      'Technical debt documented with TODOs',
      'Scalability considerations addressed',
      'Design patterns used appropriately',
      'API contracts well-defined and versioned',
      'System boundaries clear and enforced'
    ]
  },

  // ===== TIER 3: Specialized Activation =====

  'product-manager': {
    id: 'product-manager',
    name: 'Product Manager',
    icon: '📊',
    tier: 3,
    description: 'Product requirements and user value',
    checklist: [
      'User story clearly defined with acceptance criteria',
      'Feature solves actual user problem',
      'Success metrics defined and measurable',
      'MVP scope identified (what can be deferred)',
      'Stakeholder requirements captured',
      'Priority justified (P0/P1/P2)',
      'Release plan and milestones defined',
      'User documentation updated',
      'Feature flag strategy considered',
      'Rollback plan exists if needed'
    ]
  },

  ux: {
    id: 'ux',
    name: 'UX Designer',
    icon: '🎨',
    tier: 3,
    description: 'User experience and interface design',
    checklist: [
      'UI follows design system and brand guidelines',
      'User flow is intuitive and efficient',
      'Error messages are helpful and actionable',
      'Loading states provide feedback to users',
      'Responsive design works on all screen sizes',
      'Accessibility standards met (WCAG 2.1 AA)',
      'Color contrast sufficient for readability',
      'Keyboard navigation fully supported',
      'Touch targets >= 44x44px for mobile',
      'User testing feedback incorporated'
    ]
  },

  'data-scientist': {
    id: 'data-scientist',
    name: 'Data Scientist',
    icon: '📈',
    tier: 3,
    description: 'Data analysis and machine learning',
    checklist: [
      'Data quality validated (completeness, accuracy)',
      'Statistical significance verified for insights',
      'Model accuracy meets business requirements',
      'Training/validation/test split properly done',
      'Feature engineering documented and justified',
      'Bias in data and model identified and addressed',
      'Model explainability provided where needed',
      'Data privacy and compliance requirements met',
      'Monitoring and alerting set up for model drift',
      'Reproducibility ensured (fixed random seeds)'
    ]
  },

  devops: {
    id: 'devops',
    name: 'DevOps Engineer',
    icon: '🚀',
    tier: 3,
    description: 'Deployment and infrastructure',
    checklist: [
      'Infrastructure as code (Terraform, CloudFormation)',
      'CI/CD pipeline configured and tested',
      'Environment variables properly configured',
      'Secrets managed securely (not in repo)',
      'Health checks and readiness probes defined',
      'Logging and monitoring instrumented',
      'Rollback procedure tested and documented',
      'Resource limits and auto-scaling configured',
      'Disaster recovery plan exists',
      'Cost optimization considered'
    ]
  },

  'business-analyst': {
    id: 'business-analyst',
    name: 'Business Analyst',
    icon: '💼',
    tier: 3,
    description: 'Business requirements and process optimization',
    checklist: [
      'Business requirements clearly documented',
      'ROI and cost-benefit analysis completed',
      'Process workflow optimized',
      'Stakeholder sign-off obtained',
      'Compliance requirements identified',
      'Change impact analysis performed',
      'Training materials prepared for users',
      'Success criteria measurable and agreed upon',
      'Risk assessment completed',
      'Migration plan defined for existing data/processes'
    ]
  }
};

/**
 * Get tier 1 role IDs (always active)
 * @requirement REQ-V2-011 - Tier 1 always active
 */
export function getTier1RoleIds(): string[] {
  return Object.values(ROLES)
    .filter(role => role.tier === 1)
    .map(role => role.id);
}

/**
 * Get tier 2 role IDs (conditional)
 * @requirement REQ-V2-011 - Tier 2 conditional
 */
export function getTier2RoleIds(): string[] {
  return Object.values(ROLES)
    .filter(role => role.tier === 2)
    .map(role => role.id);
}

/**
 * Get tier 3 role IDs (specialized)
 * @requirement REQ-V2-011 - Tier 3 specialized
 */
export function getTier3RoleIds(): string[] {
  return Object.values(ROLES)
    .filter(role => role.tier === 3)
    .map(role => role.id);
}

/**
 * Get role by ID
 */
export function getRole(roleId: string): Role | undefined {
  return ROLES[roleId];
}

/**
 * Get multiple roles by IDs
 */
export function getRoles(roleIds: string[]): Role[] {
  return roleIds
    .map(id => ROLES[id])
    .filter((role): role is Role => role !== undefined);
}

