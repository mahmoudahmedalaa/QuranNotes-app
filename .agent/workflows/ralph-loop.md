---
description: Use this workflow when a feature fails type-checks, lint, or builds. Forces self-correction until verified clean. Every command marked // turbo is safe to auto-run.
---

# The Ralph Loop Protocol — QuranNotes

> **You are NOT done until Ralph says you're done.**
> Ralph = TypeScript compiler + linter + build system.

---

## When to Enter the Ralph Loop

Enter this loop:
- After implementing any new feature or screen
- After refactoring existing code
- After adding/updating dependencies
- After modifying types or database schema
- Before declaring ANY task complete

---

## The Loop

### Step 1: Type Check
```bash
npx tsc --noEmit
```
// turbo

**If errors:**
- Read EVERY error line. Do not skim.
- Fix the root cause, not the symptom.
- Common traps:
  - Missing `null` checks → add proper narrowing
  - Wrong return types → check the actual function signature
  - Import path issues → verify file exists at that path
  - Generic `any` leaking → type it properly

### Step 2: Lint
```bash
npx expo lint 2>&1 | head -50
```
// turbo

**If warnings/errors:**
- Fix ALL warnings, not just errors
- `no-unused-vars` → remove dead code, don't comment it out
- `react-hooks/exhaustive-deps` → fix the dependency array, don't disable the rule

### Step 3: Build Verification (on significant changes)
```bash
# Only needed for: new screens, navigation changes, native module additions
npx expo export --platform ios 2>&1 | tail -20
```
// turbo

**If build fails:**
- Read the Metro bundler output
- Common issues: missing imports, circular dependencies, native module not linked

### Step 4: Evaluate
```
Did all steps pass with 0 errors and 0 warnings?
├─ YES → Exit the loop. You may proceed.
└─ NO  → Return to Step 1. You are NOT done.
```

---

## Constraints

| Rule | Enforcement |
|:-----|:-----------|
| **Max iterations** | 10 loops before asking human for help |
| **No suppression** | Never add `@ts-ignore`, `@ts-expect-error`, `eslint-disable` to pass |
| **No `any` escape** | Typing as `any` to pass type-check is CHEATING. Fix the real type. |
| **Check base rules** | After every fix, verify it doesn't violate `.agent/rules/base.md` |
| **Track iterations** | Count your loops. If on loop 5+, you're fixing symptoms not causes |

---

## Loop Tracking Template

When running the Ralph Loop, track progress like this:

```
Ralph Loop — [Feature Name]
├─ Iteration 1: tsc → 3 errors (missing null check, wrong type, unused import)
│  → Fixed: added optional chaining, corrected return type, removed import
├─ Iteration 2: tsc → 0 errors ✅ | lint → 1 warning (unused variable)
│  → Fixed: removed unused variable
├─ Iteration 3: tsc → 0 ✅ | lint → 0 ✅
└─ EXIT: All clear. Feature verified.
```

---

## Emergency Protocol

If you've hit 10 iterations and still can't pass:

1. **Stop.** Do not continue looping.
2. **Document** the exact error and what you've tried.
3. **Ask the user** for help with specific context.
4. **Do NOT** ship broken code with suppressions.

---

## Integration with Base Rules

After exiting the Ralph Loop, cross-check against `.agent/rules/base.md`:

- [ ] No `any` types introduced?
- [ ] No `console.log` without `__DEV__` guard?
- [ ] Audio uses correct player (RNTP/expo-av)?
- [ ] Dark mode works on new/modified screens?
- [ ] Touch targets ≥ 44x44pt?
- [ ] Animations present on interactive elements?
