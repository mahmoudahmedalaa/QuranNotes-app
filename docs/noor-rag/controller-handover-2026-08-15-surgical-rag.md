# Noor controller handover — surgical natural RAG recovery

## Carrier and repository truth

- Noor carrier: `/Users/mahmoudalaaeldin/.codex/worktrees/noor-release-candidate`
- Branch: `codex/noor-release-candidate`
- HEAD at handover: `bf03151b9d7faf8948e4dd22d2ec8bc53288529b`
- Status entries after the docs-only checkpoint: `247` (the handover and plan are committed)
- NUL status SHA-256: `1401209589c2151291c57f0664c2ff9ed1af431b10ee98ae606c0241db9c8cd9`
- Newline status SHA-256: `f8e5b6725ea1ba42add7943bd0e5e05056f0947797db4ba6525987b57f400a57`
- Main checkout `/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp` is stale for Noor: branch `feature/noor-ai-phase5`, HEAD `3f34f0f0f`, and it has no `functions/src/noor-rag` directory.

## Current state

The candidate contains uncommitted Noor/backend/client changes from earlier phases, including query rewrite, lexical retrieval/readiness, generation/citation, Noor history wiring, and Tafsir identity/latency work. Those files are not a clean release checkpoint and must not be treated as deployed proof. Existing docs include `ARCHITECTURE.md`, `AUDIT.md`, the 2026-08-14 handover, and `2026-08-14-noor-natural-coverage-and-tafsir-flow.md`; this handover supersedes their next-task boundary for the new owner-approved plan.

The fresh controller independently found that the earlier Task 2 file hashes are stale in this shared tree: `TafsirBottomSheet.tsx` is now `b38245a1615fdcdedccfe5a3639510ef1f95c28d6b6c19746ec16174be99ff2e`, `TafsirBottomSheet.test.ts` is `027da7d5d0392ec8647d2d2e1e021e20ca9841ff9fc38b28ee82b0bd31b3a507`, while `app/surah/[id].tsx` remains `d3c2d129a9b4271165033a56bae8473474b81f5b87c5d681f43f01f9776726c9`. This confirms that prior handover evidence cannot be reused as a release fingerprint.

The current evaluator source defines more cases than the older production-verification document reports, and the active runtime proof is not bound to this dirty source. Refresh both before any implementation or deployment claim.

The installed `rag-eval` skill is an offline evaluation methodology, not a runtime topic allowlist and not a production monitor. Adapt its retrieval-quality and empty-context diagnostics to the existing Firebase/Firestore/Vertex evaluator.

## Root causes this handover targets

1. A brittle lexical/punctuation policy boundary can block a doctrinal question before retrieval.
2. A semantic follow-up such as “What is the Islamic alternative?” can lose the previously grounded subject.
3. Single literal retrieval can miss corpus terminology and contextual evidence.
4. Empty evidence can be presented as a generic refusal without proving both retrieval routes were attempted.
5. Tafsir asynchronous state and backend overhead can make the selected verse feel stale or unavailable.
6. Retrieval-only or local unit tests do not prove the authenticated deployed client path.

## Next owner action

The fresh controller must first triage the dirty candidate into a clean implementation carrier. It must not edit production code until that checkpoint is accepted. Then execute `docs/superpowers/plans/2026-08-15-noor-surgical-natural-rag-recovery.md` in order:

1. repository/handover checkpoint;
2. one sanitized riba → alternative vertical trace;
3. generic conversation state;
4. hybrid retrieval/readiness;
5. natural generation/fallback;
6. Tafsir parity/latency;
7. adapted evaluation and authenticated release proof.

## Stop conditions

- Any writer touches a file outside the current task scope.
- A dirty file cannot be separated from unrelated changes without staging or resetting it.
- A test passes only because a topic was added to a runtime allowlist.
- A retrieval/evaluation result is claimed without identifying the deployed revision.
- Authenticated App Check user-perspective proof is unavailable.
- The same failure requires more than one correction pass.

## Required reports at each phase

Each controller handover must include: carrier branch/HEAD, status fingerprints, exact files/hunks, RED command/output, GREEN command/output, independent reviewer verdict, unresolved concerns, next bounded task, and explicit “no deploy/archive” status until the release gate.
