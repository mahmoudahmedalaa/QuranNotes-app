# Paywall Activation Checklist

## Goal

Enable the hard paywall for new users only, while preserving:

- existing paying users
- existing free users
- restore-purchase flows
- fast rollback capability

## Engineering Sequence

### Phase 1 — Safe groundwork

1. Ship the app code with rollout support and telemetry while `enabled` remains `false`.
2. Confirm the Firebase reporting scripts work.
3. Confirm the grandfather dry-run shows the current install base is protected.

### Phase 2 — Firebase prep

1. Inspect the current rollout config:

```bash
npm run paywall:rollout
```

2. Seed or update the config in dry-run mode:

```bash
npm run paywall:rollout -- --enabled=false --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1
```

3. Write the config only after reviewing the diff:

```bash
npm run paywall:rollout -- --enabled=false --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1 --write
```

4. Dry-run the durable grandfather backfill:

```bash
npm run backfill:grandfather-access -- --cutoff=2026-05-18T00:00:00.000Z --rollout-version=1
```

5. Write the grandfather access docs only after reviewing the dry-run:

```bash
npm run backfill:grandfather-access -- --cutoff=2026-05-18T00:00:00.000Z --rollout-version=1 --write
```

### Phase 3 — Store configuration

Manual work in App Store Connect and RevenueCat:

1. Confirm the subscription group and products.
2. Configure the introductory free trial for the subscription product.
3. Verify RevenueCat offering and entitlement mapping.
4. Verify restore flows.

### Phase 4 — Activation

1. Release the app version that includes the rollout code.
2. Confirm app sessions are writing telemetry.
3. Enable the rollout in dry-run first:

```bash
npm run paywall:rollout -- --enabled=true --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1
```

4. Write the activation only when all checks are green:

```bash
npm run paywall:rollout -- --enabled=true --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1 --write
```

## Monitoring After Activation

Track:

- auth user growth
- metrics summary doc count
- telemetry event count
- paywall views
- restore events
- subscription outcomes

Useful commands:

```bash
npm run report:firebase-usage
npm run paywall:rollout
```

## Rollback

Immediate rollback is a config change:

```bash
npm run paywall:rollout -- --enabled=false --grandfather-before=2026-05-18T00:00:00.000Z --rollout-version=1 --write
```

That restores open access for non-Pro users without deleting any telemetry or grandfather docs.

## Notes

- `enabled=false` means the code is live but inactive.
- `grandfatherBefore` is the contract that protects the existing install base.
- `rolloutVersion` should be incremented only when we intentionally redefine the rollout boundary or logic.
