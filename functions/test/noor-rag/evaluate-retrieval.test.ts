import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateRibaFollowUpEvaluation } from '../../scripts/noor-rag/evaluate-retrieval';
import type { NoorSanitizedTrace } from '../../src/noor-rag/handler';

function trace(overrides: Partial<NoorSanitizedTrace> = {}): NoorSanitizedTrace {
    return {
        case: 'riba-followup',
        policy: 'allowed',
        status: 'answered',
        citationCount: 1,
        conversationState: 'validated_subject_and_evidence',
        contextSelected: true,
        selectedPriorUserContext: 'validated_prior_subject',
        queryVariantCount: 2,
        queryVariantKinds: ['original', 'context_enriched'],
        vectorHitCount: 8,
        lexicalHitCount: 4,
        evidenceIds: ['E1'],
        evidenceCount: 1,
        generationStatus: 'answered',
        citationValidation: 'passed',
        stageMs: { policy: 1, context: 2, retrieval: 30, generation: 40, citationValidation: 1 },
        finalCopy: 'Answer available with validated tafsir citations.',
        ...overrides,
    };
}

describe('Noor aggregate retrieval evaluator', () => {
    it('reports aggregate riba follow-up behavior without raw values or identifiers', () => {
        const result = aggregateRibaFollowUpEvaluation([
            trace(),
            trace({
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
        ]);

        assert.equal(result.case, 'riba-followup');
        assert.equal(result.sampleCount, 2);
        assert.equal(result.contextSelectedCount, 1);
        assert.equal(result.evidenceFoundCount, 1);
        assert.equal(result.generationNotRunCount, 1);
        assert.equal(result.citationValidationPassedCount, 1);
        assert.deepEqual(result.queryVariantCount, { total: 2, minimum: 0, maximum: 2 });
        assert.deepEqual(result.latencyMs.retrieval, { minimum: 0, maximum: 30, p50: 0, p95: 30 });

        const allPositive = aggregateRibaFollowUpEvaluation([trace(), trace()]);
        assert.equal(allPositive.queryVariantCount.minimum, 2);

        const serialized = JSON.stringify(result);
        for (const forbidden of [
            'Is riba haram?',
            'Provider answer text',
            'chunk-riba-secret',
            'secret-error',
            'sensitive-user@example.com',
            '11111111-1111-4111-8111-111111111111',
        ]) {
            assert.equal(serialized.includes(forbidden), false);
        }
    });
});
