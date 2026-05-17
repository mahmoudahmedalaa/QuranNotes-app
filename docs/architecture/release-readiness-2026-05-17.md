# Release Readiness — 2026-05-17

## Scope

This document records the code-side release prep for the telemetry-enabled hard-paywall groundwork branch.

Branch:

- `codex/paywall-migration`

Latest checkpoint at time of writing:

- `c0c253fa0`

## Verified In This Branch

### Type safety

Passed:

- `npm run typecheck`
- `npm run typecheck:functions`

### Tests

Passed:

- `npm test -- --passWithNoTests`

Notes:

- Jest was updated to ignore archived backup folders so release verification reflects the app, not `.archive` contents.
- RevenueCat test mocks were updated to match the current `RevenueCatService` contract.
- Telemetry-related Firebase mocks were updated for the new metrics writes.

### Bundle / export verification

Passed:

- `npx expo export --platform ios`

Result:

- iOS bundle exported successfully to `dist`

### Dependency compatibility

Passed:

- `npx expo install --check`

Applied safe compatibility updates:

- `expo` `~54.0.34`
- `expo-dev-client` `~6.0.21`
- `expo-file-system` `~19.0.22`
- `expo-linking` `~8.0.12`
- `expo-notifications` `~0.32.17`
- `react-native-webview` `13.15.0`

## Live Firebase Rollout State

Already applied in Firebase:

- `config/paywallRollout` exists
- `enabled=false`
- `grandfatherBefore=2026-05-18T00:00:00.000Z`
- `rolloutVersion=1`
- `users/{uid}/access/state` written for all 72 existing users

Current expected telemetry state:

- zero metrics summary docs
- zero telemetry events

That is normal until a released build containing the telemetry code is actually opened by users.

## Current App Version Metadata

From [`app.json`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/app.json):

- version: `2.2.1`
- iOS build number: `45`
- bundle identifier: `com.mahmoudahmedalaa.qurannotes`

Important:

- the build script auto-increments `buildNumber`
- if run now, it should move from `45` to `46`

## Intentional Release Exception

The app still contains an App Store review exception in [`ProContext.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/auth/infrastructure/ProContext.tsx):

- `mahmoudahmedalaa+review@gmail.com`

Behavior:

- that account is always granted Pro access

This may be useful for App Review, but it should be treated as an intentional business exception, not forgotten hidden behavior.

## What Is Still Manual

Not yet performed here:

- physical device verification
- local Xcode archive / IPA build
- TestFlight upload
- App Store Connect subscription/trial configuration
- RevenueCat dashboard configuration

## Recommended Next Sequence

### 1. Build the telemetry-enabled release locally

Use the local iOS workflow:

```bash
npx expo prebuild --clean
./scripts/build-ios.sh
```

Why `prebuild --clean` first:

- package versions changed
- the repo uses native iOS output
- `app.json` metadata must stay synced into the native project

### 2. Upload to TestFlight

Use Transporter or Xcode Organizer after the IPA is produced.

### 3. Smoke test the released build

Before any paywall activation:

- sign in
- reach the app
- confirm grandfathered existing users are not blocked
- confirm restore still works
- confirm paywall screens still render normally

### 4. Wait for telemetry

After the build is in testers’ hands, rerun:

```bash
npm run report:firebase-usage
npm run report:paywall-funnel
```

The goal is to confirm:

- metrics summary docs start appearing
- paywall events are being recorded
- app opens are being recorded

### 5. Then do dashboard work

Once the build is confirmed healthy, use:

- [`app-store-revenuecat-setup-guide.md`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/docs/architecture/app-store-revenuecat-setup-guide.md)

to complete:

- App Store Connect subscription and trial setup
- RevenueCat offering and entitlement setup

### 6. Only after all of that

Consider enabling:

- `config/paywallRollout.enabled=true`

## Bottom Line

The code branch is release-ready for a telemetry-enabled build.

The hard paywall is still off.
Existing users are already protected in Firebase.
The next real milestone is getting this build into TestFlight so telemetry can start proving the rollout path before any monetization behavior changes.
