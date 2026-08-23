# Debug: Noor real-user systemic robustness

## Status: Resolved locally; live verification pending

## Symptoms

- **Expected:** Generic planning, entity containment, bounded discourse roles, adaptive evidence qualification, correct policy boundaries, and typed non-answer hygiene.
- **Actual:** Stable-v3 uses narrow synthesis phrases, flat evidence-derived subject tokens, fixed synthesis section thresholds, first-person policy overmatching, and incomplete non-answer normalization.
- **Errors:** Established production-backed failure classes from the Aug 23 unscripted session; individual screenshots are out of scope.
- **Reproduction:** Focused deterministic regressions for planner paraphrases, explicit entity containment, multi-entity references, short-entity synthesis, normative relation terms, first-person policy variants, and answered-looking abstentions.
- **First noticed:** Production audit supplied on 2026-08-23.

## Current Hypothesis

> **Focus:** The failures share missing generic semantic invariants at planning, discourse, qualification, and outcome boundaries rather than corpus or topic-specific defects.
> **Test:** Add one failing regression per invariant against the current stable-v3 runtime, then implement the smallest reusable capabilities.
> **Expected outcome:** The new regressions fail for the established reason before implementation and pass afterward without new model calls, corpus changes, or topic-specific runtime rules.

## Evidence (append-only)

1. 2026-08-23 — Repository starts at `f55ae92a4bf7ab0a1d252cfbd262069c88a61b91`, tagged `noor-rag-stable-v3`; production baseline is `asknoorragv1-00031-put`.
2. 2026-08-23 — `quranEntities.ts` uses a finite phrase regex for synthesis; `queryRewrite.ts` stores a flat `subjectTokens` list; `answerability.ts` requires fixed positional sections; `policy.ts` includes bare `can i` in personal context; `handler.ts` permits parsed non-answers to carry citations unless separately normalized.
3. 2026-08-23 — The compiled Functions baseline passed 282/282 before the shell invocation accidentally appended six source `.ts` files to Node's compiled-test command; those six loader failures were command misuse, not product failures.
4. 2026-08-23 — Focused RED tests reproduced phrase-bound synthesis, explicit-scope contamination, flat pair drift, fixed short-entity coverage, literal normative mismatch, first-person over-refusal, and answered-looking abstention.
5. 2026-08-23 — The first adversarial review found five material boundary failures; targeted RED tests reproduced each before the generic corrections.
6. 2026-08-23 — The final targeted re-review found the synthesis, policy-condition, branch-provenance, citation-balance, and canonical-abstention corrections materially resolved.
7. 2026-08-23 — Full local Functions tests pass 298/298; full app tests pass 245/245; root and Functions TypeScript pass; `git diff --check` passes.

## Eliminated Hypotheses (append-only)

| # | Hypothesis | Evidence Against | Eliminated |
|---|------------|------------------|------------|
| 1 | The repair requires a new corpus, embedding, or per-Surah index. | The failing boundaries are deterministic routing/state/qualification/outcome logic and existing canonical metadata supports Surah containment. | 2026-08-23 |
| 2 | Topic-specific religious mappings are required. | The requested equivalences are linguistic relations and entity/task structure, not topic rulings. | 2026-08-23 |
| 3 | The six source-test loader failures indicate a dirty baseline. | The package script had already completed all compiled tests at 282/282; only the accidentally appended raw `.ts` arguments failed under Node strip-only loading. | 2026-08-23 |

## Resolution

- **Root cause:** Stable-v3 had narrow lexical task routing, evidence-derived flat discourse state, fixed synthesis coverage, literal relation matching, pronoun-based policy classification, and no authoritative normalization between generated non-answer semantics and response status.
- **Fix:** Added a bounded deterministic task/discourse frame, explicit entity and per-branch evidence invariants, adaptive coverage capacity, linguistic relation concepts, condition-aware personal-policy composition, typed/canonical abstention normalization, defensive client citation filtering, sanitized decision telemetry, and transcript/metamorphic evaluation coverage.
- **Verified:** Focused reviewer regressions 57/57; Functions 298/298; app 245/245; both TypeScript builds and diff check clean. Authenticated live verification remains intentionally pending; no deployment occurred.
