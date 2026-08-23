import type { NoorStatus } from './generatedContract';
import { visibleNoorCitations } from './NoorCitationPolicy';
import type { NoorMessage } from './types';

describe('Noor citation presentation policy', () => {
    const message = (status: NoorStatus): NoorMessage => ({
        id: 'message-1',
        role: 'noor',
        content: 'Safe response copy.',
        timestamp: 1,
        status,
        citations: [{
            chunkId: 'chunk-1', canonicalUnitId: 'unit-1', source: 'al_sadi_ar',
            sourceTitle: "Tafsir Al-Sa'di", surah: 2, verseStart: 1, verseEnd: 1,
            corpusVersion: 'corpus-v1',
        }],
    });

    it('exposes citations only for answered responses', () => {
        expect(visibleNoorCitations(message('answered'))).toHaveLength(1);
        for (const status of ['insufficient_evidence', 'policy_refusal', 'temporarily_unavailable'] as const) {
            expect(visibleNoorCitations(message(status))).toEqual([]);
        }
    });
});
