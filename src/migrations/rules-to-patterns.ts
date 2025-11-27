/**
 * Migration Tool: rules.json → patterns.json
 * v3.1.0 migration helper
 * @requirement v3.1.0 - Rules to patterns migration
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export interface MigrationOptions {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
}

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  backupPath?: string;
  errors?: string[];
}

export class RulesToPatternsMigration {
  private rulesFile = '.ai-context/rules.json';
  private patternsFile = '.ai-context/patterns.json';
  private backupFile = '.ai-context/rules.json.backup';

  /**
   * Migrate rules.json to patterns.json
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const { dryRun = false, force = false, backup = true } = options;
    
    // Check if rules.json exists
    if (!await fs.pathExists(this.rulesFile)) {
      return {
        success: false,
        migratedCount: 0,
        errors: ['No rules.json file found - nothing to migrate']
      };
    }
    
    // Check if patterns.json already exists
    if (!force && await fs.pathExists(this.patternsFile)) {
      return {
        success: false,
        migratedCount: 0,
        errors: ['patterns.json already exists - use --force to overwrite']
      };
    }
    
    try {
      // Read rules.json
      const rulesData = await fs.readJson(this.rulesFile);
      const rules = rulesData.rules || [];
      
      if (dryRun) {
        console.log(chalk.gray('\n📋 DRY RUN - Changes that would be made:'));
        console.log(chalk.gray(`  • Read ${rules.length} rules from ${this.rulesFile}`));
        console.log(chalk.gray(`  • Create ${this.patternsFile}`));
        console.log(chalk.gray(`  • Rename ${this.rulesFile} to ${this.rulesFile}.old`));
        if (backup) {
          console.log(chalk.gray(`  • Create backup: ${this.backupFile}`));
        }
        console.log('');
        
        return {
          success: true,
          migratedCount: rules.length,
        };
      }
      
      // Create backup
      let backupPath: string | undefined;
      if (backup) {
        await fs.copy(this.rulesFile, this.backupFile);
        backupPath = this.backupFile;
      }
      
      // Convert to patterns format
      const patternsData = {
        _comment: 'AI-Workflow Learned Patterns - Migrated from rules.json on ' + new Date().toISOString(),
        patterns: rules.map((r: any) => ({
          ...r,
          // Update ID prefix if it starts with RULE-
          id: r.id && r.id.startsWith('RULE-') 
            ? r.id.replace('RULE-', 'PATTERN-') 
            : r.id
        })),
        lastUpdated: new Date().toISOString(),
        migratedFrom: 'rules.json',
        migrationVersion: '3.1.0'
      };
      
      // Ensure directory exists before writing
      await fs.ensureDir(path.dirname(this.patternsFile));
      
      // Write patterns.json
      await fs.writeJson(this.patternsFile, patternsData, { spaces: 2 });
      
      // Rename rules.json to rules.json.old (don't delete, keep as fallback)
      await fs.rename(this.rulesFile, this.rulesFile + '.old');
      
      return {
        success: true,
        migratedCount: rules.length,
        backupPath
      };
      
    } catch (error) {
      return {
        success: false,
        migratedCount: 0,
        errors: [(error as Error).message]
      };
    }
  }
  
  /**
   * Rollback migration (restore from backup)
   */
  async rollback(): Promise<MigrationResult> {
    if (!await fs.pathExists(this.backupFile)) {
      return {
        success: false,
        migratedCount: 0,
        errors: ['No backup found - cannot rollback']
      };
    }
    
    try {
      // Check if rules.json.old exists
      const oldFile = this.rulesFile + '.old';
      if (await fs.pathExists(oldFile)) {
        // Restore from backup to rules.json
        await fs.copy(this.backupFile, this.rulesFile);
        
        // Remove patterns.json if it exists
        if (await fs.pathExists(this.patternsFile)) {
          await fs.remove(this.patternsFile);
        }
        
        // Remove .old file
        await fs.remove(oldFile);
        
        return {
          success: true,
          migratedCount: 0,
          backupPath: this.backupFile
        };
      } else {
        return {
          success: false,
          migratedCount: 0,
          errors: ['Migration files not found - cannot rollback']
        };
      }
      
    } catch (error) {
      return {
        success: false,
        migratedCount: 0,
        errors: [(error as Error).message]
      };
    }
  }
  
  /**
   * Check migration status
   */
  async checkStatus(): Promise<{
    hasRules: boolean;
    hasPatterns: boolean;
    hasBackup: boolean;
    hasMigrated: boolean;
  }> {
    return {
      hasRules: await fs.pathExists(this.rulesFile),
      hasPatterns: await fs.pathExists(this.patternsFile),
      hasBackup: await fs.pathExists(this.backupFile),
      hasMigrated: await fs.pathExists(this.rulesFile + '.old')
    };
  }
}

