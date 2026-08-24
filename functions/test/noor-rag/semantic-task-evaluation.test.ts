import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    evaluateSemanticTaskPlanning,
    SEMANTIC_TASK_EVALUATION_CASES,
    type SemanticTaskEvaluationCase,
} from '../../scripts/noor-rag/verify-semantic-task-classifier';
import type { SemanticTaskClassifier } from '../../src/noor-rag/semanticTaskClassifier';

describe('Noor semantic task fallback evaluator', () => {
    it('ships synthesis, point, contextual, and multi-entity natural-language coverage', () => {
        assert.ok(SEMANTIC_TASK_EVALUATION_CASES.length >= 29);
        for (const group of ['synthesis', 'point', 'contextual', 'multi_entity'] as const) {
            assert.ok(SEMANTIC_TASK_EVALUATION_CASES.some(item => item.group === group), group);
        }
        assert.ok(SEMANTIC_TASK_EVALUATION_CASES.some(item => item.question === 'what surah maryam abt'));
        assert.ok(SEMANTIC_TASK_EVALUATION_CASES.some(item => item.question === 'tell me main thing in kahf'));
        assert.ok(SEMANTIC_TASK_EVALUATION_CASES.some(item => item.question === 'who is maryam'));
        assert.ok(SEMANTIC_TASK_EVALUATION_CASES.some(item => item.question === 'why tho'));
        assert.ok(SEMANTIC_TASK_EVALUATION_CASES.some(item => item.question === 'nuh vs musa whats different'));
    });

    it('reports deterministic and fallback rates, latency, and failures without raw prompts', async () => {
        const cases: readonly SemanticTaskEvaluationCase[] = [
            {
                id: 'deterministic-point', group: 'point', question: 'what does 2:275 say',
                expectedTaskType: 'point_question', expectedEntityIds: [],
            },
            {
                id: 'fallback-summary', group: 'synthesis', question: 'what surah maryam abt',
                expectedTaskType: 'entity_summary', expectedEntityIds: ['surah:19'],
            },
        ];
        const classifier: SemanticTaskClassifier = {
            classify: async () => ({ kind: 'success', taskType: 'entity_summary' }),
        };
        let tick = 0;

        const summary = await evaluateSemanticTaskPlanning(classifier, cases, () => tick += 10);

        assert.deepEqual(summary, {
            classifierModel: 'gemini-3.5-flash-lite',
            totalCases: 2,
            deterministicCases: 1,
            semanticFallbackCases: 1,
            deterministicPlannerRate: 0.5,
            semanticFallbackRate: 0.5,
            fallbackMedianLatencyMs: 10,
            fallbackP95LatencyMs: 10,
            materialFailures: 0,
            classifierFailures: 0,
            failureCaseIds: [],
            failureDetails: [],
        });
        assert.doesNotMatch(JSON.stringify(summary), /what surah|2:275/i);
    });
});
