# READY_TO_COMMIT State - Behavior Rules

**Current State:** READY_TO_COMMIT (Step 6 of 6 - FINAL!)  
**Purpose:** Commit validated work  
**Previous:** REVIEWING (validation passed)  
**Next Step:** Task completion

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ ALLOWED ACTIONS

### Commit Operations
1. ✅ Suggest commit message (with task reference)
2. ✅ Stage files (git add)
3. ✅ Make git commit
4. ✅ Complete task after commit

### Final Checks
5. ✅ Verify all files staged
6. ✅ Verify commit message includes @task reference
7. ✅ Confirm validation passed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚫 FORBIDDEN ACTIONS

### Bypassing Quality Gates
1. 🚫 Using --no-verify flag (bypasses validation!)
2. 🚫 Committing without running validation first
3. 🚫 Skipping pre-commit hooks

### Poor Practices
4. 🚫 Vague commit messages
5. 🚫 Forgetting @task reference
6. 🚫 Committing work-in-progress

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 FINAL STEPS

1. **Suggest Commit**
   ```
   "Validation passed! Ready to commit:
    
    git add .
    git commit -m \"feat: Implement user authentication
    
    - Added AuthContext and useAuth hook
    - Implemented JWT token handling
    - Added login/register forms
    - Added protected route component
    - Test coverage: 85%
    
    @task task-XXXXX\""
   ```

2. **After Commit - Complete Task**
   ```
   run_terminal_cmd('npx ai-workflow task complete')
   
   If task just completed:
     "✅ Task completed!"
     
   If task already completed:
     "✅ Task already completed!" (Exit 0 - not an error!)
     Shows: Task info, duration, suggestion for new task
   ```
   
   **Important:** Task can be completed ONCE. If already completed, 
   system shows friendly confirmation (v2.1.5+)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Final State:** Work is done, tested, reviewed, and ready to ship!


