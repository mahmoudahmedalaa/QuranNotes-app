# Production Hardening — QuranNotes

> Complete this checklist before every TestFlight/App Store release.

## 1. Debug Screen Stripping

| Item | Status |
|:-----|:-------|
| Developer tools section removed from Settings | [ ] |
| Onboarding reset button removed | [ ] |
| Pro status toggle / manual override removed | [ ] |
| Welcome screen reset shortcut removed | [ ] |
| Test/demo accounts removed from UI | [ ] |
| Any "skip verification" shortcuts removed | [ ] |

> **Rule**: Use physical deletion, not JSX comments. Commented-out code `{/* ... */}` can accidentally reappear.

---

## 2. Environment Sync

| Item | Status |
|:-----|:-------|
| Firebase config matches production project | [ ] |
| RevenueCat keys are production (not sandbox) | [ ] |
| Bundle ID matches App Store Connect (`com.qurannotes.app`) | [ ] |
| `.env` NOT committed to git | [ ] |
| All `EXPO_PUBLIC_` keys are production values | [ ] |

---

## 3. Log Cleaning

| Item | Status |
|:-----|:-------|
| All `console.log` guarded by `__DEV__` or removed | [ ] |
| No sensitive data logged (tokens, passwords, user data) | [ ] |
| Audio player debug logs guarded | [ ] |
| Firebase auth debug logs guarded | [ ] |

---

## 4. Build Verification

| Item | Status |
|:-----|:-------|
| `tsc --noEmit` passes with zero errors | [ ] |
| `npm test -- --passWithNoTests` passes | [ ] |
| All import paths verified (no broken `../../` chains) | [ ] |
| No unused imports or dead code | [ ] |
| App installs and launches without crash on device | [ ] |
| Build number incremented in `app.json` | [ ] |

---

## 5. Feature Completion Audit

| Feature | Works on Device | Tested with Real Data | Edge Cases Handled |
|:--------|:---------------|:---------------------|:-------------------|
| Auth (Google + Apple) | [ ] | [ ] | [ ] |
| Quran Reading | [ ] | [ ] | [ ] |
| Verse Audio Playback | [ ] | [ ] | [ ] |
| Lock Screen Controls | [ ] | [ ] | [ ] |
| Voice Recording | [ ] | [ ] | [ ] |
| Notes | [ ] | [ ] | [ ] |
| Khatma Tracker | [ ] | [ ] | [ ] |
| Folders | [ ] | [ ] | [ ] |
| Premium/Paywall | [ ] | [ ] | [ ] |
| Settings | [ ] | [ ] | [ ] |

> **"Done" means**: Tested on a physical device with real network. Code review alone is not sufficient.

---

## 6. Navigation Flow Verification

| Checkpoint | Status |
|:-----------|:-------|
| First-time user → Welcome → Onboarding → Auth → Home | [ ] |
| Returning user → bypasses onboarding → Auth/Home | [ ] |
| Unauthenticated user → login screen | [ ] |
| Deep link to surah routes correctly | [ ] |
| Back button/gesture works everywhere | [ ] |
| Mini-player visible when audio playing on Home | [ ] |
| Mini-player hidden on Surah detail (StickyAudioPlayer shows) | [ ] |

---

## 7. UI Ghost Element Audit

When removing features, search the entire codebase for:
- Icon names (e.g., `radio-tower`, `access-point`)
- Feature context hooks (e.g., `useFeatureName`)
- Conditional renders in ALL layout modes (initial, sticky, inline)

> Features often have redundant UI paths in different scroll offsets. Missing one creates "ghost" buttons.

---

## 8. Audio Player Verification

| Item | Status |
|:-----|:-------|
| Verse playback starts correctly | [ ] |
| Lock screen shows track title (Surah + Verse) | [ ] |
| Lock screen shows artist (Reciter name) | [ ] |
| Lock screen play/pause works | [ ] |
| Lock screen skip forward/backward works | [ ] |
| Dynamic Island controls work | [ ] |
| Gapless transition between verses | [ ] |
| Reciter switching works mid-playback | [ ] |
| Audio stops cleanly (no ghost playback) | [ ] |
| Background audio continues when app is backgrounded | [ ] |
