/**
 * CLI Tests: Migrate Command
 * Tests migration command functionality
 * @requirement REQ-MDC-OPTIMIZATION-001
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  getUniqueAIContextDir, 
  cleanupWithRetry,
  getTestTimeout
} from '../test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import migrate function from implementation (not duplicated!)
import { updateMdcFilesFromTemplates } from '../../src/cli/commands/migrate.js';

describe('CLI: migrate command', () => {
  let testDir: string;
  let originalCwd: string;
  const testDirs: string[] = [];
  
  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir);
    await fs.ensureDir(testDir);
    process.chdir(testDir);
    
    // Create test structure (matching actual project structure)
    await fs.ensureDir(path.join(testDir, 'packages/workflow-core/templates/cursor-rules'));
    await fs.ensureDir(path.join(testDir, '.cursor/rules'));
    
    // Create test template
    await fs.writeFile(
      path.join(testDir, 'packages/workflow-core/templates/cursor-rules/000-workflow-core.mdc'),
      '---\ndescription: "Test template"\n---\n# Test\n'
    );
    
    // Create additional templates to match real structure
    await fs.writeFile(
      path.join(testDir, 'packages/workflow-core/templates/cursor-rules/001-state-behaviors.mdc'),
      '---\ndescription: "State behaviors"\n---\n# State Behaviors\n'
    );
    await fs.writeFile(
      path.join(testDir, 'packages/workflow-core/templates/cursor-rules/002-quality-gates.mdc'),
      '---\ndescription: "Quality gates"\n---\n# Quality Gates\n'
    );
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    await new Promise(resolve => setTimeout(resolve, 100));
    await cleanupWithRetry(testDir);
  });
  
  describe('migrate --update-mdc-files', () => {
    it('should copy templates to .cursor/rules/', async () => {
      // Given: Templates exist, .cursor/rules/ has old files
      await fs.writeFile(
        path.join(testDir, '.cursor/rules/old-file.mdc'),
        'old content'
      );
      
      // When: Run migrate function directly
      await updateMdcFilesFromTemplates(testDir);
      
      // Then: Files updated from templates
      const updatedFile = await fs.readFile(
        path.join(testDir, '.cursor/rules/000-workflow-core.mdc'),
        'utf-8'
      );
      expect(updatedFile).toContain('Test template');
      
      // Verify: New files match templates
      expect(updatedFile).toContain('# Test');
    });
    
    it('should create backup before update', async () => {
      // Given: Existing .mdc files
      await fs.writeFile(
        path.join(testDir, '.cursor/rules/existing.mdc'),
        'existing content'
      );
      
      // When: Run migrate function directly
      await updateMdcFilesFromTemplates(testDir);
      
      // Then: Backup directory created with timestamp
      const backupDirs = await fs.readdir(path.join(testDir, '.cursor/rules'));
      const backupDir = backupDirs.find(d => {
        const dirName = typeof d === 'string' ? d : d.toString();
        return dirName.startsWith('.backup-');
      });
      expect(backupDir).toBeTruthy();
      
      // Verify: Backup contains old files
      const backupDirName = typeof backupDir === 'string' ? backupDir : backupDir!.toString();
      const backedUpFile = await fs.readFile(
        path.join(testDir, '.cursor/rules', backupDirName, 'existing.mdc'),
        'utf-8'
      );
      expect(backedUpFile).toBe('existing content');
    });
    
    it('should preserve non-template files', async () => {
      // Given: .cursor/rules/ has custom .mdc file
      await fs.writeFile(
        path.join(testDir, '.cursor/rules/custom.mdc'),
        'custom content'
      );
      
      // When: Run migrate function directly
      await updateMdcFilesFromTemplates(testDir);
      
      // Then: Custom file preserved, only template files updated
      const customFile = await fs.readFile(
        path.join(testDir, '.cursor/rules/custom.mdc'),
        'utf-8'
      );
      expect(customFile).toBe('custom content');
    });
  });
});

