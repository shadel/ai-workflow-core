/**
 * Role Checklists Utilities
 * @requirement FR-013: Role-Specific Actionable Guidance
 * 
 * Provides structured checklists for each role with IDs, descriptions, and severity levels
 */

import { ROLES, type Role } from './role-definitions.js';

export interface ChecklistCheck {
  id: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface RoleChecklist {
  roleId: string;
  roleName: string;
  checks: ChecklistCheck[];
}

/**
 * Security Checklist (5 checks)
 */
export const SECURITY_CHECKLIST: RoleChecklist = {
  roleId: 'security',
  roleName: 'Security Engineer',
  checks: [
    {
      id: 'SEC-001',
      title: 'No Hardcoded Secrets',
      description: 'No hardcoded secrets or credentials in code',
      severity: 'error',
      message: 'Hardcoded secrets detected. Use environment variables or secret management.'
    },
    {
      id: 'SEC-002',
      title: 'Input Validation',
      description: 'Input validation and sanitization implemented',
      severity: 'error',
      message: 'Input validation missing. Validate and sanitize all user inputs.'
    },
    {
      id: 'SEC-003',
      title: 'SQL Injection Prevention',
      description: 'SQL injection prevention (parameterized queries)',
      severity: 'error',
      message: 'SQL injection risk detected. Use parameterized queries.'
    },
    {
      id: 'SEC-004',
      title: 'Authentication Check',
      description: 'Authentication and authorization checked',
      severity: 'error',
      message: 'Authentication/authorization not verified. Check access controls.'
    },
    {
      id: 'SEC-005',
      title: 'Password Hashing',
      description: 'Password hashing using bcrypt/argon2',
      severity: 'error',
      message: 'Password hashing not implemented. Use bcrypt or argon2.'
    }
  ]
};

/**
 * Performance Checklist (4 checks)
 */
export const PERFORMANCE_CHECKLIST: RoleChecklist = {
  roleId: 'performance',
  roleName: 'Performance Engineer',
  checks: [
    {
      id: 'PERF-001',
      title: 'Async in Loops',
      description: 'Expensive operations run asynchronously',
      severity: 'warning',
      message: 'Synchronous operations in loops detected. Consider async/await.'
    },
    {
      id: 'PERF-002',
      title: 'N+1 Query Problem',
      description: 'No N+1 query problems in database access',
      severity: 'error',
      message: 'N+1 query problem detected. Use eager loading or batch queries.'
    },
    {
      id: 'PERF-003',
      title: 'Caching Strategy',
      description: 'Caching strategy defined and implemented',
      severity: 'warning',
      message: 'Caching not implemented. Consider adding cache layer.'
    },
    {
      id: 'PERF-004',
      title: 'Large Arrays',
      description: 'Large datasets handled with pagination',
      severity: 'warning',
      message: 'Large arrays processed without pagination. Implement pagination.'
    }
  ]
};

/**
 * QA Checklist (4 checks)
 */
export const QA_CHECKLIST: RoleChecklist = {
  roleId: 'qa',
  roleName: 'QA Engineer',
  checks: [
    {
      id: 'QA-001',
      title: 'Test Coverage',
      description: 'Test coverage >= 80% for modified code',
      severity: 'warning',
      message: 'Test coverage below 80%. Add more tests.'
    },
    {
      id: 'QA-002',
      title: 'Edge Cases',
      description: 'Edge cases and error conditions tested',
      severity: 'warning',
      message: 'Edge cases not fully tested. Add edge case tests.'
    },
    {
      id: 'QA-003',
      title: 'Error Handling',
      description: 'Error handling tested',
      severity: 'warning',
      message: 'Error handling not tested. Add error scenario tests.'
    },
    {
      id: 'QA-004',
      title: 'Integration Tests',
      description: 'Integration tests added for API changes',
      severity: 'info',
      message: 'Integration tests missing. Consider adding integration tests.'
    }
  ]
};

/**
 * Get checklist for a specific role
 */
export function getChecklistForRole(roleId: string | null | undefined): RoleChecklist | undefined {
  if (!roleId || roleId === '') {
    return undefined;
  }
  
  // Check predefined checklists first
  if (roleId === 'security') {
    return SECURITY_CHECKLIST;
  }
  if (roleId === 'performance') {
    return PERFORMANCE_CHECKLIST;
  }
  if (roleId === 'qa') {
    return QA_CHECKLIST;
  }
  
  // Check if role exists in ROLES
  const role = ROLES[roleId];
  if (!role) {
    return undefined;
  }
  
  // Convert role checklist to RoleChecklist format
  const checks: ChecklistCheck[] = role.checklist.map((item, index) => {
    const prefix = roleId.toUpperCase().substring(0, 3);
    const id = `${prefix}-${String(index + 1).padStart(3, '0')}`;
    
    return {
      id,
      title: item.substring(0, 50), // First 50 chars as title
      description: item,
      severity: 'info' as const,
      message: item
    };
  });
  
  return {
    roleId: role.id,
    roleName: role.name,
    checks
  };
}

/**
 * Get checklists for multiple roles
 */
export function getChecklistsForRoles(roleIds: string[]): RoleChecklist[] {
  const checklists: RoleChecklist[] = [];
  
  for (const roleId of roleIds) {
    const checklist = getChecklistForRole(roleId);
    if (checklist) {
      checklists.push(checklist);
    }
  }
  
  return checklists;
}


