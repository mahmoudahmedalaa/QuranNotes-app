# Paywall Rollout Runbook — 2026-05-18

## Purpose

This is the concise operator runbook for turning the new-user hard paywall on and off safely.

Use it after the updated TestFlight build has been validated.

## Live Status Today

- Firebase config exists at `config/paywallRollout`
- rollout remains off: `enabled=false`
- current cutoff: `2026-05-18T00:00:00.000Z`
- existing users are protected by durable access docs
- telemetry is confirmed writing

## Activation Preconditions

All of these should be true before activation:

1. TestFlight build with the new paywall copy has been installed and tested.
2. Purchase sheet opens successfully.
3. Introductory offer appears correctly.
4. Restore purchases works.
5. Telemetry writes after paywall views and app opens.
6. Existing users are still not gated.

## Dry-Run Activation

```bash
npm run paywall:activate -- --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1
```

Review the printed diff before writing.

## Write Activation

```bash
npm run paywall:activate -- --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1 --write
```

Expected result:

- new users become subscription-gated
- existing grandfathered users remain open
- paying users remain open

## Rollback

If anything feels wrong, roll back immediately:

```bash
npm run paywall:rollback -- --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1 --write
```

Rollback effect:

- hard gating stops immediately for new users
- telemetry and grandfather docs remain intact

## Post-Activation Verification

Run:

```bash
npm run report:firebase-usage
npm run report:paywall-funnel
npm run paywall:rollout
```

Look for:

- higher metrics summary doc count
- paywall views appearing
- no unexpected restore failures
- no grandfathered users incorrectly blocked

## Code Path Audit

The app is already wired for the new-user hard-paywall path:

- [app/index.tsx](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/app/index.tsx)
  Redirects authenticated users who require a subscription to `/paywall?hard=1`.
- [app/(tabs)/_layout.tsx](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/app/(tabs)/_layout.tsx)
  Prevents gated users from accessing the tab shell directly.
- [app/onboarding/premium.tsx](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/app/onboarding/premium.tsx)
  Uses `requiresSubscription` to switch onboarding premium into hard-paywall mode.
- [src/features/payments/domain/SubscriptionAccessPolicy.ts](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/payments/domain/SubscriptionAccessPolicy.ts)
  Enforces `requiresSubscription = enabled && user && !isPro && !isGrandfathered`.

## Open Item

The latest patched archive `2.2.2 (50)` still needs to be uploaded from Xcode Organizer because Apple signing/upload credentials were unavailable to the non-interactive export path in this session.
