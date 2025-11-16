/**
 * Version Comparison Utility
 * Compares semantic versions to determine update status
 * @requirement FIX-UPGRADE-COMMAND - Compare current vs latest version
 */

export type VersionComparison = 'outdated' | 'current' | 'ahead';

/**
 * Compare two semantic versions
 * 
 * @param current - Current version (e.g., '3.1.0')
 * @param latest - Latest version (e.g., '3.1.2')
 * @returns 'outdated' if current < latest, 'current' if equal, 'ahead' if current > latest
 * @example
 * ```typescript
 * compareVersions('3.1.0', '3.1.2'); // 'outdated'
 * compareVersions('3.1.2', '3.1.2'); // 'current'
 * compareVersions('3.2.0', '3.1.2'); // 'ahead'
 * ```
 */
export function compareVersions(current: string, latest: string): VersionComparison {
  // Try using semver if available (via commander dependency)
  try {
    // Check if semver is available in node_modules
    const semver = require('semver');
    if (semver && typeof semver.gt === 'function') {
      if (semver.gt(latest, current)) return 'outdated';
      if (semver.lt(latest, current)) return 'ahead';
      return 'current';
    }
  } catch {
    // semver not available, fall through to manual comparison
  }
  
  // Manual comparison fallback
  return manualVersionCompare(current, latest);
}

/**
 * Manual version comparison (fallback when semver is not available)
 * Handles basic semantic versioning (major.minor.patch)
 * 
 * @param current - Current version
 * @param latest - Latest version
 * @returns Comparison result
 */
function manualVersionCompare(current: string, latest: string): VersionComparison {
  // Parse versions (handle pre-release versions like 3.1.2-beta.1)
  const currentParts = current.split('-')[0].split('.').map(Number);
  const latestParts = latest.split('-')[0].split('.').map(Number);
  
  // Ensure we have at least 3 parts (major.minor.patch)
  while (currentParts.length < 3) currentParts.push(0);
  while (latestParts.length < 3) latestParts.push(0);
  
  const [cMajor, cMinor, cPatch] = currentParts;
  const [lMajor, lMinor, lPatch] = latestParts;
  
  // Compare major version
  if (lMajor > cMajor) return 'outdated';
  if (lMajor < cMajor) return 'ahead';
  
  // Compare minor version
  if (lMinor > cMinor) return 'outdated';
  if (lMinor < cMinor) return 'ahead';
  
  // Compare patch version
  if (lPatch > cPatch) return 'outdated';
  if (lPatch < cPatch) return 'ahead';
  
  // Versions are equal
  return 'current';
}

