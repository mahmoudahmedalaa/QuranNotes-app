# Debug: Noor Natural-Language Task Planning

## Status: Resolved Locally

## Symptoms

- **Expected:** Semantically equivalent clean and messy whole-entity questions share the same task and entity boundary.
- **Actual:** `What is Surah Maryam about?` routes to `entity_summary`, while `what surah maryam abt` routes to `point_question`. `Tell me the main themes of Al-Kahf` routes to `entity_summary`, while `tell me main thing in kahf` routes to `point_question`.
- **Errors:** No runtime error. The planner returns a valid but semantically wrong task.
- **Reproduction:** Build the Functions test target and call `buildChatQueryPlan` with each clean/messy pair on commit `c9a1aefac86dbfdd7ff3e3eb26729f9ae4d3f568`.
- **First noticed:** Final pre-production natural-language audit on 2026-08-24.

## Current Hypothesis

> **Focus:** Task confidence is represented as exact token membership rather than a bounded ambiguity signal.
> **Test:** Compare resolved entity and `hasEntitySummarySignal` behavior for clean and messy pairs.
> **Expected outcome:** Entity resolution succeeds for the named Surah, but the messy operation produces no summary signal and silently defaults to `point_question`.

## Evidence (append-only)

1. 2026-08-24 — Baseline on exact candidate `c9a1aefac...`: clean Maryam and Al-Kahf inputs returned `entity_summary`; their messy equivalents returned `point_question` while retaining the correct Surah entity.
2. 2026-08-24 — `hasEntitySummarySignal` is a deterministic composition of exact normalized operation/scope token sets. `abt` is not `about`, and `main thing` has scope but no recognized broad operation, so both cases fall through to the default point task.
3. 2026-08-24 — The personalized-ruling classifier has a strict policy-only schema and is intentionally invoked for every otherwise-allowed free-form request. Adding task planning to it would couple policy availability and task routing and would force task interpretation into the policy call even for deterministic requests.
4. 2026-08-24 — RED tests failed because the task-only classifier, fallback assessment, semantic-plan application, conservative Surah candidate resolver, and informal comparison handling did not exist.
5. 2026-08-24 — Final direct Vertex evaluation passed 32/32 cases: 24 deterministic plans and 8 semantic fallbacks, with fallback median 0.972 seconds and P95 4.526 seconds.
6. 2026-08-24 — The direct model repeatedly treated an abbreviated noun after an explicit broad-scope modifier as a point. The final design kept that request on the deterministic fast path by composing existing whole-Surah, broad-scope, and no-local-focus signals; no abbreviation rule was added.

## Eliminated Hypotheses (append-only)

| # | Hypothesis | Evidence Against | Eliminated |
|---|---|---|---|
| 1 | Surah entity resolution causes both known failures. | Baseline plans resolved Maryam and Al-Kahf correctly in both messy inputs. | 2026-08-24 |
| 2 | A larger summary phrase list is required. | The failure is the absence of semantic operation confidence; adding colloquial spellings would only move the maintenance boundary. | 2026-08-24 |
| 3 | The policy classifier should return a task hint for all requests. | Its isolated policy contract and all-request invocation would create cross-domain coupling and still put every deterministic task through model planning. | 2026-08-24 |

## Resolution

- **Root cause:** The deterministic planner encoded task confidence as exact summary-token membership and silently treated every unresolved operation as a confident point question.
- **Fix:** Preserve high-confidence deterministic routing, expose only ambiguous resolved-entity or validated-frame requests to an isolated strict-schema task classifier, validate its output against deterministic entities/state, clarify on failure, and add conservative canonical Surah candidate matching.
- **Verified:** Focused planner/classifier/handler/transcript tests and the direct 32-case Vertex matrix pass locally. Full repository gates are recorded separately in the final candidate evidence.
