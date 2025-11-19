### RULE-009: Code Organization Validation (MANDATORY)

**Priority:** HIGH (P1)  
**Category:** quality-assurance  
**Feature:** code-org  
**Created:** [DATE]  

**The Problem:**
Code organization validation feature exists (tested with 12 tests!) but never used in actual workflow, leading to no structure validation and potential technical debt.

**The Rule:**
Validate code organization during IMPLEMENT and REVIEW phases automatically.

**Required Actions by Workflow Phase:**

**IMPLEMENT Phase (After Creating Files):**
- [ ] After creating directories: validate structure
- [ ] After creating files: validate naming conventions

Commands:
```bash
npx ai-workflow code-org check-structure
npx ai-workflow code-org check-naming
```

**REVIEW Phase (Before Commit):**
- [ ] Full validation before commit
- [ ] Check statistics and quality gates

Commands:
```bash
npx ai-workflow code-org validate
npx ai-workflow code-org stats
```

**Quality Gates:**
- [ ] Required directories exist (ERROR)
- [ ] Naming conventions followed (WARNING)
- [ ] File sizes reasonable (< 500 lines) (WARNING)

**Why This Rule Exists:**
- Prevents messy codebase
- Enforces standards from Day 1
- Catches organization issues early
- Feature tested but unused without rule

**Enforcement:** Quality gate in REVIEW phase

**Estimated Impact:** 0% → 100% feature usage

---

