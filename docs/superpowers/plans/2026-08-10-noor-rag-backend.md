# Noor RAG Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally verified, deployable `askNoorRagV1` backend grounded only in the versioned Ibn Kathir and Al-Sa'di corpora.

**Architecture:** Pure modules perform validation, corpus construction, retrieval, entitlement/quota control, prompt construction, and citation validation. A thin Gen2 callable composes those modules and fails closed. Corpus creation is deterministic and production upload/activation is a separate owner-approved operation.

**Tech Stack:** Node 20, TypeScript, Firebase Functions Gen2, Firebase Admin/Firestore vector search, Vertex AI `gemini-embedding-2` and GA `gemini-3.5-flash-lite` at `global`, Node test runner.

---

## File map

- `functions/src/noor-rag/types.ts`: public request/response and internal evidence contracts.
- `functions/src/noor-rag/validation.ts`: runtime request/config/schema validation.
- `functions/src/noor-rag/config.ts`: fail-closed runtime model, corpus, threshold, allowlist, and kill-switch configuration.
- `functions/src/noor-rag/corpus.ts`: canonical unit IDs, normalization, chunking, manifests.
- `functions/src/noor-rag/retrieval.ts`: exact and source-balanced semantic retrieval.
- `functions/src/noor-rag/entitlement.ts`: RevenueCat verification and five-minute cache.
- `functions/src/noor-rag/usage.ts`: atomic rate, daily quota, reservation release/finalization, and idempotency lease.
- `functions/src/noor-rag/policy.ts`: policy refusal classifier and fixed safe responses.
- `functions/src/noor-rag/generation.ts`: bounded evidence prompt, Vertex generation, retry classification.
- `functions/src/noor-rag/citations.ts`: structured-output/citation allowlist validation.
- `functions/src/noor-rag/telemetry.ts`: HMAC pseudonyms and privacy-safe event payloads.
- `functions/src/noor-rag/handler.ts`: dependency-injected request orchestration.
- `functions/src/noor-rag/callable.ts`: Gen2 `askNoorRagV1` definition.
- `functions/scripts/noor-rag/build-corpus.ts`: offline deterministic artifact builder.
- `functions/scripts/noor-rag/ingest-corpus.ts`: explicit dry-run or approved production writer.
- `functions/scripts/noor-rag/activate-corpus.ts`: manifest/index-checked atomic activation.
- `functions/scripts/noor-rag/configure-runtime.ts`: compare-and-set dark/public runtime configuration.
- `functions/scripts/noor-rag/validate-corpus.ts`: counts, hashes, mapping, provenance gate.
- `functions/scripts/noor-rag/verify-index.ts`: nonzero-on-not-ready production vector-index probe.
- `functions/test/noor-rag/*.test.ts`: pure/backend tests compiled by `tsconfig.test.json`.
- `functions/test-rules/noor-rag/rules.test.ts`: emulator-only Firestore authorization tests.
- `functions/evals/noor-rag-cases.json`: fixed retrieval, safety, and citation cases.
- `docs/noor-rag/corpus-provenance.json`: source metadata and full-corpus hashes.
- `docs/noor-rag/operations.md`: dark rollout, monitoring, rollback, retention, account cleanup.

### Task 1: Lock the typed contract and validation limits

**Files:**
- Create: `functions/src/noor-rag/types.ts`
- Create: `functions/src/noor-rag/validation.ts`
- Create: `functions/src/noor-rag/config.ts`
- Create: `docs/contracts/noor-rag-v1.schema.json`
- Create: `scripts/generate-noor-contract.js`
- Create: `functions/src/noor-rag/generatedContract.ts`
- Create: `src/features/noor-ai/domain/generatedContract.ts`
- Test: `functions/test/noor-rag/validation.test.ts`
- Modify: `functions/package.json`
- Create: `functions/tsconfig.test.json`
- Create: `functions/tsconfig.scripts.json`

- [ ] **Step 1: Add the failing validation test**

Use `node:test` and `node:assert/strict`. Cover an RFC 4122 UUID, 500-character question, six history turns, 1,000 characters per turn, 6,000 total history characters, source enum, surah range, and verse range. The core assertion is:

```ts
test('rejects oversized and malformed untrusted input', () => {
  assert.throws(() => parseNoorRequest({ mode: 'chat', requestId: 'bad', question: 'x', history: [] }));
  assert.throws(() => parseNoorRequest({
    mode: 'chat',
    requestId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    question: 'x'.repeat(501),
    history: [],
  }));
});
```

Add `@types/node` as an explicit Functions dev dependency. Set these Functions scripts:

```json
"build": "tsc -p tsconfig.json",
"build:test": "tsc -p tsconfig.test.json",
"test": "npm run build:test && node --test lib-test/test/noor-rag/*.test.js"
```

Keep `functions/tsconfig.json` scoped to `src` so the callable entrypoint remains `lib/index.js`. Set `functions/tsconfig.test.json` to extend the main config, use `outDir: "lib-test"`, and include `src`, `test`, and `test-rules`. Set `functions/tsconfig.scripts.json` to extend the main config, use `rootDir: "."`, `outDir: "lib-scripts"`, and include only `src/noor-rag/**/*.ts` plus `scripts/noor-rag/**/*.ts`; script commands execute `lib-scripts/scripts/noor-rag/*.js` and never change the deploy entrypoint layout. This explicitly excludes the legacy `functions/scripts/embed_tafsir.ts` prototype from compilation and execution.

- [ ] **Step 2: Run it red**

Run: `npm --prefix functions run build:test && node --test functions/lib-test/test/noor-rag/validation.test.js`

Expected: FAIL because `parseNoorRequest` is absent.

- [ ] **Step 3: Implement the discriminated contract**

Use `docs/contracts/noor-rag-v1.schema.json` as the authoritative committed wire contract. `scripts/generate-noor-contract.js` deterministically generates the matching backend and client TypeScript contract files, and `node scripts/generate-noor-contract.js --check` fails on drift. The schema defines the specification's three modes exactly: `chat`, `verse_summary`, and `verse_question`; `NoorStatus`, `NoorCitation`, `NoorAnswer`, `NoorSource`, and `NoorHistoryTurn`; and requires ISO-8601 UTC `nextResetAt` only when status is `quota_exceeded`. Define internal `TafsirUnit`, `TafsirChunk`, and `RetrievedEvidence` separately in `types.ts`. Runtime parsing returns a new object containing only allowlisted fields; it never spreads client data. Use this UUID expression:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

Map app sources at the boundary:

```ts
export const APP_TO_CORPUS_SOURCE = {
  ibn_kathir: 'ibn_kathir_en_abridged',
  al_sadi: 'al_sadi_ar',
} as const;
```

Define `NoorRuntimeConfig` with exactly: `enabled`, `publicEnabled`, `ownerUids`, `activeCorpusVersion`, `promptVersion`, `generationModel`, `embeddingModel`, `embeddingDimension`, `pseudonymKeyVersion`, per-source thresholds, `maxChunksPerSource`, and `maxEvidenceCharacters`. `pseudonymKeyVersion` is a required non-secret identifier for the active HMAC secret generation. Parse `noorConfig/runtime` without defaults for safety-critical fields; missing or malformed values fail closed. Lock this release to GA `gemini-3.5-flash-lite` at `global`, `gemini-embedding-2`, and 768 dimensions. The generation model supports structured output and `countTokens`, and its published retirement is July 2027 or later.

- [ ] **Step 4: Run green and commit**

```bash
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/validation.test.js
npm --prefix functions run build
git add docs/contracts/noor-rag-v1.schema.json scripts/generate-noor-contract.js src/features/noor-ai/domain/generatedContract.ts functions/package.json functions/package-lock.json functions/tsconfig.test.json functions/tsconfig.scripts.json functions/src/noor-rag/generatedContract.ts functions/src/noor-rag/types.ts functions/src/noor-rag/validation.ts functions/src/noor-rag/config.ts functions/test/noor-rag/validation.test.ts
git commit -m "feat(noor): define guarded RAG contract"
```

Expected: focused tests and Functions build pass.

### Task 2: Record and enforce corpus provenance

**Files:**
- Create: `docs/noor-rag/corpus-provenance.json`
- Create: `functions/src/noor-rag/provenance.ts`
- Test: `functions/test/noor-rag/provenance.test.ts`
- Inspect only: `scripts/download_tafsir.js`, `scripts/download_tafsir_bulk.js`, `scripts/redownload_tafsir.js`, `scripts/add_verse_ranges.js`

- [ ] **Step 1: Add a failing provenance-schema test**

Require, for both sources: `source`, `sourceTitle`, `language`, `resourceId`, `upstreamReference`, `editionLabel`, `retrievedAt`, `redistributionBasis`, 114 file SHA-256 values, and aggregate SHA-256. Reject the current resource-ID conflict until resolved.

```ts
assert.equal(validateProvenance(manifest).errors.length, 0);
assert.equal(new Set(manifest.sources.map(source => source.resourceId)).size, 2);
assert.ok(manifest.sources.every(source => Number.isInteger(source.resourceId) && source.resourceId > 0));
```

Do not encode `91`, `170`, or `169` as authoritative until the primary-source investigation resolves the discrepancy. Once resolved, the reviewed manifest itself is the source of truth and its aggregate hash locks the result.

- [ ] **Step 2: Research primary upstream metadata and write the factual manifest**

Use only the upstream Quran.com resource records/repository and their explicit license/terms. Store the exact URL, resource ID, edition/translator label, retrieval/revision date, redistribution basis, and computed hashes. If redistribution rights or edition identity cannot be proven, set `publicActivationApproved` to `false`; validation may pass structurally, but the release gate remains closed.

- [ ] **Step 3: Verify and commit**

```bash
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/provenance.test.js
git diff --check
git add docs/noor-rag/corpus-provenance.json functions/src/noor-rag/provenance.ts functions/test/noor-rag/provenance.test.ts
git commit -m "docs(noor): record tafsir corpus provenance"
```

### Task 3: Build deterministic bilingual canonical units and chunks

**Files:**
- Create: `functions/src/noor-rag/corpus.ts`
- Create: `functions/scripts/noor-rag/build-corpus.ts`
- Create: `functions/scripts/noor-rag/validate-corpus.ts`
- Test: `functions/test/noor-rag/corpus.test.ts`
- Modify: `functions/package.json`

- [ ] **Step 1: Write red tests for the known corpus invariants**

Tests must assert 114 files per source, 6,236 verse mappings per source, 2,234 unique Ibn Kathir units, 5,798 unique Al-Sa'di units, 8,032 total units, and 12,472 total lookup records. Include exact fixtures for 2:9, 2:52, 2:255, and 43:88.

```ts
assert.equal(result.units.filter(unit => unit.source === 'ibn_kathir_en_abridged').length, 2234);
assert.equal(result.units.filter(unit => unit.source === 'al_sadi_ar').length, 5798);
assert.equal(result.verseLookup.length, 12472);
assert.match(result.units.find(unit => unit.source === 'al_sadi_ar')!.retrievalText, /[\u0600-\u06ff]/);
```

- [ ] **Step 2: Implement canonical IDs, normalization, and chunking**

Canonical ID input is exactly:

```ts
`${corpusVersion}\u0000${source}\u0000${surah}:${verseStart}-${verseEnd}\u0000${contentHash}`
```

Hash with SHA-256 hex and prefix IDs with `u_`; chunk IDs are `c_${canonicalUnitId.slice(2)}_${String(index).padStart(3, '0')}_${chunkHash.slice(0, 12)}`. `originalText` is the untouched bundled string used for content hashing. Chunk boundaries are chosen against that raw string, and every chunk stores raw `originalStart`/`originalEnd` offsets. A separate `retrievalText` decodes entities, normalizes NFC/whitespace, retains Al-Sa'di Arabic, and may remove deterministic embedded Arabic repetitions from Ibn Kathir only; normalization never overwrites `originalText`.

Use an injected `TokenCounter` interface. Production ingestion calls Vertex `countTokens` at `global` with locked model `gemini-3.5-flash-lite`; the manifest records `tokenizerModel` and `chunkingVersion`. Build paragraph/sentence candidates toward 900 counted tokens, split further until every chunk is at most 1,400 counted tokens, and apply an 80-counted-token raw-text overlap without crossing the unit. Unit tests use a fixed deterministic counter to prove boundaries and offsets; the production validator re-counts every finalized chunk through Vertex before activation.

- [ ] **Step 3: Add artifact scripts and run twice**

Add scripts:

```json
"build:scripts": "tsc -p tsconfig.scripts.json",
"noor:corpus:build": "npm run build:scripts && node lib-scripts/scripts/noor-rag/build-corpus.js",
"noor:corpus:validate": "npm run build:scripts && node lib-scripts/scripts/noor-rag/validate-corpus.js"
```

The builder writes beneath `functions/.generated/noor-corpus/2026-08-10-v1/` for this release and never contacts Firestore. Run it twice and compare aggregate hashes.

```bash
npm --prefix functions run noor:corpus:build -- --version=2026-08-10-v1
npm --prefix functions run noor:corpus:validate -- --version=2026-08-10-v1
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/corpus.test.js
```

Expected: identical hashes, zero failed chunks, exact counts above.

- [ ] **Step 4: Commit source and tests, not generated vectors**

```bash
git add functions/package.json functions/package-lock.json functions/src/noor-rag/corpus.ts functions/scripts/noor-rag functions/test/noor-rag/corpus.test.ts .gitignore
git commit -m "feat(noor): build deterministic bilingual corpus"
```

### Task 4: Implement exact and balanced semantic retrieval

**Files:**
- Create: `functions/src/noor-rag/retrieval.ts`
- Create: `functions/scripts/noor-rag/verify-index.ts`
- Test: `functions/test/noor-rag/retrieval.test.ts`
- Test: `functions/test/noor-rag/verify-index.test.ts`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Write red tests with injected repositories**

Prove exact mode does not call embeddings/vector search, resolves shared ranges, and semantic mode performs one filtered search per source with independent thresholds and a maximum of four accepted chunks per source.

```ts
await retrieveExact(repo, { source: 'al_sadi_ar', surah: 2, verse: 52 });
assert.equal(embedCalls, 0);
assert.deepEqual(vectorSources, []);

const evidence = await retrieveSemantic(repo, embedder, config, 'patience');
assert.deepEqual(vectorSources.sort(), ['al_sadi_ar', 'ibn_kathir_en_abridged']);
assert.ok(evidence.every(item => item.score >= config.thresholds[item.chunk.source]));
```

- [ ] **Step 2: Implement repositories and retrieval**

Exact paths are `corpora/{version}/verseLookup/{source}_{surah}_{verse}` followed by `units/{canonicalUnitId}` and the lookup's ordered chunk IDs. The builder orders matching canonical units by `verseStart`, `verseEnd`, then canonical ID and their chunks by numeric chunk index. Exact retrieval deduplicates in that order and adds whole chunks until adding the next would exceed `maxEvidenceCharacters`; it never calls embeddings, reorders by lexical relevance, or slices source text. Corpus activation rejects a runtime evidence budget smaller than the manifest's largest finalized chunk, so exact retrieval always returns at least the first relevant whole chunk. Tests cover a very long shared-range commentary, stable prefix selection, whole-text preservation, deterministic ordering, and total evidence at or below the budget. Semantic paths query collection group `chunks`, pre-filter both `corpusVersion` and `source`, use cosine distance, request at most eight candidates per source, then threshold, deduplicate canonical units/overlap, and accept at most four per source under the evidence-character budget. This prevents inactive corpus versions from entering evidence.

- [ ] **Step 3: Define the vector index**

Add exactly one composite collection-group vector index:

```json
{
  "collectionGroup": "chunks",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "corpusVersion", "order": "ASCENDING" },
    { "fieldPath": "source", "order": "ASCENDING" },
    { "fieldPath": "embedding", "vectorConfig": { "dimension": 768, "flat": {} } }
  ]
}
```

This one composite definition supports both source values within the selected corpus version. Implement `verify-index.ts` with injectable Firestore/query dependencies and tests for ready, missing/building (`FAILED_PRECONDITION`), wrong project/version/source, and nonzero exit behavior. `noor:index:verify` performs a real zero-vector source/version-filtered nearest-neighbor query and must exit `ready` rather than `FAILED_PRECONDITION` before activation.

- [ ] **Step 4: Verify and commit**

```bash
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/retrieval.test.js functions/lib-test/test/noor-rag/verify-index.test.js
npm --prefix functions run build
git add functions/src/noor-rag/retrieval.ts functions/scripts/noor-rag/verify-index.ts functions/test/noor-rag/retrieval.test.ts functions/test/noor-rag/verify-index.test.ts firestore.indexes.json
git commit -m "feat(noor): add exact and balanced retrieval"
```

### Task 5: Add server entitlement, rate, quota, reservation, and idempotency

**Files:**
- Create: `functions/src/noor-rag/entitlement.ts`
- Create: `functions/src/noor-rag/usage.ts`
- Test: `functions/test/noor-rag/entitlement.test.ts`
- Test: `functions/test/noor-rag/usage.test.ts`

- [ ] **Step 1: Write red entitlement tests**

Mock RevenueCat responses for active `pro_access` from Monthly, Annual, and Lifetime; inactive entitlement; timeout with fresh cache; timeout with expired cache; malformed response. The verifier calls `GET https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}` with `Authorization: Bearer ${revenueCatSecret}`, caches the normalized decision for five minutes, and fails closed. Grandfathering is read only from `noorGrandfathering/{uid}` and owner QA only from `noorOwnerQa/{uid}`; never reuse the client-writable `users/{uid}/access` path.

- [ ] **Step 2: Implement entitlement normalization**

Return only:

```ts
type EntitlementClass = 'paid' | 'grandfathered' | 'owner_qa' | 'none';
interface EntitlementDecision { class: EntitlementClass; expiresAt: number; source: 'revenuecat' | 'cache' | 'server_record'; }
```

Never accept entitlement state from the request. Owner QA and grandfathering live in server-only documents.

- [ ] **Step 3: Write red concurrency/idempotency tests**

Run 10 concurrent claims against a five-RPM limit and assert exactly five accepted. Assert paid 50/day, grandfathered three/day, owner QA 100/day, UTC reset timestamp, two-minute lease/reservation expiry, non-answer release, successful-answer finalization, and ten-minute replay without a second model call or quota charge. Add a same-request concurrency test proving exactly one lease owner and exactly one model invocation.

- [ ] **Step 4: Implement one Firestore transaction per state change**

Use `noorUsage/{uid}_{utcDay}`, `noorRate/{uid}`, and `noorIdempotency/{uid}_{requestId}`. `claimRequest()` uses one Firestore transaction to read/write all three: purge expired daily reservations, reject or replay a completed idempotency record, reject an active lease owned by another invocation, claim an expired/new lease, append the non-refundable RPM attempt, and create one pending daily reservation. Only the lease owner may call retrieval/providers. `finalizeAnswered()` atomically converts the reservation to one successful daily answer and stores the typed response for ten minutes. `finalizeNonAnswer()` releases the daily reservation for every status other than `answered` while preserving the RPM attempt, then stores the typed non-answer response for replay. Expired leases are recoverable in the next claim transaction. Store no raw prompt/answer outside the ten-minute idempotency response document. Set `expiresAt` timestamps for TTL configuration.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/entitlement.test.js functions/lib-test/test/noor-rag/usage.test.js
npm --prefix functions run build
git add functions/src/noor-rag/entitlement.ts functions/src/noor-rag/usage.ts functions/test/noor-rag/entitlement.test.ts functions/test/noor-rag/usage.test.ts
git commit -m "feat(noor): enforce paid access and transactional usage"
```

### Task 6: Implement policy, grounded generation, and citation validation

**Files:**
- Create: `functions/src/noor-rag/policy.ts`
- Create: `functions/src/noor-rag/generation.ts`
- Create: `functions/src/noor-rag/citations.ts`
- Test: `functions/test/noor-rag/policy.test.ts`
- Test: `functions/test/noor-rag/citations.test.ts`

- [ ] **Step 1: Write red policy and citation tests**

Cover fatwa/personal ruling, standalone hadith request, medical/legal crisis, prompt injection, missing evidence, unknown `S9`, unused citation, duplicated citation, uncited substantive paragraph, malformed JSON, and one bounded regeneration.

```ts
assert.equal(classifyPolicy('Is crypto halal for me?').status, 'policy_refusal');
assert.throws(() => validateGeneratedAnswer({ answer: 'Claim [S9]', citationIds: ['S9'] }, evidence));
assert.throws(() => validateGeneratedAnswer({ answer: 'Uncited factual paragraph.', citationIds: [] }, evidence));
```

- [ ] **Step 2: Implement fixed refusal/insufficient responses**

Return typed statuses without calling the model when the request is excluded or no evidence clears thresholds. Refusal copy states Noor can only explain Quran passages from Ibn Kathir and Al-Sa'di and recommends a qualified scholar for personal rulings. Insufficient-evidence copy says the answer was not found in the available tafsir sources.

- [ ] **Step 3: Implement a bounded structured prompt**

System instructions identify the evidence blocks as untrusted source data, allow English paraphrase of Arabic Al-Sa'di without claiming quotation, forbid outside knowledge, require `[S1]` markers in every substantive paragraph, and request JSON with `answer` and `citationIds`. History/question are placed in explicit XML-style data tags after the fixed instructions. Use 800 output tokens and do not send custom temperature, top-K, or top-P because `gemini-3.5-flash-lite` ignores those controls.

- [ ] **Step 4: Validate output and retry once**

Map `S1…Sn` only to retrieved evidence. Reject unknown/unused markers and uncited paragraphs. One retry may reuse exactly the same evidence and consume the single retry budget; the second failure returns `temporarily_unavailable`.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/policy.test.js functions/lib-test/test/noor-rag/citations.test.js
npm --prefix functions run build
git add functions/src/noor-rag/policy.ts functions/src/noor-rag/generation.ts functions/src/noor-rag/citations.ts functions/test/noor-rag/policy.test.ts functions/test/noor-rag/citations.test.ts
git commit -m "feat(noor): validate grounded religious answers"
```

### Task 7: Compose the handler, privacy-safe telemetry, and Gen2 callable

**Files:**
- Create: `functions/src/noor-rag/telemetry.ts`
- Create: `functions/src/noor-rag/handler.ts`
- Create: `functions/src/noor-rag/callable.ts`
- Test: `functions/test/noor-rag/handler.test.ts`
- Modify: `functions/src/index.ts`
- Delete: `functions/src/askSheikh.ts`

- [ ] **Step 1: Write red orchestration tests**

Prove disabled config, missing active corpus, not entitled, quota exceeded with `nextResetAt`, exact answer, semantic answer, insufficient evidence, provider timeout, same-request contention, expired-lease recovery, idempotent replay, and release of the daily reservation on every non-answered status. Test unauthenticated, invalid request IDs, and failed App Check separately as callable transport errors. Assert no logger call contains `question`, `answer`, prompt text, provider body, or email.

- [ ] **Step 2: Implement dependency-injected orchestration**

The callable layer handles transport gates first: malformed/missing request shape or invalid request ID is `invalid-argument`, missing Auth is `unauthenticated`, and `enforceAppCheck` rejects invalid App Check before the handler. A structurally valid request with a valid ID but an impossible Quran reference may return typed `invalid_request` using that request ID. After a valid typed request exists, order is runtime config/owner-dark gate → transactionally safe lookup of an unexpired completed response → immediate replay when present → entitlement for new/expired requests → atomic idempotency/RPM/daily claim → policy → retrieval → generation/citation validation → answered/non-answer finalization → telemetry. The pre-entitlement lookup is read-only and keyed by Firebase UID plus request ID; races still resolve in `claimRequest`, which remains the sole lease/quota owner transaction. Thus a valid ten-minute replay survives a temporary RevenueCat/cache outage without a second charge or provider call. Typed application outcomes return `NoorAnswer`; transport errors are mapped by the client adapter to calm UI states without provider details.

- [ ] **Step 3: Implement telemetry**

Create user pseudonyms using HMAC-SHA256 over Firebase UID with `NOOR_TELEMETRY_HMAC_KEY` and the required non-secret `NoorRuntimeConfig.pseudonymKeyVersion`. Record only the approved fields from the specification, that exact version, and `expiresAt` 30 days ahead. Generate a server trace ID separate from request ID. Maintain a server-only `noorTelemetrySubjects/{uid}` record containing the bounded set of `{ pseudonym, pseudonymKeyVersion }` entries used during the last 30 days. `onUserDeleted` reads that subject record, deletes telemetry for every recorded pseudonym across key rotation, then deletes the subject. Add a rotation/deletion test proving a version change produces a different pseudonym while the subject mapping preserves deletion across both versions; clients can never read this mapping.

- [ ] **Step 4: Define the callable**

Use:

```ts
export const askNoorRagV1 = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 30,
    maxInstances: 10,
    concurrency: 20,
    enforceAppCheck: true,
    secrets: ['REVENUECAT_SECRET_API_KEY', 'NOOR_TELEMETRY_HMAC_KEY'],
  },
  callableHandler,
);
```

Delete the unexported `askSheikh` prototype. Keep legacy `explainVerse` temporarily until Client Task 10 removes its client caller and then the export in one coordinated checkpoint. Keep `onUserDeleted`, extending it to delete Noor entitlement cache, usage, idempotency, telemetry subjects, and account-linked telemetry.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/handler.test.js
npm --prefix functions run build
rg -n "question.slice|logger.*question|logger.*answer|askSheikh|gemini-2\.0|text-embedding-004" functions/src
git add functions/src functions/test/noor-rag
git commit -m "feat(noor): expose protected RAG callable"
```

Expected search: no raw-query logging or retired Noor prototype/model identifiers.

### Task 8: Lock Firestore access, ingestion controls, and evaluation suite

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Modify: `functions/package.json`
- Modify: `firebase.json`
- Create: `functions/scripts/noor-rag/ingest-corpus.ts`
- Create: `functions/scripts/noor-rag/activate-corpus.ts`
- Create: `functions/scripts/noor-rag/configure-runtime.ts`
- Create: `docs/noor-rag/runtime-config.2026-08-10-v1.json`
- Create: `functions/evals/noor-rag-cases.json`
- Create: `functions/scripts/noor-rag/run-evals.ts`
- Create: `docs/noor-rag/operations.md`
- Test: `functions/test-rules/noor-rag/rules.test.ts`
- Test: `functions/test/noor-rag/evals.test.ts`

- [ ] **Step 1: Write red rules and activation tests**

Authenticated clients must be denied reads/writes to `corpora`, `corpusManifests`, `noorConfig`, `noorUsage`, `noorRate`, `noorEntitlementCache`, `noorIdempotency`, `noorTelemetry`, `noorTelemetrySubjects`, `noorOwnerQa`, and `noorGrandfathering`; the tests explicitly prove `/users/{uid}/access` cannot authorize Noor. Activation must reject incomplete manifest, nonzero failed chunks, wrong embedding metadata, missing index-ready evidence, or provenance approval false. Add `@firebase/rules-unit-testing` as a Functions dev dependency and run authorization tests through the Firestore emulator.

Add these exact TTL field overrides while retaining any unrelated existing overrides:

```json
{ "collectionGroup": "noorIdempotency", "fieldPath": "expiresAt", "ttl": true, "indexes": [] },
{ "collectionGroup": "noorTelemetry", "fieldPath": "expiresAt", "ttl": true, "indexes": [] }
```

- [ ] **Step 2: Add explicit offline/dry-run defaults**

`ingest-corpus.ts` exits before any write unless all of `--project=qurannotes-9f7a1`, `--version=2026-08-10-v1`, and `--execute-production-write` are supplied. It prints exact document/write counts, embedding-token/cost estimate, and target paths first. Embedding runs with bounded concurrency four, skips an already stored matching chunk hash/model/dimension, checkpoints progress, and can resume without duplicating writes. Any failed embedding remains in the manifest and prevents activation. `activate-corpus.ts` requires an existing complete disabled runtime document with `activeCorpusVersion: "none"`; its initial invocation requires `--expected-current=none` and uses one transaction to change only `noorConfig/runtime.activeCorpusVersion`.

Commit `docs/noor-rag/runtime-config.2026-08-10-v1.json` as the complete reviewed non-secret config: disabled/public false, empty owner list, `activeCorpusVersion: "none"`, locked models/dimension, calibrated thresholds/evidence limits, prompt version, and `pseudonymKeyVersion`. `configure-runtime.ts` is a separate compare-and-set writer. Its bootstrap mode requires `--initialize-disabled --expected-missing --config=docs/noor-rag/runtime-config.2026-08-10-v1.json`; it creates that complete document only when absent and rejects any enabled/public/nonempty-owner/non-`none` bootstrap. Owner-only mode additionally requires one or more repeated `--owner-uid=<Firebase UID>` arguments, validates their bounded UID syntax, rejects a missing/empty/malformed list, and preserves the list through compare-and-set updates. It prints only a safely redacted suffix plus UID hash in the reviewed diff, never the full identifier. Tests cover missing/malformed UIDs, duplicate normalization, exact intended membership, redacted output, and CAS preservation. Other later modes require the expected current enabled/public values plus one of `--public` or `--disabled`, print the complete non-secret config diff, and exit unless `--execute-production-write` is supplied. This keeps runtime initialization, corpus activation, owner allowlisting, kill switch, and public enablement independently auditable.

Define these package scripts exactly:

```json
"test:rules": "npm run build:test && node --test lib-test/test-rules/noor-rag/rules.test.js",
"noor:eval": "npm run build:scripts && node lib-scripts/scripts/noor-rag/run-evals.js",
"noor:index:verify": "npm run build:scripts && node lib-scripts/scripts/noor-rag/verify-index.js",
"noor:corpus:ingest": "npm run build:scripts && node lib-scripts/scripts/noor-rag/ingest-corpus.js",
"noor:corpus:activate": "npm run build:scripts && node lib-scripts/scripts/noor-rag/activate-corpus.js",
"noor:runtime:configure": "npm run build:scripts && node lib-scripts/scripts/noor-rag/configure-runtime.js"
```

Run rules proof with `firebase emulators:exec --only firestore "npm --prefix functions run test:rules"`. Run `npm --prefix functions run noor:index:verify -- --project=qurannotes-9f7a1 --version=2026-08-10-v1 --source=ibn_kathir_en_abridged` after deployment; expected output is `ready` and any missing/building index exits nonzero.

- [ ] **Step 3: Add the fixed evaluation cases**

Include exact cases 2:255, 2:9, 2:52, 43:88, 1:1, malformed/false references; English/Arabic patience, mercy, hypocrisy, tawakkul, gratitude; unsupported topics; source disagreement; fabricated citation; fatwa, hadith, medical/legal, and injection cases; timeout/index/corpus failures. Fixtures assert status, source coverage, range, and citation validity rather than exact prose.

- [ ] **Step 4: Write the operations runbook**

Document configuration schema, disabled → owner allowlist → TestFlight → public progression, targeted deploy command, kill switch, active-corpus rollback, function artifact rollback, alert metrics, 30-day telemetry TTL, account deletion, and separate owner approvals.

- [ ] **Step 5: Run the backend gate and commit**

```bash
npm --prefix functions run noor:corpus:validate -- --version=2026-08-10-v1
npm --prefix functions test
firebase emulators:exec --only firestore "npm --prefix functions run test:rules"
npm --prefix functions run build
npm --prefix functions run noor:eval -- --fixtures
git diff --check
git add firestore.rules firestore.indexes.json functions docs/noor-rag
git commit -m "test(noor): lock backend release gates"
```

Expected: zero corpus failures, all tests/evals pass, no production write occurs.

## Backend completion gate

```bash
npm --prefix functions ci --ignore-scripts
npm --prefix functions run noor:corpus:validate -- --version=2026-08-10-v1
npm --prefix functions test
firebase emulators:exec --only firestore "npm --prefix functions run test:rules"
npm --prefix functions run build
npm --prefix functions run noor:eval -- --fixtures
node scripts/generate-noor-contract.js --check
git diff --check
git status --porcelain=v1 -z -uall
```

Record exact counts, hashes, pass totals, Node version, reviewed SHA, and independent specification/code-quality/security verdicts in the release handover. Production ingestion, index/rules deployment, secrets, function deployment, activation, and App Check enforcement remain unexecuted.
