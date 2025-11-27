/**
 * Commit Message Parser
 * @requirement FR-011: Auto-Task Creation from Commit Messages
 * 
 * Parses conventional commit messages and extracts:
 * - Type (feat, fix, docs, etc.)
 * - Scope (optional)
 * - Subject
 * - Breaking changes
 * - Requirement IDs (FR-XXX, NFR-XXX)
 * - Area (inferred from keywords)
 * - Priority (inferred from keywords)
 * - Goal (generated task goal)
 */

export interface ParsedCommitInfo {
  type: string;
  scope?: string;
  subject: string;
  breaking: boolean;
  requirements: string[];
  area?: string;
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  goal: string;
}

/**
 * Parse conventional commit message
 */
export function parseCommitMessage(message: string): ParsedCommitInfo {
  if (!message || message.trim() === '') {
    return {
      type: 'unknown',
      subject: '',
      breaking: false,
      requirements: [],
      goal: ''
    };
  }

  // Take first line only (ignore body)
  const firstLine = message.split('\n')[0].trim();
  
  // Check if conventional commit format
  const conventionalMatch = firstLine.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
  
  if (!conventionalMatch) {
    // Non-conventional commit
    return {
      type: 'unknown',
      subject: firstLine,
      breaking: false,
      requirements: extractRequirements(firstLine),
      area: inferArea(firstLine),
      priority: inferPriority(firstLine),
      goal: firstLine
    };
  }

  const [, type, scope, breakingMarker, subject] = conventionalMatch;
  const breaking = breakingMarker === '!';
  
  // Extract requirements
  const requirements = extractRequirements(subject);
  
  // Infer area (prefer scope, but normalize it)
  const area = scope ? normalizeAreaFromScope(scope) : inferArea(subject);
  
  // Infer priority
  const priority = inferPriority(subject);
  
  // Generate goal
  const goal = generateGoal(type, scope, subject);
  
  return {
    type,
    scope,
    subject,
    breaking,
    requirements,
    area,
    priority,
    goal
  };
}

/**
 * Extract requirement IDs (FR-XXX, NFR-XXX) from text
 */
function extractRequirements(text: string): string[] {
  const requirementRegex = /(FR|NFR)-(\d+)/gi;
  const matches = text.matchAll(requirementRegex);
  const requirements: string[] = [];
  const seen = new Set<string>();
  
  for (const match of matches) {
    const prefix = match[1].toUpperCase(); // Full prefix (FR or NFR)
    const number = match[2];
    const requirement = `${prefix}-${number}`;
    
    if (!seen.has(requirement)) {
      requirements.push(requirement);
      seen.add(requirement);
    }
  }
  
  return requirements;
}

/**
 * Normalize area from scope
 */
function normalizeAreaFromScope(scope: string): string | undefined {
  const lowerScope = scope.toLowerCase();
  
  // Scope to area mapping
  const scopeToArea: Record<string, string> = {
    'tests': 'testing',
    'test': 'testing',
    'auth': 'auth',
    'api': 'api',
    'ui': 'ui',
    'docs': 'docs',
    'database': 'database',
    'db': 'database'
  };
  
  return scopeToArea[lowerScope] || scope;
}

/**
 * Infer area from keywords
 */
function inferArea(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  
  // Area keywords mapping
  const areaKeywords: Record<string, string> = {
    'login': 'auth',
    'auth': 'auth',
    'authentication': 'auth',
    'database': 'database',
    'db': 'database',
    'query': 'database',
    'test': 'testing',
    'tests': 'testing',
    'testing': 'testing',
    'unit test': 'testing',
    'integration test': 'testing',
    'docs': 'docs',
    'documentation': 'docs',
    'readme': 'docs',
    'api': 'api',
    'endpoint': 'api',
    'ui': 'ui',
    'component': 'ui',
    'frontend': 'ui',
    'backend': 'backend',
    'server': 'backend'
  };
  
  for (const [keyword, area] of Object.entries(areaKeywords)) {
    if (lowerText.includes(keyword)) {
      return area;
    }
  }
  
  return undefined;
}

/**
 * Infer priority from keywords
 */
function inferPriority(text: string): 'P0' | 'P1' | 'P2' | 'P3' | undefined {
  const lowerText = text.toLowerCase();
  
  // Priority keywords
  if (lowerText.includes('p0') || lowerText.includes('critical')) {
    return 'P0';
  }
  if (lowerText.includes('p1') || lowerText.includes('important')) {
    return 'P1';
  }
  if (lowerText.includes('p2')) {
    return 'P2';
  }
  if (lowerText.includes('p3')) {
    return 'P3';
  }
  
  return undefined;
}

/**
 * Generate task goal from parsed commit info
 */
function generateGoal(type: string, scope: string | undefined, subject: string): string {
  const typeCapitalized = capitalizeType(type);
  const subjectCapitalized = capitalizeFirst(subject);
  
  if (scope) {
    return `${typeCapitalized} ${scope}: ${subjectCapitalized}`;
  }
  
  return `${typeCapitalized} ${subjectCapitalized}`;
}

/**
 * Capitalize commit type for goal generation
 */
function capitalizeType(type: string): string {
  const typeMap: Record<string, string> = {
    'feat': 'Implement',
    'fix': 'Fix',
    'docs': 'Document',
    'style': 'Style',
    'refactor': 'Refactor',
    'test': 'Test',
    'chore': 'Chore',
    'perf': 'Optimize',
    'ci': 'CI',
    'build': 'Build'
  };
  
  return typeMap[type] || capitalizeFirst(type);
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Check if commit message follows conventional commit format
 */
export function isConventionalCommit(message: string): boolean {
  if (!message || message.trim() === '') {
    return false;
  }
  
  const firstLine = message.split('\n')[0].trim();
  const conventionalPattern = /^(\w+)(?:\([^)]+\))?(!)?:\s+.+$/;
  const match = firstLine.match(conventionalPattern);
  
  if (!match) {
    return false;
  }
  
  // Check if type is a valid conventional commit type
  const validTypes = [
    'feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore',
    'perf', 'ci', 'build', 'revert'
  ];
  
  const type = match[1].toLowerCase();
  return validTypes.includes(type);
}

/**
 * Get description for commit type
 */
export function getCommitTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'feat': 'New feature',
    'fix': 'Bug fix',
    'docs': 'Documentation',
    'style': 'Code style',
    'refactor': 'Code refactoring',
    'test': 'Tests',
    'chore': 'Chores',
    'perf': 'Performance',
    'ci': 'CI/CD',
    'build': 'Build system'
  };
  
  return descriptions[type] || 'Other';
}

/**
 * Format parsed commit info for display
 */
export function formatParsedInfo(info: ParsedCommitInfo): string {
  const lines: string[] = [];
  
  lines.push(`Type: ${info.type}`);
  
  if (info.scope) {
    lines.push(`Scope: ${info.scope}`);
  }
  
  lines.push(`Subject: ${info.subject}`);
  
  if (info.breaking) {
    lines.push('Breaking: Yes ⚠️');
  }
  
  if (info.requirements.length > 0) {
    lines.push(`Requirements: ${info.requirements.join(', ')}`);
  }
  
  if (info.area) {
    lines.push(`Area: ${info.area}`);
  }
  
  if (info.priority) {
    lines.push(`Priority: ${info.priority}`);
  }
  
  lines.push(`Goal: ${info.goal}`);
  
  return lines.join('\n');
}

