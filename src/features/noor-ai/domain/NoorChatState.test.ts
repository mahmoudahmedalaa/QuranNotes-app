import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'node:fs';
import { createNoorMessage } from './NoorChatStore';
import { loadConversation, saveConversation } from './NoorConversationHistory';
import { getNoorStatusPresentation } from './NoorStatusPresentation';

describe('Noor chat response state', () => {
    beforeEach(() => (AsyncStorage.clear as jest.Mock)());

    it('persists citations, status, request ID, and reset time', async () => {
        const message = createNoorMessage({
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            answer: 'Daily allowance reached.',
            status: 'quota_exceeded',
            citations: [{
                chunkId: 'c1', canonicalUnitId: 'u1', source: 'al_sadi_ar', sourceTitle: "Tafsir Al-Sa'di",
                surah: 2, verseStart: 1, verseEnd: 5, corpusVersion: 'v1',
            }],
            nextResetAt: '2026-08-12T00:00:00.000Z',
        });
        const id = await saveConversation(null, [message]);
        expect((await loadConversation(id))?.messages[0]).toMatchObject({
            content: message.content,
            citations: message.citations,
            status: message.status,
            requestId: message.requestId,
            nextResetAt: message.nextResetAt,
        });
    });

    it.each([
        ['not_entitled', 'Noor AI is available with Pro access.'],
        ['policy_refusal', "I can't help with that request."],
        ['insufficient_evidence', "I couldn't find enough reliable tafsir evidence to answer that safely."],
        ['temporarily_unavailable', 'Noor is temporarily unavailable. Please try again.'],
        ['invalid_request', 'Please revise your question and try again.'],
    ] as const)('maps %s to calm fixed copy', (status, copy) => {
        expect(getNoorStatusPresentation({ status })).toMatchObject({ message: copy });
    });

    it('shows a validated UTC reset for quota status', () => {
        expect(getNoorStatusPresentation({
            status: 'quota_exceeded',
            nextResetAt: '2026-08-12T00:00:00.000Z',
        }).message).toContain('12 Aug 2026');
    });

    it('does not render raw status labels or request IDs in Noor bubbles', () => {
        const source = fs.readFileSync(require.resolve('../presentation/NoorChatBubble'), 'utf8');

        expect(source).not.toMatch(/getNoorSupportMetadata|supportMetadata/);
        expect(source).not.toMatch(/Status:|Request:|message\.status|message\.requestId/);
    });
});
