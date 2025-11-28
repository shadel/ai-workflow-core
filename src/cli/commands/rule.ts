/**
 * Rule CLI Commands for Core Build
 * Manage learned rules and best practices
 * @requirement REQ-V2-024 - Rule commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { RuleManager } from '../../utils/rule-manager.js';

const ruleManager = new RuleManager();

/**
 * Show deprecation warning for rule commands
 * v3.1.0: rule → pattern migration
 */
function showDeprecationWarning(command: string): void {
  console.warn(chalk.yellow('\n⚠️  DEPRECATION WARNING:'));
  console.warn(chalk.yellow(`The "rule ${command}" command is deprecated and will be removed in v3.2.0`));
  console.warn(chalk.cyan(`Use instead: npx ai-workflow pattern ${command}`));
  console.warn(chalk.gray('Migrate your rules: npx ai-workflow migrate patterns'));
  console.warn(chalk.gray('See: docs/migrations/v3.1.0-patterns.md\n'));
}

/**
 * Register rule commands
 * @requirement REQ-V2-024 - CLI rule management
 */
export function registerRuleCommands(program: Command): void {
  const rule = new Command('rule')
    .description(`⚠️  DEPRECATED: Use 'pattern' instead (removed in v3.2.0)

The 'rule' command is being renamed to 'pattern' to avoid confusion with Cursor behavior rules.

MIGRATION:
  OLD: npx ai-workflow rule add
  NEW: npx ai-workflow pattern add
  
Migrate now: npx ai-workflow migrate patterns
Guide: docs/migrations/v3.1.0-patterns.md

⚠️  All 'rule' commands will be removed in v3.2.0`);

  // rule list
  rule
    .command('list')
    .description('List all rules')
    .option('--json', 'Output in JSON format')
    .action(async (options: { json?: boolean }) => {
      showDeprecationWarning('list');
      try {
        const rules = await ruleManager.getRules();

        if (rules.length === 0) {
          console.log(chalk.yellow('⚠️  No rules found'));
          console.log('');
          console.log('  Add rules with: npx ai-workflow rule add');
          console.log('');
          process.exit(0);
        }

        if (options.json) {
          console.log(JSON.stringify(rules, null, 2));
          return;
        }

        console.log(chalk.bold.blue(`\n📚 Learned Rules (${rules.length})\n`));

        for (const r of rules) {
          console.log(chalk.bold(`${r.id}: ${r.title}`));
          if (r.source) {
            console.log(chalk.gray(`  Source: ${r.source}`));
          }
          if (r.score) {
            console.log(chalk.yellow(`  Score: ${r.score}/5`));
          }
          console.log('');
        }
        
        process.exit(0);

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule add
  rule
    .command('add <title>')
    .description('Add a new rule')
    .requiredOption('-c, --content <text>', 'Rule content')
    .option('-s, --source <source>', 'Source project or context')
    .option('--score <score>', 'Rule score (1-5)', '5')
    .action(async (title: string, options: { content: string; source?: string; score: string }) => {
      showDeprecationWarning('add');
      try {
        const newRule = await ruleManager.addRule({
          title,
          content: options.content,
          source: options.source,
          score: parseInt(options.score)
        });

        console.log(chalk.green('✅ Rule added!'));
        console.log('');
        console.log(`  ID: ${newRule.id}`);
        console.log(`  Title: ${newRule.title}`);
        console.log('');
        process.exit(0);

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule import
  rule
    .command('import <file>')
    .description('Import rules from markdown file')
    .requiredOption('-s, --source <source>', 'Source project name')
    .action(async (file: string, options: { source: string }) => {
      try {
        const count = await ruleManager.importFromMarkdown(file, options.source);

        console.log(chalk.green('✅ Rules imported!'));
        console.log('');
        console.log(`  File: ${file}`);
        console.log(`  Imported: ${count} rules`);
        console.log(`  Source: ${options.source}`);
        console.log('');
        process.exit(0);

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule export
  rule
    .command('export <output>')
    .description('Export all rules to markdown')
    .action(async (output: string) => {
      try {
        await ruleManager.exportToMarkdown(output);
        const count = await ruleManager.count();

        console.log(chalk.green('✅ Rules exported!'));
        console.log('');
        console.log(`  Rules: ${count}`);
        console.log(`  Output: ${output}`);
        console.log('');

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule search
  rule
    .command('search <keyword>')
    .description('Search rules by keyword')
    .action(async (keyword: string) => {
      try {
        const rules = await ruleManager.search(keyword);

        if (rules.length === 0) {
          console.log(chalk.yellow(`⚠️  No rules found for: "${keyword}"`));
          return;
        }

        console.log(chalk.bold.blue(`\n🔍 Search Results (${rules.length})\n`));

        for (const r of rules) {
          console.log(chalk.bold(`${r.id}: ${r.title}`));
          console.log(chalk.gray(`  ${r.content.substring(0, 100)}...`));
          console.log('');
        }

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule delete
  rule
    .command('delete <id>')
    .description('Delete a rule')
    .action(async (id: string) => {
      try {
        const deleted = await ruleManager.deleteRule(id);

        if (!deleted) {
          console.log(chalk.yellow(`⚠️  Rule not found: ${id}`));
          return;
        }

        console.log(chalk.green('✅ Rule deleted!'));
        console.log('');
        console.log(`  ID: ${id}`);
        console.log('');

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule check - NEW for v2.0
  rule
    .command('check')
    .description('Check missing rules for current project')
    .action(async () => {
      try {
        const result = await ruleManager.checkMissingRules();
        
        if (result.missing.length === 0) {
          console.log(chalk.green('✅ All recommended rules are present!'));
          console.log('');
          return;
        }

        console.log(chalk.yellow(`⚠️  Missing ${result.missing.length} recommended rules\n`));
        
        for (const ruleId of result.missing) {
          console.log(chalk.gray(`  - ${ruleId}`));
        }
        
        console.log('');
        console.log(chalk.dim('Tip: Use "ai-workflow rule template <rule-id>" to get started'));
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule template - NEW for v2.0
  rule
    .command('template <id>')
    .description('Get template for a specific rule')
    .action(async (id: string) => {
      try {
        const template = await ruleManager.getRuleTemplate(id);
        
        if (!template) {
          console.log(chalk.yellow(`⚠️  No template found for rule: ${id}`));
          return;
        }

        console.log(chalk.bold.blue(`\n📝 Rule Template: ${id}\n`));
        console.log(template);
        console.log('');
        console.log(chalk.dim('Copy this template to .ai-context/rules/'));
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // rule info - NEW for v2.0
  rule
    .command('info <id>')
    .description('Show detailed information about a rule')
    .action(async (id: string) => {
      try {
        const rule = await ruleManager.getRuleInfo(id);
        
        if (!rule) {
          console.log(chalk.yellow(`⚠️  Rule not found: ${id}`));
          return;
        }

        console.log(chalk.bold.blue(`\n📖 Rule Information\n`));
        console.log(chalk.bold('ID:'), chalk.cyan(rule.id));
        console.log(chalk.bold('Title:'), rule.title);
        
        if (rule.description) {
          console.log(chalk.bold('\nDescription:'));
          console.log(rule.description);
        }
        
        if (rule.rationale) {
          console.log(chalk.bold('\nRationale:'));
          console.log(rule.rationale);
        }
        
        if (rule.source) {
          console.log(chalk.bold('\nSource:'), chalk.gray(rule.source));
        }
        
        if (rule.score) {
          console.log(chalk.bold('\nScore:'), chalk.yellow(`${rule.score}/5`));
        }
        
        if (rule.examples && rule.examples.length > 0) {
          console.log(chalk.bold('\nExamples:'));
          rule.examples.forEach((ex, i) => {
            console.log(chalk.gray(`  ${i + 1}. ${ex}`));
          });
        }
        
        console.log('');
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  program.addCommand(rule);
}

