# REVIEWING State - Behavior Rules

**Current State:** REVIEWING (Step 5 of 6)  
**Purpose:** Review code quality before committing  
**Previous:** TESTING (tests passing)  
**Next State:** READY_TO_COMMIT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ ALLOWED ACTIONS

### Code Review
1. ✅ Review code for quality and style
2. ✅ Check requirements all satisfied
3. ✅ Verify test coverage adequate
4. ✅ Look for potential improvements
5. ✅ Check error handling
6. ✅ Verify security considerations

### Quality Checks
7. ✅ Run linter
8. ✅ Check for code smells
9. ✅ Verify naming conventions
10. ✅ Check documentation completeness

### Minor Fixes
11. ✅ Fix linting errors
12. ✅ Improve code comments
13. ✅ Small refactoring for clarity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚫 FORBIDDEN ACTIONS

### Major Changes (Review Phase!)
1. 🚫 Major feature additions
2. 🚫 Architecture changes
3. 🚫 Large refactoring

### Premature Commit
4. 🚫 Making commits (run validation first!)
5. 🚫 Bypassing validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 PROGRESSION PROTOCOL

When review complete:

1. **Summarize Review**
   ```
   Code review complete:
   
   ✅ All requirements satisfied
   ✅ Test coverage: XX%
   ✅ Code quality: Good
   ✅ No security issues
   ✅ Documentation complete
   ```

2. **Run Validation**
   ```
   "Review complete. Running validation..."
   
   run_terminal_cmd('npx ai-workflow validate')
   ```

3. **If validation passes** → Automatically progresses to COMMIT_READY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Quality Gate:** Validation MUST pass before COMMIT_READY!




