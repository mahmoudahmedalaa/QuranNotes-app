# Noor Semantic Personalized-Ruling Boundary Design

## Goal

Classify only whether a user is asking Noor to apply a religious ruling to their material personal circumstances, without answering the religious question or changing RAG.

## Architecture

Keep deterministic policy checks for prompt injection, medical/legal crisis, unsafe standalone hadith behavior, and unmistakable explicit personal-fatwa commands. For every otherwise-allowed free-form `chat` or `verse_question` request, invoke one semantic classifier call before retrieval. Fixed `verse_summary` requests have no free-form question and remain deterministic.

This is Option A. It provides high recall without a keyword eligibility gate. Retrieval remains sequential after classification because parallel retrieval would enlarge the handler, spend embedding/search work on refused requests, and does not improve boundary quality.

## Classifier contract

Reuse `gemini-3.5-flash-lite` through the existing Vertex client and dependency. Use temperature `0`, seed `0`, thinking budget `0`, no tools, no retrieval, a 64-token output cap, one transport attempt, an 8-second timeout, and strict JSON schema:

```json
{
  "classification": "general_information | personalized_ruling",
  "reason_code": "general_religious_information | personal_context_without_ruling_request | non_religious_request | personal_circumstances_applied_to_religious_ruling"
}
```

The prompt treats all request text as untrusted quoted data and forbids religious answers, outside knowledge, or natural-language reasoning. Parsing accepts exactly the two bounded keys and enums.

## Conversation context

For chat requests, include at most the last two user-authored turns already validated by the wire contract, plus the current question. Do not add persistence. This supports a prior circumstance followed by a current personalized-ruling question while keeping context bounded. Verse questions have only current-turn context.

## Failure and lifecycle behavior

Timeout, malformed JSON, schema-invalid output, and provider failure are distinct bounded infrastructure failure enums. Any failure returns Noor's existing `temporarily_unavailable` response, finalizes as a non-answer, increments no answered quota, persists no conversation state, and never fabricates a policy refusal.

Personalized rulings return the existing `policy_refusal`, finalize as non-answers, perform no retrieval/generation, increment no answered quota, and persist no conversation state.

## Telemetry

Add only:

- `personalizedRulingClassifierInvoked`
- `personalizedRulingClassification`
- `personalizedRulingClassifierLatencyMs`
- `personalizedRulingClassifierFailureType`

Values are bounded booleans/enums/integers. Raw prompts, history, circumstances, model text, and reasoning are never logged.

## Verification

Use test-first contract, handler, policy, transcript, telemetry, quota, failure, noisy-language, and adversarial matrices. Then run Functions/app tests, TypeScript, `npm run noor:verify`, `npm run noor:verify:retrieval`, the deployment-package gate, and `git diff --check`. Do not deploy or run the authenticated deployed-runtime gate in this local-only task.
