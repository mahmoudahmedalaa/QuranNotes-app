import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    createVertexPersonalizedRulingClassifier,
    type PersonalizedRulingClassifierRequest,
    type VertexPersonalizedRulingClassifierClient,
    type VertexPersonalizedRulingClassifierRequest,
} from '../../src/noor-rag/personalizedRulingClassifier';

const CHAT_REQUEST: PersonalizedRulingClassifierRequest = {
    mode: 'chat',
    requestId: '123e4567-e89b-42d3-a456-426614174000',
    question: 'Is this loan halal for my personal financial situation?',
    history: [],
};

class RecordingClient implements VertexPersonalizedRulingClassifierClient {
    readonly requests: VertexPersonalizedRulingClassifierRequest[] = [];

    constructor(private readonly result: string | Error) {}

    readonly models = {
        generateContent: async (request: VertexPersonalizedRulingClassifierRequest): Promise<{ text?: string }> => {
            this.requests.push(request);
            if (this.result instanceof Error) throw this.result;
            return { text: this.result };
        },
    };
}

describe('Noor personalized-ruling semantic classifier', () => {
    it('uses the existing lightweight model with one deterministic strict-schema call and no tools', async () => {
        const client = new RecordingClient(JSON.stringify({
            classification: 'personalized_ruling',
            reason_code: 'personal_circumstances_applied_to_religious_ruling',
        }));
        const classifier = createVertexPersonalizedRulingClassifier(client);

        const outcome = await classifier.classify(CHAT_REQUEST);

        assert.deepEqual(outcome, {
            kind: 'success',
            classification: 'personalized_ruling',
            reasonCode: 'personal_circumstances_applied_to_religious_ruling',
        });
        assert.equal(client.requests.length, 1);
        const sent = client.requests[0];
        assert.equal(sent?.model, 'gemini-3.5-flash-lite');
        assert.deepEqual(sent?.config, {
            responseMimeType: 'application/json',
            responseJsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['classification', 'reason_code'],
                properties: {
                    classification: { type: 'string', enum: ['general_information', 'personalized_ruling'] },
                    reason_code: {
                        type: 'string',
                        enum: [
                            'general_religious_information',
                            'personal_context_without_ruling_request',
                            'non_religious_request',
                            'personal_circumstances_applied_to_religious_ruling',
                        ],
                    },
                },
            },
            maxOutputTokens: 64,
            temperature: 0,
            seed: 0,
            thinkingConfig: { thinkingBudget: 0 },
            httpOptions: { timeout: 8_000, retryOptions: { attempts: 1 } },
        });
        assert.ok(!Object.prototype.hasOwnProperty.call(sent?.config ?? {}, 'tools'));
        assert.match(sent?.contents ?? '', /classify intent only/i);
        assert.match(sent?.contents ?? '', /must not answer/i);
        assert.match(sent?.contents ?? '', /do not infer a personal circumstance/i);
        assert.match(sent?.contents ?? '', /Can I do X\?.*general_information/i);
        assert.match(sent?.contents ?? '', /do not infer an unstated ruling or advice request/i);
    });

    it('provides only the last two bounded user turns as untrusted context', async () => {
        const client = new RecordingClient(JSON.stringify({
            classification: 'personalized_ruling',
            reason_code: 'personal_circumstances_applied_to_religious_ruling',
        }));
        const classifier = createVertexPersonalizedRulingClassifier(client);
        await classifier.classify({
            ...CHAT_REQUEST,
            question: 'So do I personally have to fast?',
            history: [
                { role: 'user', content: 'oldest-user-turn-should-not-appear' },
                { role: 'assistant', content: 'assistant-secret-should-not-appear' },
                { role: 'user', content: 'I have a medical condition.' },
                { role: 'assistant', content: 'How can I help?' },
                { role: 'user', content: 'I am also travelling.' },
            ],
        });

        const prompt = client.requests[0]?.contents ?? '';
        assert.doesNotMatch(prompt, /oldest-user-turn-should-not-appear/);
        assert.doesNotMatch(prompt, /assistant-secret-should-not-appear/);
        assert.match(prompt, /I have a medical condition/);
        assert.match(prompt, /I am also travelling/);
        assert.match(prompt, /So do I personally have to fast/);
    });

    it('accepts every bounded classification and reason-code combination produced by the schema', async () => {
        const outputs = [
            ['general_information', 'general_religious_information'],
            ['general_information', 'personal_context_without_ruling_request'],
            ['general_information', 'non_religious_request'],
            ['personalized_ruling', 'personal_circumstances_applied_to_religious_ruling'],
        ] as const;
        for (const [classification, reason_code] of outputs) {
            const classifier = createVertexPersonalizedRulingClassifier(new RecordingClient(JSON.stringify({
                classification, reason_code,
            })));
            assert.equal((await classifier.classify(CHAT_REQUEST)).kind, 'success');
        }
    });

    it('maps malformed text, schema-invalid output, provider failure, and timeout to bounded failures', async () => {
        const cases: Array<readonly [string | Error, string]> = [
            ['not-json', 'malformed_output'],
            [JSON.stringify({ classification: 'uncertain', reason_code: 'free text' }), 'schema_validation_failure'],
            [Object.assign(new Error('provider secret'), { status: 500 }), 'provider_failure'],
            [Object.assign(new Error('deadline secret'), { code: 'DEADLINE_EXCEEDED' }), 'timeout'],
            [Object.assign(new Error('abort secret'), { name: 'AbortError' }), 'timeout'],
        ];
        for (const [result, failureType] of cases) {
            const outcome = await createVertexPersonalizedRulingClassifier(new RecordingClient(result)).classify(CHAT_REQUEST);
            assert.deepEqual(outcome, { kind: 'failure', failureType });
            assert.doesNotMatch(JSON.stringify(outcome), /secret|deadline/i);
        }
    });

    it('rejects extra keys and inconsistent classification/reason pairs', async () => {
        for (const value of [
            {
                classification: 'general_information',
                reason_code: 'general_religious_information',
                reasoning: 'hidden chain of thought',
            },
            {
                classification: 'personalized_ruling',
                reason_code: 'non_religious_request',
            },
        ]) {
            const outcome = await createVertexPersonalizedRulingClassifier(
                new RecordingClient(JSON.stringify(value)),
            ).classify(CHAT_REQUEST);
            assert.deepEqual(outcome, { kind: 'failure', failureType: 'schema_validation_failure' });
        }
    });
});
