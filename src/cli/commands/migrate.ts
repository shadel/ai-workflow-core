/**
 * Migrate CLI Command - v3.1.0+
 * Migration tools for version upgrades
 * @requirement v3.1.0 - Migration command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { RulesToPatternsMigration } from '../../migrations/rules-to-patterns.js';

/**
 * Register migrate command
 * @requirement v3.1.0 - CLI migration tools
 */
export function registerMigrateCommand(program: Command): void {
  const migrate = new Command('migrate')
    .description('Migration tools for version upgrades');

  // migrate patterns (v3.1.0)
  migrate
    .command('patterns')
    .description('Migrate rules.json to patterns.json (v3.1.0)')
    .option('--dry-run', 'Preview migration without applying changes')
    .option('--force', 'Force migration even if patterns.json exists')
    .option('--no-backup', 'Skip backup creation (not recommended)')
    .option('--rollback', 'Rollback previous migration')
    .option('--status', 'Check migration status')
    .action(async (options) => {
      const migration = new RulesToPatternsMigration();
      
      // Check status
      if (options.status) {
        const status = await migration.checkStatus();
        
        console.log(chalk.bold.blue('\n📊 Migration Status\n'));
        console.log(chalk.gray('Files:'));
        console.log(`  rules.json: ${status.hasRules ? chalk.green('✓') : chalk.gray('✗')}`);
        console.log(`  patterns.json: ${status.hasPatterns ? chalk.green('✓') : chalk.gray('✗')}`);
        console.log(`  backup: ${status.hasBackup ? chalk.green('✓') : chalk.gray('✗')}`);
        console.log(`  migrated: ${status.hasMigrated ? chalk.green('✓ Yes') : chalk.gray('✗ No')}`);
        console.log('');
        
        if (status.hasMigrated) {
          console.log(chalk.green('✅ Migration already completed'));
          console.log(chalk.gray('   Run with --rollback to undo'));
        } else if (status.hasPatterns && !status.hasRules) {
          console.log(chalk.green('✅ Already using patterns.json'));
        } else if (status.hasRules && !status.hasPatterns) {
          console.log(chalk.yellow('⚠️  Migration needed'));
          console.log(chalk.gray('   Run: npx ai-workflow migrate patterns'));
        }
        console.log('');
        return;
      }
      
      // Rollback
      if (options.rollback) {
        console.log(chalk.bold.yellow('\n🔄 Rolling back migration...\n'));
        
        const result = await migration.rollback();
        
        if (!result.success) {
          console.error(chalk.red('❌ Rollback failed:'));
          result.errors?.forEach(err => console.error(chalk.red(`  ${err}`)));
          process.exit(1);
        }
        
        console.log(chalk.green('✅ Rollback successful!'));
        console.log(chalk.gray('  Restored: rules.json'));
        console.log(chalk.gray('  Removed: patterns.json'));
        console.log('');
        return;
      }
      
      // Migrate
      console.log(chalk.bold.blue('\n🔄 Migrating rules → patterns\n'));
      
      const result = await migration.migrate({
        dryRun: options.dryRun,
        force: options.force,
        backup: options.backup
      });
      
      if (!result.success) {
        console.error(chalk.red('❌ Migration failed:'));
        result.errors?.forEach(err => console.error(chalk.red(`  ${err}`)));
        console.log('');
        console.log(chalk.yellow('💡 Tips:'));
        console.log(chalk.gray('  • Check if rules.json exists'));
        console.log(chalk.gray('  • Use --force if patterns.json already exists'));
        console.log(chalk.gray('  • Use --status to check current state'));
        console.log('');
        process.exit(1);
      }
      
      if (options.dryRun) {
        console.log(chalk.yellow('📋 DRY RUN - No changes made'));
        console.log(chalk.gray(`Would migrate: ${result.migratedCount} patterns`));
        console.log('');
        console.log(chalk.cyan('Run without --dry-run to apply changes'));
        console.log('');
        return;
      }
      
      console.log(chalk.green('✅ Migration successful!'));
      console.log('');
      console.log(chalk.bold('Summary:'));
      console.log(chalk.gray(`  Migrated: ${result.migratedCount} patterns`));
      console.log(chalk.gray(`  Created: .ai-context/patterns.json`));
      console.log(chalk.gray(`  Renamed: rules.json → rules.json.old`));
      if (result.backupPath) {
        console.log(chalk.gray(`  Backup: ${result.backupPath}`));
      }
      console.log('');
      console.log(chalk.cyan('📝 Next steps:'));
      console.log(chalk.gray('  1. Verify: npx ai-workflow pattern list'));
      console.log(chalk.gray('  2. Update scripts: replace "rule" with "pattern"'));
      console.log(chalk.gray('  3. Rollback if needed: npx ai-workflow migrate patterns --rollback'));
      console.log('');
      console.log(chalk.yellow('⚠️  Note: Old "rule" commands still work but are deprecated'));
      console.log(chalk.gray('   They will be removed in v3.2.0'));
      console.log('');
    });

  program.addCommand(migrate);
}

