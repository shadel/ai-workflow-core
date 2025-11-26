/**
 * TypeScript interfaces for Help Command Data-Driven Architecture
 * @requirement REQ-V2-003 - Help system data structure
 */

/**
 * Command option definition
 */
export interface Option {
  name: string;
  description: string;
  required?: boolean;
  default?: string;
}

/**
 * Command help data structure
 */
export interface CommandHelp {
  name: string;
  description: string;
  usage: string;
  options?: Option[];
  examples: string[];
  workflow?: string[];
  tips?: string[];
  related?: string[];
  category: string;
  priority: number;
  package: 'core' | 'full' | 'both';
}

/**
 * Category definition
 */
export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  commands: string[];
  package: 'core' | 'full' | 'both';
}

/**
 * Help command options
 */
export interface HelpOptions {
  all?: boolean; // Show all commands (progressive disclosure)
  json?: boolean; // Output in JSON format
  command?: string; // Specific command to show help for
}

