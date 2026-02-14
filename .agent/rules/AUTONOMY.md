# Autonomy Boundaries — QuranNotes

> Clear rules for what the AI agent does alone vs. what requires human approval.

## Do Without Asking ✅

- Fix syntax errors, missing imports, typos
- Run `tsc --noEmit`, `npm test`, lint checks
- Fix failing tests (if the fix is straightforward)
- Refactor for clarity without changing behavior
- Add error handling to existing functions
- Update comments and documentation
- Make visual/UX polish decisions (colors, spacing, animations)
- Fix scroll offsets, navigation stack issues
- Clean up dead code and unused imports

## Ask Before Doing ⚠️

- **Adding new dependencies** (npm packages)
- **Major architectural changes** (switching patterns, new layers)
- **Breaking changes** (modifying public APIs, changing data schemas)
- **Deleting files** or removing features
- **Scope changes** (adding features not in the current task)
- **Production deployment** (App Store submission, TestFlight builds)
- **Expensive operations** (API calls that cost money)
- **Schema migrations** (Firestore structure changes)
- **Native module additions** (requires rebuild)

## Stop and Report If 🛑

- 3+ failed attempts on the same error
- The fix requires changing files outside the current task scope
- The error suggests an architecture/design issue (not a code bug)
- A test reveals a security vulnerability
- Build fails with native module errors after clean prebuild

## Iteration Loop

```
Implement → Verify (tsc + tests) → Pass? → Commit
                                  → Fail? → Fix → Verify again
                                  → 3 fails? → Stop, report to user
```
