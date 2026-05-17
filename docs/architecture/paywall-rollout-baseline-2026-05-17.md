# Paywall Rollout Baseline — 2026-05-17

Generated from Firebase Auth + Firestore on 2026-05-17.

## Auth

- Total users: 72
- Active in last 7 days: 2
- Active in last 30 days: 12
- Active in last 90 days: 72
- Newest account: 2026-05-12T22:31:53.832Z
- Latest login: 2026-05-12T22:31:53.832Z

Provider mix:

- Password: 55
- google.com: 13
- apple.com: 4

## Firestore

- Notes: 25
- Recordings: 18
- Folders: 1
- Pro sync docs: 45
- Distinct sync users: 9
- Access state docs: 0
- Metrics summary docs: 0
- Telemetry event docs: 0

## Interpretation

- The user base exists, but recent activity is low.
- There was measurable historical engagement in synced Pro-capable areas, but telemetry for paywall and session behavior did not exist yet at the time of this baseline.
- This snapshot is the “before” state for the hard-paywall migration and telemetry rollout.

## Re-run

```bash
npm run report:firebase-usage
```
