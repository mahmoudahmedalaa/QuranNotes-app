# AGENTS.md — QuranNotes Master Plan

> This file works with the 3-layer architecture from your agent-core-instructions.md. It provides project-specific context for QuranNotes while maintaining the same operational principles.

---

## Project Overview

**App:** QuranNotes
**Goal:** Mobile app for Quran study with note-taking and audio recording
**Stack:** React Native + Expo, Firebase, RevenueCat
**Current Phase:** Phase 1 — Foundation (Day 1 of 12)
**Launch Target:** Next Friday
**Status:** Ready for development

---

## How I Should Think

1. **Understand Intent First:** Before answering, identify what the user actually needs
2. **Ask If Unsure:** If critical information is missing, ask before proceeding
3. **Plan Before Coding:** Propose a plan, ask for approval, then implement
4. **Verify After Changes:** Run tests/linters or manual checks after each change
5. **Explain Trade-offs:** When recommending something, mention alternatives

---

## The 3-Layer Architecture (Adapted for QuranNotes)

**Layer 1: Directive (What to do)**
- SOPs in `directives/` folder:
  - `setup-expo-project.md` — Initialize React Native project
  - `implement-clean-architecture.md` — Folder structure, entities, repositories
  - `setup-firebase.md` — Auth, Firestore, Analytics configuration
  - `setup-revenuecat.md` — Payments, offerings, paywall
  - `build-quran-reader.md` — Display Quran text with offline cache
  - `build-note-system.md` — CRUD notes per verse
  - `build-audio-recording.md` — Record and playback audio
  - `deploy-to-app-store.md` — EAS Build, TestFlight, production
  - `autonomous-testing-and-qa.md` — Testing protocol and quality standards

**Layer 2: Orchestration (Decision making)**
- Read directives in order based on current day/phase
- Call execution scripts to perform tasks
- Handle errors, ask for clarification when needed
- Update directives with learnings (API limits, timing, edge cases)
- Git commit after each major feature
- Deploy to preview after each day
- **CRITICAL:** Follow autonomous testing protocol — launch emulators, test manually, think from all perspectives (user/owner/engineer/designer), make polish decisions without asking

**Layer 3: Execution (Doing the work)**
- Deterministic scripts in `execution/`:
  - `init-project.sh` — Setup Expo, install dependencies
  - `create-folder-structure.js` — Generate Clean Architecture folders
  - `setup-firebase.js` — Configure Firebase services
  - `setup-revenuecat.js` — Configure RevenueCat
  - `build-component.js` — Generate React Native components
  - `run-tests.js` — Execute test suite
  - `deploy-preview.sh` — Deploy to EAS preview
  - `deploy-production.sh` — Submit to App Store

**Why this works:** Push complexity into deterministic scripts. You focus on decision-making, not manual coding.

---

## Autonomy Protocol

### Setup Phase (Requires Your Input Once)

**Before I start coding, I need these credentials:**

| Service | What I Need | Where to Get It |
|---------|-------------|-----------------|
| **GitHub** | Personal access token (repo scope) | github.com/settings/tokens |
| **Firebase** | Service account JSON + project ID | console.firebase.google.com |
| **RevenueCat** | API keys (iOS + Android) | app.revenuecat.com |
| **Apple Developer** | Team ID + App Store Connect API key | appstoreconnect.apple.com |
| **Google Play** | Service account JSON | play.google.com/console |

**Store all in `.env` file (never commit):**
```bash
GITHUB_TOKEN=ghp_...
FIREBASE_PROJECT_ID=qurannotes-...
FIREBASE_SERVICE_ACCOUNT=...
REVENUECAT_IOS_KEY=appl_...
REVENUECAT_ANDROID_KEY=goog_...
APPLE_TEAM_ID=...
APPLE_API_KEY=...
GOOGLE_PLAY_SERVICE_ACCOUNT=...
```

### Execution Phase (Autonomous)

**I will handle without asking:**
- Git commits with descriptive messages after each feature
- Push to GitHub after each commit
- Deploy to EAS preview channel after each day
- Run tests and linters
- Update this AGENTS.md with progress
- Create/execute scripts in `execution/` folder
- Fix minor bugs (syntax errors, typos, missing imports)
- **Launch emulators and test manually per testing protocol**
- **Make visual/UX polish decisions (colors, spacing, animations)**
- **Skip blocked tasks and continue to next unblocked task**

**I will ask before:**
- Major architectural changes (e.g., switching from Clean Architecture)
- Expensive operations (API calls that cost money, App Store submission)
- Scope changes (adding features not in PRD)
- Breaking changes (deleting files, schema migrations)
- Production deployment (final App Store submission)

**Communication Schedule:**
- Progress update every 2 hours or after major milestone
- Blockers reported immediately with proposed solutions
- End-of-day summary of completed work
- Daily standup-style update each morning

---

## Plan → Execute → Verify (Required)

1. **Plan:** Read relevant directive, outline approach, ask for approval
2. **Execute:** Implement one feature at a time using execution scripts
3. **Verify:** Run tests, manual checks, emulator testing, ensure feature works before moving on

**If verification fails:** Fix issues before continuing. Do not bypass failing tests.

---

## Context & Memory

**Living Documents (update as we learn):**
- `AGENTS.md` (this file) — Current phase, roadmap, recent decisions
- `directives/*.md` — SOPs for specific tasks
- `execution/*.js` — Reusable scripts
- `.env` — Credentials (never commit)

**Reference Documents (read-only for context):**
- `docs/PRD-QuranNotes-MVP.md` — What to build
- `docs/TechDesign-QuranNotes-MVP.md` — How to build it
- `docs/quran_app_research.md` — Market research and competitor analysis

---

## Current State (Update This!)

**Last Updated:** February 3, 2026
**Working On:** Day 13 — Stabilization & UX Overhaul
**Recently Completed:** Web Simulator Fix, Design System, Auth Screen, Home Screen Theme
**Blocked By:** [None]
**Polish List:** [Minor fixes to tackle later]

---

## Roadmap

### Phase 1: Foundation (Days 1-5)
- [ ] Day 1: Setup & Architecture
- [ ] Day 2: Quran Display
- [ ] Day 3: Note Taking
- [ ] Day 4: Audio Recording
- [ ] Day 5: UI Polish & Auth

### Phase 2: Payments & Polish (Days 6-9)
- [ ] Day 6: RevenueCat Integration
- [ ] Day 7: Sync & Data
- [ ] Day 8: Testing & Bug Fixes
- [ ] Day 9: App Store Preparation

### Phase 3: Launch (Days 10-12)
- [ ] Day 10-11: Production Builds
- [ ] Day 12: Launch!

---

## Operating Principles

### 1. Check for Tools First
Before writing code, check `execution/` for existing scripts. Only create new scripts if none exist.

### 2. Self-Anneal When Things Break
- Read error message and stack trace
- Fix the script/code and test again (unless it uses paid tokens — ask first)
- Update the directive with what you learned
- Example: Firebase Auth error → check docs → update setup script → test → update directive

### 3. Update Directives as You Learn
Directives are living documents. When you discover:
- API constraints (rate limits, required fields)
- Better approaches (simpler code, faster methods)
- Common errors (and fixes)
- Timing expectations (how long things take)

Update the relevant directive. Don't create new directives without asking unless explicitly told to.

### 4. Clean Architecture Discipline
- Domain layer: Pure TypeScript, no dependencies
- Data layer: Implements repository interfaces
- Presentation layer: Thin, only displays data
- Infrastructure layer: External services only

### 5. Git Hygiene
- Commit after each feature (not each file)
- Commit message format: `type: description` (feat:, fix:, refactor:, docs:)
- Push to GitHub after each commit
- Create feature branches for major work

### 6. Testing Before Moving On
- **Follow autonomous testing protocol in directives/autonomous-testing-and-qa.md**
- Manual test each feature before marking complete
- Run TypeScript compiler (`tsc --noEmit`)
- Test on iOS simulator
- Test on Android emulator
- Test offline functionality (airplane mode)
- **Think from all perspectives: user, owner, engineer, designer**

---

## Self-Annealing Loop

When something breaks:
1. **Fix it** — Implement immediate solution
2. **Update the tool** — Improve the script or code pattern
3. **Test** — Verify it works deterministically
4. **Update directive** — Document the fix/edge case for future
5. **System is now stronger** — Next time this happens, it's handled

---

## File Organization

**Project Structure:**
```
QuranApp/
├── AGENTS.md                    ← This file (master plan)
├── README.md                    ← Project overview
├── app/                         ← Expo Router screens (file-based routing)
├── src/                         ← App source code (Clean Architecture)
│   ├── domain/                  ← Entities, repos, use cases (pure TS)
│   ├── data/                    ← Data sources (local, remote, models)
│   ├── infrastructure/          ← External services (Firebase, audio, payments)
│   ├── presentation/            ← Components, hooks, theme
│   ├── application/             ← App-level services
│   └── __tests__/               ← Integration tests
├── assets/                      ← App icons and splash screen
├── ios/                         ← iOS native project
├── docs/                        ← All documentation & reference material
│   ├── PRD-QuranNotes-MVP.md    ← Product requirements
│   ├── TechDesign-*.md          ← Technical design docs
│   ├── DEPLOYMENT.md            ← Deployment guide
│   ├── directives/              ← Agent SOPs (testing, building)
│   ├── logs/                    ← Build logs
│   ├── promotional/             ← App Store screenshots
│   └── skills/                  ← AI skill definitions
├── .env                         ← Credentials (gitignored)
├── app.json / eas.json          ← Expo & EAS config
├── package.json                 ← Dependencies
└── tsconfig.json                ← TypeScript config
```

**Key Principles:**
- `src/` = App source code (Clean Architecture layers)
- `app/` = Expo Router screens (thin UI wrappers)
- `docs/` = All documentation, skills, directives, and reference material
- `assets/` = App icons and splash screen only
- Root = Config files only (no loose docs or design files)

---

## What NOT To Do

- Do NOT delete files without explicit confirmation
- Do NOT modify database schemas without backup plan
- Do NOT add features not in the current phase
- Do NOT skip tests for "simple" changes
- Do NOT bypass failing tests or TypeScript errors
- Do NOT use deprecated libraries or patterns
- Do NOT commit `.env` or credentials
- Do NOT deploy to production without approval

---

## Engineering Constraints

### Type Safety (No Compromises)
- Strict TypeScript enabled
- All function parameters and returns must be typed
- Use Zod for runtime validation of external data

### Architectural Sovereignty
- Routes/screens handle UI only
- All business logic in `domain/` use cases
- No direct API calls from components

### Library Governance
- Check `package.json` before adding new dependencies
- Prefer Expo SDK packages over third-party when possible
- No deprecated patterns

### The "No Apologies" Rule
- Do NOT apologize for errors — fix them immediately
- Do NOT generate filler text before providing solutions
- If context is missing, ask ONE specific clarifying question

---

## Summary

You sit between human intent (PRD, Tech Design, directives) and deterministic execution (scripts in `execution/`, code in `src/`). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

**Be pragmatic. Be reliable. Self-anneal. Make it sexy.**

---

## Quick Reference

**Before starting work:**
- [ ] Read AGENTS.md (this file)
- [ ] Check current phase in Roadmap
- [ ] Review relevant directive in `directives/`
- [ ] Ensure credentials are in `.env`

**Before writing code:**
- [ ] Check `execution/` for existing scripts
- [ ] Propose plan to user
- [ ] Get approval

**After completing work:**
- [ ] Test thoroughly per testing protocol
- [ ] Commit with descriptive message
- [ ] Push to GitHub
- [ ] Update directive if you learned something new
- [ ] Report: what was done, what was learned, what's next

---

*QuranNotes AGENTS.md*
*Based on 3-layer architecture from agent-core-instructions.md*
*Created: February 2, 2026*
*Status: Ready for development*