/**
 * Documentation Validator
 * Validates feature/command documentation completeness and accuracy
 */

import path from 'path';
import { glob } from 'glob';
import { DocumentParser } from '../parsers/doc-parser.js';
import { SourceSyncChecker } from './source-sync-checker.js';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationReport,
  ParsedDocument,
  DiscoveredFeature
} from '../types/documentation.js';

export class DocumentationValidator {
  private parser: DocumentParser;
  private syncChecker: SourceSyncChecker;
  private workspaceRoot: string;
  
  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.parser = new DocumentParser();
    this.syncChecker = new SourceSyncChecker(workspaceRoot);
  }
  
  /**
   * Validate a single documentation file
   */
  async validate(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Parse document
    let document: ParsedDocument;
    try {
      document = await this.parser.parse(filePath);
    } catch (error) {
      errors.push({
        code: 'DOC-PARSE-001',
        message: `Failed to parse document: ${(error as Error).message}`,
        severity: 'error'
      });
      
      // Cannot continue without parsed document
      return {
        valid: false,
        errors,
        warnings,
        document: {} as ParsedDocument
      };
    }
    
    // Validate metadata completeness
    this.validateMetadata(document, errors, warnings);
    
    // Validate source files
    await this.validateSourceFiles(document, errors, warnings);
    
    // Validate logic sections
    await this.validateLogicSections(document, errors, warnings);
    
    // Validate flowcharts
    this.validateFlowcharts(document, warnings);
    
    // Validate sync status
    this.validateSyncStatus(document, errors);
    
    // Check for business rules
    if (!document.hasBusinessRules) {
      warnings.push({
        code: 'DOC-006',
        message: 'Document missing business rules table',
        severity: 'warning',
        suggestion: 'Add a "Business Rules" section with a table of rules'
      });
    }
    
    // Check for examples
    if (!document.hasExamples) {
      warnings.push({
        code: 'DOC-007',
        message: 'Document missing usage examples',
        severity: 'warning',
        suggestion: 'Add an "Examples" or "Usage Examples" section'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      document
    };
  }
  
  /**
   * Validate metadata completeness
   */
  private validateMetadata(
    document: ParsedDocument,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const meta = document.metadata;
    
    // Check required fields
    if (!meta.feature && !meta.command) {
      errors.push({
        code: 'DOC-002',
        message: 'Missing required field: feature or command name',
        severity: 'error',
        field: 'feature/command'
      });
    }
    
    if (!meta.category) {
      errors.push({
        code: 'DOC-002',
        message: 'Missing required field: category',
        severity: 'error',
        field: 'category'
      });
    }
    
    if (!meta.source_files || meta.source_files.length === 0) {
      errors.push({
        code: 'DOC-002',
        message: 'Missing required field: source_files',
        severity: 'error',
        field: 'source_files'
      });
    }
    
    if (!meta.logic_sections || meta.logic_sections.length === 0) {
      errors.push({
        code: 'DOC-002',
        message: 'Missing required field: logic_sections',
        severity: 'error',
        field: 'logic_sections'
      });
    }
    
    if (!meta.updated) {
      errors.push({
        code: 'DOC-002',
        message: 'Missing required field: updated timestamp',
        severity: 'error',
        field: 'updated'
      });
    }
    
    if (!meta.sync_status) {
      errors.push({
        code: 'DOC-002',
        message: 'Missing required field: sync_status',
        severity: 'error',
        field: 'sync_status'
      });
    }
    
    // Validate field values
    if (meta.category && !['core-feature', 'cli-command', 'utility'].includes(meta.category)) {
      warnings.push({
        code: 'DOC-003',
        message: `Invalid category: ${meta.category}`,
        severity: 'warning',
        field: 'category',
        suggestion: 'Use: core-feature, cli-command, or utility'
      });
    }
    
    if (meta.sync_status && !['verified', 'outdated', 'pending'].includes(meta.sync_status)) {
      warnings.push({
        code: 'DOC-003',
        message: `Invalid sync_status: ${meta.sync_status}`,
        severity: 'warning',
        field: 'sync_status',
        suggestion: 'Use: verified, outdated, or pending'
      });
    }
  }
  
  /**
   * Validate source files exist
   */
  private async validateSourceFiles(
    document: ParsedDocument,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const result = await this.syncChecker.validateSourceFiles(
      document.metadata.source_files
    );
    
    if (!result.valid) {
      for (const missing of result.missing) {
        errors.push({
          code: 'DOC-003',
          message: `Source file not found: ${missing}`,
          severity: 'error',
          field: 'source_files'
        });
      }
    }
  }
  
  /**
   * Validate logic sections
   */
  private async validateLogicSections(
    document: ParsedDocument,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const result = await this.syncChecker.validateLogicSections(
      document.metadata.logic_sections,
      document.metadata.updated
    );
    
    if (!result.valid) {
      for (const { section, status } of result.results) {
        if (!status.synchronized) {
          errors.push({
            code: 'DOC-004',
            message: `Logic section "${section}": ${status.message}`,
            severity: 'error',
            field: 'logic_sections'
          });
        }
      }
    }
    
    // Check that each logic section with flowchart: true has a Mermaid diagram
    for (const section of document.metadata.logic_sections) {
      if (section.flowchart) {
        const hasFlowchart = document.flowcharts.length > 0;
        if (!hasFlowchart) {
          warnings.push({
            code: 'DOC-005',
            message: `Logic section "${section.name}" marked as having flowchart but none found`,
            severity: 'warning',
            suggestion: 'Add a Mermaid diagram or set flowchart: false'
          });
        }
      }
    }
  }
  
  /**
   * Validate Mermaid flowcharts
   */
  private validateFlowcharts(
    document: ParsedDocument,
    warnings: ValidationWarning[]
  ): void {
    for (const flowchart of document.flowcharts) {
      // Basic syntax check
      if (!flowchart.code.trim()) {
        warnings.push({
          code: 'DOC-006',
          message: 'Empty Mermaid flowchart block',
          severity: 'warning',
          line: flowchart.startLine
        });
      }
      
      // Check for common syntax errors
      const code = flowchart.code.trim();
      if (flowchart.type === 'flowchart' && !code.match(/^(flowchart|graph)\s+(TD|TB|BT|RL|LR)/)) {
        warnings.push({
          code: 'DOC-006',
          message: 'Flowchart missing direction (TD, LR, etc.)',
          severity: 'warning',
          line: flowchart.startLine,
          suggestion: 'Start with: flowchart TD'
        });
      }
    }
  }
  
  /**
   * Validate sync status
   */
  private validateSyncStatus(
    document: ParsedDocument,
    errors: ValidationError[]
  ): void {
    if (document.metadata.sync_status === 'outdated') {
      errors.push({
        code: 'DOC-007',
        message: 'Document sync_status is "outdated" - must update documentation',
        severity: 'error',
        field: 'sync_status'
      });
    }
    
    // If sync_status is verified, check that updated timestamp is recent
    if (document.metadata.sync_status === 'verified') {
      const updated = new Date(document.metadata.updated);
      const now = new Date();
      const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 90) {
        errors.push({
          code: 'DOC-007',
          message: `Documentation not updated in ${Math.floor(daysSinceUpdate)} days - may be stale`,
          severity: 'error',
          field: 'updated',
        });
      }
    }
  }
  
  /**
   * Discover features/commands in source code
   */
  async discoverFeatures(): Promise<DiscoveredFeature[]> {
    const features: DiscoveredFeature[] = [];
    
    // Find CLI command files
    const commandFiles = await glob('packages/*/src/cli/commands/*.ts', {
      cwd: this.workspaceRoot,
      ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.spec.ts']
    });
    
    for (const file of commandFiles) {
      const baseName = path.basename(file, '.ts');
      const docPath = path.join(this.workspaceRoot, 'docs', 'commands', `${baseName}.md`);
      const hasDoc = await this.parser.isValidDocFile(docPath);
      
      features.push({
        type: 'command',
        name: baseName,
        sourceFile: file,
        hasDocumentation: hasDoc,
        docPath: hasDoc ? docPath : undefined
      });
    }
    
    // Find feature files (simplified - looks for manager/handler patterns)
    const featureFiles = await glob('packages/*/src/core/*-manager.ts', {
      cwd: this.workspaceRoot,
      ignore: ['**/__tests__/**', '**/*.test.ts']
    });
    
    for (const file of featureFiles) {
      const baseName = path.basename(file, '.ts').replace('-manager', '');
      const docPath = path.join(this.workspaceRoot, 'docs', 'features', `${baseName}.md`);
      const hasDoc = await this.parser.isValidDocFile(docPath);
      
      features.push({
        type: 'feature',
        name: baseName,
        sourceFile: file,
        hasDocumentation: hasDoc,
        docPath: hasDoc ? docPath : undefined
      });
    }
    
    return features;
  }
  
  /**
   * Generate validation report for all documentation
   */
  async generateReport(): Promise<ValidationReport> {
    const docFiles = await glob('docs/{features,commands}/*.md', {
      cwd: this.workspaceRoot
    });
    
    const results: ValidationResult[] = [];
    let validDocs = 0;
    let invalidDocs = 0;
    
    // Validate each doc
    for (const file of docFiles) {
      const fullPath = path.join(this.workspaceRoot, file);
      const result = await this.validate(fullPath);
      results.push(result);
      
      if (result.valid) {
        validDocs++;
      } else {
        invalidDocs++;
      }
    }
    
    // Discover features/commands
    const discovered = await this.discoverFeatures();
    
    // Find missing and orphaned docs
    const missingDocs = discovered
      .filter(f => !f.hasDocumentation)
      .map(f => `${f.type}: ${f.name}`);
    
    const documentedNames = new Set(
      discovered
        .filter(f => f.hasDocumentation)
        .map(f => f.name)
    );
    
    const orphanedDocs = results
      .filter(r => {
        const name = r.document.metadata.feature || r.document.metadata.command;
        return name && !documentedNames.has(name);
      })
      .map(r => r.document.filePath);
    
    // Find outdated docs
    const outdatedDocs = results
      .filter(r => r.document.metadata.sync_status === 'outdated')
      .map(r => r.document.filePath);
    
    // Find docs with invalid metadata
    const invalidMetadata = results
      .filter(r => r.errors.some(e => e.code.startsWith('DOC-002')))
      .map(r => r.document.filePath);
    
    return {
      totalDocs: docFiles.length,
      validDocs,
      invalidDocs,
      results,
      summary: {
        missingDocs,
        orphanedDocs,
        outdatedDocs,
        invalidMetadata
      }
    };
  }
}

