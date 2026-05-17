# Hard Paywall Rollout

## Goal

Move QuranNotes from feature-level freemium gating to a reversible hard-paywall rollout for **new users only**, while preserving access for:

- current paying users
- grandfathered existing free users
- App Review / restore-purchase flows

## Current Safety Model

The rollout is scaffolded behind [`HARD_PAYWALL_CONFIG`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/domain/SubscriptionAccessPolicy.ts).

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

## Rollback

Fast rollback is one config change:

1. set `enabled` back to `false`
2. rebuild and release

Because grandfathering is computed from Firebase Auth metadata, rollback does not require a Firestore migration.

## Follow-Up Work

- Add remote usage telemetry (`last_seen`, paywall impressions, purchase funnel)
- Move rollout config to a remotely controlled source if product wants instant toggles
- Confirm App Store / RevenueCat trial copy matches the actual introductory offer configuration before enabling hard paywall
