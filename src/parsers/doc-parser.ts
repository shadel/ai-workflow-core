/**
 * Document Parser
 * Parses markdown documentation files with YAML frontmatter
 */

import fs from 'fs-extra';
import matter from 'gray-matter';
import {
  ParsedDocument,
  DocumentMetadata,
  CodeBlock,
  FlowchartBlock
} from '../types/documentation.js';

export class DocumentParser {
  /**
   * Parse a documentation file
   */
  async parse(filePath: string): Promise<ParsedDocument> {
    // Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse frontmatter
    const { data, content: markdownContent } = matter(content);
    
    // Extract metadata
    const metadata = this.extractMetadata(data, filePath);
    
    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks(markdownContent);
    
    // Extract flowcharts
    const flowcharts = this.extractFlowcharts(markdownContent);
    
    // Check for business rules and examples
    const hasBusinessRules = markdownContent.includes('Business Rules');
    const hasExamples = markdownContent.includes('## Examples') || 
                        markdownContent.includes('## Usage Examples');
    
    return {
      filePath,
      metadata,
      content: markdownContent,
      codeBlocks,
      flowcharts,
      hasBusinessRules,
      hasExamples
    };
  }
  
  /**
   * Extract and validate metadata from frontmatter
   */
  private extractMetadata(data: any, filePath: string): DocumentMetadata {
    // Determine if this is feature or command doc
    const isCommand = filePath.includes('/commands/');
    
    return {
      feature: data.feature,
      command: data.command,
      category: data.category || (isCommand ? 'cli-command' : 'core-feature'),
      source_files: data.source_files || [],
      implementation_files: data.implementation_files || [],
      logic_sections: data.logic_sections || [],
      updated: data.updated || new Date().toISOString(),
      sync_status: data.sync_status || 'pending',
      author: data.author,
      related_features: data.related_features || [],
      related_commands: data.related_commands || [],
      dependencies: data.dependencies || []
    };
  }
  
  /**
   * Extract code blocks from markdown
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = content.split('\n');
    let inCodeBlock = false;
    let currentBlock: Partial<CodeBlock> = {};
    let currentCode: string[] = [];
    
    lines.forEach((line, index) => {
      // Start of code block
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting a new code block
          const language = line.slice(3).trim();
          currentBlock = {
            language: language || 'text',
            startLine: index + 1
          };
          currentCode = [];
          inCodeBlock = true;
        } else {
          // Ending code block
          currentBlock.endLine = index + 1;
          currentBlock.code = currentCode.join('\n');
          blocks.push(currentBlock as CodeBlock);
          inCodeBlock = false;
        }
      } else if (inCodeBlock) {
        currentCode.push(line);
      }
    });
    
    return blocks;
  }
  
  /**
   * Extract Mermaid flowcharts from markdown
   */
  private extractFlowcharts(content: string): FlowchartBlock[] {
    const flowcharts: FlowchartBlock[] = [];
    const codeBlocks = this.extractCodeBlocks(content);
    
    // Filter for Mermaid blocks
    codeBlocks.forEach(block => {
      if (block.language === 'mermaid') {
        // Detect diagram type
        let type: FlowchartBlock['type'] = 'flowchart';
        if (block.code.includes('stateDiagram')) {
          type = 'stateDiagram';
        } else if (block.code.includes('sequenceDiagram')) {
          type = 'sequenceDiagram';
        }
        
        flowcharts.push({
          type,
          code: block.code,
          startLine: block.startLine,
          endLine: block.endLine
        });
      }
    });
    
    return flowcharts;
  }
  
  /**
   * Check if file exists and is a valid markdown file
   */
  async isValidDocFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile() && filePath.endsWith('.md');
    } catch {
      return false;
    }
  }
  
  /**
   * Parse multiple documentation files
   */
  async parseMultiple(filePaths: string[]): Promise<ParsedDocument[]> {
    const results: ParsedDocument[] = [];
    
    for (const filePath of filePaths) {
      try {
        const parsed = await this.parse(filePath);
        results.push(parsed);
      } catch (error) {
        console.warn(`Failed to parse ${filePath}:`, error);
      }
    }
    
    return results;
  }
}

