# Noor RAG Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one reviewable iOS release in which Noor chat and verse-level AI use a safe, citation-grounded Firebase backend, while Lifetime purchase support and friendly sign-up errors are completed and verified.

**Architecture:** This is the controller plan for three independently testable workstreams: the backend/corpus, the iOS client/commercial/auth changes, and release verification. All work stays on `codex/noor-rag-release`, one writer at a time, with a fresh specification reviewer and then code-quality reviewer after each implementation task.

**Tech Stack:** React Native 0.81, Expo SDK 54 native workflow, TypeScript, Firebase Auth/App Check/Cloud Functions Gen2/Firestore, Vertex AI Gemini, RevenueCat, Jest, Node test runner, local Xcode/TestFlight.

---

## Durable release state

- Release worktree: `/Users/mahmoudalaaeldin/.codex/worktrees/noor-rag-release`
- Approved base: `8f36182b7def8140ddd87232b7d4a40b9dc02ba8`
- Approved design: `docs/superpowers/specs/2026-08-10-noor-rag-release-design.md`
- Initial design commit: `1b7123e6ae2463c22d8b68b71217fbdbed0c69ed`; the approved-plan checkpoint SHA is recorded after the plans are committed.
- Live App Store version at planning time: `2.2.2`
- Current release metadata in source: `2.2.2 (50)`; do not reuse without App Store Connect verification.
- Production writes, deployment, key rotation, build upload, and submission require separate explicit owner approval.

## Plan decomposition and order

1. `docs/superpowers/plans/2026-08-10-noor-rag-backend.md`
   Produces a locally tested, deployable `askNoorRagV1`, deterministic bilingual corpus artifact, rules/index definitions, and fixed safety evaluation suite.
2. `docs/superpowers/plans/2026-08-10-noor-client-commercial-auth.md`
   Produces an App Check-bearing client transport, rewired Noor and tafsir UI, Lifetime purchase UI, fair-use disclosures, and friendly sign-up behavior.
3. `docs/superpowers/plans/2026-08-10-noor-release-verification.md`
   Produces reproducible build tooling, a complete release evidence packet, dark rollout proof, TestFlight matrix, and the owner approval gates for submission.

The backend contract task completes before client transport implementation. Commercial/auth work can proceed after the client plan's contract fixture is locked. Native prebuild, archive, or external configuration cannot begin until both implementation plans are committed and their static verification passes.

## Approved-spec coverage

| Specification requirement | Executable plan location |
|---|---|
| Both complete tafsir corpora, provenance, hashes, canonical units, deterministic bilingual chunks | Backend Tasks 2–3 |
| Exact verse retrieval and source-balanced multilingual semantic retrieval | Backend Task 4 |
| Auth, App Check, RevenueCat entitlement, paid/grandfathered/owner quotas, idempotency | Backend Tasks 5 and 7; Client Task 1 |
| Religious policy, no generic fallback, citation allowlist, fixed evaluation suite | Backend Tasks 6 and 8 |
| Kill switch, active corpus, privacy-safe telemetry, deletion, targeted rollback | Backend Tasks 7–8; Release Tasks 6–8 |
| No direct client Gemini path, Noor/verse migration, cited UI, deterministic Tadabbur fallback | Client Tasks 1–5 |
| Lifetime/Monthly/Annual UI, purchase, entitlement refresh, restore, fair-use copy | Client Task 6; Release Tasks 4, 8, and 9 |
| Lifetime/legal/privacy/App Store disclosure | Client Task 7; Release Task 9 |
| Friendly sign-up errors with unchanged password policy and screen proof | Client Task 8; Release Task 8 |
| Old 2.2.2 fleet/key migration decision | Release Task 4 |
| Experimental guided/Focus work excluded with visual evidence | Release Task 2 |
| Local Xcode/TestFlight release, physical App Check/purchase proof, independent reviews, owner approvals | Release Tasks 5–9 |

### Task 1: Establish a reproducible implementation baseline

**Files:**
- Create: `.nvmrc`
- Modify: `package.json`
- Modify: `functions/package.json`
- Modify: `build-ios.sh`
- Modify: `scripts/build-ios.sh`
- Create: `scripts/validate-release-metadata.js`
- Create: `scripts/validate-release-environment.js`
- Create: `scripts/validate-release-environment.test.js`

- [ ] **Step 1: Record current state and storage blocker**

Run:

```bash
git status --porcelain=v1 -z -uall
git rev-parse HEAD
df -h /
node --version
```

Expected: clean tree at the last committed plan/spec checkpoint. Do not install dependencies or run a native build with less than 25 GiB free.

- [ ] **Step 2: Pin Node 20 and make Functions agree**

Create `.nvmrc` containing exactly:

```text
20
```

Set root `package.json`:

```json
"engines": { "node": "20.x" }
```

Set `functions/package.json`:

```json
"engines": { "node": "20" }
```

- [ ] **Step 3: Make release metadata explicit**

Create `scripts/validate-release-metadata.js` to read `app.json`, `ios/QuranNotes.xcodeproj/project.pbxproj`, the app target Info.plist, and `targets/widget/Info.plist`; fail unless marketing version and build number agree. When `QURANNOTES_RELEASE_VERSION` and `QURANNOTES_RELEASE_BUILD` are supplied, it also fails unless every source/native target equals those approved values. Create `scripts/validate-release-environment.js` to load `.env.local` then `.env`, require the existing Firebase public client fields and platform RevenueCat public SDK key, report missing variable names only, and never print values. Add fixture-based validator tests that supply temporary complete/missing maps without reading the live ignored environment. Update the canonical root `build-ios.sh` to require `QURANNOTES_RELEASE_VERSION` and `QURANNOTES_RELEASE_BUILD`, validate them before opening Xcode, and never auto-increment or archive. Replace `scripts/build-ios.sh` with a small delegating wrapper:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/../build-ios.sh" "$@"
```

- [ ] **Step 4: Verify the baseline changes**

Run:

```bash
node scripts/validate-release-metadata.js
node --test scripts/validate-release-environment.test.js
git diff --check
git status --short
```

Expected: metadata validator passes for the current internally consistent source values; environment validation behavior passes entirely from fixtures even though the release worktree does not yet contain `.env`/`.env.local`; the diff contains only this task. Live environment validation remains Release Task 1 Step 5.

- [ ] **Step 5: Commit**

```bash
git add .nvmrc package.json functions/package.json build-ios.sh scripts/build-ios.sh scripts/validate-release-metadata.js scripts/validate-release-environment.js scripts/validate-release-environment.test.js
git commit -m "build: make Noor release tooling reproducible"
```

### Task 2: Execute the backend/corpus plan

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-noor-rag-backend.md`

- [ ] **Step 1: Execute every backend task with TDD**

Use a fresh implementer for each task. The controller runs the named verification command, then dispatches a fresh specification reviewer and a fresh code-quality reviewer. Corrections are made by the original implementer and re-reviewed.

- [ ] **Step 2: Stop at the production-write boundary**

Expected local outcome: corpus dry run, Functions tests/build, Firestore rules tests, evaluation fixtures, and secret-free deployment artifact pass. Do not write vectors, indexes, secrets, functions, config, or rules to production.

### Task 3: Execute the client/commercial/auth plan

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-noor-client-commercial-auth.md`

- [ ] **Step 1: Execute every client task with TDD**

Use the same implementer → specification review → code-quality review sequence. Never copy the dirty root checkout wholesale; only reproduce the approved sign-up hunks with tests.

- [ ] **Step 2: Stop at the native/external boundary**

Expected local outcome: all client tests/typecheck/lint/static audits pass and the UI supports all three RevenueCat packages. Do not prebuild, archive, upload, or change RevenueCat/App Store Connect.

### Task 4: Execute the release verification plan

**Files:**
- Plan: `docs/superpowers/plans/2026-08-10-noor-release-verification.md`

- [ ] **Step 1: Complete local and independent review gates**

Follow the release plan through the clean committed implementation checkpoint, corpus provenance decision, build matrix, security review, and religious-output review.

- [ ] **Step 2: Request narrowly scoped production approvals**

Ask separately before each mutation: secrets, Firestore rules/indexes, corpus ingestion, App Check provider/debug registration, enforced `askNoorRagV1` deployment, targeted `onUserDeleted` deployment, owner allowlist/config, each kill-switch change, each corpus rollback/restoration, each targeted function rollback/restoration, later public enablement, TestFlight upload, and App Store submission.

## Controller checkpoint template

At every phase boundary create or update `docs/superpowers/handovers/2026-08-10-noor-rag-release-handover.md` with:

```markdown
# Noor RAG Release Handover

- Branch: codex/noor-rag-release
- Worktree: /Users/mahmoudalaaeldin/.codex/worktrees/noor-rag-release
- HEAD: paste the exact output of `git rev-parse HEAD`
- Tree: clean
- Completed gate: name the one exact completed gate
- Verification: paste the commands and pass counts
- Independent reviews: record each reviewer verdict and reviewed SHA
- Production state changed: write `no` or list each exact mutation receipt and resulting config state
- Active blocker: name one exact blocker or write `none`
- Next action: name one bounded action
```

Do not hand over from a dirty tree. A replacement controller independently verifies branch, HEAD, status, approved spec, completed gate, and next action before assigning a writer.

Fresh controller rotation is mandatory after backend completion, client/commercial/auth completion, the clean pre-production checkpoint, and dark-rollout completion. Each outgoing controller writes and commits the factual handover, then stops; the incoming controller performs the independent opening verification before continuing.
