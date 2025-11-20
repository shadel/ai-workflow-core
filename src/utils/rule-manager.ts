/**
 * Rule Manager - Simplified for Core Build
 * Manage learned rules and best practices
 * @requirement REQ-V2-024 - Rule Management
 */

import fs from 'fs-extra';
import path from 'path';
import { WorkflowState } from '@shadel/workflow-core';
import { StateBasedPattern } from '../core/pattern-provider.js';

/**
 * Rule structure
 */
export interface Rule {
  id: string;
  title: string;
  content: string;
  source?: string;
  score?: number;
  createdAt: string;
  // Optional state-based fields (passed through if present)
  applicableStates?: WorkflowState[];
  requiredStates?: WorkflowState[];
  validation?: {
    type: 'file_exists' | 'command_run' | 'code_check' | 'custom';
    rule: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  };
}

/**
 * Rule collection
 */
export interface RuleCollection {
  rules: Rule[];
  lastUpdated: string;
}

/**
 * Rule Manager - Manage rules and best practices
 * @requirement REQ-V2-024 - Rule management system
 * @requirement v3.1.0 - Support both rules.json and patterns.json during transition
 */
export class RuleManager {
  private rulesFile = '.ai-context/rules.json';      // OLD (deprecated)
  private patternsFile = '.ai-context/patterns.json'; // NEW (v3.1.0+)
  private rulesDir = '.ai-context/rules';

  /**
   * Get all rules/patterns
   * v3.1.0: Supports both patterns.json (new) and rules.json (legacy)
   * Priority: patterns.json > rules.json
   */
  async getRules(): Promise<Rule[]> {
    // v3.1.0: Check patterns.json first (new format)
    if (await fs.pathExists(this.patternsFile)) {
      const collection = await fs.readJson(this.patternsFile);
      return collection.patterns || collection.rules || [];
    }
    
    // Fallback: Check rules.json (legacy format)
    if (await fs.pathExists(this.rulesFile)) {
      const collection: RuleCollection = await fs.readJson(this.rulesFile);
      return collection.rules || [];
    }
    
    return [];
  }

  /**
   * Add a new rule
   * @requirement REQ-V2-024 - Add rules
   */
  async addRule(rule: Omit<Rule, 'id' | 'createdAt'>): Promise<Rule> {
    const rules = await this.getRules();
    
    const newRule: Rule = {
      ...rule,
      id: `RULE-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    rules.push(newRule);
    await this.saveRules(rules);

    return newRule;
  }

  /**
   * Update an existing rule
   */
  async updateRule(id: string, updates: Partial<Rule>): Promise<Rule | null> {
    const rules = await this.getRules();
    const index = rules.findIndex(r => r.id === id);

    if (index === -1) {
      return null;
    }

    rules[index] = { ...rules[index], ...updates };
    await this.saveRules(rules);

    return rules[index];
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const rules = await this.getRules();
    const filtered = rules.filter(r => r.id !== id);

    if (filtered.length === rules.length) {
      return false; // Rule not found
    }

    await this.saveRules(filtered);
    return true;
  }

  /**
   * Import rules from markdown file
   * @requirement REQ-V2-024 - Import rules from other projects
   */
  async importFromMarkdown(filePath: string, source: string): Promise<number> {
    const content = await fs.readFile(filePath, 'utf-8');
    const rules = this.parseMarkdownRules(content, source);

    const existing = await this.getRules();
    const newRules = [...existing, ...rules];
    await this.saveRules(newRules);

    return rules.length;
  }

  /**
   * Parse rules from markdown
   */
  private parseMarkdownRules(content: string, source: string): Rule[] {
    const rules: Rule[] = [];
    
    // Match ## RULE-XXX: Title patterns
    const ruleRegex = /##\s+RULE-(\d+):\s+([^\n]+)\n\n([\s\S]*?)(?=\n##\s+RULE-|\n##\s+END|$)/g;
    let match;

    while ((match = ruleRegex.exec(content)) !== null) {
      const ruleNum = match[1];
      const title = match[2].trim();
      const ruleContent = match[3].trim();

      rules.push({
        id: `RULE-${ruleNum}`,
        title,
        content: ruleContent,
        source,
        createdAt: new Date().toISOString()
      });
    }

    return rules;
  }

  /**
   * Export rules to markdown
   */
  async exportToMarkdown(outputPath: string): Promise<void> {
    const rules = await this.getRules();
    
    let md = `# Learned Rules and Best Practices\n\n`;
    md += `**Last Updated:** ${new Date().toISOString()}\n`;
    md += `**Total Rules:** ${rules.length}\n\n`;
    md += `---\n\n`;

    for (const rule of rules) {
      md += `## ${rule.id}: ${rule.title}\n\n`;
      if (rule.source) {
        md += `**Source:** ${rule.source}\n`;
      }
      if (rule.score) {
        md += `**Score:** ${rule.score}/5\n`;
      }
      md += `\n${rule.content}\n\n`;
      md += `---\n\n`;
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, md, 'utf-8');
  }

  /**
   * Search rules by keyword
   */
  async search(keyword: string): Promise<Rule[]> {
    const rules = await this.getRules();
    const lowerKeyword = keyword.toLowerCase();

    return rules.filter(rule => 
      rule.title.toLowerCase().includes(lowerKeyword) ||
      rule.content.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Save rules/patterns to file
   * v3.1.0+: Always saves to patterns.json (never creates rules.json for new projects)
   * Only reads from rules.json for backward compatibility with legacy projects
   */
  private async saveRules(rules: Rule[]): Promise<void> {
    // Always use patterns.json for new projects (v3.1.0+)
    // Never create rules.json - only read from it for backward compatibility
    const targetFile = this.patternsFile;
    
    await fs.ensureDir(path.dirname(targetFile));

    // Always use 'patterns' key for patterns.json
    const collection = {
      patterns: rules,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeJson(targetFile, collection, { spaces: 2 });
  }

  /**
   * Get rules count
   */
  async count(): Promise<number> {
    const rules = await this.getRules();
    return rules.length;
  }

  /**
   * Clear all rules (dangerous!)
   */
  async clear(): Promise<void> {
    await this.saveRules([]);
  }

  /**
   * Check missing rules - NEW for v2.0
   * @requirement REQ-V2-003 - Check what rules are missing
   */
  async checkMissingRules(): Promise<{ missing: string[]; present: string[] }> {
    const currentRules = await this.getRules();
    const currentIds = new Set(currentRules.map(r => r.id));
    
    // Recommended rules for AI workflow projects
    const recommendedRules = [
      'RULE-001', 'RULE-002', 'RULE-003', 'RULE-004', 'RULE-005',
      'RULE-006', 'RULE-007', 'RULE-008', 'RULE-009', 'RULE-010'
    ];
    
    const missing = recommendedRules.filter(id => !currentIds.has(id));
    const present = recommendedRules.filter(id => currentIds.has(id));
    
    return { missing, present };
  }

  /**
   * Get rule template - NEW for v2.0
   * @requirement REQ-V2-003 - Provide rule templates
   */
  async getRuleTemplate(id: string): Promise<string | null> {
    // Rule templates for common patterns
    const templates: Record<string, string> = {
      'RULE-001': `# ${id}: No Interactive Terminal Commands

**Category:** Terminal Safety
**Priority:** CRITICAL

## Rule
Never run terminal commands that require user interaction or open pagers (git log, git show without --no-pager, less, etc.).

## Rationale
Interactive commands can hang the AI workflow, requiring manual intervention and breaking automation.

## Examples
✅ GOOD: git log --no-pager -10
❌ BAD: git log (opens pager)
`,
      'RULE-002': `# ${id}: Document Organization

**Category:** Project Structure
**Priority:** HIGH

## Rule
All documentation must be organized into the docs/ folder structure (workflows/, implementations/, testing/, learned-knowledge/, archive/).

## Rationale
Organized documentation is easier to find and maintain. Scattered docs in the project root become hard to manage.

## Examples
✅ GOOD: docs/implementations/feature-x.md
❌ BAD: feature-x-notes.md (in root)
`
    };
    
    return templates[id] || `# ${id}: Custom Rule\n\n**Category:** [Add category]\n**Priority:** [Add priority]\n\n## Rule\n[Describe the rule]\n\n## Rationale\n[Explain why]\n\n## Examples\n[Show good and bad examples]\n`;
  }

  /**
   * Get rule info - NEW for v2.0
   * @requirement REQ-V2-003 - Show detailed rule information
   */
  async getRuleInfo(id: string): Promise<(Rule & {description?: string; rationale?: string; examples?: string[]}) | null> {
    const rules = await this.getRules();
    const rule = rules.find(r => r.id === id);
    
    if (!rule) {
      return null;
    }
    
    // Parse markdown content to extract sections
    const lines = rule.content.split('\n');
    let description = '';
    let rationale = '';
    const examples: string[] = [];
    
    let currentSection = '';
    for (const line of lines) {
      if (line.startsWith('## Rule')) {
        currentSection = 'rule';
      } else if (line.startsWith('## Rationale')) {
        currentSection = 'rationale';
      } else if (line.startsWith('## Examples')) {
        currentSection = 'examples';
      } else if (currentSection === 'rule' && line.trim()) {
        description += line + '\n';
      } else if (currentSection === 'rationale' && line.trim()) {
        rationale += line + '\n';
      } else if (currentSection === 'examples' && line.trim()) {
        examples.push(line.trim());
      }
    }
    
    return {
      ...rule,
      description: description.trim(),
      rationale: rationale.trim(),
      examples
    };
  }

  /**
   * Get patterns for specific state
   * Filters patterns by applicableStates or requiredStates
   * 
   * @param state - Workflow state to filter by
   * @returns State-relevant patterns
   */
  async getPatternsForState(state: WorkflowState): Promise<StateBasedPattern[]> {
    const allPatterns = await this.getRules();
    
    return allPatterns.filter((p: any) => {
      const stateBased = p as StateBasedPattern;
      return stateBased.applicableStates?.includes(state) || 
             stateBased.requiredStates?.includes(state);
    }) as StateBasedPattern[];
  }

  /**
   * Get mandatory patterns for specific state
   * Filters patterns where requiredStates includes the state
   * 
   * @param state - Workflow state to filter by
   * @returns Mandatory patterns for state
   */
  async getMandatoryPatternsForState(state: WorkflowState): Promise<StateBasedPattern[]> {
    const allPatterns = await this.getRules();
    
    return allPatterns.filter((p: any) => {
      const stateBased = p as StateBasedPattern;
      return stateBased.requiredStates?.includes(state);
    }) as StateBasedPattern[];
  }
}

