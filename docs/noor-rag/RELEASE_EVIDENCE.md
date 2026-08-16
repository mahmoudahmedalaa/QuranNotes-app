# QuranNotes overnight status and evidence

Evidence snapshot: 2026-08-16 UTC.

## Completed

- Noor RAG backend implemented and deployed as `askNoorRagV1`.
- Firestore corpus ingested and complete: 7,867 units, 9,248 chunks, 12,408 lookups.
- 768-dimensional Gemini Embedding 2 vectors stored in Firestore.
- Firestore vector indexes verified for both tafsir sources.
- Exact verse retrieval and semantic chat retrieval implemented.
- Gemini 3.5 Flash Lite grounded generation with structured citation validation.
- Firebase Auth/App Check boundary, RevenueCat `pro_access`, usage limits, idempotency, safe errors, and pseudonymous telemetry implemented.
- Exact verse context is carried through the generated client/backend contract for Noor chat; exact Tafsir summaries continue to use source + surah + verse retrieval.
- The bounded `noor:live-smoke` CLI covers authenticated chat, three-turn conversation, verse A/B parity, and quota probes without printing prompts, answers, tokens, or provider details.
- Runtime switched to `enabled=true`, `publicEnabled=true`, `activeCorpusVersion=2026-08-10-v1`.
- The deployment was made through an explicit operator-accepted-risk flag. The provenance record remains unchanged and still documents unresolved source-rights/coverage uncertainty.
- A clarification draft was saved in Gmail to `cloud@tafsir.net`.

## Live proof

- [Firestore runtime](https://console.firebase.google.com/project/qurannotes-9f7a1/firestore/data/~2FnoorConfig~2Fruntime)
- [Firestore corpus manifest](https://console.firebase.google.com/project/qurannotes-9f7a1/firestore/data/~2FcorpusManifests~2F2026-08-10-v1)
- [Firestore vector indexes](https://console.cloud.google.com/firestore/indexes?project=qurannotes-9f7a1)
- [Cloud Function](https://console.cloud.google.com/functions/details/us-central1/askNoorRagV1?project=qurannotes-9f7a1)
- [Callable endpoint](https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1)

The current unauthenticated endpoint smoke test returned HTTP 401 `Unauthenticated`, confirming the deployed callable rejects requests safely before model work. The deployed function list contains only `askNoorRagV1` and `onUserDeleted`; retired `askSheikh` and `explainVerse` return HTTP 404. The production index verifier returned `ready` for both canonical tafsir sources.

The authenticated live-smoke command is intentionally credential-gated. No Firebase ID token or App Check token is checked into the repository, so this evidence does not claim a fabricated production answer. Run it with an approved QA session:

```bash
NOOR_LIVE_SMOKE_ENDPOINT='https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1' \
NOOR_LIVE_SMOKE_FIREBASE_ID_TOKEN='<firebase-id-token>' \
NOOR_LIVE_SMOKE_APP_CHECK_TOKEN='<app-check-token>' \
npm run noor:live-smoke -- --mode=conversation
```

## Remaining release work

The backend/RAG setup is not the same thing as an App Store release. Remaining release work is:

1. Resolve and integrate the unfinished paywall/signup/native iOS changes in the release worktree.
2. Re-run full app tests, TypeScript, Expo iOS export, and native prebuild/Pods/App Check inspection.
3. Confirm an unused App Store Connect marketing version/build number while signed in.
4. Verify Apple distribution signing and archive locally with Xcode.
5. Test RevenueCat Monthly, Annual, Lifetime purchase/restore on a real TestFlight build.
6. Upload through Transporter and complete TestFlight QA.
7. Submit to Apple manually.

No App Store archive, upload, or submission has been performed by this evidence pass.

## The simplest RAG explanation

1. **Source:** tafsir text is the knowledge we want the assistant to use.
2. **Corpus:** that text prepared into clean, bounded, traceable units and chunks.
3. **Embedding:** each chunk becomes a 768-number representation of its meaning.
4. **Vector database:** Firestore stores the chunk text, metadata, and vector.
5. **Retrieval:** a user question is embedded and matched to nearby chunks, or a verse directly selects its chunks.
6. **Generation:** Gemini receives the question plus retrieved chunks, not the entire database.
7. **Grounding:** the backend validates the answer and citations before returning it.

The corpus is therefore the prepared knowledge layer. Firestore is the database that stores the deployed corpus and its vectors. RAG is the runtime process that retrieves from that database before generation.

## Re-run the local proof

From `functions/`:

```bash
npm test
npm run build
npm run build:scripts
npm run contract:check
```

Production read-only checks require ADC credentials:

```bash
npm run noor:index:verify -- --project=qurannotes-9f7a1 --version=2026-08-10-v1
npm run noor:activation:preflight -- --project=qurannotes-9f7a1 --version=2026-08-10-v1 --expected-current=none
```
