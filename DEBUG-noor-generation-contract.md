# Debug: Noor evidence-generation contract disagreement

## Status: 🟢 Resolved

## Symptoms
- **Expected:** Once deterministic evidence qualification establishes every required semantic slot for the selected request-scoped evidence, generation may synthesize an answer or retain a distinct residual abstention, but it must not claim that an established slot is missing.
- **Actual:** A generated typed abstention can be canonicalized as `insufficient_evidence` even when it claims that deterministic qualification's selected evidence is missing an already-established subject or relation.
- **Errors:** The authenticated candidate canary recorded a deterministic `schema_outcome_contract_failure` for a generated `insufficient_evidence` follow-up after retrieval and answerability had selected evidence.
- **Reproduction:** Supply deterministically qualified evidence, have the first generation or the existing quality-correction generation return a typed missing-slot abstention, and observe that not every generation branch compares the reason with a request-scoped evidence contract.
- **First noticed:** Final exact-SHA candidate canary at `cb5fda4e8acea68092ec5702d173a7e9c98eeb21`.

## Current Hypothesis
> **Focus:** Evidence sufficiency ownership is duplicated between deterministic qualification and generated abstention handling.
> **Test:** Add generic request-scoped tests for proven subject, relation, comparison/entity provenance, and the pre-generation current-state/normative gates; then exercise both initial abstention and quality-correction abstention branches.
> **Expected outcome:** Tests fail because the contract is absent outside direct point questions and because the quality-correction abstention branch does not detect a contradiction.

## Evidence (append-only)

1. 2026-09-01 — `functions/src/noor-rag/queryRewrite.ts:92-103` carries the resolved task, retrieval task, entity set, and primary entity from planning.
2. 2026-09-01 — `functions/src/noor-rag/answerability.ts:256-275` derives semantic requirements; `303-336` determines satisfied slots; `442-494` admits evidence only when required direct or branch support is present.
3. 2026-09-01 — `functions/src/noor-rag/handler.ts:849-979` performs retrieval and deterministic qualification and returns before generation when no qualified evidence remains.
4. 2026-09-01 — `functions/src/noor-rag/handler.ts:981-1004` preserves comparison citation provenance but constructs `answerabilityContract` only for direct `point_question` tasks, so contextual, comparison, summary, and exact generation requests receive no evidence-sufficiency contract.
5. 2026-09-01 — `functions/src/noor-rag/generation.ts:337-351` builds the selected-evidence prompt; `374-407` detects a subset of typed abstention contradictions and issues one correction with the same selected evidence.
6. 2026-09-01 — `functions/src/noor-rag/generation.ts:898-953` checks an initial typed abstention, but `993-1026` canonicalizes an abstention returned by quality correction without comparing its missing-slot reason with deterministic qualification. This is the first duplicate-ownership branch after an already-used correction.
7. 2026-09-01 — `functions/src/noor-rag/generation.ts:819-823` keeps citation/provenance validation separate from answerability; the repair must preserve those validators and the exact selected evidence IDs.

## Eliminated Hypotheses (append-only)

| # | Hypothesis | Evidence Against | Eliminated |
|---|-----------|-----------------|------------|
| 1 | Retrieval must be broadened to answer the failed request. | The handler already receives and selects answerable evidence before generation; the failure is a generated outcome disagreement after selection. | 2026-09-01 |
| 2 | Typed abstention should be disabled or every sufficient request should be forced to answer. | Existing generated contract intentionally permits `evidence_conflict` and `other_evidence_gap`; safe residual abstention is a required invariant. | 2026-09-01 |
| 3 | Citation or grounding validation should be weakened. | The disagreement occurs before quality/citation finalization and the selected evidence/citation contract is already available. | 2026-09-01 |

## Focused proof commands

```bash
cd functions && PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run build:test && PATH=/opt/homebrew/opt/node@20/bin:$PATH node --test lib-test/test/noor-rag/generation-contract.test.js
cd functions && PATH=/opt/homebrew/opt/node@20/bin:$PATH node --test lib-test/test/noor-rag/answerability.test.js lib-test/test/noor-rag/generation.test.js lib-test/test/noor-rag/handler.test.js
cd functions && PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run build && PATH=/opt/homebrew/opt/node@20/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run typecheck
```

## Resolution
- **Root cause:** Deterministic semantic qualification and generated abstention both make evidence-sufficiency decisions, but the machine-readable contract is partial by task and is not enforced at the quality-correction abstention branch.
- **Fix:** Added one request-scoped machine-readable qualification contract carrying task, relation, semantic slots, exact selected evidence IDs, and bounded entity provenance from the handler into every deterministically qualified chat generation. Typed missing-slot abstentions are checked against that contract both initially and after the single existing correction. A first contradiction receives one correction with unchanged request/evidence/citation/provenance inputs; a repeated contradiction fails closed as `generation_contract_disagreement`; a distinct residual gap remains canonical `insufficient_evidence`.
- **Verified:** TDD RED failed 4/8 generic contract cases for the expected missing behavior. GREEN passed 8/8 contract cases, 83/83 focused answerability/generation/handler cases, Functions build, 421/421 full Functions tests, and root TypeScript. The deterministic `noor:verify` carrier gate was intentionally deferred until after the required commit because it rejects a dirty development carrier.
