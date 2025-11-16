/**
 * Role System - Manages 3-tier role activation
 * @requirement REQ-V2-011 - 3-tier role activation
 */

import { Role, ROLES, getTier1RoleIds, getTier2RoleIds, getTier3RoleIds } from '../roles/role-definitions.js';
import { RoleActivator, RoleActivationContext } from './role-activator.js';

/**
 * Role System configuration
 */
export interface RoleSystemConfig {
  tier1: string[];  // Always active role IDs
  tier2: string[];  // Conditional role IDs
  tier3: string[];  // Specialized role IDs
}

/**
 * Role System - Manages role activation across 3 tiers
 * @requirement REQ-V2-011 - 3-tier activation management
 */
export class RoleSystem {
  private tier1Roles: string[];
  private tier2Roles: string[];
  private tier3Roles: string[];
  private activator: RoleActivator;

  /**
   * Initialize role system with tier configuration
   * @requirement REQ-V2-011 - Role system initialization
   */
  constructor(config?: RoleSystemConfig) {
    // Use config or defaults
    this.tier1Roles = config?.tier1 || getTier1RoleIds();
    this.tier2Roles = config?.tier2 || getTier2RoleIds();
    this.tier3Roles = config?.tier3 || getTier3RoleIds();
    
    this.activator = new RoleActivator();
  }

  /**
   * Get active roles for given context
   * @requirement REQ-V2-011 - Tier-based activation
   * 
   * Tier 1: Always active
   * Tier 2: Conditional (based on triggers)
   * Tier 3: Specialized (on-demand)
   */
  getActiveRoles(context?: RoleActivationContext): Role[] {
    // Tier 1: Always active
    const activeRoleIds: string[] = [...this.tier1Roles];

    // Tier 2/3: Conditional activation
    if (context) {
      const conditionalRoleIds = this.activator.analyzeContext(context);

      // Add Tier 2 roles if triggered
      for (const roleId of conditionalRoleIds) {
        if (this.tier2Roles.includes(roleId) && !activeRoleIds.includes(roleId)) {
          activeRoleIds.push(roleId);
        }
      }

      // Add Tier 3 roles if triggered
      for (const roleId of conditionalRoleIds) {
        if (this.tier3Roles.includes(roleId) && !activeRoleIds.includes(roleId)) {
          activeRoleIds.push(roleId);
        }
      }
    }

    // Return Role objects
    return activeRoleIds
      .map(id => ROLES[id])
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Get all tier 1 roles (always active)
   */
  getTier1Roles(): Role[] {
    return this.tier1Roles
      .map(id => ROLES[id])
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Get all tier 2 roles (conditional)
   */
  getTier2Roles(): Role[] {
    return this.tier2Roles
      .map(id => ROLES[id])
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Get all tier 3 roles (specialized)
   */
  getTier3Roles(): Role[] {
    return this.tier3Roles
      .map(id => ROLES[id])
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Check if role is in tier 1 (always active)
   */
  isTier1Role(roleId: string): boolean {
    return this.tier1Roles.includes(roleId);
  }

  /**
   * Get activation explanation (for debugging)
   */
  explainActivation(context: RoleActivationContext): Record<string, number> {
    return this.activator.explainActivation(context);
  }
}

