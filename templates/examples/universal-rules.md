# Universal Rules (Applicable to ALL Projects)

**Purpose**: Rules that apply regardless of project type  
**Applicability**: 95-100% of projects  
**Usage**: Can be activated in ANY project

---

## RULE-UNIVERSAL-001: Auto-Commit When READY_TO_COMMIT

**Applicability**: 100% (all projects use version control)

**The Rule**:
When workflow state reaches `READY_TO_COMMIT`, commit immediately without asking permission.

**Why This Rule Exists**:
- `READY_TO_COMMIT` means ALL quality gates passed
- Asking permission wastes time
- User expects autonomous completion

**Actions Required**:
```bash
When state = READY_TO_COMMIT:
1. ✅ Check git status
2. ✅ Stage all changes (git add -A)
3. ✅ Commit with comprehensive message
4. ✅ Report completion
```

**Examples**:

✅ **Good** (Auto-commit):
```
AI: *reaches READY_TO_COMMIT*
AI: *commits automatically*
AI: "✅ Feature complete and committed! (hash: abc123)"
```

❌ **Bad** (Asking permission):
```
AI: *reaches READY_TO_COMMIT*
AI: "Do you want me to commit?"  ← Wastes time!
```

**Exceptions**:
- User explicitly said "wait" or "don't commit yet"
- Merge conflicts present
- Destructive operations (file deletions)

**Activation**:
```bash
npx ai-workflow activate universal-001
```

---

## RULE-UNIVERSAL-002: State Machine Check MANDATORY

**Applicability**: 100% (all projects using ai-workflow-engine)

**The Rule**:
Before starting ANY work, check current workflow state using `npm run workflow:where-am-i`.

**Why This Rule Exists**:
- Prevents working in wrong state
- Ensures proper workflow progression
- Tracks task history

**Actions Required**:
```bash
Before ANY work:
1. ✅ Run: npm run workflow:where-am-i
2. ✅ Verify current state is appropriate
3. ✅ Advance state if needed: npm run workflow:next
4. ✅ Update .ai-context/current-task.json
```

**Examples**:

✅ **Good**:
```bash
User: "Implement feature X"
AI: $ npm run workflow:where-am-i
AI: Current state: UNDERSTANDING
AI: *proceeds with understanding phase*
```

❌ **Bad**:
```bash
User: "Implement feature X"
AI: *starts coding immediately* ← No state check!
```

**Activation**:
```bash
npx ai-workflow activate universal-002
```

---

## RULE-UNIVERSAL-003: Test Plans Required for Code Changes

**Applicability**: 95% (most projects need testing)

**The Rule**:
Every code change MUST have a documented test plan BEFORE implementation.

**Why This Rule Exists**:
- Ensures all scenarios considered upfront
- Prevents "implement then realize we forgot to test X"
- Systematic thinking about edge cases

**Actions Required**:
```markdown
BEFORE coding:
1. ✅ Create test plan document
2. ✅ List test cases (happy path, edge cases, errors)
3. ✅ Define expected results
4. ✅ Get user approval if complex

AFTER coding:
5. ✅ Execute test plan
6. ✅ Document results
7. ✅ Update plan if new scenarios discovered
```

**Test Plan Template**:
```markdown
## Test Plan: [Feature Name]

### Scope:
- What is being changed?
- What functionality is affected?

### Test Cases:
1. **Happy Path**: [Normal usage]
2. **Edge Case 1**: [Boundary condition]
3. **Error Case 1**: [What can go wrong]

### Expected Results:
- [Success criteria for each test case]

### Regression:
- [What existing functionality might break]
```

**Activation**:
```bash
npx ai-workflow activate universal-003
```

---

## RULE-UNIVERSAL-004: Recurring Bugs Require Deep Analysis

**Applicability**: 100% (all projects have bugs that can recur)

**The Rule**:
When the SAME bug or issue appears 2+ times (recurring pattern), STOP quick-fixing. Instead, convene expert analysis to find the DEEP root cause and fix systemically to prevent permanent recurrence.

**Why This Rule Exists**:
- Quick fixes treat symptoms, not root causes
- Recurring bugs waste time and frustrate users
- Pattern indicates systemic design flaw
- Deep analysis breaks the whack-a-mole cycle
- One systemic fix > Multiple band-aids

**Trigger**: Same bug appears for the 2nd time

**Don't Wait for 3rd Occurrence!**

**Actions Required**:
```markdown
When pattern detected:

STEP 1: STOP Quick-Fixing
  - Don't apply another band-aid
  - Recognize this is a PATTERN
  - Different approach needed

STEP 2: Document All Occurrences
  - When did bug occur? (dates)
  - What was the symptom?
  - What fix was applied?
  - Did fix work permanently? (NO - it came back!)

STEP 3: Deep Analysis (Critical!)
  - WHY does this keep happening?
  - What's the fundamental design flaw?
  - What assumptions are wrong?
  - What calculation is fundamentally incorrect?
  - What architectural change prevents this class of bugs?

STEP 4: Convene Expert Team (If Complex)
  - Get multiple perspectives
  - Identify root cause
  - Design systemic solution
  - Avoid future recurrences

STEP 5: Systemic Fix
  - Fix root cause (not symptom)
  - Architectural improvement if needed
  - Prevents entire class of bugs
  - More conservative approach

STEP 6: Regression Tests
  - Test that bug is fixed
  - Test that similar bugs prevented
  - Add to test suite permanently

STEP 7: Document Pattern
  - Add to BUGS.md or similar
  - Document: Pattern + Root cause + Fix
  - Future reference
```

**Example Pattern** (from md2social):
```
Bug #1: Content clipped (overflow: hidden)
  → Quick fix: Removed overflow:hidden
  → Result: Temporary

Bug #2: Content cut at 600px
  → Quick fix: Removed height constraint
  → Result: Created new issue

Bug #3: Preview not fixed-size
  → Pattern recognized! RULE-005 triggered!
  → Deep analysis: Emergency research meeting
  → Root cause: Calculation too optimistic (98% vs 90%)
  → Systemic fix: scale-calculator.ts (centralized)
  → Regression tests: Added
  → Result: No more recurrence! ✅

Saved: Would have continued whack-a-mole without RULE-005
ROI: 3-4 hours deep analysis saved 10+ hours future fixes
```

**How to Recognize Recurring Bugs**:
```
Same symptoms:
  - Same error message
  - Same broken behavior
  - Same user complaint
  - Different triggers but same root issue

Different fixes, same outcome:
  - Fix #1 didn't work permanently
  - Fix #2 didn't work permanently
  - Pattern: Temporary fixes!

Red flags:
  - "This looks familiar..."
  - "Didn't we fix this before?"
  - "Why is this happening again?"
  
If you think it: It probably IS recurring!
```

**Activation**:
```bash
npx ai-workflow activate universal-004
```

**Proven Effectiveness**:
```
Applied in md2social: 2 times
Bugs prevented: 5+ recurring bugs
Time saved: 10-15 hours per project
User frustration: Eliminated

This rule PAYS FOR ITSELF many times over!
```

---

## RULE-UNIVERSAL-005: Auto-Commit When READY_TO_COMMIT (Low-Risk)

**Applicability**: 85% (most projects, except high-stakes systems)

**The Rule**:
When workflow shows **READY_TO_COMMIT** state AND user requested task completion (e.g., "fix bug", "implement feature"), commit IMMEDIATELY without asking permission. User expects autonomous completion for low-risk operations.

**Why This Rule Exists**:
- READY_TO_COMMIT means ALL checks passed (tests, validation)
- Asking permission wastes user's time
- State machine already enforced quality gates
- User expects task completion, not permission-seeking
- Only ask for HIGH-RISK operations (destructive changes)

**When to Auto-Commit** (Don't Ask):
```
✅ Bug fixes (user asked to fix)
✅ Feature implementations (user asked to add)
✅ Code refactoring (user asked to improve)
✅ Documentation updates
✅ Test additions
✅ Configuration changes (non-critical)

Criteria:
  - User explicitly requested the task
  - Workflow reached READY_TO_COMMIT
  - Changes are low-risk (reversible)
  - No destructive operations
```

**When to Ask Permission** (High-Risk):
```
❌ Delete files/directories (5+ files)
❌ Force push to main/master
❌ Database schema changes
❌ Critical infrastructure changes
❌ User explicitly said "wait" or "don't commit yet"

Criteria:
  - Destructive/irreversible operations
  - High-risk changes
  - User indicated caution needed
```

**Actions**:
```bash
When READY_TO_COMMIT:

STEP 1: Evaluate Risk
  - Low-risk + user requested? → Auto-commit
  - High-risk? → Ask permission

STEP 2: Auto-Commit (If Low-Risk)
  git add -A
  git commit -m "..."
  Report: "✅ Committed! [hash]"

STEP 3: Don't Ask These:
  ❌ "Do you want to commit?"
  ❌ "Should I commit?"
  ❌ "What next?"
  
Just commit and report completion.
```

**Example**:
```
User: "Fix Bug #008"
AI: *fixes bug*
AI: *reaches READY_TO_COMMIT*
AI: *commits automatically* ✅
AI: "✅ Bug #008 fixed and committed! [abc123]"

NO asking permission (user already requested the fix!)
```

**Activation**:
```bash
npx ai-workflow activate universal-005
```

**Proven Effectiveness**:
```
Applied in md2social: 2 times
User frustration: Eliminated ("tại sao không commit?")
Time saved: 2-5 min per task (no back-and-forth)
```

---

## RULE-UNIVERSAL-006: Verify Requirements Satisfied Before Commit

**Applicability**: 100% (all projects need complete work)

**The Rule**:
Before committing ANY changes, verify that ALL original requirements are satisfied. Don't commit partial work or fixes that don't fully address the requirements.

**Why This Rule Exists**:
- Quick fixes may miss edge cases
- Partial implementations frustrate users
- UX bugs can be as critical as functional bugs
- User expects COMPLETE solution
- Prevents "commit → user finds more issues → fix again" cycle

**Requirements Checklist**:
```markdown
BEFORE COMMIT:

1. ✅ Original Requirements
   - What did user originally ask for?
   - ALL parts of request addressed?
   - Any implicit requirements?

2. ✅ Functional Requirements
   - Feature works as specified?
   - All user scenarios covered?
   - Edge cases handled?
   - Error cases handled?

3. ✅ UX Requirements
   - User-friendly?
   - Navigation clear?
   - Visual feedback appropriate?
   - Responsive (if UI)?

4. ✅ Testing Complete
   - All test cases passed?
   - Cross-platform tested (if needed)?
   - Regression testing done?

5. ✅ Quality Gates
   - No linter errors?
   - Performance acceptable?
   - Code maintainable?
```

**Actions**:
```bash
BEFORE git commit:

STEP 1: Re-read user's ORIGINAL request
STEP 2: List ALL requirements (explicit + implicit)
STEP 3: Check EACH requirement:
        ✅ Fully satisfied? → Good
        ⚠️  Partially? → Continue work!
        ❌ Not satisfied? → Continue work!
STEP 4: Only commit when 100% complete
```

**Red Flags** (Incomplete Work):
```
User says:
  🚨 "still missing..."
  🚨 "haven't tested everything"
  🚨 "còn thiếu" (Vietnamese: still missing)
  🚨 "need to check more"

When you see these: DON'T COMMIT! Continue working.
```

**Activation**:
```bash
npx ai-workflow activate universal-006
```

**Proven Effectiveness**:
```
Prevents: Premature commits (partial work)
Ensures: 100% requirement satisfaction
User feedback: "Complete solutions, not partial fixes"
```

---

## RULE-UNIVERSAL-007: 100% Test Plan Execution Required

**Applicability**: 90% (projects with test plans)

**The Rule**:
ALL tests in a test plan MUST be executed (100% coverage for P0/P1 tests) before committing. Cannot skip tests due to time pressure or "looks good enough".

**Why This Rule Exists**:
- Partial testing creates false confidence
- Skipped tests = unknown bugs
- UX tests are P1 priority, not "nice to have"
- User finds skipped tests' bugs ("still has bugs")

**The Problem Pattern**:
```
✅ Functional tests (1-8):   100% → Bugs found & fixed
❌ Mobile tests (9-12):      0%   → Bugs unknown
❌ UX tests (13-15):         0%   → Bugs escaped!

Result: "Fixed!" → User: "still has bugs" 😞
```

**What Counts as "Executed"**:
```
✅ Test executed = Evidence provided:
   - Screenshot/video for visual tests
   - Console output for functional tests
   - Metrics documented
   - Pass/fail result recorded

❌ Test NOT executed:
   - "Looks good" without verification
   - Assumed to work
   - Skipped due to time
   - "Will test later" (= never)
```

**Priority-Based Requirements**:
```
P0 (Critical): 100% execution - NO EXCEPTIONS
P1 (High):     100% execution - NO EXCEPTIONS
P2 (Medium):   80% acceptable
P3 (Low):      Can skip if time constrained
```

**Actions**:
```bash
DURING test planning:
1. ✅ Assign priority (P0/P1/P2/P3) to each test
2. ✅ Mark MANDATORY tests

DURING execution:
3. ✅ Track status (pending/passed/failed/skipped)
4. ✅ Document evidence

BEFORE commit:
5. ✅ Verify 100% P0/P1 executed
6. ✅ If any P0/P1 skipped → CANNOT COMMIT
```

**Common Excuses** (REJECTED):
```
❌ "Functional passed, should be good"
   NO: UX tests are P1, must test

❌ "Mobile looks similar, probably works"
   NO: Must verify, don't assume

❌ "Running out of time, later"
   NO: Later = never. Test now or don't commit.
```

**Activation**:
```bash
npx ai-workflow activate universal-007
```

**Proven Effectiveness**:
```
Applied: md2social QA analysis
Problem: 40% test coverage → bugs escaped
Solution: 100% P0/P1 → all bugs found
Impact: Zero "still has bugs" feedback
```

---

## RULE-UNIVERSAL-008: E2E User Journey Tests MANDATORY

**Applicability**: 100% (all projects with features)

**The Rule**:
Before declaring ANY feature "complete", must have end-to-end test covering the full user journey (start → work → complete).

**Why This Rule Exists**:
- Unit tests check components in isolation
- E2E tests verify full user journey works
- User found P0 bug in 5 min that unit tests (81% coverage) missed
- Integration gaps hide at component boundaries
- "High coverage" ≠ "Actually works end-to-end"

**The Problem**:
```
We had:
  ✅ Unit tests: 81% coverage (excellent!)
  ✅ Components work individually
  ❌ E2E tests: 0%
  ❌ Full journey: Broken!

Result: High coverage but incomplete functionality!

Gap: Tests verified existing code, not missing features.
```

**Actions Required**:
```bash
For EVERY feature:

STEP 1: Map User Journey
  - How does user START?
  - How does user PROGRESS?
  - How does user COMPLETE?
  - How does user CLEANUP?

STEP 2: Write E2E Test
  - Test full journey (start → end)
  - Include all steps user would take
  - Verify user can complete workflow

STEP 3: E2E Test Must Pass
  - Before declaring "complete"
  - If fails → Feature incomplete!

STEP 4: Then Ship
  - E2E passing = User can succeed
  - No E2E test = Don't know if it works
```

**Test Balance** (Industry Standard):
```
70% Unit tests (components)
20% Integration tests (boundaries)
10% E2E tests (user journeys)

Don't have: 100% unit, 0% integration, 0% E2E
Balance is critical!
```

**Example E2E Test**:
```typescript
describe('Complete User Journey', () => {
  it('user can create, work on, complete task', async () => {
    // 1. Create
    await create('Test task');
    expect(state.status).toBe('in_progress'); ✅
    
    // 2. Progress
    await update('--state', 'CODE_WRITTEN');
    expect(state.currentState).toBe('CODE_WRITTEN'); ✅
    
    // 3. Complete
    await complete();  ← Would have FAILED if missing!
    expect(state.status).toBe('completed'); ✅
    
    // 4. Cleanup
    await clear();
    expect(state).toBeNull(); ✅
  });
});

This catches: Missing commands, broken workflows!
```

**Activation**:
```bash
npx ai-workflow activate universal-008
```

**Proven Effectiveness**:
```
Caught: P0 bug (task completion missing)
When: Before npm publish
Saved: Reputation + 1000s of users
ROI: Priceless!
```

---

## RULE-UNIVERSAL-009: API Symmetry Check REQUIRED

**Applicability**: 100% (all APIs/CLIs)

**The Rule**:
For every CREATE/OPEN/START/INIT operation, must have matching DELETE/CLOSE/COMPLETE/DESTROY operation. Asymmetric APIs are incomplete and must not ship.

**Why This Rule Exists**:
- Users need to complete workflows, not just start them
- Asymmetric APIs frustrate users (can start but not finish)
- Missing completion = memory leaks, orphaned resources
- Completeness = Professional quality

**The Symmetry Principle**:
```
✅ Good (Symmetric):
  create  ↔ delete
  open    ↔ close
  start   ↔ stop
  init    ↔ destroy
  begin   ↔ end
  acquire ↔ release

❌ Bad (Asymmetric):
  create  ↔ (missing delete)
  open    ↔ (missing close)
  
User: "How do I finish?" → Frustrated!
```

**Common Violations**:
```
Task Management (Before Fix):
  ✅ task create  (can create)
  ✅ task status  (can check)
  ❌ task complete (MISSING!) ← P0 Bug!
  ❌ task clear    (MISSING!)

File Operations:
  ✅ file open
  ❌ file close (missing)

Resource Allocation:
  ✅ resource acquire
  ❌ resource release (missing)

All asymmetric = Incomplete!
```

**Actions**:
```bash
For EVERY API/CLI:

STEP 1: List All "Start" Operations
  - create, open, start, init, begin, acquire, etc.

STEP 2: For Each Start → Check End
  - Does matching end operation exist?
  - create → delete?
  - open → close?

STEP 3: If Asymmetric
  - Implement missing operation
  - Test full lifecycle
  - Document both operations

STEP 4: Lifecycle Test
  - start → work → end
  - Verify user can complete journey
```

**Checklist**:
```markdown
For API/CLI Completeness:

✅ Every CREATE has DELETE
✅ Every OPEN has CLOSE
✅ Every START has STOP/COMPLETE
✅ Every INIT has DESTROY/CLEANUP
✅ Every BEGIN has END
✅ Every ACQUIRE has RELEASE

If ANY missing: API incomplete!
```

**Activation**:
```bash
npx ai-workflow activate universal-009
```

**Proven Effectiveness**:
```
Caught: task complete/clear missing
Impact: P0 bug before ship
Lesson: Symmetry = Completeness
```

---

## RULE-UNIVERSAL-010: User Testing Before Production Tag

**Applicability**: 90% (projects shipping to users)

**The Rule**:
NEVER tag as "production-ready" (v1.x.x) without real user testing. At least 1 user must test in real project before production release.

**Why This Rule Exists**:
- Internal testing has blind spots (think like builders, not users)
- User testing finds bugs 10x faster (5 min vs hours)
- Publishing broken v1.0.0 = reputation damage
- User validation is final quality gate

**What Almost Happened** (Without):
```
Week 1: npm publish v1.0.0
Week 1: 1,000 developers install
Week 1: 800 try to use it
Week 1: 600 find: "Can't complete tasks!" 🚨
Week 1: GitHub: 500+ angry issues
Week 1: Twitter: "This package is broken!"
Week 1: Reputation: DESTROYED
Week 1: Trust: Lost forever

Damage: Irreversible
```

**What Actually Happened** (With Testing):
```
Private Beta: 1 user (real project)
User testing: 5 minutes
Bug found: P0 critical
Fix: Hotfix before npm publish
Users affected: 1 (contained!)
Reputation: SAVED ✅

Difference: Private testing saved us!
```

**User Testing Protocol**:
```markdown
MANDATORY Before v1.0.0:

PHASE 1: Dogfooding (ourselves)
  Duration: 1-2 days
  Goal: Find obvious bugs

PHASE 2: Private Beta (1-3 users) ← CRITICAL!
  Duration: 1-2 weeks
  Projects: REAL (not demos)
  Goal: Find integration bugs
  
  User Actions:
    ✅ Install in real project
    ✅ Use for actual work
    ✅ Report ALL issues
    ✅ Complete full workflows
  
  Fix P0/P1 bugs immediately!

PHASE 3: Public Beta
  Duration: 2-4 weeks
  Tag: npm publish --tag beta
  Goal: Scale testing

PHASE 4: Production
  Only after: All P0/P1 fixed
  User validation: Complete
  Confident: It works!
```

**Actions**:
```bash
Before v1.0.0:

1. ✅ Recruit 1-3 beta testers
2. ✅ Real projects (not demos)
3. ✅ Wait for feedback (min 1 week)
4. ✅ Fix ALL P0/P1 bugs
5. ✅ Re-test
6. ✅ Get confirmation: "It works!"
7. ✅ THEN tag v1.0.0

Cannot skip steps 3-6!
```

**Enforcement**:
```
v0.x.x = Alpha (until user-validated)
npm --tag beta (until user-validated)
v1.x.x only after user confirms: Works!
```

**User Feedback ROI**:
```
Investment: 5 min of user's time
Return:
  - P0 bug caught early
  - $5,000+ reputation saved
  - 20+ hours support saved
  - Trust maintained

ROI: Priceless! ✅
```

**Activation**:
```bash
npx ai-workflow activate universal-010
```

**Proven Effectiveness**:
```
Applied: ai-workflow-engine v1.x
Result: P0 caught before npm publish
Impact: Disaster averted
```

---

## RULE-UNIVERSAL-011: Feature Completeness > Feature Count

**Applicability**: 100% (all projects)

**The Rule**:
A feature is only "complete" when ≥90% completeness score across all dimensions (Implementation + Testing + Documentation + Validation). Better to ship 10 complete features than 30 incomplete ones.

**Why This Rule Exists**:
- High feature count with low completeness = False advertising
- Half-done features frustrate users MORE than missing features
- Users expect "production-ready" means it works
- Quality > Quantity

**Completeness Formula**:
```
Score = (Implementation + Testing + Documentation + Validation) / 4

Where each dimension: 0% (not started) → 100% (complete)

Example - Task Management (Before):
  Implementation: 50% (create+status exist, update+complete missing)
  Testing: 80% (unit tests only)
  Documentation: 60% (partial)
  Validation: 100% (user tested, found bug!)
  
  Score: (50 + 80 + 60 + 100) / 4 = 72.5% ← INCOMPLETE!

After Fix:
  Implementation: 100% (all 4 commands)
  Testing: 80% (+ E2E tests)
  Documentation: 80% (+ journey docs)
  Validation: 100% (user validated)
  
  Score: (100 + 80 + 80 + 100) / 4 = 90% ✅ COMPLETE!

Threshold: ≥90% = Complete, <90% = Incomplete
```

**Actions**:
```markdown
For EACH feature:

STEP 1: Calculate Score
  - Implementation: What % exists?
  - Testing: What % of test types?
  - Documentation: What % documented?
  - Validation: User-tested?

STEP 2: If Score < 90%
  - Feature is INCOMPLETE
  - Mark as "Beta" or "In Progress"
  - Do NOT claim "production-ready"
  - Finish it OR remove from list

STEP 3: Shipping Decision
  Better: 10 features at 100%
  Than: 30 features at 70%
  
  Quality > Quantity!
```

**Version Strategy**:
```
v0.x.x = Alpha
  Completeness: 50-70%
  For: Internal testing

v0.9.x-beta = Beta
  Completeness: 70-90%
  For: User testing

v1.0.0 = Production
  Completeness: ≥90%
  User-validated ✅
```

**Bad vs Good**:
```
❌ Bad:
  "30+ features, v1.0.0!"
  Reality: 18 complete, 12 half-done
  User: Tries feature → Half works → Frustrated

✅ Good:
  "18 complete, 12 in beta (v0.9.5)"
  Reality: Transparent
  User: Complete features work perfectly ✅
```

**Enforcement**:
```
Calculate score before versioning
v1.x.x requires ≥90% completeness
Document incomplete features clearly
```

**Activation**:
```bash
npx ai-workflow activate universal-011
```

**Proven Effectiveness**:
```
Prevents: Premature "production" claims
Ensures: Honest feature status
User trust: Maintained through transparency
```

---

## How to Use These Rules

### Activate All Universal Rules:
```bash
npx ai-workflow activate-all universal
```

### Activate Specific Rule:
```bash
npx ai-workflow activate universal-001
```

### Check Active Rules:
```bash
npx ai-workflow list-rules
```

### Deactivate Rule (if not needed):
```bash
npx ai-workflow deactivate universal-001
```

---

**Note**: These rules have 95-100% applicability across projects. Safe to activate in ANY project type!

