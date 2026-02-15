# AI Agent Instructions — QuranNotes

> **Critical instructions for AI assistants working on QuranNotes.**

## ⚠️ MANDATORY — Read Before ANYTHING Else

1. **Read `.agent/rules/base.md`** — Tech stack, design system, verification rules. These are locked.
2. **Read `.agent/rules/design-reference.md`** — Islamic domain palettes, typography, UX anti-patterns.
3. **Read `.agent/rules/AUTONOMY.md`** — What you may do alone vs. what requires human approval.
4. **Know `.agent/workflows/ralph-loop.md`** — Every feature must pass the verification loop before completion.
5. **Know `.agent/workflows/verification.md`** — 4-level verification (Exists → Substantive → Wired → Functional).
6. **Know `.agent/workflows/debug-loop.md`** — Structured debugging with hypothesis tracking. No ad-hoc debugging.
7. **Check `.agent/LESSONS_LEARNED.md`** — Mistakes already made. Don't repeat them.
8. **Then read this file** for build/deploy context.

---

## Project Context

QuranNotes is an Islamic Quran companion app built with:
- **Mobile:** React Native (Expo SDK 52+, Native Workflow) with TypeScript
- **Backend:** Firebase (Compat SDK) + RevenueCat (subscriptions)
- **Audio:** react-native-track-player (playback) + expo-av (recording only)
- **Deployment:** Local Xcode builds → Transporter → TestFlight
- **Architecture:** Clean Architecture (domain → infrastructure → presentation)

---

## Core Principles

### 1. iOS Development & Deployment

**NEVER suggest EAS Build or paid cloud build services.**

- ✅ **Always use local Xcode builds** via `./build-ios.sh`
- ✅ **Upload via Transporter** (free Mac App Store app)
- ✅ **Test via TestFlight** (free, unlimited builds)
- ✅ **Reference:** `.agent/workflows/XCODE_GUIDE.md`

### 2. React Native/Expo

When `ios/` directory exists:
- ✅ Changes to `app.json` (icon, buildNumber, infoPlist) need `npx expo prebuild --clean`
- ✅ The `build-ios.sh` script handles all patches
- ❌ Never use Expo Go — not for testing, not for demos

### 3. Audio Architecture

| Task | Use |
|:-----|:----|
| Verse playback | `react-native-track-player` via `AudioContext` |
| Voice recording | `expo-av` via `useAudioRecorder` |
| Single verse play (sheets) | `playVerse()` — never `playFromVerse()` |
| Continuous surah playback | `playFromVerse()` with surah object |

### 4. Code Quality — The Ralph Mandate

> **No task is finished until Ralph says you're done.**

```bash
# 1. TypeScript — zero errors
npx tsc --noEmit

# 2. Lint (on significant changes)
npx expo lint

# 3. Build (on new screens/navigation)
npx expo export --platform ios
```

If any fail → enter `.agent/workflows/ralph-loop.md` and fix until clean.

---

## Decision Trees

### iOS Build Method
```
npx expo prebuild --clean → ./build-ios.sh → Transporter upload → TestFlight
```

### Version Increment
```
What changed?
├─ Bug fixes only → Patch (1.0.0 → 1.0.1)
├─ New features → Minor (1.0.0 → 1.1.0)
├─ Breaking changes → Major (1.0.0 → 2.0.0)
└─ Resubmitting rejected build → Increment buildNumber only
```

### Khatma Navigation
```
Always navigate via ?page= param (top of Juz's start page)
Never use ?verse= for Khatma — it opens mid-scroll
```

### Auto-scroll During Playback
```
Only auto-scroll on sequential advance (verse N → N+1)
Never auto-scroll on manual play (user taps a different verse)
```

---

## Common User Requests & Responses

| Request | Action |
|:--------|:-------|
| "Deploy to App Store" | Follow `.agent/workflows/APP_STORE.md` |
| "Build iOS app" | `npx expo prebuild --clean && ./build-ios.sh` |
| "Test on my phone" | Upload IPA via Transporter → TestFlight |
| "Update app icon" | Update `Images.xcassets/AppIcon.appiconset/`, then rebuild |
| "Background audio not working" | Check `Info.plist` for `UIBackgroundModes → audio` |
| "Fix a bug" | Follow `.agent/workflows/debug-loop.md` |

---

## Error Handling

### Build Errors
| Error | Fix |
|:------|:----|
| "Sandbox: deny(1) file-write-create" | Use Release config or run `build-ios.sh` |
| "Signing requires a development team" | Xcode → Project → Signing → Select Team |
| "Build number already used" | Increment `buildNumber` in `app.json`, then `npx expo prebuild --clean` |

### App Store Rejections
| Guideline | Fix |
|:----------|:----|
| 2.1 — App Completeness | Remove placeholder content, ensure all features work |
| 5.1.1 — Privacy | Add privacy policy URL, declare data collection |

---

## Quick Reference

| Task | Command |
|:-----|:--------|
| **Type check** | `npx tsc --noEmit` |
| **Build iOS** | `npx expo prebuild --clean && ./build-ios.sh` |
| **Upload** | Open Transporter → Drag IPA |
| **Check version** | `cat app.json \| grep -A2 version` |
| **Increment build** | Edit `app.json` → `buildNumber`, then prebuild |

---

**Last updated:** 2026-02-15
**Version:** 1.0.0
