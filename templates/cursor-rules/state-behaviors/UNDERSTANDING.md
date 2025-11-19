# UNDERSTANDING State - Behavior Rules

**Current State:** UNDERSTANDING (Step 1 of 6)  
**Purpose:** Fully understand requirements before designing solution  
**Next State:** DESIGN_COMPLETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ ALLOWED ACTIONS (ONLY These!)

### Questions & Clarification
1. ✅ Ask clarifying questions about requirements
2. ✅ Request examples or use cases from user
3. ✅ Ask about edge cases and error scenarios
4. ✅ Confirm acceptance criteria
5. ✅ Ask about non-functional requirements (performance, security, scalability)
6. ✅ Verify assumptions with user
7. ✅ Request clarification on ambiguous points

### Analysis (Read-Only Operations)
8. ✅ Read existing code for context (using read_file tool)
9. ✅ Analyze current implementation (read-only)
10. ✅ Review related files and documentation
11. ✅ Search codebase for similar patterns (using codebase_search)
12. ✅ Examine test files to understand expected behavior
13. ✅ Read configuration files

### Documentation (Information Gathering)
14. ✅ Take notes about requirements (in your response)
15. ✅ List assumptions that need verification
16. ✅ Document ambiguities found
17. ✅ Create requirement checklist
18. ✅ Summarize understanding for user review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚫 STRICTLY FORBIDDEN ACTIONS (NEVER Do These!)

### Code Changes (ABSOLUTELY BLOCKED!)
1. 🚫 Writing ANY code files (.ts, .js, .tsx, .jsx, .py, .java, etc.)
2. 🚫 Modifying ANY existing code files
3. 🚫 Creating new components, classes, functions, modules
4. 🚫 Refactoring existing code
5. 🚫 Fixing bugs in code (understand first, fix at IMPLEMENTATION!)
6. 🚫 Implementing ANY features
7. 🚫 Adding ANY business logic

### File Operations (BLOCKED!)
8. 🚫 Creating new files (except documentation notes in docs/)
9. 🚫 Deleting any files
10. 🚫 Moving or renaming files
11. 🚫 Editing configuration files (package.json, tsconfig.json, etc.)
12. 🚫 Modifying build scripts

### Build, Test & Deploy (BLOCKED!)
13. 🚫 Running build commands (npm run build, tsc, webpack, etc.)
14. 🚫 Running test suites (npm test, jest, etc.)
15. 🚫 Writing test files
16. 🚫 Installing or updating packages (npm install)
17. 🚫 Deploying code

### Git Operations (BLOCKED!)
18. 🚫 Making git commits
19. 🚫 Suggesting commit messages
20. 🚫 Staging files (git add)
21. 🚫 Creating branches

### Premature Decisions (BLOCKED!)
22. 🚫 Making architecture decisions (design phase is NEXT!)
23. 🚫 Choosing specific implementations (premature!)
24. 🚫 Selecting libraries or frameworks (design first!)
25. 🚫 Deciding on database schemas (design phase!)
26. 🚫 Planning API endpoints (design phase!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 HOW TO PROGRESS TO NEXT STATE

When requirements are FULLY understood, follow this protocol:

### Step 1: Summarize Your Understanding

Present to user:
```
I have understood the requirements:

Requirements:
- [Requirement 1 with details]
- [Requirement 2 with details]
- [...]

Acceptance Criteria:
- [Criterion 1]
- [Criterion 2]
- [...]

Edge Cases Identified:
- [Edge case 1]
- [Edge case 2]
- [...]

Assumptions:
- [Assumption 1]
- [Assumption 2]
- [...]

Open Questions (if any):
- [Question 1]
- [Question 2]
```

### Step 2: Request Permission to Progress

Ask user explicitly:
```
"Understanding phase complete. All requirements clear.

May I progress to DESIGN_COMPLETE state to design the solution?"
```

### Step 3: Wait for User Approval

- If user says "Yes" → Proceed to Step 4
- If user says "No" or asks questions → Answer and refine understanding
- If user raises new points → Incorporate and re-summarize

### Step 4: Progress State (Only After Approval!)

```
run_terminal_cmd('npx ai-workflow sync --state DESIGN_COMPLETE')
```

### Step 5: Confirm State Change

After state change:
```
"✅ Progressed to DESIGN_COMPLETE state.
 Now I can design the solution architecture.
 
 Let me propose the design..."
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💡 UNDERSTANDING State - Best Practices

### What Good UNDERSTANDING Looks Like

**Characteristics:**
- Thorough questioning (ask 5-10+ clarifying questions)
- No assumptions (verify everything)
- Edge cases identified (think through scenarios)
- Requirements documented clearly
- User confirms understanding before proceeding

**Time Investment:**
- Simple tasks: 5-15 minutes of Q&A
- Complex tasks: 30-60 minutes of analysis
- Critical tasks: Multiple rounds of clarification

**Output:**
- Clear requirement document (in your response)
- User approval: "Yes, you understand correctly"
- Ready to design with confidence

### What Bad UNDERSTANDING Looks Like (Violations!)

**Characteristics:**
- Jumps straight to coding ❌
- Makes assumptions without asking ❌
- Skips clarification questions ❌
- Implements before understanding ❌

**This is what we're trying to PREVENT!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📚 EXAMPLES

### Example 1: Correct Behavior

User: "Add dark mode to the app"

✅ GOOD Response at UNDERSTANDING:
```
✓ State: UNDERSTANDING (Step 1/6) - Understanding requirements

I'm at UNDERSTANDING state. Let me understand requirements:

1. Where should dark mode apply? (Entire app or specific pages?)
2. Should it persist user preference? (localStorage, database?)
3. Toggle UI - where should it be located?
4. Color scheme - do you have specific colors? Or use standard dark theme?
5. Should it respect system preference (prefers-color-scheme)?
6. Any accessibility requirements? (contrast ratios, etc.)
7. Should existing users default to light or dark?

Once requirements clear, I'll design the solution (Step 2).
```

❌ BAD Response at UNDERSTANDING:
```
I'll implement dark mode now.

Creating theme context...
[Writes code] ← VIOLATION! Can't code at UNDERSTANDING!
```

---

### Example 2: Progressing Correctly

User answers all questions satisfactorily.

✅ GOOD Next Response:
```
Thank you for the clarifications!

Summary:
- Dark mode applies to entire app
- Preference saved in localStorage
- Toggle in header navbar
- Uses Tailwind dark: classes
- Respects system preference on first visit
- WCAG AA contrast compliance

Understanding complete.

May I progress to DESIGN_COMPLETE state to design the implementation?
```

Wait for user: "Yes"

Then:
```
run_terminal_cmd('npx ai-workflow sync --state DESIGN_COMPLETE')

✅ Progressed to DESIGN_COMPLETE.

Now designing the solution:
1. Create ThemeContext with React Context API
2. ThemeProvider wrapper in App.tsx
3. useTheme hook for components
4. Toggle component in Header
...
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ⚠️ SELF-CHECK BEFORE EVERY ACTION

Before responding to ANY user request, ask yourself:

**Q1:** What state am I at?  
**A:** UNDERSTANDING

**Q2:** What does user want me to do?  
**A:** [Parse user request]

**Q3:** Is this action in my ALLOWED list above?  
**A:** Check the ✅ ALLOWED section

**Q4:** Is this action in my FORBIDDEN list above?  
**A:** Check the 🚫 FORBIDDEN section

**Decision:**
- If ALLOWED → Proceed
- If FORBIDDEN → STOP! Explain why I can't, suggest understanding first
- If unsure → Ask for clarification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Last Updated:** Auto-generated per task  
**Maintained By:** AI Workflow Engine  
**Purpose:** Enforce proper workflow state behavior

**Remember:** You are at UNDERSTANDING. Your ONLY job is to UNDERSTAND fully!




