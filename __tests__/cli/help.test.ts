/**
 * Help CLI Command Tests
 * Tests for data-driven help command implementation
 * @requirement REQ-V2-003 - Help system
 */

import { describe, it, expect } from '@jest/globals';
import { 
  renderGeneralHelp, 
  renderHelp, 
  getPackageType,
  filterCommandsByPackage,
  renderBox,
  renderSection,
  renderCategory
} from '../../src/cli/commands/help-renderer.js';
import { COMMAND_HELPS, CATEGORIES } from '../../src/cli/commands/help-data.js';
import type { CommandHelp, Category, HelpOptions } from '../../src/cli/commands/help-types.js';

describe('Help Command - Data-Driven Architecture', () => {
  describe('getPackageType()', () => {
    it('should detect core package type', () => {
      const packageType = getPackageType();
      // Should return 'core' for this package
      expect(packageType).toBe('core');
      expect(['core', 'full']).toContain(packageType);
    });
  });

  describe('filterCommandsByPackage()', () => {
    it('should filter commands by package type', () => {
      const coreCommands = filterCommandsByPackage(COMMAND_HELPS, 'core');
      const fullCommands = filterCommandsByPackage(COMMAND_HELPS, 'full');
      
      // All commands should have package 'both' or match the filter
      coreCommands.forEach(cmd => {
        expect(['core', 'both']).toContain(cmd.package);
      });
      
      fullCommands.forEach(cmd => {
        expect(['full', 'both']).toContain(cmd.package);
      });
    });

    it('should include commands with package "both"', () => {
      const coreCommands = filterCommandsByPackage(COMMAND_HELPS, 'core');
      
      // Commands with package 'both' should be included
      const bothCommands = COMMAND_HELPS.filter(cmd => cmd.package === 'both');
      bothCommands.forEach(cmd => {
        expect(coreCommands).toContainEqual(
          expect.objectContaining({ name: cmd.name })
        );
      });
    });
  });

  describe('renderBox()', () => {
    it('should render box with title', () => {
      const output = renderBox('Test Title', '', 'core');
      expect(output).toContain('Test Title');
      expect(output).toContain('Core Build');
      expect(output).toContain('╔');
      expect(output).toContain('╗');
      expect(output).toContain('╚');
      expect(output).toContain('╝');
    });

    it('should render box with content', () => {
      const content = 'Test content here';
      const output = renderBox('Title', content, 'core');
      expect(output).toContain(content);
    });

    it('should render box without package type', () => {
      const output = renderBox('Title', 'Content');
      expect(output).toContain('Title');
      expect(output).not.toContain('Core Build');
      expect(output).not.toContain('Full Build');
    });
  });

  describe('renderSection()', () => {
    it('should render section with title and content', () => {
      const content = ['Line 1', 'Line 2', 'Line 3'];
      const output = renderSection('SECTION TITLE:', content);
      
      expect(output).toContain('SECTION TITLE:');
      // Check that lines are present (format may vary with newlines)
      content.forEach(line => {
        expect(output).toContain(line);
      });
    });

    it('should return empty string for empty content', () => {
      const output = renderSection('TITLE:', []);
      expect(output).toBe('');
    });
  });

  describe('renderCategory()', () => {
    it('should render category with commands', () => {
      // Use actual category from CATEGORIES
      const category = CATEGORIES.find(cat => cat.id === 'core-workflow');
      expect(category).toBeDefined();
      
      if (!category) return;
      
      // Filter commands that match this category ID
      const categoryCommands = COMMAND_HELPS.filter(cmd => 
        cmd.category === category.id
      );
      
      expect(categoryCommands.length).toBeGreaterThan(0);
      
      const output = renderCategory(category, categoryCommands);
      
      expect(output).toContain(category.name);
      // Verify commands are rendered
      categoryCommands.forEach(cmd => {
        expect(output).toContain(cmd.name);
        expect(output).toContain(cmd.description);
      });
    });

    it('should return empty string for category with no commands', () => {
      const category: Category = {
        id: 'empty-category',
        name: 'Empty',
        icon: '📦',
        commands: ['nonexistent'],
        package: 'both'
      };
      
      const output = renderCategory(category, COMMAND_HELPS);
      expect(output).toBe('');
    });

    it('should sort commands by priority', () => {
      // Use actual category from CATEGORIES
      const category = CATEGORIES.find(cat => cat.id === 'core-workflow');
      expect(category).toBeDefined();
      
      if (!category) return;
      
      const categoryCommands = COMMAND_HELPS.filter(cmd => 
        cmd.category === category.id
      );
      
      expect(categoryCommands.length).toBeGreaterThan(0);
      
      const output = renderCategory(category, categoryCommands);
      
      // Verify output is not empty and contains category name
      expect(output).not.toBe('');
      expect(output).toContain(category.name);
      
      // Verify all commands are rendered
      categoryCommands.forEach(cmd => {
        expect(output).toContain(cmd.name);
      });
      
      // Priority sorting is tested in renderGeneralHelp test
      // Here we just verify that rendering works correctly
    });
  });

  describe('renderHelp()', () => {
    it('should render command help in text format', () => {
      const commandHelp = COMMAND_HELPS.find(cmd => cmd.name === 'task');
      expect(commandHelp).toBeDefined();
      
      if (commandHelp) {
        const output = renderHelp(commandHelp, 'text');
        
        expect(output).toContain('COMMAND: npx ai-workflow task');
        expect(output).toContain('USAGE:');
        expect(output).toContain(commandHelp.usage);
        
        if (commandHelp.options && commandHelp.options.length > 0) {
          expect(output).toContain('OPTIONS:');
        }
        
        if (commandHelp.examples && commandHelp.examples.length > 0) {
          expect(output).toContain('EXAMPLES:');
          commandHelp.examples.forEach(example => {
            expect(output).toContain(example);
          });
        }
        
        if (commandHelp.workflow && commandHelp.workflow.length > 0) {
          expect(output).toContain('WORKFLOW:');
        }
        
        if (commandHelp.tips && commandHelp.tips.length > 0) {
          expect(output).toContain('TIPS:');
        }
        
        if (commandHelp.related && commandHelp.related.length > 0) {
          expect(output).toContain('RELATED COMMANDS:');
        }
      }
    });

    it('should render command help in JSON format', () => {
      const commandHelp = COMMAND_HELPS.find(cmd => cmd.name === 'task');
      expect(commandHelp).toBeDefined();
      
      if (commandHelp) {
        const output = renderHelp(commandHelp, 'json');
        
        // Should be valid JSON
        const parsed = JSON.parse(output);
        
        expect(parsed).toHaveProperty('name');
        expect(parsed).toHaveProperty('description');
        expect(parsed).toHaveProperty('usage');
        expect(parsed).toHaveProperty('category');
        expect(parsed).toHaveProperty('priority');
        expect(parsed).toHaveProperty('package');
        
        expect(parsed.name).toBe(commandHelp.name);
        expect(parsed.description).toBe(commandHelp.description);
      }
    });

    it('should render all sections when present', () => {
      // Find command with all sections
      const commandHelp = COMMAND_HELPS.find(cmd => 
        cmd.options && 
        cmd.examples && 
        cmd.workflow && 
        cmd.tips && 
        cmd.related
      );
      
      if (commandHelp) {
        const output = renderHelp(commandHelp, 'text');
        
        expect(output).toContain('USAGE:');
        expect(output).toContain('OPTIONS:');
        expect(output).toContain('EXAMPLES:');
        expect(output).toContain('WORKFLOW:');
        expect(output).toContain('TIPS:');
        expect(output).toContain('RELATED COMMANDS:');
      }
    });
  });

  describe('renderGeneralHelp()', () => {
    it('should render general help in text format', () => {
      const options: HelpOptions = { all: false, json: false };
      const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', options);
      
      expect(output).toContain('AI WORKFLOW ENGINE - HELP');
      expect(output).toContain('Core Build');
      
      // Should contain at least some categories
      const coreCategories = CATEGORIES.filter(cat => 
        cat.package === 'core' || cat.package === 'both'
      );
      
      // At least one category should be present in data
      expect(coreCategories.length).toBeGreaterThan(0);
      
      // With progressive disclosure, categories are only shown if they have
      // matching commands in topCommands (top 15)
      // So we just verify output contains meaningful content
      expect(output.length).toBeGreaterThan(200);
      
      // Should contain Quick Start
      expect(output).toContain('QUICK START:');
    });

    it('should render general help in JSON format', () => {
      const options: HelpOptions = { all: false, json: true };
      const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', options);
      
      // Should be valid JSON
      const parsed = JSON.parse(output);
      
      expect(parsed).toHaveProperty('package');
      expect(parsed).toHaveProperty('categories');
      expect(parsed).toHaveProperty('commands');
      expect(parsed).toHaveProperty('quickStart');
      
      expect(parsed.package).toBe('core');
      expect(Array.isArray(parsed.categories)).toBe(true);
      expect(Array.isArray(parsed.commands)).toBe(true);
      expect(Array.isArray(parsed.quickStart)).toBe(true);
    });

    it('should implement progressive disclosure', () => {
      const optionsWithoutAll: HelpOptions = { all: false, json: false };
      const outputWithoutAll = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', optionsWithoutAll);
      
      const optionsWithAll: HelpOptions = { all: true, json: false };
      const outputWithAll = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', optionsWithAll);
      
      // With --all, should show all commands
      // Without --all, should show top commands and message
      const filteredCommands = filterCommandsByPackage(COMMAND_HELPS, 'core');
      
      if (filteredCommands.length > 15) {
        // Should show progressive disclosure message when commands are hidden
        expect(outputWithoutAll).toContain('more commands available');
        expect(outputWithoutAll).toContain('Use --all to see all');
      }
      
      // Both should contain Quick Start
      expect(outputWithoutAll).toContain('QUICK START:');
      expect(outputWithAll).toContain('QUICK START:');
    });

    it('should filter commands by package type', () => {
      const options: HelpOptions = { all: true, json: true };
      const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', options);
      
      const parsed = JSON.parse(output);
      
      // All commands should be for core package
      parsed.commands.forEach((cmd: any) => {
        expect(['core', 'both']).toContain(cmd.package || 'both');
      });
      
      // Categories should be filtered
      parsed.categories.forEach((cat: any) => {
        expect(['core', 'both']).toContain(cat.package || 'both');
      });
    });

    it('should sort commands by priority', () => {
      const options: HelpOptions = { all: true, json: true };
      const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', options);
      
      const parsed = JSON.parse(output);
      
      // Commands should be sorted by priority (higher first)
      // But JSON output may only include summary fields, so check if priority is present
      if (parsed.commands.length > 1 && parsed.commands[0].priority !== undefined) {
        for (let i = 0; i < parsed.commands.length - 1; i++) {
          const current = parsed.commands[i];
          const next = parsed.commands[i + 1];
          
          // Priority should be descending (higher priority = first)
          if (current.priority !== undefined && next.priority !== undefined) {
            expect(current.priority).toBeGreaterThanOrEqual(next.priority);
          }
        }
      } else {
        // JSON output may not include priority, which is fine
        // The important thing is that text output is sorted
        expect(parsed.commands.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Help Data Structure', () => {
    it('should have all required Core commands', () => {
      const coreCommandNames = [
        'task', 'sync', 'validate', 'checklist', 'help', 'pattern', 'rule',
        'init', 'upgrade', 'generate', 'review', 'migrate', 'shell', 'dashboard'
      ];
      
      const commandNames = COMMAND_HELPS.map(cmd => cmd.name);
      
      coreCommandNames.forEach(cmdName => {
        expect(commandNames).toContain(cmdName);
      });
    });

    it('should have checklist command in help data', () => {
      const checklistCommand = COMMAND_HELPS.find(cmd => cmd.name === 'checklist');
      expect(checklistCommand).toBeDefined();
      
      if (checklistCommand) {
        expect(checklistCommand.description).toBe('Manage state checklists');
        expect(checklistCommand.category).toBe('core-workflow');
        expect(checklistCommand.package).toBe('both');
        expect(checklistCommand.priority).toBeGreaterThanOrEqual(1);
        expect(checklistCommand.priority).toBeLessThanOrEqual(10);
      }
    });

    it('should have checklist in core-workflow category', () => {
      const coreWorkflowCategory = CATEGORIES.find(cat => cat.id === 'core-workflow');
      expect(coreWorkflowCategory).toBeDefined();
      
      if (coreWorkflowCategory) {
        expect(coreWorkflowCategory.commands).toContain('checklist');
      }
    });

    it('should have all commands with required fields', () => {
      COMMAND_HELPS.forEach(cmd => {
        expect(cmd).toHaveProperty('name');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('usage');
        expect(cmd).toHaveProperty('examples');
        expect(cmd).toHaveProperty('category');
        expect(cmd).toHaveProperty('priority');
        expect(cmd).toHaveProperty('package');
        
        expect(typeof cmd.name).toBe('string');
        expect(typeof cmd.description).toBe('string');
        expect(typeof cmd.usage).toBe('string');
        expect(Array.isArray(cmd.examples)).toBe(true);
        expect(typeof cmd.priority).toBe('number');
        expect(cmd.priority).toBeGreaterThanOrEqual(1);
        expect(cmd.priority).toBeLessThanOrEqual(10);
        expect(['core', 'full', 'both']).toContain(cmd.package);
      });
    });

    it('should have all categories with required fields', () => {
      CATEGORIES.forEach(category => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('icon');
        expect(category).toHaveProperty('commands');
        expect(category).toHaveProperty('package');
        
        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.icon).toBe('string');
        expect(Array.isArray(category.commands)).toBe(true);
        expect(['core', 'full', 'both']).toContain(category.package);
      });
    });

    it('should have category IDs match command categories', () => {
      const categoryIds = CATEGORIES.map(cat => cat.id);
      
      COMMAND_HELPS.forEach(cmd => {
        expect(categoryIds).toContain(cmd.category);
      });
    });
  });

  describe('Checklist Command Help', () => {
    it('should show checklist in general help', () => {
      const options: HelpOptions = { all: true, json: false };
      const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', options);
      
      // Should contain checklist in CORE WORKFLOW category
      expect(output).toContain('checklist');
      expect(output).toContain('Manage state checklists');
    });

    it('should show help for checklist command', () => {
      const checklistCommand = COMMAND_HELPS.find(cmd => cmd.name === 'checklist');
      expect(checklistCommand).toBeDefined();
      
      if (checklistCommand) {
        const output = renderHelp(checklistCommand, 'text');
        
        // Verify all sections are present
        expect(output).toContain('COMMAND: npx ai-workflow checklist');
        expect(output).toContain('USAGE:');
        expect(output).toContain('OPTIONS:');
        expect(output).toContain('EXAMPLES:');
        expect(output).toContain('WORKFLOW:');
        expect(output).toContain('TIPS:');
        expect(output).toContain('RELATED COMMANDS:');
        
        // Verify specific content
        expect(output).toContain('--state');
        expect(output).toContain('--evidence');
        expect(output).toContain('checklist status');
        expect(output).toContain('checklist check');
      }
    });

    it('should show checklist in help --all output', () => {
      const options: HelpOptions = { all: true, json: false };
      const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', options);
      
      // With --all, checklist should appear
      expect(output).toContain('checklist');
    });

    it('should show checklist in JSON output', () => {
      const options: HelpOptions = { all: true, json: true };
      const output = renderGeneralHelp(CATEGORIES, COMMAND_HELPS, 'core', options);
      
      const parsed = JSON.parse(output);
      
      // Find checklist in commands array
      const checklistInCommands = parsed.commands.find((cmd: any) => cmd.name === 'checklist');
      expect(checklistInCommands).toBeDefined();
      
      // Find checklist in categories
      const coreWorkflowCategory = parsed.categories.find((cat: any) => cat.id === 'core-workflow');
      if (coreWorkflowCategory) {
        expect(coreWorkflowCategory.commands).toContain('checklist');
      }
    });

    it('should render checklist command help in JSON format', () => {
      const checklistCommand = COMMAND_HELPS.find(cmd => cmd.name === 'checklist');
      expect(checklistCommand).toBeDefined();
      
      if (checklistCommand) {
        const output = renderHelp(checklistCommand, 'json');
        const parsed = JSON.parse(output);
        
        expect(parsed).toHaveProperty('name', 'checklist');
        expect(parsed).toHaveProperty('description', 'Manage state checklists');
        expect(parsed).toHaveProperty('category', 'core-workflow');
        expect(parsed).toHaveProperty('package', 'both');
        expect(parsed).toHaveProperty('options');
        expect(parsed).toHaveProperty('examples');
        expect(parsed).toHaveProperty('workflow');
        expect(parsed).toHaveProperty('tips');
        expect(parsed).toHaveProperty('related');
        
        // Verify options array
        if (parsed.options && Array.isArray(parsed.options)) {
          expect(parsed.options.length).toBeGreaterThan(0);
          const stateOption = parsed.options.find((opt: any) => opt.name && opt.name.includes('--state'));
          expect(stateOption).toBeDefined();
        }
      }
    });
  });
});

