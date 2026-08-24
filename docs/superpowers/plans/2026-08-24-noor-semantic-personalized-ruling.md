# Noor Semantic Personalized-Ruling Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one strict semantic intent classifier for circumstance-dependent personalized religious rulings while preserving deterministic policy fast paths and all Noor lifecycle invariants.

**Architecture:** Every deterministically allowed free-form Noor request receives one sequential Vertex classification call before retrieval. The classifier is isolated from religious knowledge, validates exact bounded JSON, uses existing bounded chat history, and fails with the existing temporary infrastructure outcome.

**Tech Stack:** TypeScript, Node test runner, `@google/genai`, Firebase Functions v2.

---

### Task 1: Classifier contract

**Files:**
- Create: `functions/src/noor-rag/personalizedRulingClassifier.ts`
- Create: `functions/test/noor-rag/personalized-ruling-classifier.test.ts`

- [x] Write tests asserting exact schema, model, temperature, thinking budget, no tools, token cap, history bounding, enum parsing, malformed JSON, schema errors, provider errors, and timeout mapping.
- [x] Run `npm run build:test && node --test lib-test/test/noor-rag/personalized-ruling-classifier.test.js` and confirm the missing-module RED failure.
- [x] Implement the minimal classifier/provider and exact parser.
- [x] Rerun the focused test and require zero failures.

### Task 2: Policy and handler integration

**Files:**
- Modify: `functions/src/noor-rag/policy.ts`
- Modify: `functions/src/noor-rag/handler.ts`
- Modify: `functions/src/noor-rag/callable.ts`
- Modify: `functions/test/noor-rag/policy.test.ts`
- Modify: `functions/test/noor-rag/handler.test.ts`

- [x] Write RED tests for the canonical fixture, general first-person information, nonreligious lookalikes, deterministic fast paths, one-call invocation, refusal short-circuit, temporary failure behavior, quota finalization, and zero state persistence.
- [x] Run the focused tests and confirm the intended failures.
- [x] Remove brittle personalized circumstance/topic grammar, retain only safe deterministic categories, make semantic classification an async handler dependency, and wire the existing Vertex client.
- [x] Rerun focused tests and require zero failures.

### Task 3: Privacy, context, and semantic matrix

**Files:**
- Modify: `functions/src/noor-rag/telemetry.ts`
- Modify: `functions/test/noor-rag/production-wiring.test.ts`
- Modify: `functions/test/noor-rag/systemic-robustness.test.ts`
- Modify: `functions/test/noor-rag/transcript-robustness.test.ts`

- [x] Write RED tests for the requested informational, personalized, noisy, non-loan, lookalike, and two-turn matrices plus telemetry allowlisting.
- [x] Run focused tests and confirm intended failures.
- [x] Add bounded telemetry fields to handler event/trace sanitization and complete context wiring.
- [x] Rerun focused tests and require zero failures.

### Task 4: Full proof and one commit

**Files:**
- Modify: `.agent/LESSONS_LEARNED.md`
- Modify: `DEBUG-noor-semantic-personalized-ruling.md`

- [ ] Run Functions tests, app tests, Functions/root TypeScript, `npm run noor:verify`, `npm run noor:verify:retrieval`, deployment-package verification, and `git diff --check` under Node 20.
- [ ] Dispatch a fresh read-only reviewer over the frozen diff and adversarial matrix; correct any material finding and rerun affected plus full gates.
- [ ] Record exact test counts, latency evidence, scope evidence, and the two intentionally unfixed planner-noise findings.
- [ ] Create one commit with message `fix: classify personalized Noor rulings semantically`.
