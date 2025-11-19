# IMPLEMENTING State - Behavior Rules

**Current State:** IMPLEMENTING (Step 3 of 6)  
**Purpose:** Implement solution according to approved design  
**Previous:** DESIGNING (design approved)  
**Next State:** TESTING

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ ALLOWED ACTIONS

### Code Implementation
1. ✅ Write production code files
2. ✅ Implement features per approved design
3. ✅ Create new components, classes, functions
4. ✅ Modify existing files as per design
5. ✅ Refactor code following design plan
6. ✅ Fix bugs discovered during implementation
7. ✅ Add error handling and validation

### File Operations
8. ✅ Create new files per design
9. ✅ Modify configuration if needed (package.json, tsconfig, etc.)
10. ✅ Install dependencies listed in design
11. ✅ Update imports and exports

### Development
12. ✅ Run build to check compilation errors
13. ✅ Fix TypeScript/linting errors
14. ✅ Add code comments and documentation
15. ✅ Follow coding standards and style guide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚫 FORBIDDEN ACTIONS

### Testing (Next Step!)
1. 🚫 Writing test files (TESTING_COMPLETE phase is NEXT!)
2. 🚫 Running full test suites
3. 🚫 Creating test utilities (tests come next!)

### Commits (Not Ready!)
4. 🚫 Making git commits (need tests first!)
5. 🚫 Suggesting commits
6. 🚫 Claiming work is "done" (tests required!)

### Design Changes (Need Approval!)
7. 🚫 Changing approved design without discussion
8. 🚫 Adding features not in design
9. 🚫 Using different architecture than approved

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 PROGRESSION PROTOCOL

When implementation is complete:

1. **Summarize Implementation**
   ```
   Implementation complete:
   
   Files created:
   - [File 1 with summary]
   - [File 2 with summary]
   
   Features implemented:
   - [Feature 1]
   - [Feature 2]
   
   Build status: ✅ Compiles successfully
   ```

2. **Request Permission**
   ```
   "Implementation complete per design.
    
    May I progress to TESTING_COMPLETE to write comprehensive tests?"
   ```

3. **Progress State**
   ```
   run_terminal_cmd('npx ai-workflow sync --state TESTING_COMPLETE')
   ```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💡 EXAMPLE

✅ GOOD Behavior at IMPLEMENTATION_COMPLETE:
```
✓ State: IMPLEMENTATION_COMPLETE (Step 3/6) - Writing code per design

Implementing authentication system per approved design:

[Creates AuthContext.tsx]
[Creates useAuth.ts]
[Creates authService.ts]
[Installs jwt-decode]

Implementation complete. Build passing.
May I write tests next?
```

❌ BAD: Makes commit without tests, or skips to production!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Remember:** Tests are MANDATORY before commits!




