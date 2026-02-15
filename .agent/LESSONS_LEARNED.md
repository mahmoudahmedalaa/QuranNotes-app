# Lessons Learned — QuranNotes

> What went wrong, what went right, and what to do differently. Update this after every major session.

## 🔴 Things That Went Wrong

### 1. Starting to Code Before Documentation
**What happened**: Jumped into coding without a complete PRD or tech spec. Features were built based on chat conversations, leading to inconsistent implementations and rework.
**Fix**: Never write code until docs are reviewed. Use implementation plans.

### 2. Mock-to-Real Transition Gap
**What happened**: Built the entire app with mock services. When switching to real Firebase/RevenueCat, everything broke — different return types, async behavior, error cases not handled.
**Fix**: Use real services from day one. Mock only for tests.

### 3. Firebase SDK Version Chaos
**What happened**: Used Firebase modular SDK (v9/v10) in React Native. "Component not registered" errors, HMR crashes, auth persistence failures.
**Fix**: Use Firebase Compat Layer (`firebase/compat/app`). Documented in TROUBLESHOOTING.md.

### 4. Debug Screens Shipped to Production
**What happened**: Left developer tools (onboarding reset, Pro toggle) in Settings for the App Store submission.
**Fix**: Use PRODUCTION_HARDENING.md checklist before every release. Physically delete — never comment out.

### 5. Import Path Fragility
**What happened**: Refactored file structure but forgot to update import paths. `tsc --noEmit` would have caught this.
**Fix**: Run `tsc --noEmit` before every commit.

### 6. expo-av Limitations for Background Audio
**What happened**: Built the entire audio system on `expo-av`. Discovered it can't do background playback, lock screen controls, or gapless transitions.
**Fix**: Migrated verse playback to `react-native-track-player`. Kept `expo-av` only for voice recording.

### 7. scrollToIndex Hidden by Sticky Header
**What happened**: `scrollToIndex` with `viewPosition: 0` aligned verses to the top edge, hidden behind the sticky header.
**Fix**: Changed `viewPosition` to `0.3` to center verses on screen.

### 8. Navigation Stack Not Clearing
**What happened**: `router.replace('/')` after onboarding didn't clear the stack — Welcome screen was skipped.
**Fix**: Call `router.dismissAll()` before `router.replace('/')`.

### 9. Build Path Spaces Broke Xcode
**What happened**: Project folder was `Vibe Coding/Projects/QuranApp`. Spaces in the path caused Expo/RN build scripts to fail.
**Fix**: Renamed to `VibeCoding/`. Never use spaces in project paths.

### 10. AI Tool JSX Corruption
**What happened**: AI editing tools occasionally double-escaped string attributes in JSX.
**Fix**: Verify no backslashes before quotes. Use Python script for literal replacement if needed.

---

## 🟢 Things That Went Right

### 1. Clean Architecture
Domain layer with zero framework dependencies made testing easy and refactoring safe.

### 2. DesignSystem.ts as Single Source of Truth
Having `Colors`, `Spacing`, `BorderRadius`, `Shadows` in one file ensures visual consistency across all screens.

### 3. Production Readiness Audit
Systematic feature-by-feature audit before submission caught multiple issues that would have caused App Store rejection.

### 4. Comprehensive QA Document
Having a troubleshooting guide prevented re-debugging the same issues across sessions.

### 5. react-native-track-player Migration
Moving to RNTP gave us native lock screen controls, Dynamic Island support, and gapless playback — all for free.

### 6. Khatma Feature Rebuild
When the Khatma feature had too many bugs, doing a full rewrite with proper state management was faster than patching.

---

## 📋 Rules to Carry Forward

1. **Research before code** — 1 hour of research saves 10 hours of rework
2. **Pin all versions** — "latest" is a timebomb
3. **Real services from day one** — mocks hide real-world complexity
4. **`tsc --noEmit` before every commit** — catches the bugs you can't see
5. **Physical deletion > comments** — commented code comes back to haunt you
6. **Delete Account feature** — App Store requires it. Build it early.
7. **Test on real device** — simulator misses native module issues
8. **Self-anneal** — after every milestone, update docs to match reality
9. **No spaces in paths** — breaks Expo/RN build scripts
10. **Use native solutions for native problems** — expo-av for web-like audio, RNTP for real mobile audio

---

## ➕ Add Your Lessons Here

### 2026-02-15 — Khatma, Audio, Mood Fixes

**What went wrong**:
- Khatma past-day navigation started reading from a random verse in the middle because it used `?verse=` param instead of `?page=`
- Auto-scroll fired when user manually tapped a different verse during playback, causing a jarring jump
- Mood illustrations were too small at 44px — not visible enough in the grid
- Verse recommendation sheets used `playFromVerse()` which queued the entire surah instead of playing just the single recommended verse

**What went right**:
- Using `playVerse()` for single-verse playback in sheets — clean, no side effects
- Checking `isSequentialAdvance` flag before auto-scrolling — only scrolls on N→N+1 transitions
- The 4-level verification protocol (added today) would have caught the wired→functional gap earlier

**Rules added**:
- Never navigate Khatma with `?verse=` param — always `?page=` to land at top of Juz
- Never auto-scroll on manual verse play — only on sequential advance (N → N+1)
- Mood illustrations must be 56px+ for grid, 60px+ for today summary
- Use `playVerse()` (not `playFromVerse()`) for single-verse playback in sheets/modals
