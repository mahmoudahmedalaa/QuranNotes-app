# Quran Focus Mode Plan — 2026-05-18

## Purpose

This document adapts the original feature idea into a realistic QuranNotes implementation plan based on:

- the current React Native / Expo native workflow codebase
- the new hard-paywall / trial strategy
- current iOS platform constraints around app blocking

It is the planning checkpoint that should be completed before implementation begins.

## Product Intent

Quran Focus Mode should help a user build a daily Quran habit before distraction wins.

The desired product story is:

> Build a daily Quran habit before your phone distracts you.

The emotional tone should be:

- calm
- premium
- encouraging
- opt-in
- non-judgmental

## Proposed User Outcome

The user:

1. chooses a small Quran habit
2. optionally connects that habit to distraction control
3. starts a focused session
4. completes the Quran goal
5. unlocks apps if applicable
6. sees streak + reflection reinforcement

## Reality Check: Platform Constraints

### iOS

The “choose apps to block until goal is complete” idea is **not** a normal React Native feature.

On iOS, meaningful app blocking requires Apple’s Screen Time stack:

- `FamilyControls`
- `ManagedSettings`
- `DeviceActivity`

That means:

- a special Apple entitlement
- native Swift work
- additional extension targets
- App Store approval for that capability

Relevant Apple references:

- [Configuring Family Controls](https://developer.apple.com/documentation/xcode/configuring-family-controls)
- [Screen Time Technology Frameworks](https://developer.apple.com/documentation/ScreenTimeAPIDocumentation)
- [ShieldSettings](https://developer.apple.com/documentation/managedsettings/shieldsettings)

### Android

Android can support related focus / usage-control concepts, but QuranNotes is currently iOS-primary and the requested experience needs to be planned from the iOS constraint outward.

## Product Decision

Quran Focus Mode should be built in **phases**, not as one giant release.

## Recommended Delivery Phases

### Phase 1 — Shippable Quran Habit MVP

Ship the habit system **without true OS-level app blocking**.

Includes:

- Focus Mode intro
- habit selection
- goal selection
- reminders / schedule
- active session
- completion flow
- streak logic
- reflection prompt
- share card
- one free trial session/day for free users
- Pro gating for unlimited usage

Optional “blocking” in this phase becomes:

- distraction selection UI marked as “coming soon on supported devices”
- or a softer “accountability mode” reminder instead of real blocking

Why:

- lets us ship habit value quickly
- unlocks monetization sooner
- avoids waiting on entitlement approval

### Phase 2 — Native iOS App Shielding

After MVP proves value:

- add Family Controls entitlement
- add Screen Time API extension targets
- build native app/category shielding
- connect unlock to completed Quran goals

This phase requires separate technical and App Store review work.

### Phase 3 — Advanced Focus Platform

- multiple recurring sessions
- grace days
- reflection history
- deeper streaks
- richer analytics
- cloud sync and cross-device state reconciliation

## Monetization Plan

### Free

- one completed Focus Mode session total **or** one Focus trial day
- basic Quran reading remains unchanged
- existing limited notes/folders/recordings behavior remains unchanged

### Pro

- unlimited Focus Mode sessions
- multiple distraction selections
- scheduled sessions
- advanced streaks
- grace days
- full reflection history
- share cards
- cloud sync

## Rollout Strategy

Do **not** combine this feature rollout with the hard-paywall activation itself.

Recommended order:

1. finish paywall/trial rollout work
2. validate the updated paywall build
3. activate hard-paywall for new users only
4. then start implementing Quran Focus Mode on its own branch

This keeps monetization rollout risk separate from new feature risk.

## Architecture Fit

Quran Focus Mode should be a new feature slice, likely:

```text
src/features/quran-focus/
  domain/
  infrastructure/
  presentation/
```

Likely integrations:

- `AuthContext` for user identity
- `ProContext` for free/pro gating
- `StreakContext` or a sibling focus-streak model
- `ShareCardGenerator` for completion/share output
- Firebase / local persistence for trial usage, sessions, schedules, and sync

## Primary Technical Risks

1. iOS app blocking is entitlement-gated native work.
2. Trial usage must be durable across reinstall / multi-device cases.
3. Session recovery must survive app restarts and crashes.
4. Goal completion needs a precise and unambiguous definition.
5. Onboarding and paywall interaction must not confuse existing monetization flows.

## Definition Of “Goal Complete”

This must be explicit before coding.

Recommended initial definitions:

- `Read Quran`: complete when the user opens the reading flow and reads the configured ayah count inside a tracked session
- future habit types can expand later

For V1, keep the default:

- habit: `Read Quran`
- goal: `1 ayah daily`

## Recommendation

Proceed with **Phase 1 MVP first**, and treat true app blocking as Phase 2 native expansion.

That gives QuranNotes:

- a shippable habit loop
- monetizable Focus Mode
- no fake promise about unsupported blocking
- a clean path toward the stronger “pause distracting apps” story later

## Next Step

Write the implementation spec and edge-case matrix before starting code changes.
