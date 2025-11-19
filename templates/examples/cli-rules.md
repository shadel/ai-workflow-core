# CLI Tool Rules

**Purpose**: Rules for command-line tools  
**Applicability**: ~15% of projects (CLI tools)  
**Usage**: Activate if building CLI application

---

## RULE-CLI-001: Help Text Required

**The Rule**: Every command must have `--help` flag with clear documentation.

**Actions**:
```bash
For EACH command:
1. ✅ Add --help/-h flag
2. ✅ Document usage
3. ✅ Show examples
4. ✅ List all options
```

**Activation**: `npx ai-workflow activate cli-001`

---

## RULE-CLI-002: Non-Interactive Mode

**The Rule**: Support `--yes` flag to skip all prompts (for CI/CD).

**Why**: Scripts need non-interactive execution.

**Actions**:
```
1. ✅ Add --yes/-y flag
2. ✅ Use defaults when flag present
3. ✅ Skip all prompts
```

**Activation**: `npx ai-workflow activate cli-002`

---

## RULE-CLI-003: Exit Codes

**The Rule**: Use standard exit codes (0 = success, non-zero = error).

**Standards**:
- 0: Success
- 1: General error
- 2: Misuse of command
- 126: Command cannot execute
- 127: Command not found

**Activation**: `npx ai-workflow activate cli-003`

---

**Activate all**: `npx ai-workflow activate-all cli`

