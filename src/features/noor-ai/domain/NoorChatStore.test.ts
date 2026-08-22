import { appendNoorResponseOnce, createNoorMessage } from './NoorChatStore';

describe('Noor recovered answer merge', () => {
    it('does not create a duplicate assistant answer for the same request ID', () => {
        const response = {
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            answer: 'A grounded answer. [S1]',
            status: 'answered' as const,
            citations: [{
                chunkId: 'chunk-1', canonicalUnitId: 'unit-1', source: 'al_sadi_ar' as const,
                sourceTitle: "Tafsir Al-Sa'di", surah: 2, verseStart: 275, verseEnd: 275,
                corpusVersion: '2026-08-10-v1',
            }],
        };
        const message = createNoorMessage(response);
        const existing = [message];

        expect(appendNoorResponseOnce(existing, createNoorMessage(response))).toBe(existing);
    });
});
