---
description: Verify implemented features are real and functional, not stubs or placeholders. Run after completing any feature implementation.
---

# Verification Protocol — QuranNotes

> Code that compiles isn't code that works. This protocol catches stubs, broken wiring, and placeholder implementations.

## When to Use
- After implementing any new feature or component
- Before marking a task as "complete"
- When reviewing code that passes TypeScript checks but hasn't been manually tested
- As a pre-merge checklist

## The 4-Level Verification

Every feature must pass all four levels:

```
Level 1: EXISTS      — File exists, has non-zero content
Level 2: SUBSTANTIVE — Contains real logic, not stubs/placeholders
Level 3: WIRED       — Connected to the rest of the app (imports, routes, navigation)
Level 4: FUNCTIONAL  — Actually works when triggered by user action
```

---

## Level 1 — Exists

```bash
# Verify file exists with content
test -s "path/to/file.tsx" && echo "✅ Exists" || echo "❌ Missing or empty"
```

## Level 2 — Substantive (Stub Detection)

```bash
# RED FLAGS — These indicate stubs:
grep -n "TODO\|FIXME\|placeholder\|Placeholder\|implement\|IMPLEMENT" path/to/Component.tsx

# Check for empty handlers
grep -n "() => {}" path/to/Component.tsx

# Check for meaningful JSX (not just a wrapper div)
grep -c "<Text\|<View\|<Pressable\|<ScrollView" path/to/Component.tsx
```

**Stub patterns to catch:**
```typescript
// ❌ These are stubs:
return <View><Text>Component Name</Text></View>
return <View />
return null  // (unless conditional rendering)
const handleSubmit = () => {}
onPress={() => alert("Coming soon")}
```

## Level 3 — Wired

Check that components are connected to the app:

```bash
# Is the component imported and used?
grep -rn "ComponentName" app/ src/ --include="*.tsx"

# Does it fetch real data (not hardcoded)?
grep -n "useQuery\|useFetch\|useContext\|useState\|useEffect" path/to/Component.tsx

# Are there hardcoded mock arrays?
grep -n "const.*=.*\[{.*}\]" path/to/Component.tsx
```

## Level 4 — Functional

| Check | How |
|:------|:----|
| Component renders | Navigate to it in the app |
| Data loads | Check for loading → real data transition |
| User actions work | Tap buttons, submit forms, swipe |
| Error states handled | Disconnect network, submit invalid data |
| Navigation works | Can you get TO and FROM this screen? |
| State persists | Does data survive app restart? |
| Audio works | Does verse play? Does it stop? Lock screen controls? |

---

## Quick Verification Checklist

Copy this into your task tracking when completing a feature:

```
### Verification: {Feature Name}
- [ ] L1: Files exist with non-zero content
- [ ] L2: No stubs — real logic, real handlers, real queries
- [ ] L3: Wired — imported, navigable, connected to data
- [ ] L4: Functional — tested on real device
```

## Anti-Patterns

| ❌ Don't | ✅ Do |
|:---------|:------|
| Mark complete after TypeScript passes | Mark complete after L4 functional test |
| Leave `console.log("TODO")` in handlers | Implement the real handler or remove |
| Hardcode demo data in components | Connect to real data source |
| Skip error state handling | Handle loading, error, and empty states |
| Test only the happy path | Test error cases, edge cases, empty states |
