# Paywall Rollout Status — 2026-05-17

This document captures the live operational state after the initial rollout groundwork was applied.

## Firebase Status

- project: `qurannotes-9f7a1`
- `config/paywallRollout` exists
- `enabled=false`
- `grandfatherBefore=2026-05-18T00:00:00.000Z`
- `rolloutVersion=1`

## User Protection Status

- total auth users: 72
- durable access docs written: 72
- users grandfathered by the current cutoff: 72
- existing users newly gated: 0

## Telemetry Status

- metrics summary docs: 0
- telemetry event docs: 0

This is expected until a released build with the telemetry code is actively used by real users.

## Interpretation

The rollout foundation is live, but the hard paywall is not active.

- remote control exists
- existing users are protected
- telemetry tables are ready
- no monetization behavior has changed yet

## Useful Commands

Inspect the rollout config:

```bash
npm run paywall:rollout
```

Refresh the Firebase usage report:

```bash
npm run report:firebase-usage
```
