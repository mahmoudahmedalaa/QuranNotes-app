# QuranNotes repository and release audit

Audit snapshot: 2026-08-11 UTC. This is a read-only audit of the source tree plus live Google Cloud state. No merge, push, App Store submission, or archive was performed.

## State summary

| Area | State | Evidence |
|---|---|---|
| Noor callable | Live/ACTIVE | `askNoorRagV1`, Gen 2, us-central1 |
| Noor runtime | Live/public | `noorConfig/runtime`: enabled=true, publicEnabled=true, active corpus `2026-08-10-v1` |
| Firestore corpus | Complete | 7,867 units, 9,248 chunks, 12,408 lookups, zero failures |
| Vector index | Ready | Both source filters/COSINE probes passed previously |
| Backend tests/build | Green | Noor suite 158/158 at the release audit; activation branch 161/161 after override work |
| Architecture docs | Complete | `ARCHITECTURE.md` and editable `.drawio` diagram |
| Email | Drafted | Gmail draft to `cloud@tafsir.net`, unsent |
| App Store release | Not ready | Native/paywall/signing/StoreKit work remains |

## Important state mismatch

The live runtime is public because the owner explicitly accepted the unresolved corpus risk through the operator override. The committed provenance record still says `publicActivationApproved=false` and retains its five warnings. This is intentional and documented; it is not a claim that the source rights have been independently cleared.

## Repository/Git state

- Main checkout: branch `feature/noor-ai-phase5`, HEAD `3f34f0f0f`; 21,087 status entries including large generated/deleted/untracked material. It is not safe to pull, reset, merge, or push from this checkout.
- Noor release worktree: branch `codex/noor-rag-release`, HEAD `ed7884514`; 104 status entries from unfinished paywall/signup/native release work. It is not safe to merge another branch into it without first completing or explicitly shelving that work.
- Evidence worktree: branch `codex/noor-evidence`, clean at commit `8b90d7f95`. It contains only the architecture/evidence documents on top of the tested Noor activation branch.
- Remote `origin` is reachable and contains the existing project branches. No fetch, push, merge, or reset was run.

## Remaining work, in priority order

### P0: App Store release safety

1. Resolve the unfinished paywall/signup/native changes in one owned worktree.
2. Secure the Firestore paywall rollout read path and remove client-writable grandfather bypasses.
3. Guard all deep-linked routes behind the hard paywall and complete modal dismissal protection.
4. Add onboarding renewal/cancellation copy plus Privacy/Terms links.
5. Regenerate iOS native configuration and Pods so App Check/App Attest is actually present.
6. Confirm an unused App Store Connect version/build, distribution signing, and Lifetime product/offering state.
7. Run local Xcode Release archive, Transporter upload, TestFlight purchase/restore QA, then stop for the owner to submit.

### P1: Noor production hardening

1. Add Noor data deletion to `onUserDeleted` for entitlement cache, usage, idempotency, rate, telemetry, owner-QA, and grandfathering records.
2. Add Firestore TTL field overrides for idempotency and telemetry expiry fields.
3. Remove or explicitly isolate legacy AI paths (`explainVerse`, old `askSheikh`, direct client Gemini/OpenAI fallback, Tadabbur direct Firebase AI Logic) before claiming the new architecture is the only AI path.
4. Add Firestore rules and evaluation coverage for Noor paths; current rules default-deny them, which is safe for Admin-only access but should be intentional and tested.
5. Add production evaluation fixtures for retrieval/generation quality and a clear invalid-request status contract.
6. Decide whether production App Check should use App Attest only or add DeviceCheck fallback; current code uses debug in development and App Attest in production.

### P2: Documentation and operational polish

- Keep the live runtime/provenance status synchronized in the checked-in evidence document after any owner decision.
- Add a routine index/manifest health check and alerting runbook.
- Repair the root Jest configuration so backend `node:test` files are not accidentally discovered by the app Jest root.

## Safe Git plan

1. Treat `codex/noor-rag-release` as the sole writer for the App Store work.
2. Finish and independently review its uncommitted files; do not mix them with the evidence branch.
3. Merge the reviewed release commit into the chosen release branch only after the owner confirms the target branch.
4. Push only the reviewed branch after the local release checks pass.
5. Archive with Xcode and upload via Transporter; do not use EAS.

The current repository state does not support a safe automatic pull/merge/push. The evidence branch is intentionally separate so the architecture proof is preserved without overwriting the release worktree.
