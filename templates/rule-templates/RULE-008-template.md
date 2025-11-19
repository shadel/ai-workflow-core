### RULE-008: Requirements & Traceability Integration (MANDATORY)

**Priority:** CRITICAL (P0)  
**Category:** workflow-integration  
**Features:** requirements, traceability  
**Created:** [DATE]  

**The Problem:**
Requirements and traceability features exist but not integrated into workflow automatically, leading to manual project management and missing coverage.

**The Rule:**
For EVERY coding task, AI MUST integrate requirements and traceability into workflow phases automatically.

**Required Actions by Workflow Phase:**

**UNDERSTAND Phase:**
- [ ] List existing requirements
- [ ] Create requirement for new features
- [ ] Check current traceability coverage

Commands:
```bash
npx ai-workflow requirement list
npx ai-workflow requirement create "<name>" --type FR --priority P0
npx ai-workflow trace show
```

**IMPLEMENT Phase:**
- [ ] Add @requirement FR-XXX comments to all files
- [ ] Update requirement status to in_progress

Commands:
```bash
npx ai-workflow requirement update FR-XXX --status in_progress
```

**REVIEW Phase:**
- [ ] Generate traceability matrix
- [ ] Check coverage (target: >= 80%)
- [ ] Find and fix gaps

Commands:
```bash
npx ai-workflow trace generate
npx ai-workflow trace show
npx ai-workflow trace gaps
```

**COMMIT Phase:**
- [ ] Mark requirements as done
- [ ] Export traceability report
- [ ] Verify coverage >= 80%

Commands:
```bash
npx ai-workflow requirement update FR-XXX --status done
npx ai-workflow trace export --output docs/workflows/traceability-report.md
```

**Why This Rule Exists:**
- Requirements tracking is core workflow feature
- Traceability provides professional project management
- Coverage detection prevents missing features
- Automatic usage vs manual overhead

**Enforcement:** Cannot proceed to COMMIT if requirements not tracked or coverage < 80%

**Estimated Impact:** 0% → 95% feature usage

---

