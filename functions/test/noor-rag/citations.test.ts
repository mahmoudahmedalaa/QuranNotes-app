import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseAndValidateGeneratedAnswer, validateGeneratedAnswer } from '../../src/noor-rag/citations';
import type { RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

function evidence(promptSourceId: string, overrides: Partial<TafsirChunk> = {}): RetrievedEvidence {
    return {
        kind: 'exact', promptSourceId,
        chunk: {
            chunkId: `chunk-${promptSourceId}`, canonicalUnitId: `unit-${promptSourceId}`, chunkIndex: 0,
            source: 'al_sadi_ar', sourceTitle: "Tafsir Al-Sa'di", language: 'ar', surah: 2,
            verseStart: 153, verseEnd: 153, originalStart: 0, originalEnd: 12,
            originalText: 'Arabic source', retrievalText: 'Arabic source', corpusVersion: 'v1',
            contentHash: 'hash', tokenCount: 3, embeddingModel: 'gemini-embedding-2', embeddingDimension: 768,
            ...overrides,
        },
    };
}

const EVIDENCE = [
    evidence('S1'),
    evidence('S2', { source: 'ibn_kathir_en_abridged', sourceTitle: 'Tafsir Ibn Kathir', language: 'en' }),
];

describe('Noor generated citation validation', () => {
    it('accepts valid single and multi-source answers and maps only cited metadata', () => {
        const single = validateGeneratedAnswer({ answer: 'Al-Sa\'di explains this meaning in English paraphrase. [S1]', citationIds: ['S1'] }, EVIDENCE);
        assert.deepEqual(single.citations, [{
            chunkId: 'chunk-S1', canonicalUnitId: 'unit-S1', source: 'al_sadi_ar',
            sourceTitle: "Tafsir Al-Sa'di", surah: 2, verseStart: 153, verseEnd: 153, corpusVersion: 'v1',
        }]);
        const multi = validateGeneratedAnswer({
            answer: 'The first explanation emphasizes steadfastness. [S1]\n\nThe second adds context. [S2]',
            citationIds: ['S1', 'S2'],
        }, EVIDENCE);
        assert.equal(multi.citations.length, 2);
    });

    it('accepts structured citation ids when the client renders citation metadata separately', () => {
        const result = validateGeneratedAnswer({
            answer: 'Al-Sa\'di explains this meaning in an English paraphrase.',
            citationIds: ['S1'],
        }, EVIDENCE);

        assert.equal(result.answer, 'Al-Sa\'di explains this meaning in an English paraphrase.');
        assert.deepEqual(result.citationIds, ['S1']);
        assert.equal(result.citations[0]?.chunkId, 'chunk-S1');
    });

    it('rejects malformed JSON and extra top-level keys', () => {
        assert.throws(() => parseAndValidateGeneratedAnswer('{bad', EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S1]', citationIds: ['S1'], details: 'provider body' }, EVIDENCE), /invalid generated answer/i);
    });

    it('rejects unknown, unused, duplicate, and uncited citations', () => {
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S9]', citationIds: ['S9'] }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S0]', citationIds: ['S0'] }, [evidence('S0')]), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S1]', citationIds: ['S1', 'S2'] }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S1]', citationIds: ['S1', 'S1'] }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Supported. [S1]\n\nSubstantive uncited claim.', citationIds: ['S1'] }, EVIDENCE), /invalid generated answer/i);
    });
});
