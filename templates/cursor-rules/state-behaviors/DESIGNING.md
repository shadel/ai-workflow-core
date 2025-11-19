# DESIGNING State - Behavior Rules

**Current State:** DESIGNING (Step 2 of 6)  
**Purpose:** Design solution architecture before implementation  
**Previous:** UNDERSTANDING (requirements understood)  
**Next State:** IMPLEMENTING

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ ALLOWED ACTIONS

### Solution Design
1. ✅ Propose solution architecture and approach
2. ✅ Design component structure and interactions
3. ✅ Create system diagrams or pseudocode
4. ✅ Plan implementation steps
5. ✅ Identify files/modules that need creation/modification
6. ✅ Design data models and schemas
7. ✅ Plan API endpoints and contracts
8. ✅ Document design decisions and rationale

### Technical Planning
9. ✅ Select appropriate libraries/frameworks
10. ✅ Choose design patterns to use
11. ✅ Plan error handling strategy
12. ✅ Design state management approach
13. ✅ Plan testing strategy

### Documentation
14. ✅ Write design documentation
15. ✅ Create architecture diagrams (as markdown/text)
16. ✅ Document trade-offs and alternatives considered

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚫 FORBIDDEN ACTIONS

### Implementation (Too Early!)
1. 🚫 Writing production code (design approved first!)
2. 🚫 Implementing features
3. 🚫 Creating actual components/modules
4. 🚫 Refactoring existing code

### Testing (No Code Yet!)
5. 🚫 Writing test files
6. 🚫 Running tests
7. 🚫 Test implementation

### Build & Deploy
8. 🚫 Running build commands
9. 🚫 Installing packages (list them in design, install at IMPLEMENTATION)
10. 🚫 Making commits

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 PROGRESSION PROTOCOL

When design is complete:

1. **Present Design to User**
   ```
   Design proposal:
   
   Architecture:
   - [Component 1: Purpose and responsibilities]
   - [Component 2: ...]
   
   Implementation Plan:
   - Step 1: [...]
   - Step 2: [...]
   
   Files to create/modify:
   - [File 1]
   - [File 2]
   
   Dependencies needed:
   - [Package 1]
   - [Package 2]
   ```

2. **Request Approval**
   ```
   "Design complete. Does this approach look good?
    May I progress to IMPLEMENTATION_COMPLETE to write code?"
   ```

3. **Progress State**
   ```
   run_terminal_cmd('npx ai-workflow sync --state IMPLEMENTATION_COMPLETE')
   ```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💡 EXAMPLE

User request: "Add user authentication" (requirements understood in UNDERSTANDING state)

✅ GOOD Response at DESIGN_COMPLETE:
```
✓ State: DESIGN_COMPLETE (Step 2/6) - Designing solution

Based on requirements understood, here's the design:

Architecture:
1. AuthContext (React Context for auth state)
2. AuthProvider component (wraps app)
3. useAuth hook (for components)
4. authService (API calls)
5. Protected Route component

Implementation approach:
- JWT tokens stored in httpOnly cookies
- Refresh token rotation
- Auth state in Context API
- Login/Register forms with validation

Files to create:
- src/contexts/AuthContext.tsx
- src/hooks/useAuth.ts
- src/services/authService.ts
- src/components/ProtectedRoute.tsx

Dependencies:
- jwt-decode for token parsing
- react-hook-form for forms

Design approved? May I implement?
```

❌ BAD Response: Jumps to coding without showing design first!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Purpose:** Ensure solution is well-designed before implementation begins!




