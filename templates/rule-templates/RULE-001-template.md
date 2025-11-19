### RULE-001: Auto-trigger AI Workflow Engine (COMPREHENSIVE)

**Priority:** CRITICAL (P0)  
**Category:** automation  
**Feature:** Task management  
**Created:** [DATE]  

**The Problem:**
AI assistants may not automatically use workflow engine for all coding tasks, leading to inconsistent tracking and missed workflow benefits.

**The Rule:**
When user sends ANY coding-related request, AI MUST automatically trigger ai-workflow-engine commands WITHOUT asking for permission.

**Trigger On:**
- ✅ Feature requests
- ✅ Bug fixes
- ✅ Refactoring
- ✅ Debugging/Troubleshooting
- ✅ Performance optimization
- ✅ Configuration problems

**Do NOT Trigger On:**
- ❌ Pure questions (no code changes)
- ❌ Information requests
- ❌ Status checks
- ❌ Documentation reading

**Required Actions:**
1. ✅ Run `npx ai-workflow task create "[user request]"`
2. ✅ Execute full workflow: understand → design → implement → test → review
3. ✅ For debugging: investigate → design solution → implement fix
4. ✅ Run `npx ai-workflow validate` before commit
5. ✅ Auto-commit per criteria (if low-risk)

**Example:**
```bash
User: "Fix 404 error"

AI Action:
1. npx ai-workflow task create "Fix 404 error"
2. UNDERSTAND: Check server, routing
3. DESIGN: Identify root cause
4. IMPLEMENT: Fix configuration
5. TEST: Verify server responds
6. REVIEW: Validate quality gates
7. COMMIT: Auto-commit with documentation
```

**Why This Rule Exists:**
- Ensures comprehensive automation
- Provides audit trail for ALL changes
- Leverages full workflow benefits
- User expects proactive AI behavior

**Enforcement:** MANDATORY for all coding-related requests

**Estimated Impact:** 0% → 90% workflow usage

---

