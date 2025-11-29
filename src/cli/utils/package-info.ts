/**
 * Package Info Utility
 * Reads package.json information (name, version, description)
 * @requirement FIX-UPGRADE-COMMAND - Extract version reading logic
 * @pattern RULE-1763106290119 - Reuse existing code instead of duplicating
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
}

/**
 * Get package information from package.json
 * Reuses logic from cli/index.ts to avoid duplication
 * 
 * @returns PackageInfo object with name, version, and description
 * @throws Error if package.json cannot be read or parsed
 */
export function getPackageInfo(): PackageInfo {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Calculate path to package.json relative to this file
  // This file is at: src/cli/utils/package-info.ts
  // package.json is at: package.json (root)
  const packageJsonPath = join(__dirname, '../../../package.json');
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    return {
      name: packageJson.name || '',
      version: packageJson.version || '0.0.0',
      description: packageJson.description
    };
  } catch (error: any) {
    throw new Error(`Failed to read package.json: ${error.message}`);
  }
}

