/**
 * Checklist Registry - registry & filtering for checklist items
 *
 * Phase 1.1: Foundation for dynamic state + pattern-based checklists.
 * This file is intentionally minimal and side‑effect free so we can
 * evolve it safely without breaking existing review checklist logic.
 */

import type { WorkflowState } from '@shadel/workflow-core';
import { getAllStateChecklistItems } from './state-checklist-items.js';

/**
 * Task context used for filtering checklist items.
 *
 * NOTE: This is a narrowed view of the full task; we only keep
 * fields that are useful for checklist filtering.
 */
export interface TaskContext {
  state: WorkflowState;
  goal?: string;
  patterns?: string[];   // active pattern IDs
  roles?: string[];      // active role IDs / names
  tags?: string[];       // task tags
}

export type ChecklistPriority = 'high' | 'medium' | 'low';

/**
 * Generic checklist item definition, designed to be compatible with
 * existing ReviewChecklistItem while adding filtering metadata.
 *
 * IMPORTANT:
 * - Do NOT remove or rename existing fields used by review checklist
 *   until migration is fully implemented and tested.
 * - New fields are optional so we don't break old data.
 */
export interface ChecklistItem {
  id: string;
  title: string;
  description: string;

  // Existing semantics
  required?: boolean;
  priority?: ChecklistPriority;

  // Context‑based filtering
  applicableStates?: WorkflowState[]; // if empty/undefined → all states
  applicableGoals?: string[];        // keyword match on task goal
  applicablePatterns?: string[];     // list of pattern IDs
  applicableRoles?: string[];        // list of role IDs / names
  applicableTags?: string[];         // list of task tags

  // Custom condition hook (for future use)
  condition?:(context: TaskContext) => boolean;
}

/**
 * Pattern checklist item - specialization for pattern-based checks.
 *
 * This extends ChecklistItem with a required patternId so later phases
 * (PatternChecklistGenerator, PatternVerificationService) can rely on it
 * without changing the base interface.
 */
export interface PatternChecklistItem extends ChecklistItem {
  patternId: string;
}

/**
 * ChecklistRegistry
 *
 * - Registers checklist items (state + pattern based)
 * - Provides filtered view for a given TaskContext
 * - Uses a simple in‑memory cache to avoid recomputing filters
 *
 * NOTE:
 * - This class is intentionally framework‑agnostic (no fs, no side effects)
 * - Integration with services (StateChecklistService, PatternChecklistGenerator)
 *   will be done in later phases.
 */
export class ChecklistRegistry {
  private items: ChecklistItem[] = [];
  private cache = new Map<string, ChecklistItem[]>();
  private defaultItemsRegistered = false;

  /**
   * Register a new checklist item.
   *
   * Safe to call multiple times; duplicated IDs will overwrite the previous
   * definition to keep latest version.
   */
  register(item: ChecklistItem): void {
    const existingIndex = this.items.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      this.items[existingIndex] = item;
    } else {
      this.items.push(item);
    }

    // Any registry change invalidates cache
    this.cache.clear();
  }

  /**
   * Get all checklist items matching the given context.
   * Results are cached based on a stable cache key.
   */
  getChecklistsForContext(context: TaskContext): ChecklistItem[] {
    const cacheKey = this.buildCacheKey(context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const matched = this.items.filter(item => this.matchesContext(item, context));
    this.cache.set(cacheKey, matched);
    return matched;
  }

  /**
   * Build a stable cache key from context. We only include fields that
   * affect filtering.
   */
  private buildCacheKey(context: TaskContext): string {
    const normalized = {
      state: context.state,
      goal: (context.goal || '').toLowerCase(),
      patterns: (context.patterns || []).slice().sort(),
      roles: (context.roles || []).slice().sort(),
      tags: (context.tags || []).slice().sort()
    };
    return JSON.stringify(normalized);
  }

  /**
   * Check whether an item matches the given context.
   *
   * Matching is designed to be:
   * - Conservative (if metadata missing → treat as globally applicable)
   * - Performance optimized (quick checks first, fail fast)
   *
   * Order of checks (fastest to slowest):
   * 1. State filter (enum equality - fastest)
   * 2. Arrays existence check (early exit if no arrays)
   * 3. Array includes (patterns, roles, tags - fast O(n))
   * 4. String search (goal keywords - slower O(n*m))
   * 5. Custom condition (function call - slowest)
   */
  private matchesContext(item: ChecklistItem, context: TaskContext): boolean {
    // 1. State filter (fastest check - enum equality)
    if (item.applicableStates && item.applicableStates.length > 0) {
      if (!item.applicableStates.includes(context.state)) {
        return false; // Fail fast on state mismatch
      }
    }

    // Quick existence check: if no other filters, item matches
    const hasOtherFilters = 
      (item.applicablePatterns && item.applicablePatterns.length > 0) ||
      (item.applicableRoles && item.applicableRoles.length > 0) ||
      (item.applicableTags && item.applicableTags.length > 0) ||
      (item.applicableGoals && item.applicableGoals.length > 0) ||
      typeof item.condition === 'function';

    if (!hasOtherFilters) {
      return true; // Early exit if only state filter (or no filters)
    }

    // 2. Patterns (fast array includes)
    if (item.applicablePatterns && item.applicablePatterns.length > 0) {
      const activePatterns = context.patterns || [];
      if (activePatterns.length === 0) {
        return false; // Fail fast if no active patterns
      }
      const hasPatternMatch = item.applicablePatterns.some(p =>
        activePatterns.includes(p)
      );
      if (!hasPatternMatch) {
        return false;
      }
    }

    // 3. Roles (fast array includes)
    if (item.applicableRoles && item.applicableRoles.length > 0) {
      const activeRoles = context.roles || [];
      if (activeRoles.length === 0) {
        return false; // Fail fast if no active roles
      }
      const hasRoleMatch = item.applicableRoles.some(r =>
        activeRoles.includes(r)
      );
      if (!hasRoleMatch) {
        return false;
      }
    }

    // 4. Tags (fast array includes)
    if (item.applicableTags && item.applicableTags.length > 0) {
      const activeTags = context.tags || [];
      if (activeTags.length === 0) {
        return false; // Fail fast if no active tags
      }
      const hasTagMatch = item.applicableTags.some(t =>
        activeTags.includes(t)
      );
      if (!hasTagMatch) {
        return false;
      }
    }

    // 5. Goal keywords (slower string search)
    if (item.applicableGoals && item.applicableGoals.length > 0) {
      if (!context.goal) {
        return false; // Fail fast if no goal
      }
      const goalLower = context.goal.toLowerCase();
      const hasGoalMatch = item.applicableGoals.some(keyword =>
        goalLower.includes(keyword.toLowerCase())
      );
      if (!hasGoalMatch) {
        return false;
      }
    }

    // 6. Custom condition (slowest - function call)
    if (typeof item.condition === 'function') {
      try {
        if (!item.condition(context)) {
          return false;
        }
      } catch {
        // Defensive: if custom condition throws, we treat as non‑match to
        // avoid surprising behavior during filtering.
        return false;
      }
    }

    return true;
  }

  /**
   * Register default state-specific checklist items.
   * 
   * This method can be called multiple times safely (idempotent).
   * Only registers defaults once to avoid duplicates.
   * 
   * Phase 1.4: Register default checklist items
   */
  registerDefaultChecklists(): void {
    if (this.defaultItemsRegistered) {
      return; // Already registered, skip
    }

    // Register all default state-specific checklist items
    const defaultItems = getAllStateChecklistItems();
    this.registerItems(defaultItems);
    
    this.defaultItemsRegistered = true;
  }

  /**
   * Register multiple checklist items at once.
   * Useful for bulk registration of default items.
   */
  registerItems(items: ChecklistItem[]): void {
    for (const item of items) {
      this.register(item);
    }
  }

  /**
   * Check if default items have been registered.
   */
  hasDefaultItems(): boolean {
    return this.defaultItemsRegistered;
  }

  /**
   * Get all registered items (for testing/debugging).
   */
  getAllItems(): readonly ChecklistItem[] {
    return [...this.items];
  }

  /**
   * Clear all registered items (for testing).
   */
  clear(): void {
    this.items = [];
    this.cache.clear();
    this.defaultItemsRegistered = false;
  }
}


