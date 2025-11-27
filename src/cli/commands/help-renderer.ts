/**
 * Help Rendering System
 * Template-based rendering for help command output
 * @requirement REQ-V2-003 - Help system rendering
 */

import type { CommandHelp, Category, HelpOptions } from './help-types.js';
import { getPackageInfo } from '../utils/package-info.js';

/**
 * Get package type (Core or Full Build)
 */
export function getPackageType(): 'core' | 'full' {
  const packageInfo = getPackageInfo();
  const name = packageInfo.name;
  
  // Check current package names
  if (name === '@shadel/ai-workflow-full' || name === '@ai-workflow/full') {
    return 'full';
  }
  if (name === '@shadel/ai-workflow-core' || name === '@ai-workflow/core') {
    return 'core';
  }
  
  // Default to core if detection fails
  return 'core';
}

/**
 * Filter commands by package type
 */
export function filterCommandsByPackage(
  commands: CommandHelp[],
  packageType: 'core' | 'full'
): CommandHelp[] {
  return commands.filter(
    cmd => cmd.package === packageType || cmd.package === 'both'
  );
}

/**
 * Filter categories by package type
 */
export function filterCategoriesByPackage(
  categories: Category[],
  packageType: 'core' | 'full'
): Category[] {
  return categories.filter(
    cat => cat.package === packageType || cat.package === 'both'
  );
}

/**
 * Render box with title (Unicode box drawing with ASCII fallback)
 */
export function renderBox(
  title: string,
  content: string,
  packageType?: 'core' | 'full'
): string {
  const width = 70;
  const titleLine = packageType
    ? `${title} (${packageType === 'core' ? 'Core Build' : 'Full Build'})`
    : title;
  
  // Check if Unicode is supported (try to detect terminal capabilities)
  // For now, always use Unicode (most modern terminals support it)
  // ASCII fallback can be added later if needed
  
  const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
  const titleBorder = '║ ' + titleLine.padEnd(width - 4) + ' ║';
  const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';
  
  return `${topBorder}\n${titleBorder}\n${bottomBorder}\n\n${content}`;
}

/**
 * Render a section with title and content
 */
export function renderSection(title: string, content: string[]): string {
  if (content.length === 0) {
    return '';
  }
  
  let output = `${title}\n`;
  
  for (const line of content) {
    output += `  ${line}\n`;
  }
  
  return output + '\n';
}

/**
 * Render a category with its commands
 */
export function renderCategory(
  category: Category,
  commands: CommandHelp[]
): string {
  const categoryCommands = commands.filter(cmd => 
    cmd.category === category.id
  );
  
  if (categoryCommands.length === 0) {
    return '';
  }
  
  let output = `${category.name}\n`;
  
  // Sort commands by priority (higher priority first)
  const sortedCommands = [...categoryCommands].sort(
    (a, b) => b.priority - a.priority
  );
  
  for (const cmd of sortedCommands) {
    output += `  ${cmd.name.padEnd(20)} ${cmd.description}\n`;
  }
  
  return output + '\n';
}

/**
 * Render command-specific help
 */
export function renderHelp(
  data: CommandHelp,
  format: 'text' | 'json' = 'text'
): string {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  
  let output = `📖 COMMAND: npx ai-workflow ${data.name}\n\n`;
  
  // USAGE section
  output += renderSection('USAGE:', [data.usage]);
  
  // OPTIONS section
  if (data.options && data.options.length > 0) {
    const options = data.options.map(
      opt => `${opt.name.padEnd(25)} ${opt.description}`
    );
    output += renderSection('OPTIONS:', options);
  }
  
  // EXAMPLES section
  if (data.examples && data.examples.length > 0) {
    output += renderSection('EXAMPLES:', data.examples);
  }
  
  // WORKFLOW section
  if (data.workflow && data.workflow.length > 0) {
    output += renderSection('WORKFLOW:', data.workflow);
  }
  
  // TIPS section
  if (data.tips && data.tips.length > 0) {
    const tips = data.tips.map(tip => `💡 ${tip}`);
    output += renderSection('💡 TIPS:', tips);
  }
  
  // RELATED COMMANDS section
  if (data.related && data.related.length > 0) {
    const related = data.related.map(
      cmd => `- npx ai-workflow ${cmd}`
    );
    output += renderSection('📚 RELATED COMMANDS:', related);
  }
  
  return output;
}

/**
 * Render general help (all commands)
 */
export function renderGeneralHelp(
  categories: Category[],
  commands: CommandHelp[],
  packageType: 'core' | 'full',
  options: HelpOptions
): string {
  if (options.json) {
    // JSON output
    const filteredCommands = filterCommandsByPackage(commands, packageType);
    const filteredCategories = filterCategoriesByPackage(categories, packageType);
    
    // Sort commands by priority (higher priority first)
    const sortedCommands = [...filteredCommands].sort(
      (a, b) => b.priority - a.priority
    );
    
    return JSON.stringify({
      package: packageType,
      categories: filteredCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        commands: cat.commands
      })),
      commands: sortedCommands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        category: cmd.category,
        priority: cmd.priority
      })),
      quickStart: [
        'npx ai-workflow init',
        'npx ai-workflow task create "Your goal"',
        'Work on your code',
        'npx ai-workflow sync',
        'npx ai-workflow validate',
        'npx ai-workflow task complete'
      ]
    }, null, 2);
  }
  
  // Text output
  const filteredCommands = filterCommandsByPackage(commands, packageType);
  const filteredCategories = filterCategoriesByPackage(categories, packageType);
  
  // Sort commands by priority
  const sortedCommands = [...filteredCommands].sort(
    (a, b) => b.priority - a.priority
  );
  
  // Progressive disclosure: show top commands by default
  const topCommandCount = options.all ? sortedCommands.length : Math.min(15, sortedCommands.length);
  const topCommands = sortedCommands.slice(0, topCommandCount);
  const remainingCount = sortedCommands.length - topCommandCount;
  
  // Render box header
  // Title already includes package type, so don't pass packageType to renderBox
  const boxTitle = packageType === 'core' 
    ? 'AI WORKFLOW ENGINE - HELP (Core Build)'
    : 'AI WORKFLOW ENGINE - HELP (Full Build)';
  const header = renderBox(boxTitle, '');
  
  let output = header;
  
  // Render categories with their commands
  for (const category of filteredCategories) {
    const categoryOutput = renderCategory(category, topCommands);
    if (categoryOutput) {
      output += categoryOutput;
    }
  }
  
  // Quick Start section
  output += renderSection('💡 QUICK START:', [
    '1. npx ai-workflow init',
    '2. npx ai-workflow task create "Your goal"',
    '3. Work on your code',
    '4. npx ai-workflow sync',
    '5. npx ai-workflow validate',
    '6. npx ai-workflow task complete'
  ]);
  
  // Progressive disclosure message
  if (remainingCount > 0 && !options.all) {
    output += `\n(${remainingCount} more commands available. Use --all to see all.)\n`;
  }
  
  return output;
}

