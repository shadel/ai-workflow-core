/**
 * Directory Utilities
 * 
 * Common utilities for directory operations
 * 
 * @requirement TASK-3.1 - Refactor to Eliminate Duplication
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Ensure directory exists, creating parent directories if needed
 * 
 * @param dirPath - Directory path
 * @throws Error if directory cannot be created
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.ensureDir(dirPath);
  } catch (error: any) {
    throw new Error(
      `Failed to create directory: ${dirPath}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Ensure parent directory exists for a file path
 * 
 * @param filePath - File path
 * @throws Error if directory cannot be created
 */
export async function ensureParentDirectory(filePath: string): Promise<void> {
  const dirPath = path.dirname(filePath);
  await ensureDirectory(dirPath);
}

/**
 * Check if directory exists
 * 
 * @param dirPath - Directory path
 * @returns True if directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get all subdirectories in a directory
 * 
 * @param dirPath - Directory path
 * @returns Array of subdirectory paths
 */
export async function getSubdirectories(dirPath: string): Promise<string[]> {
  if (!await directoryExists(dirPath)) {
    return [];
  }
  
  try {
    const entries = await fs.readdir(dirPath);
    const subdirs: string[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      if (await directoryExists(fullPath)) {
        subdirs.push(fullPath);
      }
    }
    
    return subdirs;
  } catch (error: any) {
    // Handle race condition: directory might be deleted between check and readdir
    // Also handle ENOENT errors gracefully
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Remove directory and all contents
 * 
 * @param dirPath - Directory path
 * @throws Error if removal fails
 */
export async function removeDirectory(dirPath: string): Promise<void> {
  try {
    await fs.remove(dirPath);
  } catch (error: any) {
    throw new Error(
      `Failed to remove directory: ${dirPath}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Copy directory and all contents
 * 
 * @param srcDir - Source directory
 * @param destDir - Destination directory
 * @throws Error if copy fails
 */
export async function copyDirectory(srcDir: string, destDir: string): Promise<void> {
  try {
    await ensureDirectory(path.dirname(destDir));
    await fs.copy(srcDir, destDir);
  } catch (error: any) {
    throw new Error(
      `Failed to copy directory: ${srcDir} -> ${destDir}\n` +
      `Error: ${error.message}`
    );
  }
}

