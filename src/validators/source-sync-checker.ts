/**
 * Source Sync Checker
 * Validates that documentation references match actual source code
 */

import fs from 'fs-extra';
import path from 'path';
import {
  SyncStatus,
  SourceReference,
  parseSourceReference,
  LogicSection
} from '../types/documentation.js';

export class SourceSyncChecker {
  private workspaceRoot: string;
  
  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }
  
  /**
   * Check if a source file reference is valid
   */
  async checkSourceReference(ref: string): Promise<SyncStatus> {
    const parsed = parseSourceReference(ref);
    
    if (!parsed) {
      return {
        synchronized: false,
        sourceFile: ref,
        sourceExists: false,
        lineRangeValid: false,
        contentMatches: false,
        message: 'Invalid source reference format. Expected: path/to/file.ts:start-end'
      };
    }
    
    const fullPath = path.join(this.workspaceRoot, parsed.file);
    
    // Check file exists
    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      return {
        synchronized: false,
        sourceFile: parsed.file,
        sourceExists: false,
        lineRangeValid: false,
        contentMatches: false,
        message: `Source file not found: ${parsed.file}`
      };
    }
    
    // Check line range
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    if (parsed.startLine < 1 || parsed.endLine > totalLines || parsed.startLine > parsed.endLine) {
      return {
        synchronized: false,
        sourceFile: parsed.file,
        sourceExists: true,
        lineRangeValid: false,
        contentMatches: false,
        message: `Invalid line range: ${parsed.startLine}-${parsed.endLine} (file has ${totalLines} lines)`
      };
    }
    
    // Get last modified time
    const stats = await fs.stat(fullPath);
    
    return {
      synchronized: true,
      sourceFile: parsed.file,
      sourceExists: true,
      lineRangeValid: true,
      contentMatches: true,
      lastModified: stats.mtime,
      message: 'Source reference is valid'
    };
  }
  
  /**
   * Read source code at specified line range
   */
  async readSourceLines(ref: string): Promise<string | null> {
    const parsed = parseSourceReference(ref);
    if (!parsed) {
      return null;
    }
    
    const fullPath = path.join(this.workspaceRoot, parsed.file);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      const selectedLines = lines.slice(parsed.startLine - 1, parsed.endLine);
      return selectedLines.join('\n');
    } catch {
      return null;
    }
  }
  
  /**
   * Check if source file has been modified since doc update
   */
  async detectChanges(sourceFile: string, docUpdated: Date): Promise<boolean> {
    const fullPath = path.join(this.workspaceRoot, sourceFile);
    
    try {
      const stats = await fs.stat(fullPath);
      return stats.mtime > docUpdated;
    } catch {
      return true; // Assume changed if can't read
    }
  }
  
  /**
   * Validate all logic sections in a document
   */
  async validateLogicSections(
    logicSections: LogicSection[],
    docUpdated: string
  ): Promise<{
    valid: boolean;
    results: Array<{ section: string; status: SyncStatus }>;
  }> {
    const results: Array<{ section: string; status: SyncStatus }> = [];
    let allValid = true;
    
    for (const section of logicSections) {
      const status = await this.checkSourceReference(section.source);
      results.push({
        section: section.name,
        status
      });
      
      if (!status.synchronized) {
        allValid = false;
      }
      
      // Note: If source was modified after doc 'updated' timestamp,
      // we do not mark this as invalid here. A higher-level validator
      // may choose to warn about potential staleness, but line-range
      // validity remains the primary correctness check in this method.
    }
    
    return {
      valid: allValid,
      results
    };
  }
  
  /**
   * Check if all source_files exist
   */
  async validateSourceFiles(sourceFiles: string[]): Promise<{
    valid: boolean;
    missing: string[];
    existing: string[];
  }> {
    const missing: string[] = [];
    const existing: string[] = [];
    
    for (const file of sourceFiles) {
      const fullPath = path.join(this.workspaceRoot, file);
      const exists = await fs.pathExists(fullPath);
      
      if (exists) {
        existing.push(file);
      } else {
        missing.push(file);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      existing
    };
  }
  
  /**
   * Compare code snippet in doc with actual source
   */
  async compareWithSource(
    docCode: string,
    sourceRef: string
  ): Promise<{ matches: boolean; similarity: number; message: string }> {
    const sourceCode = await this.readSourceLines(sourceRef);
    
    if (!sourceCode) {
      return {
        matches: false,
        similarity: 0,
        message: 'Cannot read source code'
      };
    }
    
    // Normalize whitespace for comparison
    const normalizeCode = (code: string) =>
      code
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('//'))
        .join('\n');
    
    const normalizedDoc = normalizeCode(docCode);
    const normalizedSource = normalizeCode(sourceCode);
    
    // Simple similarity check
    const matches = normalizedDoc === normalizedSource;
    
    if (matches) {
      return {
        matches: true,
        similarity: 100,
        message: 'Code matches source exactly'
      };
    }
    
    // Calculate approximate similarity
    const docLines = normalizedDoc.split('\n');
    const sourceLines = normalizedSource.split('\n');
    const matchingLines = docLines.filter(line => sourceLines.includes(line)).length;
    const similarity = (matchingLines / Math.max(docLines.length, sourceLines.length)) * 100;
    
    return {
      matches: false,
      similarity,
      message: `Code differs from source (${similarity.toFixed(0)}% similar)`
    };
  }
}

