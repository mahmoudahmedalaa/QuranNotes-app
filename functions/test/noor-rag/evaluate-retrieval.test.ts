import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateNoorEvaluation, parseNoorEvaluationInput } from '../../scripts/noor-rag/evaluate-retrieval';
import type { NoorSanitizedTrace } from '../../src/noor-rag/handler';

function trace(overrides: Partial<NoorSanitizedTrace> = {}): NoorSanitizedTrace {
    return {
        requestId: '11111111-1111-4111-8111-111111111111',
        case: 'seed-follow-up',
        policy: 'allowed',
        status: 'answered',
        citationCount: 1,
        conversationState: 'validated_subject_and_evidence',
        contextSelected: true,
        selectedPriorUserContext: 'validated_prior_subject',
        queryVariantCount: 2,
        queryVariantKinds: ['original', 'context_enriched'],
        taskType: 'contextual_followup',
        resolvedEntityIds: [],
        sanitizedRewriteFingerprint: 'b'.repeat(64),
        preAnswerabilityEvidenceIds: ['E1'],
        postAnswerabilityEvidenceIds: ['E1'],
        answerabilityReason: 'sufficient',
        policyReasonCode: 'allowed',
        outcomeNormalizationReason: 'none',
        stateAction: 'persisted',
        vectorHitCount: 8,
        lexicalHitCount: 4,
        lexicalSearchStatus: 'available',
        evidenceIds: ['E1'],
        evidenceCount: 1,
        generationStatus: 'answered',
        citationValidation: 'passed',
        generationAttemptCount: 1,
        generationFailurePhase: 'none',
        structuralValidationResult: 'passed_first_attempt',
        citationValidationResult: 'passed_first_attempt',
        citationValidationFailureSubtype: null,
        qualityJudgeInvoked: true,
        generationRetryInvoked: false,
        correctionInvoked: false,
        finalGenerationErrorClass: null,
        statePersistence: 'persisted',
        stateFingerprint: 'a'.repeat(64),
        stageMs: { policy: 1, context: 2, retrieval: 30, generation: 40, citationValidation: 1 },
        finalCopy: 'Answer available with validated tafsir citations.',
        ...overrides,
    };
}

describe('Noor generic aggregate evaluator', () => {
    it('accepts external sanitized inputs without importing a topic list', () => {
        assert.throws(() => parseNoorEvaluationInput({}), /traces array/);
        const parsed = parseNoorEvaluationInput({ traces: [trace({ case: 'story-paraphrase' })] });
        assert.equal(parsed.traces[0]?.case, 'story-paraphrase');
    });

    it('rejects malformed trace records before aggregation', () => {
        assert.throws(
            () => parseNoorEvaluationInput({ traces: [trace({ status: 'not-a-status' as NoorSanitizedTrace['status'] })] }),
            /invalid sanitized trace/i,
        );
        assert.throws(
            () => parseNoorEvaluationInput({ traces: [trace({ queryVariantCount: 1, queryVariantKinds: [] })] }),
            /invalid sanitized trace/i,
        );
        assert.throws(
            () => parseNoorEvaluationInput({ traces: [trace({ evidenceCount: 0, evidenceIds: ['E1'] })] }),
            /invalid sanitized trace/i,
        );
    });

    it('aggregates arbitrary case labels and evaluates external expectations without raw values', () => {
        const result = aggregateNoorEvaluation({
            traces: [
                trace(),
                trace({
                    case: 'unresolved-pronoun',
                    status: 'insufficient_evidence',
                    contextSelected: false,
                    conversationState: 'none',
                    selectedPriorUserContext: 'none',
                    queryVariantCount: 0,
                    queryVariantKinds: [],
                    evidenceIds: [],
                    evidenceCount: 0,
                    generationStatus: 'not_run',
                    citationValidation: 'not_run',
                    stageMs: { policy: 1, context: 1, retrieval: 0, generation: 0, citationValidation: 0 },
                    finalCopy: 'Please name the Quran topic, verse, or person you mean so I can search the tafsir.',
                }),
            ],
            expectations: {
                'seed-follow-up': { minimumContextSelected: 1, minimumEvidenceFound: 1, minimumCitationValidationPassed: 1, allowedStatuses: ['answered'] },
                'unresolved-pronoun': { minimumEvidenceFound: 0, allowedStatuses: ['insufficient_evidence'] },
            },
        });

        assert.deepEqual(result.caseCounts, { 'seed-follow-up': 1, 'unresolved-pronoun': 1 });
        assert.deepEqual(result.statusCounts, { answered: 1, insufficient_evidence: 1 });
        assert.equal(result.expectations['seed-follow-up']?.passed, true);
        assert.equal(result.expectations['unresolved-pronoun']?.passed, true);
        assert.equal(aggregateNoorEvaluation({ traces: [], expectations: { missing: {} } }).expectations.missing?.passed, false);
        assert.deepEqual(result.queryVariantCount, { total: 2, minimum: 0, maximum: 2 });
        assert.deepEqual(result.latencyMs.retrieval, { minimum: 0, maximum: 30, p50: 0, p95: 30 });

        const serialized = JSON.stringify(result);
        for (const forbidden of [
            'Provider answer text', 'chunk-secret', 'secret-error', 'sensitive-user@example.com',
            '11111111-1111-4111-8111-111111111111',
        ]) {
            assert.equal(serialized.includes(forbidden), false);
        }
    });
});
