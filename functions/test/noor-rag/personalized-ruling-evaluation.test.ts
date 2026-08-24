import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    evaluatePersonalizedRulingCases,
    PERSONALIZED_RULING_EVALUATION_CASES,
    type PersonalizedRulingEvaluationCase,
} from '../../scripts/noor-rag/verify-personalized-ruling-classifier';
import type { PersonalizedRulingClassifier } from '../../src/noor-rag/personalizedRulingClassifier';

describe('Noor personalized-ruling direct-model evaluator', () => {
    it('ships a generic adversarial matrix with noisy, non-loan, lookalike, and multi-turn coverage', () => {
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.length >= 42);
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'canonical-loan'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'noisy-personal-loan'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'personalized-non-loan'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'nonreligious-lookalike'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'multiturn-personalized'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'lookalike-remote-work'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'negated-current'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'history-diabetes-prayer'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'history-third-person-referent'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'history-travel-prayer-constraint'));
        assert.ok(PERSONALIZED_RULING_EVALUATION_CASES.some(item => item.id === 'history-work-prayer-constraint'));
    });

    it('reports a confusion matrix and latency without returning raw prompts', async () => {
        const cases: readonly PersonalizedRulingEvaluationCase[] = [
            {
                id: 'general-one', group: 'general_information', expected: 'general_information',
                request: { mode: 'chat', requestId: '11111111-1111-4111-8111-111111111111', question: 'general', history: [] },
            },
            {
                id: 'personal-one', group: 'personalized_ruling', expected: 'personalized_ruling',
                request: { mode: 'chat', requestId: '22222222-2222-4222-8222-222222222222', question: 'personal', history: [] },
            },
            {
                id: 'lookalike-one', group: 'nonreligious_lookalike', expected: 'general_information',
                request: { mode: 'chat', requestId: '33333333-3333-4333-8333-333333333333', question: 'lookalike', history: [] },
            },
        ];
        const outputs = ['general_information', 'personalized_ruling', 'personalized_ruling'] as const;
        let outputIndex = 0;
        const classifier: PersonalizedRulingClassifier = {
            classify: async () => {
                const classification = outputs[outputIndex++]!;
                return classification === 'personalized_ruling'
                    ? {
                        kind: 'success', classification,
                        reasonCode: 'personal_circumstances_applied_to_religious_ruling',
                    }
                    : { kind: 'success', classification, reasonCode: 'general_religious_information' };
            },
        };
        let tick = 0;

        const summary = await evaluatePersonalizedRulingCases(classifier, cases, () => tick += 10);

        assert.deepEqual(summary, {
            classifierModel: 'gemini-3.5-flash-lite',
            totalCases: 3,
            generalInformationCorrect: 1,
            personalizedRulingCorrect: 1,
            nonReligiousLookalikesCorrect: 0,
            materialFailures: 1,
            classifierFailures: 0,
            medianLatencyMs: 10,
            p95LatencyMs: 10,
            failureCaseIds: ['lookalike-one'],
            failureDetails: [{ caseId: 'lookalike-one', observed: 'personalized_ruling' }],
        });
        assert.doesNotMatch(JSON.stringify(summary), /"general"|"personal"|"lookalike"/i);
    });
});
