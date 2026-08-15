import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildChatQueryPlan, parseValidatedConversationState, type ValidatedConversationState } from '../../src/noor-rag/queryRewrite';
import type { NoorChatRequest } from '../../src/noor-rag/types';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function request(question: string, history: NoorChatRequest['history'] = []): NoorChatRequest {
    return { mode: 'chat', requestId: REQUEST_ID, question, history };
}

const VALIDATED_STATE: ValidatedConversationState = {
    subjectTokens: ['riba'],
    evidenceIds: ['chunk-1'],
    evidenceCount: 1,
    expiresAt: '2099-01-01T00:00:00.000Z',
};

describe('Noor generic query rewriting', () => {
    it('requires clarification for a structural follow-up without validated prior subject and evidence', () => {
        const plan = buildChatQueryPlan({
            request: request('What is the Islamic alternative?', [{ role: 'user', content: 'Is riba haram?' }]),
        });

        assert.equal(plan.requiresClarification, true);
        assert.equal(plan.contextSelected, false);
        assert.deepEqual(plan.variants, []);
    });

    it('preserves ordinary direct questions without context state', () => {
        const plan = buildChatQueryPlan({ request: request('What is zakat?') });

        assert.equal(plan.requiresClarification, false);
        assert.deepEqual(plan.variants, [{ kind: 'original', query: 'What is zakat?' }]);
    });

    it('preserves direct how and why questions without context state', () => {
        for (const question of ['How does mercy appear in the Quran?', 'Why is riba haram?']) {
            const plan = buildChatQueryPlan({ request: request(question) });
            assert.equal(plan.requiresClarification, false);
            assert.deepEqual(plan.variants, [{ kind: 'original', query: question }]);
        }
    });

    it('uses both literal and context-enriched variants only with validated matching state', () => {
        const plan = buildChatQueryPlan({
            request: request('What is the Islamic alternative?', [
                { role: 'user', content: 'Is riba haram?' },
                { role: 'assistant', content: 'Provider answer text and secret-error details' },
            ]),
            validatedConversationState: VALIDATED_STATE,
        });

        assert.equal(plan.requiresClarification, false);
        assert.equal(plan.contextSelected, true);
        assert.deepEqual(plan.variants.map(value => value.kind), ['original', 'context_enriched']);
        assert.match(plan.variants[1]!.query, /riba/i);
        assert.doesNotMatch(plan.variants[1]!.query, /Provider answer|secret-error/i);
    });

    it('rejects expired persisted conversation state', () => {
        assert.equal(parseValidatedConversationState({
            subjectTokens: ['riba'], evidenceIds: ['chunk-1'], evidenceCount: 1,
            expiresAt: '2000-01-01T00:00:00.000Z',
        }), null);
    });
});
