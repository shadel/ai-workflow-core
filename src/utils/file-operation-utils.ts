/**
 * File Operation Utilities
 * 
 * Common utilities for file operations
 * 
 * @requirement TASK-3.1 - Refactor to Eliminate Duplication
 */

import fs from 'fs-extra';
import path from 'path';
import { ensureParentDirectory } from './directory-utils.js';

/**
 * Write file with automatic directory creation
 * 
 * @param filePath - File path
 * @param content - File content
 * @param encoding - File encoding (default: 'utf-8')
 * @throws Error if write fails
 */
export async function writeFileSafe(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<void> {
  await ensureParentDirectory(filePath);
  
  try {
    await fs.writeFile(filePath, content, encoding);
  } catch (error: any) {
    throw new Error(
      `Failed to write file: ${filePath}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Write JSON file with automatic directory creation
 * 
 * @param filePath - File path
 * @param data - JSON data
 * @param options - Write options
 * @throws Error if write fails
 */
export async function writeJsonSafe(
  filePath: string,
  data: any,
  options: { spaces?: number } = {}
): Promise<void> {
  await ensureParentDirectory(filePath);
  
  try {
    await fs.writeJson(filePath, data, { spaces: options.spaces || 2 });
  } catch (error: any) {
    throw new Error(
      `Failed to write JSON file: ${filePath}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Read JSON file
 * 
 * @param filePath - File path
 * @returns Parsed JSON data
 * @throws Error if read fails
 */
export async function readJsonSafe(filePath: string): Promise<any> {
  try {
    return await fs.readJson(filePath);
  } catch (error: any) {
    throw new Error(
      `Failed to read JSON file: ${filePath}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Read file
 * 
 * @param filePath - File path
 * @param encoding - File encoding (default: 'utf-8')
 * @returns File content
 * @throws Error if read fails
 */
export async function readFileSafe(
  filePath: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<string> {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error: any) {
    throw new Error(
      `Failed to read file: ${filePath}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Check if file exists
 * 
 * @param filePath - File path
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Remove file
 * 
 * @param filePath - File path
 * @throws Error if removal fails
 */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.remove(filePath);
  } catch (error: any) {
    throw new Error(
      `Failed to remove file: ${filePath}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Copy file
 * 
 * @param srcFile - Source file path
 * @param destFile - Destination file path
 * @throws Error if copy fails
 */
export async function copyFile(srcFile: string, destFile: string): Promise<void> {
  await ensureParentDirectory(destFile);
  
  try {
    await fs.copy(srcFile, destFile);
  } catch (error: any) {
    throw new Error(
      `Failed to copy file: ${srcFile} -> ${destFile}\n` +
      `Error: ${error.message}`
    );
  }
}

/**
 * Move file
 * 
 * @param srcFile - Source file path
 * @param destFile - Destination file path
 * @throws Error if move fails
 */
export async function moveFile(srcFile: string, destFile: string): Promise<void> {
  await ensureParentDirectory(destFile);
  
  try {
    await fs.move(srcFile, destFile);
  } catch (error: any) {
    throw new Error(
      `Failed to move file: ${srcFile} -> ${destFile}\n` +
      `Error: ${error.message}`
    );
  }
}


