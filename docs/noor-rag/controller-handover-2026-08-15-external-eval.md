# Noor controller handover — external evaluation matrix checkpoint

## Carrier truth

- Carrier: `/Users/mahmoudalaaeldin/.codex/worktrees/faae/QuranApp`
- Branch: `codex/noor-surgical-rag-recovery`
- HEAD: `586d14eb54aebe8f80ea777302c5ecbf1f2c8c83`
- Status: clean
- Empty-status SHA-256 (NUL and newline forms): `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- The dirty candidate `/Users/mahmoudalaaeldin/.codex/worktrees/noor-release-candidate` remains preserved and untouched.

## Completed in this phase

- Added `functions/evals/noor-evaluation-cases.json` with 11 external cases spanning direct concepts, themes/stories, structural follow-ups, modern concepts, paraphrase/language variants, abstention, and safety controls.
- Added a bounded validator that accepts arbitrary future case IDs and family labels; it does not contain a runtime topic list.
- Added `noor:eval:validate-cases` and allowed `noor:eval` to consume the external case expectations while emitting aggregate-only output.
- Verified the runtime Noor module graph does not import the evaluation artifact.

## Verification

- Functions: `196/196` tests passed.
- Functions production build passed.
- Functions scripts build passed.
- Noor contract check passed.
- Root TypeScript check passed.
- Focused Noor/Tafsir UI tests: `12/12` passed.
- Case validator passed with `11` cases.
- `git diff --check` passed.

## Zero-write Firebase corpus/index preflight

Command: `cd functions && npm run noor:activation:preflight -- --project=qurannotes-9f7a1 --version=2026-08-10-v1 --expected-current=none`

Result: `ready: false`, exit code `1`. No corpus activation, deployment, archive, or upload was performed.

Blockers returned by the preflight:

- `provenance:translator_publisher_edition_and_revision_not_stated`
- `provenance:content_sync_or_long_term_storage_basis_not_proven`
- `provenance:commercial_redistribution_license_not_proven`
- `provenance:machine_learning_use_written_consent_not_proven`
- `provenance:upstream_corpus_has_known_coverage_gaps`
- `locked_local_corpus_manifest_invalid`
- `runtime_config_missing_or_invalid`
- `retrieval_indexes_not_ready:ibn_kathir_en_abridged`
- `retrieval_indexes_not_ready:al_sadi_ar`

These are corpus/configuration and release-readiness blockers, not evidence that the bounded hybrid runtime path failed. They must be resolved before any activation or user-perspective release proof.

## Remaining bounded work

1. Execute the 11-case matrix against sanitized traces from the actual callable/client path and add reviewed retrieval ground truth where recall/MRR is required. This is evaluation execution, not a new runtime branch.
2. Resolve the preflight blockers above, then rerun the same zero-write preflight against the approved corpus/configuration.
3. Run authenticated Firebase Auth + valid App Check user-perspective tests against the deployed revision, including client copy and Tafsir verse A → verse B parity.

No deployment, archive, Transporter upload, or TestFlight claim is authorized by this checkpoint.
