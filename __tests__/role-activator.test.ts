/**
 * Unit tests for Role Activator
 * @requirement REQ-V2-011 - Context-based role activation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { RoleActivator, RoleActivationContext } from '../src/core/role-activator.js';

// OPTIMIZED: Enable concurrent execution for async tests
// Note: describe.concurrent temporarily removed due to Jest import issue
describe('RoleActivator', () => {
  let activator: RoleActivator;

  // OPTIMIZED: Use beforeAll instead of beforeEach - RoleActivator is stateless
  beforeAll(() => {
    activator = new RoleActivator();
  });

  describe('analyzeContext', () => {
    it('should activate security role for auth-related tasks', () => {
      // @requirement REQ-V2-011 - Security role activation
      const context: RoleActivationContext = {
        taskGoal: 'Implement user authentication and authorization',
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('security');
    });

    it('should activate performance role for optimization tasks', () => {
      // @requirement REQ-V2-011 - Performance role activation
      const context: RoleActivationContext = {
        taskGoal: 'Optimize database queries and caching strategy',
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('performance');
    });

    it('should activate architect role for design tasks with priority', () => {
      // @requirement REQ-V2-011 - Architect role activation
      const context: RoleActivationContext = {
        taskGoal: 'Refactor system architecture design patterns modular clean code',
        linkedRequirements: [
          { id: 'REQ-1', priority: 'P0' }  // Architect needs P0/P1
        ]
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('architect');
    });

    it('should activate UX role for UI tasks', () => {
      // @requirement REQ-V2-011 - UX role activation
      const context: RoleActivationContext = {
        taskGoal: 'Design responsive user interface with accessibility',
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('ux');
    });

    it('should activate multiple roles when multiple keywords match', () => {
      // @requirement REQ-V2-011 - Multiple role activation
      const context: RoleActivationContext = {
        taskGoal: 'Implement secure authentication password encryption with performance optimization caching',
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('security');
      expect(roles).toContain('performance');
    });

    it('should not activate roles when no keywords match', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Simple text change',
      };

      const roles = activator.analyzeContext(context);
      expect(roles.length).toBe(0);
    });

    it('should activate roles based on requirement categories', () => {
      // @requirement REQ-V2-011 - Category-based activation
      const context: RoleActivationContext = {
        taskGoal: 'Update feature',
        linkedRequirements: [
          { id: 'REQ-1', category: 'security' }
        ]
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('security');
    });

    it('should respect minimum priority threshold', () => {
      // @requirement REQ-V2-011 - Priority-based activation
      const context: RoleActivationContext = {
        taskGoal: 'Refactor architecture design patterns system modular structure',
        linkedRequirements: [
          { id: 'REQ-1', priority: 'P2' }  // Too low for architect (needs P1)
        ]
      };

      const roles = activator.analyzeContext(context);
      // Architect requires P0/P1, should not activate with P2 only
      expect(roles).not.toContain('architect');
    });

    it('should activate architect for P0/P1 tasks', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Design system architecture patterns for scalability and clean code',
        linkedRequirements: [
          { id: 'REQ-1', priority: 'P0' }
        ]
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('architect');
    });

    it('should handle task with description', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Update API',
        taskDescription: 'Implement OAuth authentication with JWT tokens',
      };

      const roles = activator.analyzeContext(context);
      expect(roles).toContain('security');
    });
  });

  describe('explainActivation', () => {
    it('should return activation scores for all roles', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Implement authentication with password hashing',
      };

      const scores = activator.explainActivation(context);
      
      expect(scores.security).toBeGreaterThan(0);
      expect(typeof scores.performance).toBe('number');
      expect(typeof scores.architect).toBe('number');
    });

    it('should give higher scores for more keyword matches', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Implement secure authentication authorization password encryption token JWT',
      };

      const scores = activator.explainActivation(context);
      expect(scores.security).toBeGreaterThan(5); // Many security keywords
    });
  });
});

