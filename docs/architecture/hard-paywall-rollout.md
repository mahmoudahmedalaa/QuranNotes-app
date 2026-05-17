# Hard Paywall Rollout

## Goal

Move QuranNotes from feature-level freemium gating to a reversible hard-paywall rollout for **new users only**, while preserving access for:

- current paying users
- grandfathered existing free users
- App Review / restore-purchase flows

## Current Safety Model

The rollout is scaffolded behind [`DEFAULT_PAYWALL_ROLLOUT_CONFIG`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/domain/SubscriptionAccessPolicy.ts) and can be overridden live via Firestore config.

- `enabled: false`
- `grandfatherBefore: 2026-05-18T00:00:00.000Z`

This means the access-policy plumbing can ship without changing live behavior.

## Access Rules

When `enabled` is flipped to `true`:

1. `isPro === true` → full access
2. `createdAt < grandfatherBefore` → full access (legacy free users)
3. everyone else → subscription required

The primary enforcement points are:

- [`app/onboarding/premium.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/app/onboarding/premium.tsx)
- [`app/(tabs)/_layout.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/app/(tabs)/_layout.tsx)
- [`src/features/payments/presentation/PaywallScreen.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/presentation/PaywallScreen.tsx)
- [`src/features/payments/presentation/RamadanPaywallScreen.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/presentation/RamadanPaywallScreen.tsx)

## Firestore Shape

### Rollout config

`config/paywallRollout`

```json
{
  "enabled": false,
  "grandfatherBefore": "2026-05-18T00:00:00.000Z",
  "rolloutVersion": 1
}
```

### Durable access state

`users/{uid}/access/state`

```json
{
  "grandfathered": true,
  "evaluatedAt": "2026-05-17T09:50:00.000Z",
  "source": "auth_creation_time",
  "rolloutVersion": 1,
  "userCreatedAt": "2026-05-01T00:00:00.000Z"
}
```

### Telemetry summary

`users/{uid}/metrics/summary`

```json
{
  "lastSeenAt": "<server timestamp>",
  "lastSeenClientAt": "2026-05-17T09:50:00.000Z",
  "appOpenCount": 1,
  "lastKnownIsPro": false,
  "lastKnownGrandfathered": true,
  "lastRolloutVersion": 1,
  "lastPaywallViewAt": "<server timestamp>",
  "paywallViewCount": 1,
  "lastSubscriptionOutcome": "success",
  "onboardingCompletedAt": "<server timestamp>"
}
```

### Telemetry events

`users/{uid}/telemetry_events/{eventId}`

Event types currently emitted:

- `paywall_view`
- `subscription_event`

## Reporting

You can re-run the current Firebase baseline report with:

```bash
npm run report:firebase-usage
```

For machine-readable output:

```bash
node scripts/report-firebase-usage.js --json
```

## Grandfather Backfill

Before enabling the hard paywall in production, run a dry-run backfill to see how many users will be grandfathered:

```bash
npm run backfill:grandfather-access -- --cutoff=2026-05-18T00:00:00.000Z
```

When the numbers look correct, write the durable access records:

```bash
npm run backfill:grandfather-access -- --cutoff=2026-05-18T00:00:00.000Z --write
```

Use `--overwrite` only if we intentionally want to recompute existing access documents.

## Rollback

Fast rollback is one config change:

1. set `config/paywallRollout.enabled` back to `false`
2. confirm the listener has propagated, or fully restart the app to force a fresh config fetch
3. ship a follow-up release only if we also want permanent code changes, not for emergency access restoration

Because grandfathering is derived from Firebase Auth metadata and optionally persisted in additive access docs, rollback does not require a destructive Firestore migration.

## Follow-Up Work

- Backfill `users/{uid}/access/state` for current users once we are ready to harden grandfathering across the full install base
- Confirm App Store / RevenueCat trial copy matches the actual introductory offer configuration before enabling hard paywall
