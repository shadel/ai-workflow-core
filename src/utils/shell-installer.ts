/**
 * Shell Installer - Auto-install shell integration
 * @requirement REQ-FIX-006 - Shell auto-install
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Detected shell type
 */
export type ShellType = 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'unknown';

/**
 * Installation result
 */
export interface InstallResult {
  success: boolean;
  shellType: ShellType;
  profilePath?: string;
  backupPath?: string;
  message: string;
}

/**
 * Shell Installer
 * Automatically installs shell integration (prompt, aliases, completion)
 * @requirement REQ-FIX-006 - Auto-detect and install
 */
export class ShellInstaller {
  private homeDir: string;

  constructor() {
    this.homeDir = os.homedir();
  }

  /**
   * Detect current shell
   * @requirement REQ-FIX-006 - Shell detection
   */
  detectShell(): ShellType {
    const platform = os.platform();
    
    // Windows
    if (platform === 'win32') {
      const shell = process.env.SHELL || process.env.ComSpec || '';
      
      if (shell.includes('bash')) return 'bash';
      if (shell.includes('zsh')) return 'zsh';
      if (shell.includes('powershell') || shell.includes('pwsh')) return 'powershell';
      if (shell.includes('cmd')) return 'cmd';
      
      // Default to bash on Windows (Git Bash)
      return 'bash';
    }
    
    // Unix-like (Linux, macOS)
    const shell = process.env.SHELL || '';
    
    if (shell.includes('zsh')) return 'zsh';
    if (shell.includes('bash')) return 'bash';
    if (shell.includes('fish')) return 'fish';
    
    return 'bash'; // Default
  }

  /**
   * Get shell profile path
   * @requirement REQ-FIX-006 - Profile file location
   */
  getProfilePath(shellType: ShellType): string {
    switch (shellType) {
      case 'bash':
        // Try .bashrc, then .bash_profile
        const bashrc = path.join(this.homeDir, '.bashrc');
        const bashProfile = path.join(this.homeDir, '.bash_profile');
        return fs.existsSync(bashrc) ? bashrc : bashProfile;
      
      case 'zsh':
        return path.join(this.homeDir, '.zshrc');
      
      case 'fish':
        return path.join(this.homeDir, '.config', 'fish', 'config.fish');
      
      case 'powershell':
        // PowerShell profile
        try {
          const profilePath = execSync('powershell -NoProfile -Command "$PROFILE"', { encoding: 'utf-8' }).trim();
          return profilePath;
        } catch {
          return path.join(this.homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
        }
      
      case 'cmd':
        // CMD doesn't have a profile
        return '';
      
      default:
        return path.join(this.homeDir, '.profile');
    }
  }

  /**
   * Generate shell integration code
   * @requirement REQ-FIX-006 - Integration code generation
   */
  generateIntegrationCode(shellType: ShellType): string {
    const marker = '# AI Workflow Engine Integration';
    
    switch (shellType) {
      case 'bash':
      case 'zsh':
        return `
${marker}
# Added by ai-workflow on ${new Date().toISOString()}

# Show workflow status in prompt
_ai_workflow_prompt() {
  if [ -f .ai-context/current-task.json ]; then
    local state=$(grep -o '"currentState":"[^"]*"' .ai-context/current-task.json 2>/dev/null | cut -d'"' -f4)
    if [ -n "$state" ]; then
      echo "[AI:$state] "
    fi
  fi
}

# Update PS1 prompt (comment out if you have custom prompt)
# export PS1='$(_ai_workflow_prompt)'"$PS1"

# Aliases
alias aiw='ai-workflow'
alias aiw-task='ai-workflow task'
alias aiw-validate='ai-workflow validate'
alias aiw-sync='ai-workflow sync'

# Tab completion (basic)
complete -W "task requirement traceability code-org approval license config help validate sync init upgrade" ai-workflow

# End AI Workflow Integration
`;

      case 'fish':
        return `
${marker}
# Added by ai-workflow on ${new Date().toISOString()}

# Show workflow status in prompt
function _ai_workflow_prompt
    if test -f .ai-context/current-task.json
        set -l state (grep -o '"currentState":"[^"]*"' .ai-context/current-task.json 2>/dev/null | cut -d'"' -f4)
        if test -n "$state"
            echo "[AI:$state] "
        end
    end
end

# Aliases
alias aiw='ai-workflow'
alias aiw-task='ai-workflow task'
alias aiw-validate='ai-workflow validate'

# End AI Workflow Integration
`;

      case 'powershell':
        return `
${marker}
# Added by ai-workflow on ${new Date().toISOString()}

# Show workflow status in prompt
function Get-AIWorkflowPrompt {
    if (Test-Path .ai-context/current-task.json) {
        $state = (Get-Content .ai-context/current-task.json | ConvertFrom-Json).workflow.currentState
        if ($state) {
            "[AI:$state] "
        }
    }
}

# Aliases
Set-Alias -Name aiw -Value ai-workflow

# End AI Workflow Integration
`;

      default:
        return `${marker}\n# Shell type not supported for auto-integration\n`;
    }
  }

  /**
   * Install shell integration
   * @requirement REQ-FIX-006 - Auto-install to shell profile
   */
  async install(options?: { force?: boolean }): Promise<InstallResult> {
    const shellType = this.detectShell();
    const profilePath = this.getProfilePath(shellType);

    // Check if profile path exists
    if (!profilePath) {
      return {
        success: false,
        shellType,
        message: `Shell type ${shellType} does not support profile integration`,
      };
    }

    // Check if already installed
    if (await this.isInstalled(shellType)) {
      if (!options?.force) {
        return {
          success: false,
          shellType,
          profilePath,
          message: 'Shell integration already installed. Use --force to reinstall',
        };
      }
      
      // Uninstall first
      await this.uninstall();
    }

    // Create backup
    const backupPath = await this.backup(profilePath);

    // Get integration code
    const code = this.generateIntegrationCode(shellType);

    // Append to profile
    try {
      await fs.ensureFile(profilePath);
      const existingContent = await fs.readFile(profilePath, 'utf-8');
      const newContent = existingContent + '\n' + code + '\n';
      await fs.writeFile(profilePath, newContent, 'utf-8');

      return {
        success: true,
        shellType,
        profilePath,
        backupPath,
        message: `Shell integration installed to ${profilePath}`,
      };
    } catch (error: any) {
      // Restore backup on failure
      if (backupPath) {
        await fs.copy(backupPath, profilePath);
      }
      
      return {
        success: false,
        shellType,
        profilePath,
        message: `Installation failed: ${error.message}`,
      };
    }
  }

  /**
   * Uninstall shell integration
   * @requirement REQ-FIX-006 - Uninstall command
   */
  async uninstall(): Promise<InstallResult> {
    const shellType = this.detectShell();
    const profilePath = this.getProfilePath(shellType);

    if (!profilePath || !await fs.pathExists(profilePath)) {
      return {
        success: false,
        shellType,
        message: 'Shell profile not found',
      };
    }

    try {
      const content = await fs.readFile(profilePath, 'utf-8');
      
      // Remove integration code (between markers)
      const marker = '# AI Workflow Engine Integration';
      const endMarker = '# End AI Workflow Integration';
      
      const startIndex = content.indexOf(marker);
      const endIndex = content.indexOf(endMarker);
      
      if (startIndex === -1) {
        return {
          success: false,
          shellType,
          profilePath,
          message: 'Shell integration not found',
        };
      }

      // Create backup
      const backupPath = await this.backup(profilePath);

      // Remove integration section
      const before = content.substring(0, startIndex);
      const after = endIndex !== -1 
        ? content.substring(endIndex + endMarker.length)
        : content.substring(startIndex);
      
      const newContent = before + after;
      await fs.writeFile(profilePath, newContent, 'utf-8');

      return {
        success: true,
        shellType,
        profilePath,
        backupPath,
        message: `Shell integration removed from ${profilePath}`,
      };
    } catch (error: any) {
      return {
        success: false,
        shellType,
        profilePath,
        message: `Uninstallation failed: ${error.message}`,
      };
    }
  }

  /**
   * Check if shell integration is installed
   * @requirement REQ-FIX-006 - Installation check
   */
  async isInstalled(shellType?: ShellType): Promise<boolean> {
    const shell = shellType || this.detectShell();
    const profilePath = this.getProfilePath(shell);

    if (!profilePath || !await fs.pathExists(profilePath)) {
      return false;
    }

    try {
      const content = await fs.readFile(profilePath, 'utf-8');
      return content.includes('# AI Workflow Engine Integration');
    } catch {
      return false;
    }
  }

  /**
   * Create backup of shell profile
   * @requirement REQ-FIX-006 - Backup before changes
   */
  private async backup(profilePath: string): Promise<string> {
    const backupPath = `${profilePath}.ai-workflow.backup.${Date.now()}`;
    
    if (await fs.pathExists(profilePath)) {
      await fs.copy(profilePath, backupPath);
    }
    
    return backupPath;
  }

  /**
   * Get installation status
   */
  async status(): Promise<{
    shellType: ShellType;
    profilePath: string;
    installed: boolean;
  }> {
    const shellType = this.detectShell();
    const profilePath = this.getProfilePath(shellType);
    const installed = await this.isInstalled(shellType);

    return {
      shellType,
      profilePath,
      installed,
    };
  }
}

