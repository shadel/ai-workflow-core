# TESTING State - Behavior Rules

**Current State:** TESTING (Step 4 of 6)  
**Purpose:** Write comprehensive tests for implemented code  
**Previous:** IMPLEMENTING (code written)  
**Next State:** REVIEWING

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ ALLOWED ACTIONS

### Test Writing
1. ✅ Write unit tests for all new code
2. ✅ Write integration tests
3. ✅ Write end-to-end tests if applicable
4. ✅ Test edge cases and error scenarios
5. ✅ Create test utilities and helpers
6. ✅ Add test fixtures and mocks

### Test Execution
7. ✅ Run test suites
8. ✅ Verify all tests passing
9. ✅ Check test coverage
10. ✅ Debug failing tests
11. ✅ Fix test-specific issues

### Code Adjustments (Test-Related Only!)
12. ✅ Fix bugs discovered by tests
13. ✅ Adjust code to make testable
14. ✅ Add test IDs or data-testid attributes
15. ✅ Export functions needed for testing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚫 FORBIDDEN ACTIONS

### Code Changes (Tests Only!)
1. 🚫 Adding new features (test existing features!)
2. 🚫 Major refactoring (outside test scope)
3. 🚫 Changing architecture

### Commits (Need Review!)
4. 🚫 Making commits (review comes next!)
5. 🚫 Suggesting commits before review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 PROGRESSION PROTOCOL

When tests are complete and passing:

1. **Show Test Results**
   ```
   Tests complete:
   
   Test files created:
   - [Test file 1]: X tests
   - [Test file 2]: Y tests
   
   Coverage:
   - Lines: XX%
   - Functions: YY%
   - Branches: ZZ%
   
   All tests: ✅ PASSING
   ```

2. **Request Permission**
   ```
   "All tests written and passing.
    
    May I progress to REVIEW_COMPLETE for code review?"
   ```

3. **Progress State**
   ```
   run_terminal_cmd('npx ai-workflow sync --state REVIEW_COMPLETE')
   ```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Minimum Coverage:** 70-80% for critical code
**Test Types:** Unit + Integration required
**All Tests Must Pass:** Before progressing!




