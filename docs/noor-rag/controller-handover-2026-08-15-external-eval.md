# Noor controller handover — external evaluation matrix checkpoint

## Carrier truth

- Carrier: `/Users/mahmoudalaaeldin/.codex/worktrees/faae/QuranApp`
- Branch: `codex/noor-surgical-rag-recovery`
- HEAD: `4780206af11f4f165e9ffe351e64056150c80b3f`
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

## Remaining bounded work

1. Execute the 11-case matrix against sanitized traces from the actual callable/client path and add reviewed retrieval ground truth where recall/MRR is required. This is evaluation execution, not a new runtime branch.
2. Run zero-write Firebase corpus/index preflight and bind the result to this source fingerprint.
3. Run authenticated Firebase Auth + valid App Check user-perspective tests against the deployed revision, including client copy and Tafsir verse A → verse B parity.

No deployment, archive, Transporter upload, or TestFlight claim is authorized by this checkpoint.
