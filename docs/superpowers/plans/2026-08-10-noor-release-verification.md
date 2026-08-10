# Noor RAG Release Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the reviewed Noor implementation into a reproducible, independently verified TestFlight candidate and submit it only after every safety, corpus, billing, purchase, App Check, and owner-approval gate passes.

**Architecture:** Release proceeds from local proof to owner-only dark infrastructure, physical TestFlight validation, and finally public/submission decisions. Repository artifacts and exact SHAs are authoritative; no external mutation is implied by code-plan approval.

**Tech Stack:** npm/Node 20, Firebase CLI, Google Cloud/Firebase Console, local Expo prebuild, Xcode archive, Transporter/TestFlight, RevenueCat, App Store Connect.

---

### Task 1: Resolve the disk and toolchain blockers safely

**Files:**
- Create: `docs/releases/noor-rag-release-evidence.md`
- Modify only with separate approval: local regenerable caches outside Git

- [ ] **Step 1: Audit storage read-only**

Run:

```bash
df -h /
du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null
du -sh ~/Library/Caches/CocoaPods 2>/dev/null
du -sh ~/.npm/_cacache 2>/dev/null
du -sh /Users/mahmoudalaaeldin/.codex/worktrees/* 2>/dev/null | sort -h
```

Record exact candidates. Do not delete worktrees, source checkouts, archives, signing assets, `.env` files, or user documents.

- [ ] **Step 2: Ask for exact cleanup approval if less than 25 GiB is free**

The request names each regenerable cache path and size. After approval, remove only those explicit cache/DerivedData targets and report that they are regenerable. Re-run `df -h /`; require at least 25 GiB before dependency/native work.

- [ ] **Step 3: Install/enter Node 20 with explicit approval and install dependencies deterministically**

```bash
brew list node@20 >/dev/null 2>&1 || brew install node@20
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
command -v node
command -v npm
node --version
npm ci --ignore-scripts
npx patch-package
npm --prefix functions ci --ignore-scripts
```

Installing Homebrew `node@20` is a machine mutation and requires owner approval if it is absent. Expected paths begin `/opt/homebrew/opt/node@20/bin/`; Node is `v20.x`. Stop after three repeated failures under the repository debug rules.

- [ ] **Step 4: Record baseline**

```bash
git status --porcelain=v1 -z -uall
npm run typecheck
npm run typecheck:functions
npm test -- --runInBand --passWithNoTests
npm --prefix functions test
npm --prefix functions run build
git diff --check
```

Record existing failures separately from implementation regressions. Do not hide failures with exclusions.

- [ ] **Step 5: Require the ignored release environment before export/native work**

The owner supplies `.env` or `.env.local` in this isolated worktree through the existing ignored mechanism. Verify presence and run the environment validator without printing values:

```bash
test -f .env -o -f .env.local
git check-ignore .env .env.local 2>/dev/null
node scripts/validate-release-environment.js
```

Missing production Firebase/RevenueCat public configuration blocks export, prebuild, and archive.

### Task 2: Prove the experimental guided feature is excluded

**Files:**
- Create: `docs/releases/noor-rag-experimental-feature-audit.md`
- Create: `docs/releases/evidence/noor-rag-home-and-quran-flow.png`

- [ ] **Step 1: Identify the prior experiment without porting it**

Inventory the dirty checkout separately and search both carriers for Focus/guided/coach/experimental entry points:

```bash
git -C /Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp status --short
git -C /Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp diff --name-only
rg -n "Focus Mode|focus mode|guided|guide|coach|experiment" app src docs --glob '!src/features/tafsir/data/tafsir/**'
rg -n "Focus Mode|focus mode|guided|guide|coach|experiment" /Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp/app /Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp/src --glob '!**/tafsir/data/tafsir/**'
```

Record the exact candidate files and whether they are shipped, planned-only, or dirty/uncommitted. The approved release must not add Quran Focus Mode, guided end-of-flow UI, or unrelated experimental navigation.

- [ ] **Step 2: Capture the release-carrier UI**

After the simulator build succeeds, launch from a clean install and capture the relevant home/Quran flow showing the experiment is absent. Store the screenshot at the exact evidence path above and include it in the handoff for owner inspection.

- [ ] **Step 3: Commit the audit/evidence**

```bash
git add docs/releases/noor-rag-experimental-feature-audit.md docs/releases/evidence/noor-rag-home-and-quran-flow.png
git commit -m "docs(release): prove guided experiment is excluded"
```

### Task 3: Close the corpus provenance and human religious-review gates

**Files:**
- Verify: `docs/noor-rag/corpus-provenance.json`
- Create: `docs/releases/noor-rag-religious-review.md`

- [ ] **Step 1: Run corpus validation**

```bash
npm --prefix functions run noor:corpus:validate -- --version=2026-08-10-v1
shasum -a 256 docs/noor-rag/corpus-provenance.json
```

Expected: 114+114 files, 8,032 units, 12,472 mappings, zero failed chunks, aggregate hashes match.

- [ ] **Step 2: Obtain owner approval of edition and redistribution basis**

Present source IDs, labels, upstream references, resource IDs, retrieval/revision dates, hashes, and licensing basis. Public activation remains blocked until the owner explicitly approves the provenance record; code completion cannot waive this gate.

- [ ] **Step 3: Run the fixed evaluation suite and independent human review**

```bash
npm --prefix functions run noor:eval -- --fixtures
```

Have an independent qualified reviewer inspect representative Ibn Kathir, Al-Sa'di Arabic-to-English paraphrases, disagreements, hadith-within-tafsir, refusals, and citations. Record each case ID, verdict, issue, correction SHA, and re-review verdict. No failed religious-output case is waived.

### Task 4: Verify billing, quotas, secrets, and dashboard state read-only

**Files:**
- Update: `docs/releases/noor-rag-release-evidence.md`
- Create: `docs/releases/noor-rag-old-client-migration.md`

- [ ] **Step 1: Confirm project and deployed state**

```bash
firebase use
firebase functions:list --project qurannotes-9f7a1
firebase firestore:indexes --project qurannotes-9f7a1
```

Expected project: `qurannotes-9f7a1`. Record existing functions/indexes; do not deploy.

- [ ] **Step 2: Verify console billing and model access with owner**

Confirm Blaze billing account, Vertex AI API/model availability, intended budget alerts, service quotas, function max instances, and quota envelope. Because `gcloud` is not installed, use authenticated console evidence unless the owner separately approves installing/configuring Google Cloud CLI.

- [ ] **Step 3: Re-verify RevenueCat and Apple state**

In RevenueCat, confirm the active `default` offering contains Monthly, Annual, and Lifetime and that all grant `pro_access`. In App Store Connect, confirm the Lifetime non-consumable is Ready for Review, agreements/tax/banking are valid, and it can be attached to the next version. Record timestamps/screenshots because dashboard state is mutable.

- [ ] **Step 4: Verify secrets without exposing values**

Confirm `REVENUECAT_SECRET_API_KEY` and `NOOR_TELEMETRY_HMAC_KEY` exist or require creation. Record only secret names and version/status, never values. Confirm the release `.env`/`.env.local` is ignored and has the production Firebase and RevenueCat public SDK settings.

- [ ] **Step 5: Record the 2.2.2 fleet decision**

Document that version 2.2.2 cannot be rewritten remotely and has no existing minimum-version facility. Keep `gen-lang-client-0986553355` unbilled and tightly quota-limited; never make it the new production path. Define an owner-approved adoption threshold and observation window before rotating/deleting the exposed key. Until that decision is reached, use the App Store update availability and support messaging rather than adding another remote-config system to this release. Record old-client traffic evidence, chosen threshold, key-rotation owner, and rollback consequence in `docs/releases/noor-rag-old-client-migration.md`.

### Task 5: Prepare a clean, reviewed deployment artifact

**Files:**
- Update: `docs/releases/noor-rag-release-evidence.md`
- Update: `docs/superpowers/handovers/2026-08-10-noor-rag-release-handover.md`

- [ ] **Step 1: Run the complete static gate**

```bash
git status --porcelain=v1 -z -uall
git diff --check
npm run typecheck
npm run typecheck:functions
npm test -- --runInBand --passWithNoTests
npm --prefix functions test
firebase emulators:exec --only firestore "npm --prefix functions run test:rules"
npm --prefix functions run build
npm --prefix functions run noor:eval -- --fixtures
npm run lint
npx expo export --platform ios
node scripts/generate-noor-contract.js --check
rg -n "EXPO_PUBLIC_GEMINI_API_KEY|GoogleGenerativeAI|generativelanguage.googleapis.com|firebase/ai|getGenerativeModel|VertexAIBackend|GoogleAIBackend" app src package.json --glob '*.{ts,tsx,js,jsx,json}' --glob '!**/*.test.*' --glob '!**/docs/**'
node -e "const p=require('./package.json'); if (p.dependencies?.['@google/generative-ai'] || p.devDependencies?.['@google/generative-ai']) process.exit(1)"
if npm ls @google/generative-ai --depth=0 >/dev/null 2>&1; then echo "forbidden direct dependency: @google/generative-ai"; exit 1; fi
rg -n "NoorUsageService|TafsirUsageService" app src --glob '!**/*.test.*' --glob '!**/data/**'
git ls-files '.env' '.env.*' '*.p8'
```

Expected: all commands pass; prohibited client-AI, legacy client-quota import, and tracked-secret searches are empty.

- [ ] **Step 2: Obtain independent reviews at one exact SHA**

Required verdicts: specification PASS, code-quality PASS, security PASS, religious-output PASS, and release-readiness PASS. Reviewers are read-only. Any correction produces a new SHA and invalidates prior verdicts until re-review.

- [ ] **Step 3: Write the clean checkpoint**

Record branch, HEAD, clean status, command outputs/pass totals, corpus hash, Functions artifact hash, blockers, and exact next action. This is the only valid handover point.

### Task 6: Perform owner-approved dark infrastructure rollout

**Files:**
- Update evidence only; external state changes require separate approval.

- [ ] **Step 1: Ask for secret creation/update approval**

Only after approval:

```bash
firebase functions:secrets:set REVENUECAT_SECRET_API_KEY --project qurannotes-9f7a1
firebase functions:secrets:set NOOR_TELEMETRY_HMAC_KEY --project qurannotes-9f7a1
```

- [ ] **Step 2: Ask for Firestore rules/index deployment approval**

Only after approval:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project qurannotes-9f7a1
```

Wait until the 768-dimensional `chunks` vector index reports ready.

- [ ] **Step 3: Ask for corpus ingestion approval**

First show the dry-run target/count/hash. Only after approval:

```bash
npm --prefix functions run noor:corpus:ingest -- --project=qurannotes-9f7a1 --version=2026-08-10-v1 --execute-production-write
```

Validate the production manifest and leave it inactive. After the deployed index and ingested corpus are both present, run the real readiness probe before activation:

```bash
npm --prefix functions run noor:index:verify -- --project=qurannotes-9f7a1 --version=2026-08-10-v1 --source=ibn_kathir_en_abridged
```

Expected: `ready`; missing/building/mismatched index state exits nonzero and blocks activation.

- [ ] **Step 4: Ask for targeted function deployment approval**

Before deploying, request owner approval to register `com.mahmoudahmedalaa.qurannotes` for Firebase App Check with App Attest in project `qurannotes-9f7a1`. Register a debug token only for the controlled local/simulator proof and never store it in Git or the app bundle. The callable deploys with `enforceAppCheck: true`; there is no later enforcement toggle.

Only after approval:

```bash
firebase deploy --only functions:askNoorRagV1 --project qurannotes-9f7a1
```

Never deploy all functions. Runtime config stays disabled/public false with only explicit owner UID allowlist.

- [ ] **Step 5: Ask separately for the account-deletion trigger deployment approval**

The reviewed `onUserDeleted` change is required to remove Noor usage, idempotency, entitlement cache, and telemetry subject mappings. Only after separate approval:

```bash
firebase deploy --only functions:onUserDeleted --project qurannotes-9f7a1
```

Record the targeted deployment receipt, Functions artifact hash, and exact prior artifact/rollback command. Never deploy all functions.

- [ ] **Step 6: Ask for disabled runtime initialization and owner-only activation approval**

First create the complete reviewed disabled config only if the document is absent:

```bash
npm --prefix functions run noor:runtime:configure -- --project=qurannotes-9f7a1 --initialize-disabled --expected-missing --config=docs/noor-rag/runtime-config.2026-08-10-v1.json --execute-production-write
```

Verify the complete document is disabled/public false, has an empty owner list, uses the reviewed locked fields, and has `activeCorpusVersion: "none"`. After index/manifest readiness, activate with the explicit `none` compare-and-set:

```bash
npm --prefix functions run noor:corpus:activate -- --project=qurannotes-9f7a1 --version=2026-08-10-v1 --expected-current=none --execute-production-write
```

Then apply the separately reviewed owner allowlist/config diff:

```bash
read -r APPROVED_OWNER_UID
npm --prefix functions run noor:runtime:configure -- --project=qurannotes-9f7a1 --owner-only --owner-uid="$APPROVED_OWNER_UID" --expected-enabled=false --expected-public=false --execute-production-write
```

The owner supplies the Firebase UID through the interactive shell input or another non-logged ignored mechanism; do not place it in Git or command history. Require at least one valid UID and record only the script's redacted/hash membership proof.

Task 6 ends with infrastructure/config receipt checks only. Do not claim an authenticated callable smoke result before Task 7 produces an App Check-capable native build.

### Task 7: Regenerate and verify native iOS configuration

**Files:**
- Modify: `app.json`
- Modify generated files under: `ios/`
- Verify: `targets/widget/Info.plist`, `ios/QuranNotes.xcodeproj/project.pbxproj`, app target Info.plist

- [ ] **Step 1: Confirm an unused release version/build**

Verify App Store Connect live/build history. A minor release such as 2.3.0 is reasonable because this release adds Noor/Lifetime behavior, but the owner must approve an available marketing version and unused build. Export those values as `APPROVED_RELEASE_VERSION` and `APPROVED_UNUSED_BUILD`. Before prebuild, explicitly set `expo.version` and `expo.ios.buildNumber` in `app.json` to those reviewed values; do not auto-increment during prebuild or archive.

- [ ] **Step 2: Record native before-state and close Xcode**

```bash
git status --short
git rev-parse HEAD
rg -n "MARKETING_VERSION|CURRENT_PROJECT_VERSION" ios/QuranNotes.xcodeproj/project.pbxproj
```

- [ ] **Step 3: Prebuild locally and inspect all native churn**

```bash
npx expo prebuild --clean --platform ios
git status --short
git diff -- ios app.json targets modules plugins package.json package-lock.json
QURANNOTES_RELEASE_VERSION="$APPROVED_RELEASE_VERSION" QURANNOTES_RELEASE_BUILD="$APPROVED_UNUSED_BUILD" node scripts/validate-release-metadata.js
```

The validator must compare the owner-approved values against `app.json`, the app and widget build settings, and both app/widget Info.plists after prebuild. Verify App Attest capability/production environment, Firebase App Check integration before backend calls, app/widget bundle IDs, Team `2S42RLH67Y`, background audio, URL schemes, privacy manifests, and widget target. Reject unrelated generated churn.

- [ ] **Step 4: Build and smoke-test simulator without Expo Go**

```bash
npx expo export --platform ios
xcodebuild -showBuildSettings -workspace ios/QuranNotes.xcworkspace -scheme QuranNotes -configuration Release | rg "MARKETING_VERSION|CURRENT_PROJECT_VERSION|PRODUCT_BUNDLE_IDENTIFIER|DEVELOPMENT_TEAM"
test -d ios/Pods
test -d ios/QuranNotes.xcworkspace
```

Run the exact local native simulator command:

```bash
npx expo run:ios
```

Verify launch, auth, all paywall layouts, Noor unavailable handling, tafsir sheet, citations, Quran Goals naming/behavior, and the excluded guided experiment screenshot. With the controlled ignored debug App Check registration, sign into the owner QA account and run the first authenticated owner-only callable smoke. Verify raw questions/answers/provider bodies are absent from telemetry. Request and record explicit approval separately for each kill-switch change, corpus rollback, corpus restoration, targeted function rollback, and targeted function restoration. Exercise only the approved mutation, verify its expected behavior, restore the reviewed owner-only state under its separate approval, and record every deployment/config receipt before continuing.

- [ ] **Step 5: Commit reviewed native output**

```bash
git add app.json package.json package-lock.json ios targets modules plugins docs/releases
git commit -m "build(ios): prepare Noor App Check release"
```

Run independent native/release re-review on the new SHA.

### Task 8: Build, upload, and test through TestFlight with separate approvals

**Files:**
- Update evidence only; archive/upload are external actions.

- [ ] **Step 1: Run final pre-archive gate**

```bash
git status --porcelain=v1 -z -uall
git diff --check
node scripts/validate-release-metadata.js
node scripts/generate-noor-contract.js --check
npm run typecheck
npm run typecheck:functions
npm test -- --runInBand --passWithNoTests
npm --prefix functions test
firebase emulators:exec --only firestore "npm --prefix functions run test:rules"
npm --prefix functions run build
npm run lint
npx expo export --platform ios
```

Expected: clean tree and all gates pass.

- [ ] **Step 2: Prepare Xcode for the owner to archive**

Verify the ignored release environment is present before export/opening Xcode:

```bash
test -f .env -o -f .env.local
node scripts/validate-release-environment.js
QURANNOTES_RELEASE_VERSION="$APPROVED_RELEASE_VERSION" QURANNOTES_RELEASE_BUILD="$APPROVED_UNUSED_BUILD" ./build-ios.sh
```

The canonical script validates every metadata carrier against the approved values and opens the workspace; it never archives. The agent does not run Archive. The owner confirms scheme `QuranNotes`, destination `Any iOS Device (arm64)`, the approved version/build, signing team `2S42RLH67Y`, then chooses `Product > Archive`. After the owner reports completion, verify archive identifiers, entitlements, dSYMs, signing, widget, and App Check capability from Organizer evidence.

- [ ] **Step 3: Ask separately for TestFlight upload approval**

Upload through Xcode Organizer or Transporter. Wait for processing; do not submit to review yet.

- [ ] **Step 4: Run physical TestFlight matrix**

On a clean install and returning-user install verify:

- App Attest token accepted and invalid/no-token requests rejected.
- Noor chat retrieves/cites both scholars where supported.
- Ibn Kathir and Al-Sa'di verse summaries/questions use exact ranges.
- Fatwa, standalone hadith, medical/legal, injection, and no-evidence cases fail safely.
- 50/day paid quota, 5 RPM, idempotent retry, timeout, offline, kill switch, and rollback copy.
- Monthly, Annual, and Lifetime purchase, `pro_access` unlock, cancellation, and restore from fresh StoreKit/TestFlight accounts.
- Friendly sign-up validation/provider errors and stale-error clearing.
- Quran reading, notes, folders, Khatma, audio/background controls, widget, settings, links, and navigation regressions.

Record videos/screenshots, account class, build, time, result, and defect SHA. No safety/App Check/purchase/build defect is waived.

- [ ] **Step 5: Ask for public backend activation approval**

The callable has enforced App Check since the dark deployment. Only after physical proof and dark telemetry review, request approval to set public enabled. Apply the reviewed compare-and-set config with `noor:runtime:configure -- --project=qurannotes-9f7a1 --public --expected-enabled=true --expected-public=false --execute-production-write`. Monitor error rate, p95, App Check rejection, retrieval empties, citation failures, tokens, and estimated cost. If thresholds regress, use kill switch or targeted rollback.

### Task 9: Attach Lifetime and submit the app only after final approval

**Files:**
- Finalize: `docs/releases/noor-rag-release-evidence.md`

- [ ] **Step 1: Complete App Store Connect metadata**

Attach the Lifetime IAP to `$APPROVED_RELEASE_VERSION`, verify privacy disclosures, legal URLs, review notes, screenshots, build, version, widget, agreements, and product metadata. Confirm the IAP is included in the submission, not merely Ready for Review separately.

- [ ] **Step 2: Obtain final independent release verdict**

The reviewer checks the exact uploaded build evidence, production configuration, TestFlight matrix, corpus/provenance approval, dashboards, rollback proof, and unresolved defects. Verdict must be PASS.

- [ ] **Step 3: Request explicit App Store submission approval**

Only after the owner says to submit, submit `$APPROVED_RELEASE_VERSION` with the attached Lifetime IAP. Record App Store Connect receipt/status and do not describe Apple review as complete.

## Final evidence fields

The release evidence document must include:

```markdown
- Source SHA and clean status
- Marketing version/build and App Store Connect availability proof
- Corpus version, provenance approval, manifest hash, unit/chunk/mapping counts
- Functions artifact hash and targeted deployment receipt
- Rules/index/corpus/activation receipts
- App Check provider/enforcement/TestFlight proof
- Billing project, budgets, quotas, max instances, model versions
- RevenueCat offering/package/entitlement proof
- Monthly/Annual/Lifetime purchase and restore proof
- Auth, client, Functions, eval, lint, export, archive results
- Security, code-quality, religious-output, and release reviewer verdicts
- Kill-switch, corpus rollback, function rollback exercises
- Open defects and explicit release blockers
- Owner approvals for each external action
```
