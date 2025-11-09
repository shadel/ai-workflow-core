/**
 * Shell Integration - Display workflow in shell prompt
 * @requirement REQ-V2-023 - Shell Integration
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Shell Integration - Generate shell prompt functions
 * @requirement REQ-V2-023 - Shell prompt integration
 */
export class ShellIntegration {
  private contextDir = '.ai-context';

  /**
   * Get current workflow state for shell prompt
   * @requirement REQ-V2-023 - State display in prompt
   */
  async getPromptInfo(): Promise<string> {
    const taskFile = path.join(this.contextDir, 'current-task.json');
    
    if (!await fs.pathExists(taskFile)) {
      return '';
    }

    try {
      const taskData = await fs.readJson(taskFile);
      const state = taskData.workflow?.currentState || 'UNKNOWN';
      
      // Short state indicators
      const stateIcons: Record<string, string> = {
        'UNDERSTANDING': '🔍',
        'DESIGN_COMPLETE': '📐',
        'IMPLEMENTATION_COMPLETE': '💻',
        'TESTING_COMPLETE': '🧪',
        'REVIEW_COMPLETE': '👀',
        'COMMIT_READY': '✅'
      };
      
      const icon = stateIcons[state] || '❓';
      const shortState = state.replace('_COMPLETE', '').substring(0, 6);
      
      return `[${icon} ${shortState}]`;
    } catch {
      return '';
    }
  }

  /**
   * Generate bash prompt function
   */
  generateBashPrompt(): string {
    return `# AI Workflow Engine - Shell Integration (Bash)
# Add to ~/.bashrc or ~/.bash_profile

ai_workflow_prompt() {
  local task_file=".ai-context/current-task.json"
  if [ -f "$task_file" ]; then
    local state=$(grep -o '"currentState":"[^"]*"' "$task_file" | cut -d'"' -f4)
    case "$state" in
      "UNDERSTANDING") echo "[🔍 UNDERS]" ;;
      "DESIGN_COMPLETE") echo "[📐 DESIGN]" ;;
      "IMPLEMENTATION_COMPLETE") echo "[💻 IMPLEM]" ;;
      "TESTING_COMPLETE") echo "[🧪 TESTIN]" ;;
      "REVIEW_COMPLETE") echo "[👀 REVIEW]" ;;
      "COMMIT_READY") echo "[✅ COMMIT]" ;;
      *) echo "[❓]" ;;
    esac
  fi
}

# Add to PS1:
# export PS1="\\$(ai_workflow_prompt)\\u@\\h:\\w\$ "
`;
  }

  /**
   * Generate zsh prompt function
   */
  generateZshPrompt(): string {
    return `# AI Workflow Engine - Shell Integration (Zsh)
# Add to ~/.zshrc

ai_workflow_prompt() {
  local task_file=".ai-context/current-task.json"
  if [[ -f "$task_file" ]]; then
    local state=$(grep -o '"currentState":"[^"]*"' "$task_file" | cut -d'"' -f4)
    case "$state" in
      "UNDERSTANDING") echo "[🔍 UNDERS]" ;;
      "DESIGN_COMPLETE") echo "[📐 DESIGN]" ;;
      "IMPLEMENTATION_COMPLETE") echo "[💻 IMPLEM]" ;;
      "TESTING_COMPLETE") echo "[🧪 TESTIN]" ;;
      "REVIEW_COMPLETE") echo "[👀 REVIEW]" ;;
      "COMMIT_READY") echo "[✅ COMMIT]" ;;
      *) echo "[❓]" ;;
    esac
  fi
}

# Add to PROMPT:
# setopt PROMPT_SUBST
# PROMPT='$(ai_workflow_prompt)%n@%m:%~%# '
`;
  }

  /**
   * Generate fish prompt function
   */
  generateFishPrompt(): string {
    return `# AI Workflow Engine - Shell Integration (Fish)
# Add to ~/.config/fish/config.fish

function ai_workflow_prompt
    set task_file ".ai-context/current-task.json"
    if test -f $task_file
        set state (grep -o '"currentState":"[^"]*"' $task_file | cut -d'"' -f4)
        switch $state
            case "UNDERSTANDING"
                echo "[🔍 UNDERS]"
            case "DESIGN_COMPLETE"
                echo "[📐 DESIGN]"
            case "IMPLEMENTATION_COMPLETE"
                echo "[💻 IMPLEM]"
            case "TESTING_COMPLETE"
                echo "[🧪 TESTIN]"
            case "REVIEW_COMPLETE"
                echo "[👀 REVIEW]"
            case "COMMIT_READY"
                echo "[✅ COMMIT]"
            case '*'
                echo "[❓]"
        end
    end
end

# Add to prompt:
# function fish_prompt
#     printf '%s%s@%s:%s%s ' (ai_workflow_prompt) (whoami) (hostname) (pwd) '>'
# end
`;
  }

  /**
   * Install shell integration
   */
  async install(shell: 'bash' | 'zsh' | 'fish'): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configFiles: Record<string, string> = {
      bash: path.join(homeDir, '.bashrc'),
      zsh: path.join(homeDir, '.zshrc'),
      fish: path.join(homeDir, '.config', 'fish', 'config.fish')
    };

    const configFile = configFiles[shell];
    const promptFunction = shell === 'bash' ? this.generateBashPrompt() :
                          shell === 'zsh' ? this.generateZshPrompt() :
                          this.generateFishPrompt();

    // Append to config file
    await fs.appendFile(configFile, `\n${promptFunction}\n`);
  }
}

