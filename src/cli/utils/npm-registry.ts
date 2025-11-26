/**
 * NPM Registry Utility
 * Fetches package information from npm registry
 * @requirement FIX-UPGRADE-COMMAND - Add npm registry check
 */

export interface RegistryInfo {
  latestVersion: string | null;
  betaVersion: string | null;
  publishDate: string | null;
}

interface NpmRegistryResponse {
  'dist-tags'?: {
    latest?: string;
    beta?: string;
  };
  time?: Record<string, string>;
}

/**
 * Fetch latest version information from npm registry
 * 
 * @param packageName - Package name (e.g., '@shadel/ai-workflow-core')
 * @returns RegistryInfo with latest version, beta version, and publish date
 * @example
 * ```typescript
 * const info = await fetchLatestVersion('@shadel/ai-workflow-core');
 * console.log(info.latestVersion); // '3.1.2'
 * ```
 */
export async function fetchLatestVersion(packageName: string): Promise<RegistryInfo> {
  try {
    const registryUrl = `https://registry.npmjs.org/${packageName}`;
    const response = await fetch(registryUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Handle 404 (package not found) or other HTTP errors
      if (response.status === 404) {
        return {
          latestVersion: null,
          betaVersion: null,
          publishDate: null
        };
      }
      
      // For other errors, return null (will be handled gracefully)
      return {
        latestVersion: null,
        betaVersion: null,
        publishDate: null
      };
    }
    
    const data = await response.json() as NpmRegistryResponse;
    
    // Extract version information from dist-tags
    const latestVersion = data['dist-tags']?.latest || null;
    const betaVersion = data['dist-tags']?.beta || null;
    
    // Get publish date of latest version
    let publishDate = null;
    if (latestVersion && data.time && data.time[latestVersion]) {
      publishDate = data.time[latestVersion];
    }
    
    return {
      latestVersion,
      betaVersion,
      publishDate
    };
  } catch (error: any) {
    // Network errors, timeouts, etc.
    // Return null values to allow graceful fallback
    return {
      latestVersion: null,
      betaVersion: null,
      publishDate: null
    };
  }
}

