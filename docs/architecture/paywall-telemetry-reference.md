# Paywall Telemetry Reference

## Purpose

This document explains how to read the Firebase telemetry introduced for the hard-paywall migration.

The goal is to answer practical product questions:

- are users still opening the app?
- are they reaching the paywall?
- are they restoring purchases?
- are they starting purchases and abandoning them?
- are onboarding users getting through the funnel?

## Data Sources

### `users/{uid}/metrics/summary`

This is the compact per-user summary document.

Useful fields:

- `lastSeenAt`
- `lastSeenClientAt`
- `appOpenCount`
- `lastKnownIsPro`
- `lastKnownGrandfathered`
- `lastRolloutVersion`
- `lastPaywallViewAt`
- `lastPaywallViewClientAt`
- `paywallViewCount`
- `lastPaywallReason`
- `lastPaywallLocation`
- `lastPaywallHardGate`
- `lastSubscriptionEventAt`
- `lastSubscriptionOutcome`
- `lastSubscriptionLocation`
- `lastSubscriptionReason`
- `lastSubscriptionHardGate`
- `onboardingCompletedAt`
- `onboardingCompletedClientAt`
- `onboardingSkipped`

### `users/{uid}/telemetry_events/{eventId}`

This is the append-only event stream.

Current event types:

- `paywall_view`
- `subscription_event`

`subscription_event` outcomes:

- `started`
- `success`
- `cancelled`
- `failed`
- `restored`

## Reports

### General Firebase state

```bash
npm run report:firebase-usage
```

This reports:

- auth user counts
- Firestore content counts
- rollout config status
- access state doc count
- telemetry doc counts

### Funnel report

```bash
npm run report:paywall-funnel
```

This reports:

- active users from telemetry summaries
- total recorded app opens
- paywall views
- hard vs soft paywall views
- views by location and reason
- subscription outcomes
- onboarding completion metrics
- last-known Pro vs grandfathered segments

For machine-readable output:

```bash
node scripts/report-paywall-funnel.js --json
```

## Interpretation Notes

### If telemetry is zero

That usually means one of these is true:

- the telemetry-enabled build is not released yet
- released users have not opened the updated build yet
- telemetry wiring regressed and should be checked in-app

### If auth activity is non-zero but telemetry is low

That suggests users may still be authenticating, but not yet on the new app version or not reaching the instrumented flows often.

### If paywall views are high but starts are low

That suggests copy, price presentation, or trial messaging may need work.

### If starts are high but success is low

That usually points to product configuration, trust, restore confusion, price resistance, or checkout friction.

### If restores are common

That may indicate returning subscribers, multi-device use, or confusion about access state.

## Operational Rhythm

Recommended review cadence after release:

- daily for the first 7 days after rollout code ships
- before enabling the hard paywall
- daily for the first 7 days after enabling the hard paywall
- weekly after the rollout stabilizes
