/**
 * Documentation Type Definitions
 * For feature/command documentation pattern validation
 */

/**
 * Document metadata schema (from YAML frontmatter)
 */
export interface DocumentMetadata {
  // Required fields
  feature?: string;           // Feature name (for features)
  command?: string;            // Command name (for commands)
  category: 'core-feature' | 'cli-command' | 'utility';
  source_files: string[];      // Implementation files
  implementation_files?: string[]; // Specific file:line ranges
  logic_sections: LogicSection[];
  updated: string;             // ISO8601 timestamp
  sync_status: 'verified' | 'outdated' | 'pending';
  
  // Optional fields
  author?: string;
  related_features?: string[];
  related_commands?: string[];
  dependencies?: string[];
}

/**
 * Logic section definition
 */
export interface LogicSection {
  name: string;                // Logic section name
  type: 'business-logic' | 'algorithm' | 'workflow';
  source: string;              // file.ts:startLine-endLine
  flowchart: boolean;          // Has Mermaid diagram
  description?: string;
}

/**
 * Parsed document structure
 */
export interface ParsedDocument {
  filePath: string;
  metadata: DocumentMetadata;
  content: string;             // Raw markdown content
  codeBlocks: CodeBlock[];
  flowcharts: FlowchartBlock[];
  hasBusinessRules: boolean;
  hasExamples: boolean;
}

/**
 * Code block from markdown
 */
export interface CodeBlock {
  language: string;
  code: string;
  startLine: number;
  endLine: number;
}

/**
 * Flowchart block (Mermaid)
 */
export interface FlowchartBlock {
  type: 'flowchart' | 'stateDiagram' | 'sequenceDiagram';
  code: string;
  startLine: number;
  endLine: number;
}

/**
 * Validation result for a document
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  document: ParsedDocument;
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;               // e.g., DOC-001
  message: string;
  severity: 'error';
  line?: number;
  field?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  severity: 'warning';
  line?: number;
  suggestion?: string;
  field?: string;
}

/**
 * Source sync status
 */
export interface SyncStatus {
  synchronized: boolean;
  sourceFile: string;
  sourceExists: boolean;
  lineRangeValid: boolean;
  contentMatches: boolean;
  lastModified?: Date;
  docUpdated?: Date;
  message: string;
}

/**
 * Source line range reference
 */
export interface SourceReference {
  file: string;
  startLine: number;
  endLine: number;
}

/**
 * Parse source reference from string
 * Format: "path/to/file.ts:45-80"
 */
export function parseSourceReference(ref: string): SourceReference | null {
  const match = ref.match(/^(.+):(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }
  
  return {
    file: match[1],
    startLine: parseInt(match[2], 10),
    endLine: parseInt(match[3], 10)
  };
}

/**
 * Validation report for all documents
 */
export interface ValidationReport {
  totalDocs: number;
  validDocs: number;
  invalidDocs: number;
  results: ValidationResult[];
  summary: {
    missingDocs: string[];      // Features/commands without docs
    orphanedDocs: string[];     // Docs without corresponding code
    outdatedDocs: string[];     // Docs with outdated sync_status
    invalidMetadata: string[];  // Docs with invalid metadata
  };
}

/**
 * Feature/Command discovery result
 */
export interface DiscoveredFeature {
  type: 'feature' | 'command';
  name: string;
  sourceFile: string;
  hasDocumentation: boolean;
  docPath?: string;
}

