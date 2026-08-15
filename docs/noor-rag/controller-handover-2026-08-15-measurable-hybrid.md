# Noor controller handover — measurable hybrid checkpoint

## Carrier truth

- Carrier: `/Users/mahmoudalaaeldin/.codex/worktrees/faae/QuranApp`
- Branch: `codex/noor-surgical-rag-recovery`
- HEAD: `9c8a124e1`
- Status: clean
- Empty-status SHA-256 (NUL and newline forms): `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- The dirty candidate `/Users/mahmoudalaaeldin/.codex/worktrees/noor-release-candidate` remains preserved and untouched.

## Completed in this carrier

- The riba → Islamic alternative trace is a sanitized regression seed, not a production topic list.
- Runtime policy now sends unfamiliar questions to grounded retrieval; only hard safety gates refuse before retrieval.
- Validated conversation state carries bounded user-derived subject tokens and cited evidence IDs; assistant text is never state evidence.
- Original plus one context-enriched query is bounded; vector and lexical retrieval are parallel, source-filtered, deduplicated, reranked, source-balanced, and character-bounded.
- Firestore lexical search uses one bounded `array-contains-any` query per source. Lexical fallback is reported as `available`, `unavailable`, or `not_configured`.
- Corpus activation probes both the vector index and the exact lexical field/index using a token derived from a real retrieved chunk; no topic token is hardcoded.
- The evaluator accepts external sanitized traces and arbitrary class labels, has a `noor:eval` CLI, and reports lexical fallback separately from lexical hit count.
- Client status copy remains safe; Tafsir stale local commentary is cleared before a new verse/source load.

## Verification at this checkpoint

- Functions: `193/193` tests passed.
- Functions production build passed.
- Functions scripts build passed.
- Noor contract check passed.
- Root TypeScript check passed.
- Focused Noor/Tafsir UI tests: `12/12` passed.
- `git diff --check` passed.

## Remaining bounded work

1. Supply an external broad evaluation set covering direct concepts, stories/themes, follow-ups, modern concepts, language/paraphrase variants, unrelated questions, and adversarial safety cases; run it through the generic evaluator and inspect recall/MRR, groundedness, citation validity, abstention, and latency.
2. Run the zero-write corpus/index preflight against the real Firebase project and capture its result for this source fingerprint.
3. Run the authenticated Firebase Auth + valid App Check user-perspective matrix against the deployed revision, including client copy and Tafsir verse A → verse B parity.

No deployment, archive, Transporter upload, or TestFlight claim is authorized by this checkpoint. Automated tests are not a substitute for the authenticated deployed proof.
