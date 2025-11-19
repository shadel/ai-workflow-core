/**
 * Pattern CLI Commands - NEW in v3.1.0
 * Replaces 'rule' commands to avoid confusion with Cursor behavior rules
 * @requirement v3.1.0 - Pattern management system
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { RuleManager } from '../../utils/rule-manager.js';

const patternManager = new RuleManager();

/**
 * Register pattern commands
 * @requirement v3.1.0 - CLI pattern management
 */
export function registerPatternCommands(program: Command): void {
  const pattern = new Command('pattern')
    .description(`Manage AI-Workflow Learned Patterns

✅ NEW in v3.1.0: Renamed from 'rule' to avoid confusion with Cursor rules

• Storage: .ai-context/patterns.json (or rules.json during transition)
• Purpose: Project-specific learned patterns, conventions, best practices
• Old 'rule' commands still work but are deprecated (removed in v3.2.0)

Migration: npx ai-workflow migrate patterns
Guide: docs/migrations/v3.1.0-patterns.md`);

  // pattern list
  pattern
    .command('list')
    .description('List all patterns')
    .option('--json', 'Output in JSON format')
    .action(async (options: { json?: boolean }) => {
      try {
        const patterns = await patternManager.getRules();

        if (patterns.length === 0) {
          console.log(chalk.yellow('⚠️  No patterns found'));
          console.log('');
          console.log('  Add patterns with: npx ai-workflow pattern add');
          console.log('');
          process.exit(0);
        }

        if (options.json) {
          console.log(JSON.stringify(patterns, null, 2));
          return;
        }

        console.log(chalk.bold.blue(`\n📚 Learned Patterns (${patterns.length})\n`));

        for (const p of patterns) {
          console.log(chalk.bold(`${p.id}: ${p.title}`));
          if (p.source) {
            console.log(chalk.gray(`  Source: ${p.source}`));
          }
          if (p.score) {
            console.log(chalk.yellow(`  Score: ${p.score}/5`));
          }
          console.log('');
        }
        
        process.exit(0);

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern add
  pattern
    .command('add <title>')
    .description('Add a new pattern')
    .requiredOption('-c, --content <text>', 'Pattern content')
    .option('-s, --source <source>', 'Source project or context')
    .option('--score <score>', 'Pattern score (1-5)', '5')
    .option('--states <list>', 'Comma-separated applicable states (e.g. IMPLEMENTING,TESTING)')
    .option('--required-states <list>', 'Comma-separated required states')
    .option('--validation-type <type>', 'Validation type: file_exists|command_run|code_check|custom')
    .option('--validation-rule <rule>', 'Validation rule (path/command/check identifier)')
    .option('--validation-message <msg>', 'Validation failure message')
    .option('--validation-severity <sev>', 'Severity: error|warning|info', 'warning')
    .action(async (title: string, options: {
      content: string;
      source?: string;
      score: string;
      states?: string;
      requiredStates?: string;
      validationType?: 'file_exists' | 'command_run' | 'code_check' | 'custom';
      validationRule?: string;
      validationMessage?: string;
      validationSeverity?: 'error' | 'warning' | 'info';
    }) => {
      try {
        // Parse states
        const toList = (v?: string) =>
          v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined;

        const applicableStates = toList(options.states);
        const requiredStates = toList(options.requiredStates);

        // Build validation if provided
        let validation: any = undefined;
        if (options.validationType && options.validationRule) {
          validation = {
            type: options.validationType,
            rule: options.validationRule,
            message: options.validationMessage || 'Pattern validation failed',
            severity: options.validationSeverity || 'warning'
          };
        }

        const newPattern = await patternManager.addRule({
          title,
          content: options.content,
          source: options.source,
          score: parseInt(options.score),
          ...(applicableStates ? { applicableStates } : {}),
          ...(requiredStates ? { requiredStates } : {}),
          ...(validation ? { validation } : {})
        } as any);

        console.log(chalk.green('✅ Pattern added!'));
        console.log('');
        console.log(`  ID: ${newPattern.id}`);
        console.log(`  Title: ${newPattern.title}`);
        if (applicableStates) {
          console.log(chalk.gray(`  States: ${applicableStates.join(', ')}`));
        }
        if (requiredStates) {
          console.log(chalk.gray(`  Required: ${requiredStates.join(', ')}`));
        }
        if (validation) {
          console.log(chalk.gray(`  Validation: ${validation.type} | ${validation.severity}`));
          console.log(chalk.gray(`    Rule: ${validation.rule}`));
        }
        console.log('');
        process.exit(0);

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern import
  pattern
    .command('import <file>')
    .description('Import patterns from markdown file')
    .requiredOption('-s, --source <source>', 'Source project name')
    .action(async (file: string, options: { source: string }) => {
      try {
        const count = await patternManager.importFromMarkdown(file, options.source);

        console.log(chalk.green('✅ Patterns imported!'));
        console.log('');
        console.log(`  File: ${file}`);
        console.log(`  Imported: ${count} patterns`);
        console.log(`  Source: ${options.source}`);
        console.log('');
        process.exit(0);

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern export
  pattern
    .command('export <output>')
    .description('Export all patterns to markdown')
    .action(async (output: string) => {
      try {
        await patternManager.exportToMarkdown(output);
        const count = await patternManager.count();

        console.log(chalk.green('✅ Patterns exported!'));
        console.log('');
        console.log(`  Patterns: ${count}`);
        console.log(`  Output: ${output}`);
        console.log('');

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern search
  pattern
    .command('search <keyword>')
    .description('Search patterns by keyword')
    .action(async (keyword: string) => {
      try {
        const patterns = await patternManager.search(keyword);

        if (patterns.length === 0) {
          console.log(chalk.yellow(`⚠️  No patterns found for: "${keyword}"`));
          return;
        }

        console.log(chalk.bold.blue(`\n🔍 Search Results (${patterns.length})\n`));

        for (const p of patterns) {
          console.log(chalk.bold(`${p.id}: ${p.title}`));
          console.log(chalk.gray(`  ${p.content.substring(0, 100)}...`));
          console.log('');
        }

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern delete
  pattern
    .command('delete <id>')
    .description('Delete a pattern')
    .action(async (id: string) => {
      try {
        const deleted = await patternManager.deleteRule(id);

        if (!deleted) {
          console.log(chalk.yellow(`⚠️  Pattern not found: ${id}`));
          return;
        }

        console.log(chalk.green('✅ Pattern deleted!'));
        console.log('');
        console.log(`  ID: ${id}`);
        console.log('');

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern check - NEW for v2.0
  pattern
    .command('check')
    .description('Check missing patterns for current project')
    .action(async () => {
      try {
        const result = await patternManager.checkMissingRules();
        
        if (result.missing.length === 0) {
          console.log(chalk.green('✅ All recommended patterns are present!'));
          console.log('');
          return;
        }

        console.log(chalk.yellow(`⚠️  Missing ${result.missing.length} recommended patterns\n`));
        
        for (const patternId of result.missing) {
          console.log(chalk.gray(`  - ${patternId}`));
        }
        
        console.log('');
        console.log(chalk.dim('Tip: Use "ai-workflow pattern template <pattern-id>" to get started'));
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern template - NEW for v2.0
  pattern
    .command('template <id>')
    .description('Get template for a specific pattern')
    .action(async (id: string) => {
      try {
        const template = await patternManager.getRuleTemplate(id);
        
        if (!template) {
          console.log(chalk.yellow(`⚠️  No template found for pattern: ${id}`));
          return;
        }

        console.log(chalk.bold.blue(`\n📝 Pattern Template: ${id}\n`));
        console.log(template);
        console.log('');
        console.log(chalk.dim('Copy this template to .ai-context/patterns/'));
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // pattern info - NEW for v2.0
  pattern
    .command('info <id>')
    .description('Show detailed information about a pattern')
    .action(async (id: string) => {
      try {
        const pattern = await patternManager.getRuleInfo(id);
        
        if (!pattern) {
          console.log(chalk.yellow(`⚠️  Pattern not found: ${id}`));
          return;
        }

        console.log(chalk.bold.blue(`\n📖 Pattern Information\n`));
        console.log(chalk.bold('ID:'), chalk.cyan(pattern.id));
        console.log(chalk.bold('Title:'), pattern.title);
        if ((pattern as any).applicableStates) {
          console.log(chalk.bold('Applicable States:'), (pattern as any).applicableStates.join(', '));
        }
        if ((pattern as any).requiredStates) {
          console.log(chalk.bold('Required States:'), (pattern as any).requiredStates.join(', '));
        }
        if ((pattern as any).validation) {
          const v = (pattern as any).validation;
          console.log(chalk.bold('Validation:'), `${v.type} | ${v.severity}`);
          console.log(chalk.gray(`  Rule: ${v.rule}`));
          if (v.message) console.log(chalk.gray(`  Message: ${v.message}`));
        }
        
        if (pattern.description) {
          console.log(chalk.bold('\nDescription:'));
          console.log(pattern.description);
        }
        
        if (pattern.rationale) {
          console.log(chalk.bold('\nRationale:'));
          console.log(pattern.rationale);
        }
        
        if (pattern.source) {
          console.log(chalk.bold('\nSource:'), chalk.gray(pattern.source));
        }
        
        if (pattern.score) {
          console.log(chalk.bold('\nScore:'), chalk.yellow(`${pattern.score}/5`));
        }
        
        if (pattern.examples && pattern.examples.length > 0) {
          console.log(chalk.bold('\nExamples:'));
          pattern.examples.forEach((ex, i) => {
            console.log(chalk.gray(`  ${i + 1}. ${ex}`));
          });
        }
        
        console.log('');
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  program.addCommand(pattern);
}

