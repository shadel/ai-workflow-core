### RULE-012: Workflow Step Actions Enforcement (MANDATORY)

**Priority:** CRITICAL (P0)  
**Category:** workflow-enforcement  
**Feature:** workflow  
**Created:** [DATE]  
**Consolidates:** RULE-008, RULE-009, RULE-010, RULE-011  

**The Problem:**
Workflow has 6 steps but doesn't enforce specific actions, leading to steps being suggestions only and 78% features underutilized.

**The Rule:**
Each workflow step has MANDATORY actions that cannot be skipped.

**Consolidated Workflow Checklist:**

**UNDERSTAND Phase:**
- [ ] List requirements (RULE-008)
- [ ] Create requirement if new feature (RULE-008)
- [ ] Check traceability coverage (RULE-008)

**DESIGN Phase:**
- [ ] Document solution approach
- [ ] Define acceptance criteria
- [ ] Create test strategy (RULE-010)

**IMPLEMENT Phase:**
- [ ] Write code with quality focus
- [ ] Add @requirement comments (RULE-008)
- [ ] Validate code-org after creating files (RULE-009)
- [ ] Update requirement status to in_progress (RULE-008)

**TEST Phase:**
- [ ] Write unit tests (70% coverage) (RULE-010)
- [ ] Write integration tests (20% coverage) (RULE-010)
- [ ] Write E2E tests (10% coverage, MCP for UI) (RULE-010, RULE-011)
- [ ] Execute all P0/P1 tests
- [ ] Document test results

**REVIEW Phase:**
- [ ] Validate code-org fully (RULE-009)
- [ ] Generate traceability matrix (RULE-008)
- [ ] Check coverage >= 80% (RULE-008)
- [ ] Find and fix gaps (RULE-008)
- [ ] Verify test coverage >= 60% (RULE-010)

**COMMIT Phase:**
- [ ] Mark requirements done (RULE-008)
- [ ] Export traceability report (RULE-008)
- [ ] Run final validate
- [ ] Verify all quality gates passed
- [ ] Commit with safe message format (RULE-007)

**Why This Rule Exists:**
- Workflow without enforcement = suggestions only
- 78% features unused without step enforcement
- Steps need mandatory actions to be effective
- Prevents feature underutilization

**Enforcement:** Cannot proceed to next step without completing actions

**Estimated Impact:** 22% → 89% overall feature usage

---

