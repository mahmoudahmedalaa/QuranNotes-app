import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateNormativeObservation, type NormativeObservation } from '../../scripts/noor-rag/verify-normative';

function observation(overrides: Partial<NormativeObservation> = {}): NormativeObservation {
    return {
        taskType: 'point_question',
        contextSelected: false,
        retrievedRelevant: true,
        requestedRelation: 'prohibition',
        postAnswerabilityEvidenceCount: 0,
        generationCalls: 0,
        status: 'insufficient_evidence',
        citationCount: 0,
        statePersisted: false,
        answeredUsageIncrement: 0,
        answerability: 'insufficient',
        ...overrides,
    };
}

describe('Noor normative real-corpus harness contract', () => {
    it('accepts safe categorical abstention with retrieved relevant evidence', () => {
        assert.deepEqual(evaluateNormativeObservation('safe_abstention', observation()), {
            passed: true,
            failures: [],
        });
    });

    it('rejects a fabricated categorical answer from the same weaker evidence', () => {
        const result = evaluateNormativeObservation('safe_abstention', observation({
            postAnswerabilityEvidenceCount: 1,
            generationCalls: 1,
            status: 'answered',
            citationCount: 1,
            statePersisted: true,
            answeredUsageIncrement: 1,
            answerability: 'sufficient',
        }));

        assert.equal(result.passed, false);
        assert.deepEqual(result.failures, [
            'post-answerability evidence must be empty',
            'generation must not be invoked',
            'status must be insufficient_evidence',
            'citations must be empty',
            'conversation state must not persist',
            'answered usage increment must be zero',
            'answerability must be insufficient',
        ]);
    });
});
