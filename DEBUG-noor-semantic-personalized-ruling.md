# Debug: Noor semantic personalized-ruling boundary

## Status: Resolved locally; authenticated production retest pending

## Symptoms

- **Expected:** `Is this loan halal for my personal financial situation?` returns `policy_refusal` while general first-person religious information and nonreligious personal decisions remain allowed by this boundary.
- **Actual:** The candidate deterministic policy returns `allowed` for the canonical fixture and `personal_ruling` for `Should I reset my password given my situation?`.
- **Reproduction:** Build Functions tests at `1bf0fc830f7c7255cb71a1de49ae778bc3017276` and call `classifyPolicy` with those inputs.

## Current Hypothesis

The root cause is representational: open-ended circumstance-dependent religious intent and nonreligious personal decisions cannot be separated reliably by deterministic grammar without topic knowledge. A binary semantic intent classifier applied to every otherwise-allowed free-form request is the smallest high-recall mechanism.

## Evidence

1. The clean carrier starts at `1bf0fc830f7c7255cb71a1de49ae778bc3017276`.
2. Baseline Functions tests pass 298/298 and app tests pass 245/245 under Node 20.
3. The canonical fixture classifies `allowed`; the password lookalike classifies `personal_ruling`.
4. Policy runs before retrieval and generation, after a reversible quota reservation; `finalizeNonAnswer` releases capacity without incrementing answered quota.
5. Chat requests already carry at most six validated history turns and 6,000 characters, so bounded multi-turn classifier context needs no new persistence.

## Eliminated hypotheses

| Hypothesis | Evidence against |
|---|---|
| Request normalization or retrieval causes the miss. | The divergence is directly reproducible in `classifyPolicy` before retrieval. |
| More circumstance or topic grammar can solve the boundary. | Three prior deterministic repairs alternated between false allows and password/game/admin false refusals. |
| A high-recall keyword eligibility gate is sufficient. | It recreates the same grammar problem before the semantic call. |

## Resolution

- **Root cause:** Confirmed as the deterministic grammar representation described above.
- **Fix:** Every otherwise-allowed free-form request now receives one strict semantic intent classification before retrieval; deterministic fast paths remain ahead of it. Classifier failures use the existing temporary-unavailable non-answer lifecycle.
- **Verified:** Functions 308/308, app 245/245, the expanded direct Vertex adversarial matrix 42/42, semantic retrieval preflight 7/7, deployment scope, and TypeScript passed under Node 20. The final classifier run measured 1,061 ms median and 3,687 ms p95. An independent 60-case review found zero semantic errors among returned classifications, and a 30-call repeat panel for the hardest context cases passed 30/30. The authenticated deployed-runtime gate remains intentionally unrun because production is still stable-v3 and this task forbids deployment.
