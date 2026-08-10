# QuranNotes Noor RAG Release Design

**Date:** 2026-08-10
**Status:** Owner-approved architecture; written-spec review pending
**Release carrier:** `codex/noor-rag-release`
**Release base:** `8f36182b7def8140ddd87232b7d4a40b9dc02ba8`
**Production baseline:** App Store `2.2.2`; best matching source commit `33c2d9baf`

## Goal

Prepare one focused iOS release containing:

1. A single, server-governed AI system for Noor chat and verse-level AI.
2. Proper retrieval grounding in the app's complete Ibn Kathir and Al-Sa'di corpora.
3. The externally prepared Lifetime configuration, re-verified and completed with client purchase/restore support for the next Apple submission.
4. The partially verified friendly sign-up correction from the original checkout, completed with screen-level proof.

Submission is blocked until every release gate in this document has fresh evidence. The controller will work toward a same-day upload and submission, but neither a same-day submission nor Apple review completion is promised at the expense of a safety, purchase, corpus, or real-device gate.

## Product Boundary

The first governed Noor release answers Quran and tafsir questions supported by Ibn Kathir or Al-Sa'di. It does not provide fatwas, personal religious rulings, hadith authentication, medical advice, legal advice, or unsupported general-Islam answers.

When the trusted sources do not support an answer, the product says so. It never silently falls back to an ungrounded model response.

The first release answers in English, matching the shipped verse-level AI behavior. Arabic Al-Sa'di evidence remains intact and is clearly presented as an English explanation or paraphrase, never as an English verbatim quotation.

## Release Scope

### Included

- Noor chat through one authenticated Firebase callable backend.
- Verse-level AI summaries and questions through the same backend.
- Ibn Kathir English corpus: all 114 bundled surah files.
- Al-Sa'di Arabic corpus: all 114 bundled surah files.
- Multilingual semantic retrieval for open Noor questions.
- Direct source/verse retrieval for verse-level AI.
- Structured, backend-validated citations.
- Firebase Auth, App Check, server-side entitlement enforcement, abuse limits, kill switch, privacy-safe monitoring, and bounded timeouts.
- Lifetime, Monthly, and Annual products in the active RevenueCat offering.
- Apple Lifetime IAP submitted with the new iOS version.
- Friendly sign-up messages without raw Firebase errors or codes.

### Excluded

- Direct Gemini calls or Gemini secrets in the iOS bundle.
- A second AI provider, vector database, RAG platform, reranker, judge model, or multi-agent answering pipeline.
- Noor personalization based on mood, streak, notes, recordings, or inferred topic fingerprints.
- The experimental client-side Hadith index.
- New UGC tooling, analytics instrumentation, Quran Focus Mode, or unrelated dirty-checkout changes.
- Streaming responses, shared semantic caching, conversation cloud sync, and additional tafsir sources.

## One Cohesive Architecture

```text
QuranNotes iOS app
        |
        | Firebase callable request
        | Auth token + App Check token
        v
askNoorRag Cloud Function
        |
        +-- entitlement and transactional quota gate
        +-- operation router
        |     +-- verse summary / verse question -> exact source lookup
        |     +-- open Noor chat -> multilingual embedding + vector lookup
        +-- source threshold and policy gate
        +-- Vertex Gemini generation
        +-- citation allowlist validation
        +-- privacy-safe metrics
        v
Typed answer + structured citations
```

All production AI resources live in the existing `qurannotes-9f7a1` Firebase/Google Cloud project. Firestore is the source and vector store. Vertex AI creates embeddings and generates answers. RevenueCat remains the purchase entitlement authority. No separate AI Studio project is part of the target runtime.

## Why Each Component Exists

| Component | Single responsibility |
|---|---|
| Firebase Auth | Identify the requesting account. |
| Firebase App Check | Verify requests come from an authentic QuranNotes installation/device. |
| Cloud Function | Enforce access, retrieve sources, call the model, validate output, and meter usage. |
| Firestore | Store versioned tafsir passages, vectors, usage counters, configuration, and short entitlement cache records. |
| Vertex embedding model | Convert corpus passages and open questions into comparable vectors. |
| Vertex Gemini model | Compose an English answer from retrieved passages. |
| RevenueCat | Confirm whether the Firebase-linked user has an active Lifetime, Monthly, or Annual entitlement. |

## Corpus and Ingestion

Firestore does not create embeddings. A controlled ingestion command reads the checked-in corpus, chunks it deterministically, asks Vertex AI for embeddings, and stores the resulting vectors in Firestore.

The release locks `gemini-embedding-001` at 768 output dimensions. This supports multilingual retrieval, stays below Firestore's 2,048-dimension limit, and avoids storing the model's maximum 3,072-dimensional output. A future dimensionality change requires a new corpus version and retrieval evaluation.

The checked-in data represents 12,472 verse-to-commentary associations across both sources, but repeated members of shared verse ranges resolve to the same commentary. Ingestion therefore creates canonical units instead of embedding duplicate text for every verse:

- 2,234 unique Ibn Kathir commentary units;
- 5,798 unique Al-Sa'di commentary units;
- 8,032 total canonical units;
- 12,472 deterministic verse lookup mappings.

The server-side corpus uses one versioned namespace with three related record types:

```text
corpora/{corpusVersion}/units/{canonicalUnitId}
corpora/{corpusVersion}/chunks/{chunkId}
corpora/{corpusVersion}/verseLookup/{source_surah_verse}
corpusManifests/{corpusVersion}
```

Each canonical unit contains:

```ts
interface TafsirUnit {
  canonicalUnitId: string;
  source: 'ibn_kathir_en_abridged' | 'al_sadi_ar';
  sourceTitle: 'Tafsir Ibn Kathir' | "Tafsir Al-Sa'di";
  language: 'en' | 'ar';
  surah: number;
  verseStart: number;
  verseEnd: number;
  originalText: string;
  retrievalText: string;
  corpusVersion: string;
  contentHash: string;
  resourceId: number;
  upstreamReference: string;
  editionLabel: string;
  normalizationVersion: string;
  embeddingModel: string;
  embeddingDimension: number;
}
```

- Ibn Kathir keeps the original bundled text, while `retrievalText` removes embedded Arabic verse repetitions only when deterministic normalization is safe.
- Al-Sa'di retains its Arabic commentary in both the trusted original and retrieval representation. The shipped `stripToEnglish()` behavior must not be used for Al-Sa'di.
- Canonical IDs are deterministic from source, verse range, corpus version, and content hash.
- Long units are split into deterministic paragraph/sentence-aware chunks of approximately 700–1,000 model tokens with a hard bounded maximum and small overlap. Chunks never cross source, surah, or canonical verse-range boundaries.
- Every chunk stores its canonical unit ID, chunk index, original character offsets, hash, language, embedding metadata, and embedding.
- Verse lookup records cover every one of the 6,236 Quran verses for both sources and preserve the bundled `verseRange` semantics.
- Ingestion is idempotent and writes only beneath `corpora/{corpusVersion}`.
- `corpusManifests/{corpusVersion}` records expected files, units, chunks, verse mappings, hashes, failed chunks, embedding model, vector-index definition, and completion time.
- Activation is separate from ingestion. An incomplete corpus can never become active.

### Corpus provenance gate

Before public activation, the release must record the exact upstream resource IDs, edition/translation labels, source revision or retrieval date, redistribution/license basis, and full corpus hashes. Current scripts refer to Quran.com resources and an alternate upstream repository, and one comment disagrees with executable configuration about the Al-Sa'di resource ID. The content cannot be marketed or cited as authenticated until this discrepancy and the rights/provenance record are resolved.

## Retrieval Modes

### Verse-level AI

The app submits a canonical source, surah, verse, operation, and optional question. The backend retrieves the exact commentary range. It does not use vector search when the verse and source are already known.

For Al-Sa'di, Gemini may explain the Arabic commentary in English, but the source passage remains Arabic and the response cites Al-Sa'di explicitly.

### Noor chat

The backend embeds the user's open question once. It performs separately filtered searches against Ibn Kathir and Al-Sa'di so one source cannot crowd the other out solely because of language, corpus size, or chunk-length differences. Relevance thresholds are calibrated separately per source/language rather than assumed equal.

Retrieved passages must pass a calibrated similarity threshold. The generation prompt receives only the accepted passages, bounded recent conversation turns, and the current question. If no passage passes, Noor returns an evidence-insufficient response.

## API Contract

One callable endpoint accepts a discriminated request:

```ts
type NoorOperation =
  | {
      mode: 'chat';
      requestId: string;
      question: string;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
    }
  | {
      mode: 'verse_summary';
      requestId: string;
      source: 'ibn_kathir_en_abridged' | 'al_sadi_ar';
      surah: number;
      verse: number;
    }
  | {
      mode: 'verse_question';
      requestId: string;
      source: 'ibn_kathir_en_abridged' | 'al_sadi_ar';
      surah: number;
      verse: number;
      question: string;
    };
```

All client-provided question and history content is untrusted data. The callable accepts only RFC 4122 UUID request IDs, questions of 1–500 characters, at most six user/assistant turns, at most 1,000 characters per history message, and at most 6,000 history characters total. Prompt construction places untrusted content inside explicit data delimiters and never concatenates it into system instructions.

The response is structured:

```ts
interface NoorAnswer {
  requestId: string;
  answer: string;
  status:
    | 'answered'
    | 'insufficient_evidence'
    | 'policy_refusal'
    | 'not_entitled'
    | 'quota_exceeded'
    | 'invalid_request'
    | 'temporarily_unavailable';
  citations: Array<{
    chunkId: string;
    canonicalUnitId: string;
    source: 'ibn_kathir_en_abridged' | 'al_sadi_ar';
    sourceTitle: string;
    surah: number;
    verseStart: number;
    verseEnd: number;
    corpusVersion: string;
  }>;
}
```

The model cites only prompt-assigned source IDs such as `S1`. The backend rejects IDs that were not retrieved and returns metadata only for IDs actually cited. Semantic source support is additionally governed by the fixed evaluation suite and human spot review; the design does not pretend that ID validation alone proves scholarly correctness.

Every substantive answer paragraph must contain at least one accepted citation marker. One bounded regeneration using the same evidence is allowed for malformed schema or citations; a second failure returns `temporarily_unavailable`.

## Religious-Safety Policy

- Every substantive claim must be supported by a returned Ibn Kathir or Al-Sa'di citation.
- Comparisons between the scholars identify each view separately.
- The model may translate or simplify retrieved text without introducing new rulings.
- A hadith may be mentioned only when it appears in retrieved tafsir and must be attributed as part of that commentary; Noor does not independently authenticate it.
- Prompt injection attempts remain untrusted question/history data and cannot be promoted into system instructions; adversarial evaluation verifies the boundary.
- Unsupported hadith, fatwa, aqidah adjudication, personal verdict, medical, and legal requests are declined.
- No generic-model fallback is available.
- Empty retrieval, invalid citations, schema failure, or low confidence fails closed.
- The client never displays raw backend, Firebase, model, quota, or configuration errors.

## Access, Quotas, and Cost Safety

- Firebase authentication is mandatory.
- Production App Check uses App Attest on iOS. While TestFlight attestation is being proven, the callable remains disabled for public traffic and accepts only owner-allowlisted UIDs. App Check must be enforced before any non-owner traffic.
- The backend never accepts `isPro` or entitlement state from the client.
- RevenueCat credentials live in Secret Manager, never in the app or repository.
- Firebase UID is the RevenueCat app user ID. An active `pro_access` entitlement grants paid access. A server-recorded grandfathered account receives the limited legacy allowance.
- RevenueCat entitlement results are cached for five minutes by Firebase UID. Revocation propagates within five minutes. If RevenueCat times out, an unexpired cached decision may be used; otherwise the request fails closed as `temporarily_unavailable`.
- Paid Monthly, Annual, and Lifetime users receive five requests per minute and 50 successful AI answers per UTC day across Noor and verse-level AI. Grandfathered accounts receive three successful answers per UTC day. Owner-allowlisted QA accounts receive 100 per UTC day while the backend is dark.
- Usage reservation and completion/refund are transactional so concurrent calls cannot bypass limits or charge failed requests permanently. A reservation expires after two minutes if not finalized.
- A validated request ID is idempotent for ten minutes. The completed typed response is stored only for that retry window, excluded from logs, and deleted by Firestore TTL. Repeating the request ID returns the same response without another quota charge or model call.
- A quota denial returns `quota_exceeded` with the next UTC reset time. `not_entitled` directs the client to the paywall without exposing provider internals.
- The new paywall and App Store copy must not call AI answers or AI insights "unlimited." It describes access to Noor AI and verse explanations without promising an uncapped service. Existing `Unlimited AI Quran Insights` and `Unlock Unlimited AI Insights` copy is replaced in this release. The 50-answer daily fair-use limit and reset behavior are disclosed in purchase-facing terms before payment.
- Global maximum instances, timeout, output-token limit, project quota, budget alerts, and a server kill switch bound failure and spend.

## Locked Runtime Configuration

- Function: second-generation Firebase callable named `askNoorRagV1`.
- Region: `us-central1`, aligned with the existing AI/function deployment region.
- Runtime: Node.js 20.
- Memory: 512 MiB.
- Timeout: 30 seconds.
- Maximum instances: 10.
- Concurrency: 20 requests per instance.
- Generation model: stable `gemini-2.5-flash` for this release.
- Embedding model: `gemini-embedding-001`, 768 dimensions.
- Generation: temperature 0.2, maximum 800 output tokens.
- Retrieval: at most four accepted chunks per source and a bounded combined evidence budget.
- Retry: one retry only for explicitly retryable provider errors; citation/schema regeneration uses the same evidence and consumes the single retry budget.

Model, prompt, threshold, and corpus versions are server configuration, never client constants. Changing a model or embedding dimension requires the corresponding evaluation and, for embeddings, a new corpus version.

## Availability and Failure Handling

The system is designed for professional availability but does not claim impossible 100% uptime.

- The exact-verse path avoids vector search and therefore has fewer dependencies.
- The callable has a bounded timeout and one retry only for explicitly retryable provider failures.
- No timeout triggers a second provider or an ungrounded path.
- A missing or malformed enabled flag, owner allowlist, active corpus version, or threshold configuration fails closed.
- A server-side enabled flag and active corpus version can be changed without an App Store release. Active-version switching is one atomic configuration-document update after `corpusManifests/{corpusVersion}` and the corresponding `corpora/{corpusVersion}/chunks` vector index report ready.
- New function and corpus versions deploy dark, then owner-only, then TestFlight, then public.
- The callable name is versioned (`askNoorRagV1`). The release commit/tag and built Functions artifact are retained so rollback is a targeted redeploy of the last-known-good function, never a broad functions deployment. The kill-switch and corpus-version rollback runbook are exercised before public activation.
- Alerts cover error rate, p95 latency, quota denials, empty retrieval, invalid citations, App Check rejection, token use, and estimated cost.
- The user sees a calm temporary-unavailable message only after controlled recovery fails.

## Privacy and Observability

Production telemetry records:

- request ID;
- operation mode;
- a keyed-HMAC account pseudonym, rotated with the telemetry key and not reversible without the secret;
- entitlement class;
- backend/model/corpus/prompt versions;
- retrieval duration and returned chunk IDs;
- generation duration and token usage;
- citation count;
- outcome and normalized error class.

Production telemetry does not record raw questions, answers, callable payloads, provider response/error bodies, notes, mood, recordings, email addresses, or partial religious-query text. Validated client request IDs are UUIDs only; server trace IDs are generated independently.

Safety telemetry is retained for 30 days, restricted to production operators, and deleted through the documented retention job. Account deletion removes entitlement cache, quota, idempotency, and account-linked operational records. Broader engagement instrumentation remains in the separate analytics scope and is not added by this release.

## Billing Consolidation

Target runtime billing belongs only to `qurannotes-9f7a1`:

1. Confirm the Firebase project is on Blaze and linked to the intended billing account.
2. Confirm Vertex AI and the selected embedding/generation models are enabled in that project.
3. Configure Cloud Billing budgets and alerts. Alerts are not hard caps.
4. Apply service quotas, function maximum instances, per-user quotas, and output-token limits as hard technical controls.
5. Enable AI/function monitoring and record real token use before changing the budget envelope.
6. Remove the direct Gemini fallback from Noor and verse-level AI.
7. During fleet migration, keep the old AI Studio project unbilled and tightly quota-limited while monitoring old-client traffic. Version 2.2.2 cannot be remotely rewritten and may continue using its embedded fallback.
8. Add an upgrade prompt/minimum-supported-version decision for the old fleet. Rotate/delete the exposed key only after the owner approves a measured adoption threshold, old-client behavior is understood, and the new backend is stable. `gen-lang-client-0986553355` is never upgraded into the target production path.

No billing, quota, key rotation, deployment, or production corpus write occurs without an explicit owner-approved production step.

## Lifetime and Sign-up Release Inputs

### External dashboard state

- Apple Lifetime IAP is reported Ready for Review in draft and must be attached to the next iOS version before submission. Draft/Ready for Review is not Apple approval or proven StoreKit availability.
- RevenueCat's active `default` offering is reported to contain Lifetime, Monthly, and Annual packages granting `pro_access`.
- These states must be re-verified immediately before submission because dashboard state can change.
- Release base `8f36182b7` still renders only Monthly and Annual choices. The new release therefore needs a separately tested Lifetime selector, purchase path, entitlement unlock, legal copy, and restore proof; dashboard configuration alone does not make Lifetime available in the app.

### Friendly sign-up correction

The original checkout contains an uncommitted change with focused utility-test and scoped TypeScript evidence, but not full release verification, in:

- `src/features/auth/presentation/authErrorMessage.ts`
- `src/features/auth/presentation/authErrorMessage.test.ts`
- `app/(auth)/sign-up.tsx`
- implementation notes identified by the integration audit

Only the helper, helper test, and four friendly-error screen hunks are ported: translator import, password validation call, safe email-registration catch, and stale-error clearing on the three fields. Overlapping Google/Apple social-sign-up UI and handlers are explicitly excluded. The dirty original checkout is not a release carrier and is never broadly copied or committed.

The port must preserve the production password acceptance policy. Friendly guidance may describe an uppercase requirement only if the active Firebase password policy or an owner-approved product requirement actually enforces it; the release must not introduce a stricter password rule accidentally.

## Test and Evaluation Strategy

### Unit and integration tests

- deterministic bilingual chunking and hashes;
- canonical-unit deduplication and all 12,472 verse mappings;
- 114 source files present for each scholar;
- zero failed ingestion chunks and expected manifest counts;
- exact verse-range lookup for both sources;
- multilingual cross-language retrieval;
- source-balanced retrieval;
- relevance-threshold refusal;
- Auth and App Check rejection;
- RevenueCat entitlement success, Lifetime success, timeout, and invalid response;
- transactional quota concurrency and failed-request refund;
- bounded history and input validation;
- model timeout and retry classification;
- unknown, missing, duplicated, or malformed citations;
- kill-switch and inactive-corpus behavior;
- client rendering and deep-linking of citations;
- Firestore rules/IAM denying client reads and writes to `corpora`, `corpusManifests`, quota, entitlement-cache, idempotency, and server configuration collections;
- absence of direct Gemini SDK/API-key runtime paths;
- friendly sign-up regression tests;
- Lifetime/Monthly/Annual paywall presentation, purchase, entitlement-unlock, and restore tests;
- screen-level sign-up tests proving invalid passwords do not call registration, raw provider messages never render, known codes render approved copy, and editing each field clears stale errors.

### Fixed religious evaluation set

The release evaluation set covers:

- direct verse meaning from Ibn Kathir;
- direct verse meaning from Al-Sa'di;
- English questions retrieving Arabic Al-Sa'di passages;
- shared verse-range lookups and very long commentary units remaining within the evidence budget;
- themes spanning multiple surahs;
- areas where the two sources emphasize different points;
- questions absent from both sources;
- invented hadith requests;
- fatwa and personal-ruling requests;
- prompt injection requesting hidden instructions or uncited answers;
- false verse references;
- adversarial requests to fabricate a citation;
- sensitive mental-health, medical, and legal questions.

Every answered case must have valid supporting citations. Every unsupported or excluded case must refuse appropriately. Representative bilingual outputs receive independent human content review before public rollout.

## Release Gates

1. Clean sparse worktree at the approved base and exact scoped commits.
2. Full design and implementation plans approved.
3. Corpus provenance, edition/translation labels, resource IDs, redistribution basis, and hashes are recorded and approved.
4. Backend tests and religious evaluation suite pass.
5. Corpus manifest complete and vector index reports ready.
6. Owner-only dark backend proof succeeds without raw-query logging.
7. App Check works from a physical TestFlight installation.
8. RevenueCat `default` membership and `pro_access` attachment are re-verified; Apple exposes the Lifetime product to StoreKit; fresh TestFlight Lifetime, Monthly, and Annual purchase, entitlement-unlock, and restore paths pass.
9. Friendly sign-up tests and physical-device UX checks pass.
10. Full TypeScript, Jest, ESLint, Functions build/tests, iOS export, and regression matrix pass; the two existing Jest transform failures are either corrected or explicitly proven as harness-only without weakening release coverage.
11. Independent spec, code-quality, security, religious-output, and release review pass.
12. App Store version/build, widget, signing, privacy disclosures, review notes, and Lifetime IAP attachment are verified.
13. Owner explicitly approves each production deployment, TestFlight upload, and App Store submission.

Failure of a safety, corpus, entitlement, App Check, purchase, build, or real-device gate blocks public release. It does not authorize an ungrounded fallback.

## Controller and Handover Rules

- This specification, its implementation plan, Git commits, and verification evidence are durable truth; chat memory is not.
- The controller records the current base SHA, branch, clean/dirty state, completed gate, outstanding blocker, and exact next action at every phase boundary.
- One implementation writer operates in the release worktree at a time.
- Each implementation task receives fresh spec-compliance and code-quality review.
- A fresh controller may take over only from a clean committed checkpoint and a written handover.
- No merge, push, Firebase deployment, key rotation, TestFlight upload, Apple submission, or production activation is implied by code-plan approval.
