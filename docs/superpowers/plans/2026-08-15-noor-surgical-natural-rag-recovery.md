# Noor Surgical Natural RAG Recovery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. The repository-backed handover is authoritative; chat history is not.

**Goal:** Restore the current live Noor experience’s natural, open-ended conversation while adding reliable Quran/tafsir retrieval, citations, generic follow-up resolution, and measured verse-level latency without creating a runtime topic allowlist.

**Architecture:** Keep the existing Firebase callable, Auth/App Check, Firestore corpus, Vertex embeddings/generation, RevenueCat entitlement, quota, and citation contract. Add a generic conversation-state layer that carries only validated subject/evidence metadata, a bounded original-plus-context query plan, hybrid vector/lexical retrieval with deterministic merge/rerank, and user-facing clarification when evidence is weak. Exact verse Tafsir remains a separate low-latency path with an identity boundary so previous-verse state can never render.

**Tech Stack:** React Native/Expo, TypeScript, Firebase Gen 2 callable functions, Firestore vector/lexical indexes, Vertex AI, RevenueCat, Jest, Node `node:test`, local Xcode/TestFlight release flow.

---

## Source-of-truth checkpoint

The main checkout is stale and must not be used for Noor implementation:

```text
Main checkout: /Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp
Branch: feature/noor-ai-phase5
HEAD: 3f34f0f0fa1f2f4030dc6641804ae763a310d10d
No functions/src/noor-rag directory exists there.
```

The current Noor candidate is a separate, intentionally dirty worktree:

```text
Carrier: /Users/mahmoudalaaeldin/.codex/worktrees/noor-release-candidate
Branch: codex/noor-release-candidate
HEAD: bf03151b9d7faf8948e4dd22d2ec8bc53288529b
Status entries at plan creation: 247
NUL status SHA-256: 1401209589c2151291c57f0664c2ff9ed1af431b10ee98ae606c0241db9c8cd9
Newline status SHA-256: f8e5b6725ea1ba42add7943bd0e5e05056f0947797db4ba6525987b57f400a57
```

Do not reset, clean, stage whole files, merge, deploy, or archive from that dirty state. The first task creates a clean, reviewable checkpoint or stops and reports why it cannot. Previously implemented dirty hunks are evidence to review, not proof of the deployed revision.

## Non-negotiable product contract

- Noor accepts arbitrary natural-language questions; no finite runtime list of approved topics.
- Evaluation cases are regression probes, never an allowlist.
- Safety, Auth/App Check, quota, evidence validation, citation validation, and transport limits remain deterministic.
- Successful answers use approved Quran/tafsir evidence and citation IDs.
- Weak evidence produces a clarification or evidence-limit explanation, not hallucination and not a premature lexical refusal.
- Assistant-generated prose is never treated as source authority.
- Exact verse Tafsir shows the selected verse’s local content immediately and never displays the previous verse’s state.

## What the installed skill contributes

The installed `rag-eval` skill is used as a methodology for offline retrieval evaluation: retrieval recall, empty-context diagnosis, query-rewrite comparisons, groundedness, and result analysis. Its `corpus/` + `train.json` filesystem workflow is not imported into Noor’s callable, and it is not used as production monitoring. Noor’s adapter remains the existing Firebase/Firestore/Vertex evaluator with aggregate-only output.

## Task 0 — Repository-backed controller handover and clean baseline

**Files:**

- Create: `docs/noor-rag/controller-handover-2026-08-15-surgical-rag.md`
- Inspect only: all current Noor source, existing `docs/noor-rag/*`, candidate branch/HEAD/status

- [ ] Verify the carrier with `git branch --show-current`, `git rev-parse HEAD`, and both NUL/newline status hashes.
- [ ] Inventory every current dirty Noor file and classify each hunk as: already reviewed, unreviewed, unrelated release work, generated artifact, or required for this plan.
- [ ] Create a clean implementation branch/worktree from an explicitly approved source checkpoint. If the dirty candidate cannot be safely separated, stop; do not “just continue” in the mixed tree.
- [ ] Record the chosen carrier, source fingerprint, current deployed function revision, active corpus version, runtime/index readiness, and the exact next task in the handover.
- [ ] Fresh controller reads this handover before delegating any writer. Every phase creates a new handover with the exact test commands and unresolved findings.

## Task 1 — One vertical trace: `riba → Islamic alternative`

**Files:**

- Modify: `functions/src/noor-rag/policy.ts`
- Modify: `functions/src/noor-rag/queryRewrite.ts`
- Modify: `functions/src/noor-rag/callable.ts`
- Modify: `functions/src/noor-rag/handler.ts`
- Create/extend: `functions/test/noor-rag/riba-followup-trace.test.ts`
- Extend: `functions/scripts/noor-rag/evaluate-retrieval.ts`

Write the RED test before implementation. The trace must emit only sanitized fields:

```json
{
  "case": "riba-followup",
  "policy": "doctrinal_question|personal_ruling|out_of_scope|...",
  "contextSelected": true,
  "queryCount": 2,
  "evidenceCount": 0,
  "citationCount": 0,
  "status": "answered|insufficient_evidence|policy_refusal|temporarily_unavailable",
  "stageMs": {"policy": 0, "context": 0, "retrieval": 0, "generation": 0}
}
```

Required behavior:

- `Is riba haram` and `Is riba haram?` are treated as general doctrinal questions and may retrieve evidence; punctuation must not decide whether a question is personal advice.
- Personalized requests such as “Should I take this loan for my situation?” remain personal-ruling/refusal behavior.
- After a grounded riba answer, `What is the Islamic alternative?` retains the validated subject generically and searches both the literal query and a context-enriched query.
- Without a validated prior subject, the same follow-up asks for clarification or returns the existing friendly evidence-limit status.
- The trace proves whether failure occurs at policy, context, query planning, retrieval, generation, or citation validation; it must not print raw prompts, provider text, IDs, or secrets.

Run the focused RED/GREEN command, then the full Functions suite. Do not change thresholds or bypass citation validation to make this case pass.

## Task 2 — Generic conversation state, not a growing name list

**Files:**

- Modify: `functions/src/noor-rag/queryRewrite.ts`
- Modify: `functions/src/noor-rag/policy.ts`
- Modify: `functions/src/noor-rag/types.ts`
- Extend: `functions/test/noor-rag/queryRewrite.test.ts`
- Extend: `functions/test/noor-rag/production-wiring.test.ts`

Implement subject state from validated retrieval output and recent user turns, not from a finite list of Moses/Noah/riba strings:

- Store a bounded `subject` representation derived from the current query and cited corpus metadata.
- Detect structural follow-ups generically: pronouns, ellipsis, “what about…”, “what is the alternative…”, “why…”, “what happened next…”, and similar referential forms.
- Require a validated prior subject/evidence result before enriching; assistant history alone never qualifies.
- Treat the current user’s safety class as authoritative before using history.
- Preserve the original query alongside the context variant so the system can recover when the context hypothesis is wrong.
- Use corpus metadata/transliteration aliases as data, not code branches. Adding a corpus term must not require adding a new policy condition.

Adversarial tests must include unfamiliar names, common-word collisions, standalone “Tell me about him,” stale unrelated history, prompt injection in history, and a question that changes subject completely.

## Task 3 — Hybrid retrieval and evidence quality

**Files:**

- Modify: `functions/src/noor-rag/retrieval.ts`
- Modify: `functions/src/noor-rag/firestore.ts`
- Modify: `functions/scripts/noor-rag/ingest-corpus.ts`
- Modify: `functions/scripts/noor-rag/activate-corpus.ts`
- Modify: `functions/scripts/noor-rag/verify-index.ts`
- Extend: `functions/test/noor-rag/retrieval-quality.test.ts`
- Extend: `functions/test/noor-rag/migrate-lexical-readiness.test.ts`

The request path runs vector and lexical/metadata retrieval in parallel for the original and optional context query. Merge deterministically by source/corpus validity, query agreement, rank, score, and stable chunk identity. Deduplicate canonical units, preserve source diversity, cap evidence characters, and reassign citation IDs only after the final merge.

The corpus migration must be safe while active:

- Metadata-only lexical backfill must not mark a complete vector corpus `in_progress`.
- Runtime lexical readiness is separate from manifest completion.
- Activation requires a real composite-index probe, exact chunk-count equality, and a compare-and-set transition.
- If lexical search is not ready, vector retrieval remains explicitly available as a measured fallback or the system returns a typed corpus-unavailable status—never a silent false-green.

Required quality cases: Quran vocabulary, chapter themes, stories, follow-ups, modern concepts, no-evidence topics, and unrelated questions. Measure recall@k/MRR or equivalent, evidence diversity, citation validity, groundedness, completeness, abstention correctness, and p50/p95 latency.

## Task 4 — Natural generation and user-facing fallback

**Files:**

- Modify: `functions/src/noor-rag/generation.ts`
- Modify: `functions/src/noor-rag/citations.ts`
- Modify: `src/features/noor-ai/domain/NoorStatusPresentation.ts`
- Extend: `functions/test/noor-rag/generation.test.ts`
- Extend: `functions/test/noor-rag/citations.test.ts`
- Extend: `src/features/noor-ai/domain/NoorChatState.test.ts`

Generation must distinguish:

- direct Quran/tafsir evidence;
- a related principle supported by cited evidence;
- insufficient evidence for the requested modern concept;
- a clarification needed because the subject is unresolved;
- a safety refusal.

The client must display only bounded backend-safe copy for these statuses, never raw status/reference/provider details. Plain natural answers with validated citation IDs remain valid; inline marker formatting must not be required if the UI already renders citation chips separately.

## Task 5 — Tafsir parity and perceived latency

**Files:**

- Modify: `app/surah/[id].tsx`
- Modify: `src/features/tafsir/presentation/TafsirBottomSheet.tsx`
- Modify: `src/features/tafsir/domain/TafsirService.ts`
- Extend: `src/features/tafsir/presentation/TafsirBottomSheet.test.ts`
- Extend: `src/features/tafsir/domain/TafsirService.test.ts`

Keep the live interaction model. Enforce a verse/source/session render identity at the parent boundary; clear all context-bound state before a new request; render current-verse local commentary immediately or a neutral skeleton while the saved source is restored; ignore late old completions; keep the same-verse local fallback when remote Noor is unavailable.

Do not introduce a client cache that bypasses Auth/App Check, entitlement, quota, or corpus-version boundaries. If caching is later justified, the key must include user identity, source, verse, corpus version, and entitlement boundary—or the cache must live behind the authenticated server.

Acceptance: selected verse content appears locally under 300ms; no previous verse/source text ever renders; remote p50/p95 is measured separately and not hidden behind a generic promise.

## Task 6 — Adapted evaluation harness and production proof

**Files:**

- Modify: `functions/scripts/noor-rag/evaluate-retrieval.ts`
- Extend: `functions/test/noor-rag/evaluate-retrieval.test.ts`
- Create: `docs/noor-rag/noor-evaluation-method.md`
- Update: `docs/noor-rag/production-verification-2026-08-14.md`

The evaluation set is external to runtime code. Maintain:

1. a small seed set of representative behavior classes;
2. paraphrase and language variants generated from corpus metadata;
3. sanitized production failures promoted only when they represent a reusable failure mode;
4. aggregate-only output with no raw prompts, answers, IDs, tokens, or account data.

The evaluator must test the complete callable and client mapping where possible, not retrieval alone. It must report per-class recall, groundedness/citation validity, completeness, abstention correctness, policy safety, and latency distributions. A green evaluator does not authorize release unless it ran against the actual deployed revision and authenticated App Check path.

## Task 7 — Independent release gate

Different agents perform implementation, spec review, quality review, and final audit. One correction pass maximum per task; a second failure stops the phase and writes a new handover rather than looping.

Required final proof:

```bash
cd functions && npm test
cd functions && npm run build
cd functions && npm run build:scripts
cd functions && npm run contract:check
cd .. && npx tsc --noEmit
git diff --check
```

Then run an authenticated + App Check user-perspective matrix against the deployed revision: direct verse, Quran concept, story, semantic follow-up, modern concept, ambiguous pronoun, unrelated question, medical/legal, personal ruling, hadith, prompt injection, provider-unavailable, repeated Tafsir, and verse A → verse B. Capture sanitized expected/actual status, citations, stage timings, client build, deployed revision, and screenshots for failures or representative successes.

Archive/TestFlight is allowed only when the source fingerprint, deployed revision, corpus/index readiness, evaluator, client matrix, and live-parity matrix all match. Automated tests alone are not user-perspective proof.
