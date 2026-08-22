import {
    createNoorAIService,
    createNoorChatRequest,
    isNoorResumeTransition,
    NoorRecoveryPendingError,
    recoverNoorRequest,
} from './NoorAIService';
import { NoorAnswer } from './generatedContract';

jest.mock('../../../core/firebase/config', () => ({ auth: { currentUser: null } }));
jest.mock('../../../core/firebase/AppCheckService', () => ({
    getQuranNotesAppCheckToken: jest.fn(async () => 'app-check-token'),
}));

describe('NoorAIService', () => {
    it('sends bounded history and preserves the typed answer', async () => {
        const answer: NoorAnswer = {
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            answer: 'Grounded answer',
            status: 'quota_exceeded',
            citations: [],
            nextResetAt: '2026-08-12T00:00:00.000Z',
        };
        const remote = { ask: jest.fn(async () => answer) };
        const service = createNoorAIService(remote, () => answer.requestId);
        const history = Array.from({ length: 8 }, (_, index) => ({
            id: String(index),
            role: index % 2 ? 'noor' as const : 'user' as const,
            content: `message ${index}`,
            timestamp: index,
        }));

        await expect(service.askNoor('Question', history)).resolves.toEqual(answer);
        expect(remote.ask).toHaveBeenCalledWith({
            mode: 'chat',
            requestId: answer.requestId,
            question: 'Question',
            history: [
                { role: 'user', content: 'message 2' },
                { role: 'assistant', content: 'message 3' },
                { role: 'user', content: 'message 4' },
                { role: 'assistant', content: 'message 5' },
                { role: 'user', content: 'message 6' },
                { role: 'assistant', content: 'message 7' },
            ],
        });
    });

    it('sends the selected verse reference when Noor is opened from a verse', async () => {
        const answer: NoorAnswer = {
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            answer: 'Grounded answer',
            status: 'answered',
            citations: [],
        };
        const remote = { ask: jest.fn(async () => answer) };
        const service = createNoorAIService(remote, () => answer.requestId);

        await service.askNoor(
            'What does this teach me?',
            [],
            {
                surahNumber: 2,
                surahName: 'Al-Baqarah',
                verseNumber: 255,
            },
        );

        expect(remote.ask).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'chat',
            verseContext: { surah: 2, verse: 255 },
        }));
    });

    it('reuses the same request ID while recovering a suspended request', async () => {
        const request = createNoorChatRequest(
            'What does the Quran say about riba?',
            [],
            '550e8400-e29b-41d4-a716-446655440000',
        );
        const temporarilyUnavailable: NoorAnswer = {
            requestId: request.requestId,
            answer: 'Noor is temporarily unavailable.',
            status: 'temporarily_unavailable',
            citations: [],
        };
        const answered: NoorAnswer = {
            requestId: request.requestId,
            answer: 'A grounded answer. [S1]',
            status: 'answered',
            citations: [{
                chunkId: 'chunk-1',
                canonicalUnitId: 'unit-1',
                source: 'al_sadi_ar',
                sourceTitle: "Tafsir Al-Sa'di",
                surah: 2,
                verseStart: 275,
                verseEnd: 275,
                corpusVersion: '2026-08-10-v1',
            }],
        };
        const remote = {
            ask: jest.fn()
                .mockResolvedValueOnce(temporarilyUnavailable)
                .mockResolvedValueOnce(answered),
        };
        const states: string[] = [];

        await expect(recoverNoorRequest(request, remote, {
            maxAttempts: 2,
            retryDelaysMs: [0],
            sleep: async () => undefined,
            expectedOwnerUid: 'owner-a',
            onStateChange: (state) => {
                states.push(state);
            },
        })).resolves.toEqual(answered);

        expect(remote.ask).toHaveBeenCalledTimes(2);
        expect(remote.ask.mock.calls.map(([value]) => value.requestId)).toEqual([
            request.requestId,
            request.requestId,
        ]);
        expect(remote.ask.mock.calls.map(([, ownerUid]) => ownerUid)).toEqual(['owner-a', 'owner-a']);
        expect(states).toEqual(['pending', 'recovering']);
    });

    it('recovers the same request after a transport interruption', async () => {
        const request = createNoorChatRequest(
            'How does the Quran describe patience?',
            [],
            '550e8400-e29b-41d4-a716-446655440000',
        );
        const answer: NoorAnswer = {
            requestId: request.requestId,
            answer: 'A grounded answer. [S1]',
            status: 'answered',
            citations: [{
                chunkId: 'chunk-1', canonicalUnitId: 'unit-1', source: 'al_sadi_ar',
                sourceTitle: "Tafsir Al-Sa'di", surah: 2, verseStart: 153, verseEnd: 153,
                corpusVersion: '2026-08-10-v1',
            }],
        };
        const remote = {
            ask: jest.fn()
                .mockRejectedValueOnce(new Error('client suspended'))
                .mockResolvedValueOnce(answer),
        };

        await expect(recoverNoorRequest(request, remote, {
            maxAttempts: 2,
            retryDelaysMs: [0],
            sleep: async () => undefined,
        })).resolves.toEqual(answer);
        expect(remote.ask.mock.calls[0]?.[0].requestId).toBe(request.requestId);
        expect(remote.ask.mock.calls[1]?.[0].requestId).toBe(request.requestId);
    });

    it.each(['quota_exceeded', 'insufficient_evidence', 'policy_refusal'] as const)(
        'keeps %s distinct without lifecycle retries',
        async status => {
            const request = createNoorChatRequest(
                'Question',
                [],
                '550e8400-e29b-41d4-a716-446655440000',
            );
            const response = {
                requestId: request.requestId,
                answer: 'Safe response',
                status,
                citations: [],
                ...(status === 'quota_exceeded' ? { nextResetAt: '2026-08-23T00:00:00.000Z' } : {}),
            } as NoorAnswer;
            const remote = { ask: jest.fn(async () => response) };

            await expect(recoverNoorRequest(request, remote, {
                maxAttempts: 3,
                retryDelaysMs: [0, 0],
                sleep: async () => undefined,
            })).resolves.toEqual(response);
            expect(remote.ask).toHaveBeenCalledTimes(1);
        },
    );

    it('retains recovery ownership when temporary failure retries are exhausted', async () => {
        const request = createNoorChatRequest(
            'Question',
            [],
            '550e8400-e29b-41d4-a716-446655440000',
        );
        const response: NoorAnswer = {
            requestId: request.requestId,
            answer: 'Noor is temporarily unavailable.',
            status: 'temporarily_unavailable',
            citations: [],
        };
        const remote = { ask: jest.fn(async () => response) };

        await expect(recoverNoorRequest(request, remote, {
            maxAttempts: 3,
            retryDelaysMs: [0, 0],
            sleep: async () => undefined,
        })).rejects.toBeInstanceOf(NoorRecoveryPendingError);
        expect(remote.ask).toHaveBeenCalledTimes(3);
    });

    it('reconciles only a pending request when the app returns to active', () => {
        expect(isNoorResumeTransition('background', 'active', true)).toBe(true);
        expect(isNoorResumeTransition('inactive', 'active', true)).toBe(true);
        expect(isNoorResumeTransition('active', 'active', true)).toBe(false);
        expect(isNoorResumeTransition('background', 'active', false)).toBe(false);
    });

    it('includes a recovered answer in the next conversational turn', () => {
        const nextRequest = createNoorChatRequest(
            'What is an Islamic alternative?',
            [{
                id: 'user-1', role: 'user', content: 'What does the Quran say about riba?', timestamp: 1,
            }, {
                id: 'noor-1', role: 'noor', content: 'Riba is prohibited. [S1]', timestamp: 2,
                requestId: '550e8400-e29b-41d4-a716-446655440000', status: 'answered',
            }],
            '550e8400-e29b-41d4-a716-446655440001',
        );

        expect(nextRequest.history).toEqual([
            { role: 'user', content: 'What does the Quran say about riba?' },
            { role: 'assistant', content: 'Riba is prohibited. [S1]' },
        ]);
    });
});
