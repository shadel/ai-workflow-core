/**
 * Unit tests for Role Definitions
 * @requirement REQ-V2-011 - Role structure and definitions
 */

import { describe, it, expect } from '@jest/globals';
import {
  ROLES,
  getTier1RoleIds,
  getTier2RoleIds,
  getTier3RoleIds,
  getRole,
  getRoles
} from '../src/roles/role-definitions.js';

describe('Role Definitions', () => {
  describe('ROLES object', () => {
    it('should have all required roles defined', () => {
      // @requirement REQ-V2-011 - 10 predefined roles
      expect(ROLES.developer).toBeDefined();
      expect(ROLES.qa).toBeDefined();
      expect(ROLES.security).toBeDefined();
      expect(ROLES.performance).toBeDefined();
      expect(ROLES.architect).toBeDefined();
      expect(ROLES['product-manager']).toBeDefined();
      expect(ROLES.ux).toBeDefined();
      expect(ROLES['data-scientist']).toBeDefined();
      expect(ROLES.devops).toBeDefined();
      expect(ROLES['business-analyst']).toBeDefined();
    });

    it('should have Tier 1 roles with tier=1', () => {
      // @requirement REQ-V2-011 - Tier 1 always active
      expect(ROLES.developer.tier).toBe(1);
      expect(ROLES.qa.tier).toBe(1);
    });

    it('should have Tier 2 roles with tier=2', () => {
      // @requirement REQ-V2-011 - Tier 2 conditional
      expect(ROLES.security.tier).toBe(2);
      expect(ROLES.performance.tier).toBe(2);
      expect(ROLES.architect.tier).toBe(2);
    });

    it('should have Tier 3 roles with tier=3', () => {
      // @requirement REQ-V2-011 - Tier 3 specialized
      expect(ROLES['product-manager'].tier).toBe(3);
      expect(ROLES.ux.tier).toBe(3);
      expect(ROLES['data-scientist'].tier).toBe(3);
      expect(ROLES.devops.tier).toBe(3);
      expect(ROLES['business-analyst'].tier).toBe(3);
    });
  });

  describe('Role structure', () => {
    it('should have required properties for each role', () => {
      // @requirement REQ-V2-011 - Role structure validation
      for (const role of Object.values(ROLES)) {
        expect(role.id).toBeTruthy();
        expect(role.name).toBeTruthy();
        expect(role.icon).toBeTruthy();
        expect(role.tier).toBeGreaterThanOrEqual(1);
        expect(role.tier).toBeLessThanOrEqual(3);
        expect(role.description).toBeTruthy();
        expect(Array.isArray(role.checklist)).toBe(true);
      }
    });

    it('should have non-empty checklists', () => {
      // @requirement REQ-V2-011 - Role checklists for guidance
      for (const role of Object.values(ROLES)) {
        expect(role.checklist.length).toBeGreaterThan(0);
        expect(role.checklist.every(item => typeof item === 'string')).toBe(true);
      }
    });

    it('should have unique role IDs', () => {
      const ids = Object.keys(ROLES);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getTier1RoleIds', () => {
    it('should return Tier 1 role IDs', () => {
      const tier1 = getTier1RoleIds();
      expect(tier1).toContain('developer');
      expect(tier1).toContain('qa');
      expect(tier1.length).toBe(2);
    });
  });

  describe('getTier2RoleIds', () => {
    it('should return Tier 2 role IDs', () => {
      const tier2 = getTier2RoleIds();
      expect(tier2).toContain('security');
      expect(tier2).toContain('performance');
      expect(tier2).toContain('architect');
      expect(tier2.length).toBe(3);
    });
  });

  describe('getTier3RoleIds', () => {
    it('should return Tier 3 role IDs', () => {
      const tier3 = getTier3RoleIds();
      expect(tier3).toContain('product-manager');
      expect(tier3).toContain('ux');
      expect(tier3).toContain('data-scientist');
      expect(tier3).toContain('devops');
      expect(tier3).toContain('business-analyst');
      expect(tier3.length).toBe(5);
    });
  });

  describe('getRole', () => {
    it('should return role by ID', () => {
      const dev = getRole('developer');
      expect(dev).toBeDefined();
      expect(dev?.id).toBe('developer');
      expect(dev?.name).toBe('Developer');
    });

    it('should return undefined for non-existent role', () => {
      const role = getRole('non-existent');
      expect(role).toBeUndefined();
    });
  });

  describe('getRoles', () => {
    it('should return multiple roles by IDs', () => {
      const roles = getRoles(['developer', 'security', 'ux']);
      expect(roles.length).toBe(3);
      expect(roles[0].id).toBe('developer');
      expect(roles[1].id).toBe('security');
      expect(roles[2].id).toBe('ux');
    });

    it('should filter out non-existent role IDs', () => {
      const roles = getRoles(['developer', 'non-existent', 'qa']);
      expect(roles.length).toBe(2);
      expect(roles.map(r => r.id)).toEqual(['developer', 'qa']);
    });
  });
});

