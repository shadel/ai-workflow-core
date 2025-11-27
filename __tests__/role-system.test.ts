/**
 * Unit tests for Role System
 * @requirement REQ-V2-011 - 3-tier role system
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { RoleSystem } from '../src/core/role-system.js';
import { RoleActivationContext } from '../src/core/role-activator.js';

// OPTIMIZED: Enable concurrent execution for stateless tests
// Note: describe.concurrent temporarily removed due to Jest import issue
describe('RoleSystem', () => {
  let roleSystem: RoleSystem;

  // OPTIMIZED: Use beforeAll instead of beforeEach - RoleSystem is stateless
  beforeAll(() => {
    roleSystem = new RoleSystem();
  });

  describe('Tier 1 - Always Active', () => {
    it('should always return Tier 1 roles without context', () => {
      // @requirement REQ-V2-011 - Tier 1 always active
      const roles = roleSystem.getActiveRoles();
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).toContain('developer');
      expect(roleIds).toContain('qa');
    });

    it('should return Tier 1 roles even with context', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Random task',
      };

      const roles = roleSystem.getActiveRoles(context);
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).toContain('developer');
      expect(roleIds).toContain('qa');
    });
  });

  describe('Tier 2 - Conditional Activation', () => {
    it('should activate security role for auth tasks', () => {
      // @requirement REQ-V2-011 - Tier 2 conditional
      const context: RoleActivationContext = {
        taskGoal: 'Implement user authentication and password hashing',
      };

      const roles = roleSystem.getActiveRoles(context);
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).toContain('security');
    });

    it('should activate performance role for optimization tasks', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Optimize database queries and implement caching',
      };

      const roles = roleSystem.getActiveRoles(context);
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).toContain('performance');
    });

    it('should NOT activate Tier 2 roles without triggers', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Simple text update',
      };

      const roles = roleSystem.getActiveRoles(context);
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).not.toContain('security');
      expect(roleIds).not.toContain('performance');
      expect(roleIds).not.toContain('architect');
    });
  });

  describe('Tier 3 - Specialized Activation', () => {
    it('should activate UX role for UI tasks', () => {
      // @requirement REQ-V2-011 - Tier 3 specialized
      const context: RoleActivationContext = {
        taskGoal: 'Design user interface with responsive layout and accessibility',
      };

      const roles = roleSystem.getActiveRoles(context);
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).toContain('ux');
    });

    it('should activate DevOps role for deployment tasks', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Setup CI/CD pipeline with Docker and Kubernetes',
      };

      const roles = roleSystem.getActiveRoles(context);
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).toContain('devops');
    });

    it('should activate Data Scientist role for ML tasks', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Build machine learning model for prediction',
      };

      const roles = roleSystem.getActiveRoles(context);
      
      const roleIds = roles.map(r => r.id);
      expect(roleIds).toContain('data-scientist');
    });
  });

  describe('getTier1Roles', () => {
    it('should return all Tier 1 role objects', () => {
      const tier1Roles = roleSystem.getTier1Roles();
      
      expect(tier1Roles.length).toBe(2);
      expect(tier1Roles.every(r => r.tier === 1)).toBe(true);
    });
  });

  describe('getTier2Roles', () => {
    it('should return all Tier 2 role objects', () => {
      const tier2Roles = roleSystem.getTier2Roles();
      
      expect(tier2Roles.length).toBe(3);
      expect(tier2Roles.every(r => r.tier === 2)).toBe(true);
    });
  });

  describe('getTier3Roles', () => {
    it('should return all Tier 3 role objects', () => {
      const tier3Roles = roleSystem.getTier3Roles();
      
      expect(tier3Roles.length).toBe(5);
      expect(tier3Roles.every(r => r.tier === 3)).toBe(true);
    });
  });

  describe('isTier1Role', () => {
    it('should return true for Tier 1 roles', () => {
      expect(roleSystem.isTier1Role('developer')).toBe(true);
      expect(roleSystem.isTier1Role('qa')).toBe(true);
    });

    it('should return false for Tier 2/3 roles', () => {
      expect(roleSystem.isTier1Role('security')).toBe(false);
      expect(roleSystem.isTier1Role('ux')).toBe(false);
    });
  });

  describe('Custom configuration', () => {
    it('should accept custom tier configuration', () => {
      const customSystem = new RoleSystem({
        tier1: ['developer'],  // Only developer in Tier 1
        tier2: ['security', 'performance'],
        tier3: ['architect', 'ux']
      });

      const roles = customSystem.getActiveRoles();
      const roleIds = roles.map(r => r.id);
      
      expect(roleIds).toContain('developer');
      expect(roleIds).not.toContain('qa');  // Not in custom Tier 1
    });
  });

  describe('explainActivation', () => {
    it('should return activation scores', () => {
      const context: RoleActivationContext = {
        taskGoal: 'Implement authentication with encryption',
      };

      const scores = roleSystem.explainActivation(context);
      
      expect(scores.security).toBeGreaterThan(0);
      expect(typeof scores.performance).toBe('number');
    });
  });
});

