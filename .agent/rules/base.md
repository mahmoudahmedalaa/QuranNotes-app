---
description: Core rules for QuranNotes. Read FIRST, follow ALWAYS. Tech stack is LOCKED.
---

# Project Base Rules — QuranNotes

> ⚠️ **Every AI agent must read this file before writing a single line of code.**

---

## Tech Stack (Locked)

> [!IMPORTANT]
> These are locked. Do NOT change without explicit user approval.

| Layer | Technology | Version Constraint |
|:------|:-----------|:-------------------|
| **Framework** | React Native (Expo, Native Workflow) | Expo SDK 52+ |
| **Language** | TypeScript | **Strict mode** (`strict: true`) |
| **Backend** | Firebase (Compat SDK) + RevenueCat | Latest stable |
| **Styling** | StyleSheet + `DesignSystem.ts` | N/A |
| **UI Library** | React Native Paper | v5+ |
| **State** | React Context + Custom Hooks | N/A |
| **Navigation** | Expo Router | v4+ |
| **Audio (Playback)** | react-native-track-player | Latest |
| **Audio (Recording)** | expo-av | Latest |
| **Animations** | Moti + React Native Reanimated | Latest |
| **Haptics** | expo-haptics | Latest |
| **Build** | **Xcode Archive → TestFlight ONLY** | Xcode 16+ |

### Universal "Never" Rules
- **Never use Expo Go.** Not for testing, not for demos, not for "just checking."
- **Never use EAS Build.** Build locally with Xcode.
- **Never use Firebase modular SDK.** Use `firebase/compat/app` — modular causes singleton registration errors in RN.
- **Never use `expo-av` for verse playback.** Use `react-native-track-player` via `AudioContext`.
- **Never add a dependency** without checking: maintained? TypeScript types? Expo compatible? <500KB bundle impact?
- **Never use `any` type.** If you can't type it, you don't understand it.
- **Never use `@ts-ignore` or `@ts-expect-error`.** Fix the type instead.
- **Never commit `console.log`.** Guard with `__DEV__` or remove entirely.
- **Never navigate Khatma with `?verse=` param.** Always use `?page=` to land at top of Juz.
- **Never auto-scroll on manual verse play.** Only auto-scroll on sequential advance (N → N+1).

### Domain-Specific Rules (Islamic App)
- Arabic text must render right-to-left with proper font support
- Verse references use `surah:verse` format (e.g., `2:255`)
- Audio files follow Quran.com CDN convention: `{surahNum3d}{verseNum3d}.mp3`
- Mood check-ins use custom illustrations, never emoji
- Gold (`#D4A853`) is the accent color for achievements and progress

---

## Design System Rules

### Colors — QuranNotes Palette
| Token | Light Mode | Dark Mode | Usage |
|:------|:-----------|:----------|:------|
| **Primary** | `#7C3AED` (purple) | `#A78BFA` | Primary actions, navigation |
| **Accent Gold** | `#D4A853` | `#D4A853` | Achievement, progress, Khatma |
| **Success** | `#10B981` | `#34D399` | Completion, streaks |
| **Error** | `#EF4444` | `#F87171` | Validation, warnings |
| **Surface** | `#FFFFFF` | `#1E1E2E` | Cards, backgrounds |
| **OnSurface** | `#1A1A2E` | `#E8E8E8` | Text on surface |

### Interaction Standards
- **Every pressable element**: press feedback (opacity or scale) + haptic
- **Every loading state**: skeleton shimmer, never a spinner
- **Touch targets**: minimum 44x44pt (Apple HIG)
- **Dark mode**: Required — both modes must look premium
- **Animations**: present on all interactive elements (100ms micro, 250ms transitions)

---

## The Ralph Mandate

> **No task is finished until it passes external verification.**

```bash
# 1. TypeScript — zero errors
npx tsc --noEmit

# 2. Lint — zero warnings (on significant changes)
npx expo lint

# 3. Build — compiles successfully (on new screens/navigation)
npx expo export --platform ios
```

If any fail → enter `.agent/workflows/ralph-loop.md` and fix until clean.

**Acceptance criteria for ANY pull of work:**
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] No `any` types introduced
- [ ] No `console.log` in production code (guard with `__DEV__`)
- [ ] All new components have proper TypeScript interfaces
- [ ] Dark mode tested
- [ ] Verse references use correct format
- [ ] Audio uses correct player (RNTP for playback, expo-av for recording)

---

## File Organization

```
src/
├── domain/                 # Entities, interfaces (zero framework deps)
│   └── entities/           # Quran, Mood, UserStreak, etc.
├── application/            # Use cases, services
│   └── services/           # StreakService, etc.
├── infrastructure/         # Context providers, 3rd-party SDKs
│   ├── audio/              # AudioContext (RNTP)
│   ├── auth/               # ProContext, StreakContext
│   ├── khatma/             # KhatmaContext
│   ├── mood/               # MoodContext
│   └── notes/              # NoteContext
├── presentation/           # UI layer
│   ├── components/         # Reusable components by domain
│   ├── hooks/              # Custom hooks
│   └── theme/              # DesignSystem.ts, MoodIllustrations.ts
app/
├── (tabs)/                 # Tab screens (home, quran, khatma, insights, settings)
├── surah/[id].tsx          # Surah detail/reading screen
└── _layout.tsx             # Root layout with providers
```

**Rules:**
- One component per file
- Components in PascalCase, hooks in camelCase with `use` prefix
- All backend queries go through Context providers
- Types in `domain/entities/` — never inline complex types
- Dependencies point inward: domain ← infrastructure ← presentation

---

## Quick Decision Framework

| Question | Answer |
|:---------|:-------|
| Expo Go or Xcode? | **Xcode.** Always. |
| `any` type or figure it out? | **Figure it out.** |
| Skip verification to move faster? | **No.** Run `tsc --noEmit` minimum. |
| `console.log` in production? | **No.** Guard with `__DEV__`. |
| `expo-av` or `react-native-track-player`? | **RNTP** for playback. **expo-av** for recording only. |
| Firebase modular or compat? | **Compat.** Always. |
