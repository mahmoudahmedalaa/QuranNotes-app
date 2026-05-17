# Paywall Strategy And Operations — 2026-05-17

## Purpose

This document is the durable record for the QuranNotes monetization migration work. It explains:

- why we are adding Firebase telemetry instead of relying on App Store data alone
- how the hard-paywall rollout is designed to avoid harming existing users
- what has already been implemented in the app
- what manual work will still be needed later in App Store Connect and RevenueCat

## Recommendation

For QuranNotes, the recommended direction is:

- keep existing paying users fully intact
- grandfather existing free users
- move new users to a hard paywall with a free trial
- measure the funnel before and after rollout

The recommendation is based on the current app state:

- small install base
- low recent activity
- broad free access is not converting into meaningful paid adoption

## Why This Is Not Just An App Store Change

Three systems each solve a different part of the problem:

1. App Store Connect
Creates the subscription product, pricing, and introductory trial.

2. RevenueCat
Maps App Store products into app entitlements and gives the app a clean subscription state.

3. Firebase + app code
Controls who is grandfathered, who is hard-gated, and how we measure actual usage and conversion behavior.

Without Firebase telemetry, we can know revenue outcomes but not product behavior. We would miss:

- app opens from already signed-in users
- paywall impressions
- onboarding completion rate
- restore success frequency
- which existing users were explicitly preserved

## Current Baseline

The baseline snapshot lives in [`paywall-rollout-baseline-2026-05-17.md`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/docs/architecture/paywall-rollout-baseline-2026-05-17.md).

Highlights from the baseline:

- 72 total auth users
- 12 users active in the last 30 days
- 2 users active in the last 7 days
- 25 notes in Firestore
- 18 recordings in Firestore
- 45 sync docs across 9 distinct users
- no historical paywall/session telemetry existed yet

Grandfathering dry-run with cutoff `2026-05-18T00:00:00.000Z`:

- 72 existing users would be grandfathered
- 0 existing users would be newly hard-gated

This is the safety property we want before any rollout is enabled.

## Current Live Rollout State

After the groundwork phase completed on 2026-05-17:

- Firebase now has an explicit `config/paywallRollout` document
- that config is still disabled
- all 72 current users have durable grandfather access docs
- telemetry counts remain at zero because the instrumented app build has not yet produced live traffic

This means the rollout is now controllable and reversible from Firebase, while the current user base is explicitly protected.

## What Has Been Implemented

### Access control

- central subscription access policy
- reversible rollout flag
- grandfather cutoff support
- durable per-user access state in Firestore
- tab-level hard-paywall guard for new users

### Telemetry

- app open tracking with write throttling
- paywall impression tracking
- subscription event tracking
- onboarding completion tracking
- metrics summary + raw event stream

### Operations

- Firebase baseline reporting script
- grandfathering backfill script with dry-run mode
- implementation docs and rollout notes

## Firestore Data Shape

### `config/paywallRollout`

Controls the rollout without requiring a code change.

```json
{
  "enabled": false,
  "grandfatherBefore": "2026-05-18T00:00:00.000Z",
  "rolloutVersion": 1
}
```

### `users/{uid}/access/state`

Stores durable access evaluation per user.

```json
{
  "grandfathered": true,
  "evaluatedAt": "2026-05-17T09:50:00.000Z",
  "source": "auth_creation_time",
  "rolloutVersion": 1,
  "userCreatedAt": "2026-05-01T00:00:00.000Z"
}
```

### `users/{uid}/metrics/summary`

Stores the latest operational metrics we will want to review later.

```json
{
  "lastSeenAt": "<server timestamp>",
  "appOpenCount": 12,
  "paywallViewCount": 3,
  "lastSubscriptionOutcome": "cancelled",
  "lastKnownIsPro": false,
  "lastKnownGrandfathered": true
}
```

### `users/{uid}/telemetry_events/{eventId}`

Stores the raw event trail for later analysis.

Current event types:

- `paywall_view`
- `subscription_event`

## Safety Model

This rollout is designed to be reversible.

- default code path ships with rollout disabled
- hard gating only applies when config is explicitly enabled
- legacy users can be protected by account creation cutoff
- durable access docs can preserve grandfathering even if logic changes later
- rollback can happen by setting `config/paywallRollout.enabled` back to `false`

## Commands

Generate a readable Firebase usage report:

```bash
npm run report:firebase-usage
```

Generate JSON output for scripting:

```bash
node scripts/report-firebase-usage.js --json
```

Preview the grandfathering backfill:

```bash
npm run backfill:grandfather-access -- --cutoff=2026-05-18T00:00:00.000Z
```

Write grandfathering access records after review:

```bash
npm run backfill:grandfather-access -- --cutoff=2026-05-18T00:00:00.000Z --write
```

## Remaining Work

### App code and Firebase

- verify the rollout paths with focused tests
- backfill durable access docs when ready
- add lightweight reporting views or export scripts if deeper analysis is needed later

### RevenueCat

- confirm the entitlement and offering structure
- ensure the trial is attached to the correct subscription product
- verify restore flows for grandfathered users and paid users

### App Store Connect

- create or confirm the subscription group
- configure the introductory free trial
- confirm pricing and review metadata

## Manual Work Later

No App Store Connect steps are required yet for this checkpoint.

When we reach the store-configuration phase, the manual work can be done by the product owner while engineering provides:

- the exact subscription setup checklist
- the trial configuration guidance
- the RevenueCat mapping checklist
- the rollout sequence for turning the gate on safely

## Decision Log

- 2026-05-17: chose additive Firestore telemetry rather than invasive data restructuring
- 2026-05-17: chose grandfather-first rollout to protect existing users
- 2026-05-17: kept the hard-paywall flag off by default for rollback safety
