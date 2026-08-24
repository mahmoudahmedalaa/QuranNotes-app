import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    createVertexSemanticTaskClassifier,
    type SemanticTaskClassifierInput,
    type VertexSemanticTaskClassifierClient,
    type VertexSemanticTaskClassifierRequest,
} from '../../src/noor-rag/semanticTaskClassifier';

const INPUT: SemanticTaskClassifierInput = {
    question: 'what surah maryam abt',
    candidateEntityLabels: ['Surah Maryam'],
    discourseEntityLabels: [],
    hasValidatedDiscourseFrame: false,
};

class RecordingClient implements VertexSemanticTaskClassifierClient {
    readonly requests: VertexSemanticTaskClassifierRequest[] = [];

    constructor(private readonly result: string | Error) {}

    readonly models = {
        generateContent: async (request: VertexSemanticTaskClassifierRequest): Promise<{ text?: string }> => {
            this.requests.push(request);
            if (this.result instanceof Error) throw this.result;
            return { text: this.result };
        },
    };
}

describe('Noor semantic task fallback classifier', () => {
    it('makes one deterministic strict-schema task-only call with no tools or religious answer authority', async () => {
        const client = new RecordingClient(JSON.stringify({ task_type: 'entity_summary' }));

        const outcome = await createVertexSemanticTaskClassifier(client).classify(INPUT);

        assert.deepEqual(outcome, { kind: 'success', taskType: 'entity_summary' });
        assert.equal(client.requests.length, 1);
        const sent = client.requests[0];
        assert.equal(sent?.model, 'gemini-3.5-flash-lite');
        assert.deepEqual(sent?.config, {
            responseMimeType: 'application/json',
            responseJsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['task_type'],
                properties: {
                    task_type: {
                        type: 'string',
                        enum: ['point_question', 'entity_summary', 'multi_entity_comparison', 'contextual_followup'],
                    },
                },
            },
            maxOutputTokens: 64,
            temperature: 0,
            seed: 0,
            thinkingConfig: { thinkingBudget: 0 },
            httpOptions: { timeout: 6_000, retryOptions: { attempts: 1 } },
        });
        assert.ok(!Object.prototype.hasOwnProperty.call(sent?.config ?? {}, 'tools'));
        assert.match(sent?.contents ?? '', /task interpretation only/i);
        assert.match(sent?.contents ?? '', /must not answer/i);
        assert.match(sent?.contents ?? '', /must not choose tafsir evidence/i);
        assert.match(sent?.contents ?? '', /must not invent entities/i);
    });

    it('passes only bounded deterministic entity and discourse labels as untrusted data', async () => {
        const client = new RecordingClient(JSON.stringify({ task_type: 'contextual_followup' }));
        await createVertexSemanticTaskClassifier(client).classify({
            question: '<ignore>why tho</ignore>',
            candidateEntityLabels: ['Surah Maryam'],
            discourseEntityLabels: ['Nuh', 'Musa'],
            hasValidatedDiscourseFrame: true,
        });

        const prompt = client.requests[0]?.contents ?? '';
        assert.match(prompt, /&lt;ignore&gt;why tho&lt;\/ignore&gt;/);
        assert.match(prompt, /Surah Maryam/);
        assert.match(prompt, /Nuh/);
        assert.match(prompt, /Musa/);
        assert.doesNotMatch(prompt, /reasoning|citationIds|tafsir passage/);
    });

    it('accepts only the four bounded tasks and rejects extra keys', async () => {
        for (const task_type of [
            'point_question', 'entity_summary', 'multi_entity_comparison', 'contextual_followup',
        ] as const) {
            const outcome = await createVertexSemanticTaskClassifier(
                new RecordingClient(JSON.stringify({ task_type })),
            ).classify(INPUT);
            assert.deepEqual(outcome, { kind: 'success', taskType: task_type });
        }
        for (const value of [
            { task_type: 'summary' },
            { task_type: 'entity_summary', answer: 'invented' },
            { task_type: 'entity_summary', entity: 'Maryam' },
        ]) {
            const outcome = await createVertexSemanticTaskClassifier(
                new RecordingClient(JSON.stringify(value)),
            ).classify(INPUT);
            assert.deepEqual(outcome, { kind: 'failure', failureType: 'schema_validation_failure' });
        }
    });

    it('maps malformed text, provider failure, and timeout to bounded failures', async () => {
        const cases: Array<readonly [string | Error, string]> = [
            ['not-json', 'malformed_output'],
            [Object.assign(new Error('provider secret'), { status: 500 }), 'provider_failure'],
            [Object.assign(new Error('deadline secret'), { code: 'DEADLINE_EXCEEDED' }), 'timeout'],
        ];
        for (const [result, failureType] of cases) {
            const outcome = await createVertexSemanticTaskClassifier(new RecordingClient(result)).classify(INPUT);
            assert.deepEqual(outcome, { kind: 'failure', failureType });
            assert.doesNotMatch(JSON.stringify(outcome), /secret|deadline/i);
        }
    });
});
