# Debug: Noor final stabilization benchmark failures

## Status: Blocked after two runtime repair passes; no release candidate commit

## Symptoms

- Expected: the frozen 80-case benchmark and exact clean/messy transcripts meet the declared release thresholds.
- Final actual: deterministic planning/policy passed 80/80 and transcripts passed 31/31, but the independent eight-case multi-entity sample answered only 5/8 (62.5%) against the 95% threshold.
- Provider events: zero transient failures and zero timeouts.
- Remaining generic failure: three supported comparison formulations stopped before generation as `insufficient_evidence` even though two entities were resolved.
- Affected cases: `g-maryam-yusuf-noisy`, `g-musa-yusuf`, and `g-nuh-maryam`.

## Current Hypothesis

> Final classification: deterministic runtime defect in generic multi-entity branch answerability/retrieval coverage. It is not a provider, citation-provenance, or harness failure. The two-pass cap prohibits another runtime change in this stabilization run.

## Evidence

1. Production remained on stable-v3 revision `asknoorragv1-00055-mak`; no deployment or production mutation occurred.
2. Focused preserved multi-entity tests passed 71/71.
3. Deterministic release benchmark passed 80/80; messy planner equivalence passed 10/10; policy critical set passed 5/5.
4. Promoted-corpus semantic retrieval passed 22/22 and current-world full-handler control stopped before generation with zero state/quota leakage.
5. Normative real-corpus gate passed 4/4 for clean Riba, categorical arrogance abstention, descriptive arrogance, and condemnation.
6. Real-Vertex synthesis passed 9/9 across Al-Nas, Maryam, and Yusuf with zero citation, quality, provider, coverage, or cross-Surah failures.
7. First exact transcript run: 21/31 turns passed; supported generation success 16/25; p50 5,498 ms; p95 20,653 ms; zero provider events; zero non-answer state/quota leaks.
8. The noisy categorical failure was pre-generation answerability drift, not a provider or citation failure.
9. Repair pass 1 canonicalized the generic elliptical normative question frame. Repair pass 2 aligned shorthand description/prerequisite and bounded lexical-family semantics without topic-specific runtime vocabulary.
10. Final transcript run passed 31/31; supported generation passed 25/25; p50 was 8,727 ms and p95 was 18,636 ms; provider, state-leak, and quota-leak counts were zero.
11. Final multi-entity run answered 5/8 across five distinct pairs; every answered result passed provenance validation, with zero provenance violations and zero provider events.
12. Required real-provider synthesis controls passed 30/30: Al-Nas 10/10, Maryam 10/10, and Yusuf 10/10, with zero citation, quality, coverage, provider, or cross-Surah failures.

## Eliminated Hypotheses

| # | Hypothesis | Evidence Against | Eliminated |
|---|---|---|---|
| 1 | Provider instability caused transcript failures | Zero provider transient/timeout subtypes; most failures stopped before generation | Yes |
| 2 | Promoted corpus identity or readiness is wrong | Active corpus `2026-08-10-v1`; promoted retrieval gate 22/22 | Yes |
| 3 | Multi-entity citation repair weakened citation acceptance | Focused 71/71 and synthesis 9/9; no unsupported citation was accepted | Yes |

## Resolution

- Root cause: the remaining comparison class resolves both entities but does not consistently retain enough branch-qualified evidence to pass balanced multi-entity answerability across natural formulations.
- Fix: No further fix attempted. The maximum two coherent runtime repair passes were consumed.
- Verified: Final thresholds not met because multi-entity answer success was 62.5% versus the required 95%. Production remains stable-v3; no final RC commit or carrier was created.

## Release-hardening continuation — query-side structural typo

### Status: 🟢 Focused repair verified; full frozen and live gates pending

### Current hypothesis

> Confirmed: conservative typo normalization belongs before retrieval planning and semantic answerability. Evidence tokenization and citation validation remain unchanged.

### Evidence (append-only)

13. With identical generic prerequisite evidence, `without` satisfied subject and relation slots while `wthout`, `withuot`, and `wihout` satisfied neither and selected no evidence.
14. `buildChatQueryPlan` emitted each typo unchanged, proving the first divergence was query interpretation rather than retrieval, evidence qualification, generation, or citation validation.
15. RED tests failed at both boundaries: the retrieval variant retained `wthout`, and answerability rejected the supported generic prerequisite case.
16. A bounded query-only normalizer now accepts only unique single-omission or adjacent-transposition matches from a structural operator vocabulary. Ambiguous `ater`, substitution-near `currant`, and `well` remain unchanged.
17. Focused planner, answerability, segment isolation, systemic robustness, transcript robustness, and production-shaped replay tests passed 56/56. Evidence text remained byte-for-byte unchanged in the query-normalization control.

### Resolution

- Root cause: misspelled structural query operators were treated as material subject tokens and prevented the existing relation contract from being recognized.
- Fix: normalize conservative, uniquely resolvable structural typos on the query side before planning and answerability; never normalize evidence text.
- Verified: focused local behavior passed. Frozen benchmark, promoted-corpus live proof, repository gates, and production canary remain pending.

### Release availability stop

18. Frozen deterministic semantics passed 80/80 with 100% messy equivalence and 100% policy pass rate.
19. The unchanged continuous transcripts passed 31/31 and supported generation passed 25/25, with zero provider, structured, citation-validation, quality, state, or quota failures.
20. The real five-form Wudu matrix answered clean, `wuduu`, `wthout`, and `withuot` with sufficient answerability and passed citations. The separate validity wording failed closed because the promoted evidence had prayer, wudu, and obligation support but no validity support; no cross-relation upgrade was attempted.
21. The frozen eight-case multi-entity run answered 7/8. Yusuf/Nuh failed closed as `provider_permanent_failure`; all answered cases had 100% provenance and zero unsupported citations or contamination.
22. The predefined 30-run multi-entity repetition answered 28/30. Nuh/Musa failed closed twice with the same `provider_permanent_failure` subtype at 66,517 ms and 66,479 ms; the other eight Nuh/Musa calls answered.
23. Across the two current multi-entity runs, 35/38 calls answered (92.1%) and 3/38 failed closed (7.9%) with the same provider-permanent subtype across two semantic pairs. Safety remained perfect, but the event is not isolated and therefore does not satisfy the release availability exception.

### Final stop

- No further runtime or harness repair was attempted.
- No final RC commit, detached carrier, deployment, production canary, or stable-v4 tag was created.
- Final blocker: reproducible safe provider-permanent availability failure in the multi-entity generation path, 3/38 current calls across two pairs.
