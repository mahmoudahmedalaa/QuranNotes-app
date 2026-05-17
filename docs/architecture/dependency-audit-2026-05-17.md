# Dependency Audit — 2026-05-17

## Scope

This audit separates:

- low-risk compatibility updates that were applied now
- higher-risk dependency upgrades that should be treated as dedicated follow-up work

## Applied Now

These were the Expo-recommended compatibility fixes for the current SDK 54 app and were verified after install:

- `expo` `~54.0.33` -> `~54.0.34`
- `expo-dev-client` `~6.0.20` -> `~6.0.21`
- `expo-file-system` `~19.0.21` -> `~19.0.22`
- `expo-linking` `~8.0.11` -> `~8.0.12`
- `expo-notifications` `~0.32.16` -> `~0.32.17`
- `react-native-webview` `13.16.1` -> `13.15.0`

## Verification After Update

The following checks passed after the compatibility patch set:

- `npx expo install --check`
- `npm run typecheck`
- `npm run typecheck:functions`
- `npm run report:paywall-funnel`

## Important Constraint Discovered

`react-native-swipeable-card-stack@2.0.0` currently advertises:

- `react-native-reanimated@^3.0.0`

But the app is already using:

- `react-native-reanimated@4.x`

This mismatch is not breaking the app immediately, but it does mean ordinary `npm install` can hit peer-resolution conflicts during dependency updates. The safe compatibility patch set was completed using the existing dependency graph with `--legacy-peer-deps`.

## Recommendation For This Constraint

Before attempting a broader dependency modernization, treat this as an explicit migration task:

1. confirm whether `react-native-swipeable-card-stack` is still actively used
2. if unused, remove it
3. if used, replace it with a maintained alternative or fork/patch it for Reanimated 4 compatibility

Current finding: it is actively used in [`TodayReadingCard.tsx`](/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp-paywall-audit/src/features/khatma/presentation/TodayReadingCard.tsx), so this should be handled as a real feature-level migration, not just dependency cleanup.

## Deferred Higher-Risk Upgrades

These are worth revisiting later, but they should not be mixed into paywall rollout work:

- Expo SDK 55 migration
- React Native ecosystem major/minor upgrades tied to SDK 55
- RevenueCat upgrade beyond the current 9.x line
- Firebase client upgrade beyond the current installed range
- Skia upgrade
- Moti upgrade
- broader lint/tooling modernization

## Why They Were Deferred

Each of the items above can change runtime behavior, native compatibility, or build/test assumptions. They are better handled as their own tracked maintenance batch after the paywall rollout instrumentation is shipping and observable.
