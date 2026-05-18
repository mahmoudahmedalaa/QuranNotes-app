# Quran Focus Mode Spec — 2026-05-18

## Summary

Quran Focus Mode is an opt-in habit feature that helps users complete a small daily Quran goal before distraction takes over.

The feature should feel:

- gentle
- premium
- practical
- spiritually encouraging

## Core Copy

- headline: `Build a daily Quran habit before your phone distracts you.`
- helper line: `Start small. Stay consistent.`
- paywall headline: `Keep your Quran habit going.`
- paywall benefit: `Pause distracting apps until your Quran goal is complete.`

## V1 Scope

### Included

- intro screen
- habit selection
- goal setup
- distraction selection UI
- permission explanation UI
- summary screen
- active session
- completion screen
- settings screen
- paywall screen
- free trial usage gating
- focus streak tracking
- reflection prompt
- completion share card
- analytics events

### Explicitly Deferred

- true iOS app/category blocking until Screen Time entitlement/native work is approved
- Android-specific blocking implementation
- cross-device live session sync

## User Flows

### Flow 1 — First-Time Setup

1. user opens Focus Mode intro
2. chooses habit type
3. chooses goal
4. chooses distracting apps/categories they want associated with focus
5. sees permission explanation
6. sees summary
7. starts first session

### Flow 2 — Active Session

1. active session screen opens
2. app shows current goal progress
3. user completes Quran goal inside QuranNotes
4. session completes
5. streak updates
6. completion screen appears

### Flow 3 — Free User Gate

1. free user completes first Focus session or consumes first trial day
2. next attempt to start Focus Mode shows paywall
3. user can upgrade or exit

### Flow 4 — Pro User

1. Pro user can create unlimited sessions
2. Pro user can configure more distraction selections
3. Pro user can access schedule, reflection history, grace days, and full sharing

## Default Setup

- habit type: `Read Quran`
- goal: `1 ayah daily`

## Habit Types

V1 should keep the product tightly scoped.

Recommended:

- `Read Quran`

Potential future expansions:

- listen to recitation
- write one reflection
- complete a short tadabbur session

## Goal Presets

For `Read Quran`:

- `1 ayah daily`
- `3 ayat daily`
- `5 ayat daily`
- `10 ayat daily`
- `1 page daily`

V1 should spotlight `1 ayah daily`.

## “Blocking” Behavior In V1

Because real iOS blocking requires native entitlement work, V1 should separate:

- **intent capture**: user chooses distracting apps/categories
- **future capability**: UI explains that stronger blocking unlocks on supported devices / future version

If product prefers a lighter immediate version, V1 can use:

- reminders
- lock-screen encouragement
- accountability copy on session start

But it should not falsely claim OS-level blocking where none exists.

## Session State

Each session should track:

- session id
- user id
- habit type
- goal type
- goal target
- started at
- completed at
- status: `idle | active | completed | aborted | expired`
- distraction selection snapshot
- trial/pro state snapshot

## Free Trial Logic

Free users get:

- one completed Focus Mode session total
  or
- one Focus trial day

Recommended implementation:

- durable server-backed usage state in Firebase
- local cache for offline resilience

## Analytics Events

Track at minimum:

- `focus_intro_viewed`
- `focus_setup_started`
- `focus_habit_selected`
- `focus_goal_selected`
- `focus_distraction_selection_saved`
- `focus_permission_prompt_viewed`
- `focus_permission_result`
- `focus_summary_viewed`
- `focus_session_started`
- `focus_session_completed`
- `focus_session_aborted`
- `focus_paywall_viewed`
- `focus_paywall_converted`
- `focus_streak_updated`
- `focus_reflection_saved`
- `focus_share_started`
- `focus_share_completed`

## Edge Cases

Must be designed for:

- denied permissions
- revoked permissions
- offline usage
- crash during session
- completion outside Focus Mode
- emergency unlock
- subscription expiry
- timezone changes
- trial used on another device
- user disables Focus Mode

## Data Model Proposal

Likely Firebase / local docs:

- `users/{uid}/focus/profile`
- `users/{uid}/focus/history/{sessionId}`
- `users/{uid}/focus/reflections/{reflectionId}`
- `users/{uid}/focus/trial/state`

This is additive and should be implemented carefully to respect existing schema constraints.

## UI Inventory

Create these screens/components:

- Focus Mode intro
- habit selection
- goal setup
- distraction selection
- permission request
- summary
- active session
- blocked-app explainer
- completion
- settings
- paywall

## Integration Notes

Use existing QuranNotes capabilities where possible:

- `ProContext` for premium gating
- `ShareCardGenerator` for completion cards
- existing routing patterns with Expo Router
- existing telemetry style introduced in the paywall rollout
- existing streak primitives only if they fit; otherwise add a dedicated focus streak model

## Delivery Plan

### Step 1

Build the data model and setup flow.

### Step 2

Build active session + completion + free/pro gating.

### Step 3

Add analytics, sharing, and history.

### Step 4

Design the native iOS app shielding phase separately.

## Non-Goals For Initial Implementation

- cross-platform full app blocking
- deep category-blocking parity across iOS and Android
- over-gamified habit mechanics
- guilt-based copy or punitive streak messaging
