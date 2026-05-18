# Paywall Rollout Status — 2026-05-18

This document captures the live operational state after rollout groundwork, telemetry validation, and the latest paywall UX patch.

## Firebase Status

- project: `qurannotes-9f7a1`
- `config/paywallRollout` exists
- `enabled=false`
- `grandfatherBefore=2026-05-18T00:00:00.000Z`
- `rolloutVersion=1`

## User Protection Status

- total auth users: 73
- durable access docs written: 72
- users grandfathered by the current cutoff: 72
- existing users newly gated: 0

## Telemetry Status

- metrics summary docs: 1
- telemetry event docs: 0
- app opens recorded: 1
- users seen in last 7 days: 1
- paywall views recorded in summary docs: 2

This confirms the telemetry path is now writing from a released build.

The funnel report now shows a minimal but valid baseline:

```bash
npm run report:paywall-funnel
```

## Interpretation

The rollout foundation is live, but the hard paywall is not active.

- remote control exists
- existing users are protected
- telemetry tables are live
- no monetization behavior has changed yet

## Release Candidate Status

- latest local archive: `2.2.2 (50)`
- includes:
  - intro-offer trial messaging support on paywalls
  - live package pricing from RevenueCat products
  - clearer unavailable-product fallback messaging
- TestFlight upload is still pending because the non-interactive export/upload path could not access an Apple distribution account/certificate in this session

## Useful Commands

Inspect the rollout config:

```bash
npm run paywall:rollout
```

Refresh the Firebase usage report:

```bash
npm run report:firebase-usage
```
