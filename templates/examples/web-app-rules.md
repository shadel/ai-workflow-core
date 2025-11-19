# Web Application Rules

**Purpose**: Rules specific to web applications (React, Vue, Angular, Next.js, etc.)  
**Applicability**: ~20% of projects (web apps with UI)  
**Usage**: Activate if building web application

---

## RULE-WEB-001: Browser Testing MANDATORY for UI Changes

**Applicability**: Web apps with UI

**The Rule**:
For ANY UI-related changes (components, styles, layouts), browser testing is MANDATORY and CANNOT be skipped.

**Why This Rule Exists**:
- Code can look correct but render wrong
- User sees browser, not code
- Multiple layers (data + render) can have bugs

**Actions Required**:
```bash
For EVERY UI change:
1. ✅ Navigate to page in browser
2. ✅ Verify visual changes match expectations
3. ✅ Take screenshot as evidence
4. ✅ Document what user actually sees
5. ✅ Compare with expected behavior
```

**Examples**:

✅ **Good**:
```
UI bug fix workflow:
1. Fix code ✅
2. Navigate: http://localhost:3000/page ✅
3. Verify visually ✅
4. Screenshot evidence ✅
5. Document results ✅
6. THEN mark as fixed ✅
```

❌ **Bad**:
```
UI bug fix workflow:
1. Fix code ✅
2. Assume it works ❌
3. Mark as fixed ❌ ← No browser verification!
```

**Activation**:
```bash
npx ai-workflow activate web-001
```

---

## RULE-WEB-002: Mobile-First Testing MANDATORY

**Applicability**: Responsive web apps

**The Rule**:
For ALL UI changes, mobile testing MUST be executed FIRST, before desktop testing.

**Why This Rule Exists**:
- Mobile has stricter constraints (small screen, touch targets)
- Mobile bugs don't always appear on desktop
- 60%+ users access via mobile

**Actions Required**:
```markdown
STEP 1: Mobile Testing (375x667) - MANDATORY
✅ Resize browser to mobile
✅ Test all interactions (touch-friendly?)
✅ Verify touch targets ≥ 44px
✅ Check text readability
✅ Navigation works
✅ Layout doesn't break

STEP 2: Desktop Testing (1280x720) - MANDATORY  
✅ Test on desktop
✅ Verify consistency with mobile

STEP 3: Cross-Platform Comparison
✅ Same functionality on both?
✅ No features missing on mobile?
```

**Device Sizes**:
```javascript
P0 (Must test):
- Mobile: 375x667 (iPhone SE)
- Desktop: 1280x720

P1 (Should test):
- Mobile Large: 414x896 (iPhone Pro Max)
- Tablet: 768x1024 (iPad)
```

**Activation**:
```bash
npx ai-workflow activate web-002
```

---

## RULE-WEB-003: Layout Containment Validation

**Applicability**: Web apps with complex layouts

**The Rule**:
For EVERY component rendering or layout change, MUST verify component stays within designated container boundaries.

**Why This Rule Exists**:
- Transform scale can use wrong reference dimension
- Components can overflow and overlap sidebars
- Visual bugs invisible in code review

**Actions Required**:
```javascript
// Browser console validation:
const component = document.querySelector('[YOUR_SELECTOR]');
const parent = component.parentElement;

const compRect = component.getBoundingClientRect();
const parentRect = parent.getBoundingClientRect();

const leftOverhang = compRect.left < parentRect.left ? 
  parentRect.left - compRect.left : 0;
const rightOverhang = compRect.right > parentRect.right ? 
  compRect.right - parentRect.right : 0;

console.log({
  containment: leftOverhang === 0 && rightOverhang === 0 ? 
    "✅ CONTAINED" : "❌ OVERLAP DETECTED",
  leftOverhang,
  rightOverhang
});

// BLOCKING if overhang > 0!
```

**Activation**:
```bash
npx ai-workflow activate web-003
```

---

## RULE-WEB-004: Accessibility Check (WCAG AA)

**Applicability**: All web apps

**The Rule**:
All UI components must meet WCAG AA standards (color contrast, keyboard navigation, screen reader support).

**Why This Rule Exists**:
- Legal requirement in many jurisdictions
- Better UX for all users
- SEO benefits

**Actions Required**:
```markdown
For NEW components:
1. ✅ Color contrast ≥ 4.5:1 (text)
2. ✅ Color contrast ≥ 3:1 (UI elements)
3. ✅ Keyboard navigation works
4. ✅ Focus indicators visible
5. ✅ Screen reader compatible (ARIA labels)
6. ✅ Alt text for images
```

**Tools**:
- Chrome DevTools Lighthouse
- axe DevTools
- WAVE browser extension

**Activation**:
```bash
npx ai-workflow activate web-004
```

---

## RULE-WEB-005: Performance Budget

**Applicability**: Production web apps

**The Rule**:
Page load time must be < 3 seconds on 3G, First Contentful Paint < 1.5s.

**Why This Rule Exists**:
- User experience
- SEO ranking
- Conversion rates

**Actions Required**:
```bash
# Measure performance:
npm run build
npm run lighthouse

# Thresholds:
- First Contentful Paint: < 1.5s ✅
- Largest Contentful Paint: < 2.5s ✅
- Time to Interactive: < 3.8s ✅
- Total Blocking Time: < 200ms ✅
```

**Activation**:
```bash
npx ai-workflow activate web-005
```

---

## How to Use Web App Rules

### Activate All Web Rules:
```bash
npx ai-workflow activate-all web-app
```

### Activate Specific Rules:
```bash
npx ai-workflow activate web-001 web-002
```

### Check Active Web Rules:
```bash
npx ai-workflow list-rules --filter web
```

---

**Note**: Only activate these if building a web application with UI!

