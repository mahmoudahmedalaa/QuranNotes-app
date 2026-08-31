# Debug: Noor multi-entity citation failure

## Status: Resolved locally; release verification pending

## Symptoms

- Expected: The Nuh/Musa comparison returns an answered response with balanced, claim-local citations from both retrieval branches.
- Actual: Candidate revision `asknoorragv1-00054-len` returned `temporarily_unavailable`.
- Error: `citation_validation_failure` / `missing_required_citation` during `quality_correction`.
- Reproduction: Clean transcript turn 9, `How is the story of Nuh and Musa different?`
- First noticed: 2026-08-30 production release gate.

## Current Hypothesis

> Focus: Multi-entity branch provenance is lost before generation, and the correction path can introduce inline markers while leaving a formatting-only paragraph uncited; the validator then applies its all-paragraph rule without distinguishing headings from claims.
>
> Test: Replay the exact request through real promoted-corpus retrieval, real Vertex generation, and the full handler while retaining only citation IDs, entity mentions, and paragraph shape.
>
> Expected outcome: The bounded correction structure identifies the first paragraph/claim where generator output and deterministic citation expectations diverge.

## Evidence

1. Production is currently 100% on stable-v3 revision `asknoorragv1-00055-mak`.
2. Candidate revision `asknoorragv1-00054-len` was created at 2026-08-30T04:40:19Z and is retired.
3. Retained request ID: `694db3ee-5ad4-4297-af9e-a9e2201e2a5e`.
4. Sanitized trace: initial structural validation passed; quality judge and correction ran; corrected output failed `missing_required_citation`; state was not persisted.
5. `generation.ts` supplies final evidence without retrieval-branch provenance, while `handler.ts` retains branch groups only for answer-level post-validation.
6. `citations.ts` requires every non-empty paragraph to contain a marker whenever any marker appears, including formatting-only paragraphs.
7. A real promoted-corpus/full-handler replay reproduced the first divergence: the first substantive-looking block was an uncited formatting label, while later entity-local paragraphs carried valid branch citations.
8. After the request-scoped contract and deterministic validator were aligned, an initial reliability sample exposed the same formatting class in labels such as `## Comparison of <entity A> and <entity B>` plus valid rejection of cross-branch claim citations. The generation shape was then constrained generically to one cited paragraph per branch followed by one cited relation paragraph; retry counts were unchanged.
9. Final real-provider reliability: exact Nuh/Musa 10/10 answered on the first generation attempt; Yusuf/Nuh 5/5; Maryam/Yusuf 5/5. All had zero unsupported citations and zero independent provenance-validation failures.

## Eliminated Hypotheses

| # | Hypothesis | Evidence Against | Eliminated |
|---|---|---|---|
| 1 | Provider transient or timeout | Final class was deterministic citation validation; no provider transient/timeout class | Yes |
| 2 | Initial structured output failure | Initial structural validation passed | Yes |
| 3 | Missing retrieval support for one entity | Production trace resolved two entity IDs and reported balanced multi-entity retrieval before generation | Yes |

## Resolution

- Root cause: The handler retained branch provenance only for answer-level post-validation, while generation, structured-output guidance, citation validation, and quality correction did not share a request-scoped branch-to-evidence contract. The paragraph validator also treated safe formatting-only comparison labels as substantive claims.
- Fix: Build one generic comparison citation contract from the actual retrieval branches; pass it through generation, quality judgement, correction, and re-validation; validate claim-local entity provenance and distinct support for direct comparisons; exempt only tightly bounded formatting-only labels; constrain generated comparisons to cited entity-local paragraphs plus one cited relation paragraph.
- Verified: Focused citation/generation/handler tests 71/71; exact real-provider pair 10/10; two unrelated real-provider pairs 5/5 each. Complete repository and release verification remain pending.
