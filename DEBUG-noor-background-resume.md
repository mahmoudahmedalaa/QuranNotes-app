# Debug: Noor Background Resume Reliability

## Status: 🔴 Active

## Symptoms
- **Expected:** A submitted Noor request continues server-side while QuranNotes is backgrounded and the same request is safely reconciled after resume.
- **Actual:** Returning to QuranNotes can surface a false temporary-unavailability error instead of the original answer.
- **Errors:** `Noor is temporarily unavailable. Your message was not sent. Please try again.`
- **Reproduction:** Send an answerable Noor question, immediately background the app for 5–15 seconds, then reopen it.
- **First noticed:** Production Noor RAG and quota behavior are already verified; this session is scoped only to the mobile lifecycle defect.

## Current Hypothesis
> **Focus:** The client loses the active fetch result or aborts it after iOS suspension, while the backend completes and stores the final answer under the original request ID.
> **Test:** Record the request ID and lifecycle timing, interrupt the client, then inspect production idempotency, telemetry, usage, and conversation state before replaying the same ID.
> **Expected outcome:** The original backend request completes once, but the client has no retained request ID/reconciliation path and converts the transport interruption into temporary failure.

## Evidence (append-only)
<!-- NEVER delete entries. Only add new findings. -->

1. 2026-08-22 — Canonical carrier is `feature/noor-ai-phase5` at `884b19f8204b4a0f7b8fce56c8156a74d9d0ab2e`; `noor-rag-stable-v2` remains at `455343507233f69d2c922933a641ce3ff7b87d3b`.
2. 2026-08-22 — `NoorAIService.createNoorAIService().askNoor()` creates a new request ID internally for every call, so `NoorAIScreen` cannot retain or replay it.
3. 2026-08-22 — `NoorRemoteService.ask()` aborts its fetch after 25 seconds and maps abort/network errors to `temporarily_unavailable`.
4. 2026-08-22 — `NoorAIScreen.handleSend()` has no AppState/resume reconciliation; every thrown transport error becomes the transient temporary-unavailability message.
5. 2026-08-22 — Backend `claimRequest()` returns a stored completed response for same-ID replay, reports a live different-owner lease as `in_progress`, and does not charge again for completed replay.
6. 2026-08-22 — Release simulator reproduction sent a Riba question at `2026-08-21T23:40:30.893Z`, immediately backgrounded, and resumed at `23:40:51.052Z`. The UI showed the false `temporarily unavailable` copy and no idempotency, usage, telemetry, or conversation-state record existed, proving that immediate suspension can occur before callable dispatch rather than iOS cancelling an accepted backend request.
7. 2026-08-22 — Accepted-request interruption probe used request `f7e852f1-b612-47de-a11a-9bc3c25a4862`: backend accepted it as pending, the client transport was aborted, and backend finalized `answered`. Same-ID replay returned the stored answer with generation count `0`, quality judge `false`, unchanged usage `answered=1`, no reservation, and no second conversation-state write.
8. 2026-08-22 — First divergence is client-side request ownership: request ID was created inside the service, never persisted, and `NoorAIScreen` had no AppState reconciliation. Thus pre-dispatch suspension and a lost post-accept response both became terminal presentation failures even though the interruption was recoverable.
9. 2026-08-22 — Focused client tests passed: four suites, fifteen tests. Full Functions build/test passed: 270 tests, including same-ID replay assertions for exactly one claim, generation, finalize, and conversation-state write.
10. 2026-08-22 — Debug simulator live proof used request `c46a6ec6-b020-411d-a940-6734dcca71e3`. Backend state was observed `pending` with one reservation before QuranNotes was backgrounded at `2026-08-22T00:22:21.871Z`; while backgrounded it finalized `answered`, generation count `1`, quality judge invoked once, usage `answered=1`, reservations `0`, and state persistence `persisted`. Foregrounding displayed the original cited answer without temporary failure.
11. 2026-08-22 — The recovered Riba turn supported the sequential question `What is an Islamic alternative?`; Noor answered contextually about permitted trade and Zakah. This was request `1625f0c5-09ad-4998-a83a-c13ede5de088`, leaving total usage at two for two distinct answered questions and zero reservations.
12. 2026-08-22 — Final verification passed: TypeScript zero errors; app Jest 32 suites / 240 tests; Functions/RAG 35 suites / 270 tests; Expo lint zero errors (94 pre-existing warnings, none in changed files); iOS export bundled 3,769 modules successfully; `git diff --check` clean.
13. 2026-08-22 — QA teardown deleted two idempotency records, the usage record, two telemetry records, rate state, conversation state, telemetry subject, owner-QA grant, Auth user, App Check debug token, and the local credential file. Post-operational cleanup inspection returned empty collections/state before identity deletion.
14. 2026-08-22 — Independent review found three exact-once gaps outside the 5–15 second reproduction: unbounded replay beyond the backend's ten-minute completed-result retention, a client retry window shorter than the two-minute in-progress lease, and pending state not scoped to the creating Firebase UID. Focused tests were changed first and failed on all three gaps.
15. 2026-08-22 — Corrections use existing contracts only: user-scoped pending storage with owner checks before and during replay; a conservative nine-minute automatic-recovery cutoff checked before every attempt; a retry schedule covering the full two-minute lease; and exhausted `temporarily_unavailable` recovery now retains the pending identity instead of persisting a false terminal answer. Focused correction tests passed 16/16 and TypeScript remained clean.
16. 2026-08-22 — Re-review found one final account-switch TOCTOU between local ownership validation and token acquisition. A RED test changed Firebase users during `getAuthToken()` and proved the old transport could proceed. The transport now accepts the expected owner UID and verifies `auth.currentUser.uid` both before and after Auth/App Check token acquisition, immediately before fetch; the GREEN test proves fetch is never called with a switched user.
17. 2026-08-22 — Independent final re-review reports no Critical or Important findings and a PASS readiness verdict. Fresh final gates: focused lifecycle/transport 33/33, full app 32 suites / 243 tests, TypeScript clean, iOS export successful, Functions/RAG 35 suites / 270 tests, and diff check clean.

## Eliminated Hypotheses (append-only)
<!-- NEVER delete entries. Prevents re-investigating dead ends. -->

| # | Hypothesis | Evidence Against | Eliminated |
|---|-----------|-----------------|------------|

## Resolution
- **Root cause:** The client treated the active JavaScript promise as the only owner of a Noor request. Its stable request ID and replay payload were not available to the screen, were not persisted, and no AppState resume path existed, so an iOS suspension could strand either pre-dispatch work or an accepted backend result and surface a false service failure.
- **Fix:** Create and persist the request ID plus minimum replay payload before transport; retain pending/recovering state; reconcile on initial mount and inactive/background-to-active transitions using the same ID; merge the assistant result once; clear pending state only after local conversation persistence.
- **Verified:** Focused and full app tests, all Functions/RAG tests, TypeScript, lint, iOS export, local Debug simulator background/resume against the production backend, exactly-once telemetry/usage, contextual follow-up, scoped diff check, and QA teardown all passed.
