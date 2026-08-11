import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
    buildCorpus,
    canonicalUnitId,
    loadReviewedCorpusInputs,
    normalizeRetrievalText,
    validateCorpus,
    type TokenCounter,
} from '../../src/noor-rag/corpus';

const REPOSITORY_ROOT = resolve(__dirname, '../../../..');
const CORPUS_VERSION = '2026-08-10-v1';
const counter: TokenCounter = {
    mode: 'local-deterministic-test',
    model: 'test-codepoint-counter-v1',
    countTokens: async (text: string): Promise<number> => Array.from(text).length,
};

describe('Noor canonical corpus', () => {
    it('normalizes retrieval text without mutating the source representation', () => {
        const original = '  Arabic: \u0627\u0644\u0633\u064e\u0651\u0644\u0627\u0645&nbsp; &amp;  caf\u0065\u0301\r\n';

        assert.equal(normalizeRetrievalText(original), 'Arabic: \u0627\u0644\u0633\u064e\u0651\u0644\u0627\u0645 & caf\u00e9');
        assert.equal(original.endsWith('\r\n'), true);
    });

    it('uses the exact approved canonical unit ID input', () => {
        const contentHash = createHash('sha256').update('Exact bytes').digest('hex');
        const expected = createHash('sha256')
            .update([CORPUS_VERSION, 'al_sadi_ar', '2:9-10', contentHash].join('\0'))
            .digest('hex');

        assert.equal(canonicalUnitId(CORPUS_VERSION, 'al_sadi_ar', 2, 9, 10, contentHash), `u_${expected}`);
    });

    it('groups only contiguous explicit byte-identical records and keeps gaps split', async () => {
        const original = 'First sentence. Second sentence. Third sentence.';
        const result = await buildCorpus({
            corpusVersion: CORPUS_VERSION,
            tokenCounter: counter,
            targetTokens: 20,
            hardMaxTokens: 24,
            overlapTokens: 5,
            sources: [{
                source: 'al_sadi_ar',
                sourceTitle: "\u0627\u0644\u0633\u0639\u062f\u064a Al-Sa'di",
                language: 'ar',
                resourceId: 91,
                upstreamReference: 'https://example.test/source',
                editionLabel: 'fixture',
                files: [{
                    surah: 2,
                    verses: {
                        '1': { text: original },
                        '2': { text: original },
                        '3': { text: '   ' },
                        '4': { text: original },
                        '5': 'legacy text is not an explicit record',
                    },
                }],
            }],
        });

        assert.deepEqual(result.units.map(unit => [unit.verseStart, unit.verseEnd]), [[1, 2], [4, 4]]);
        assert.equal(result.lookups.length, 3);
        assert.ok(result.chunks.every(chunk => (
            chunk.originalText === result.units
                .find(unit => unit.canonicalUnitId === chunk.canonicalUnitId)!
                .originalText.slice(chunk.originalStart, chunk.originalEnd)
        )));
        assert.ok(result.chunks.every(chunk => chunk.tokenCount <= 24));
        assert.ok(result.chunks.every(chunk => chunk.chunkId === (
            `c_${chunk.canonicalUnitId.slice(2)}_${String(chunk.chunkIndex).padStart(3, '0')}_${chunk.contentHash.slice(0, 12)}`
        )));
    });

    it('matches the reviewed explicit coverage and reports current grouped counts', async () => {
        const { sources, coverage } = loadReviewedCorpusInputs(REPOSITORY_ROOT);
        const result = await buildCorpus({
            corpusVersion: CORPUS_VERSION,
            tokenCounter: counter,
            sources,
        });

        assert.deepEqual(result.manifest.sourceCounts, [
            { source: 'ibn_kathir_en_abridged', fileCount: 114, mappingCount: 6231, unitCount: 1895, missingVerseKeys: coverage.sources[0]!.missingVerseKeys },
            { source: 'al_sadi_ar', fileCount: 114, mappingCount: 6177, unitCount: 5972, missingVerseKeys: coverage.sources[1]!.missingVerseKeys },
        ]);
        assert.equal(result.units.length, 7867);
        assert.equal(result.lookups.length, 12408);
        assert.match(result.units.find(unit => unit.source === 'al_sadi_ar')!.retrievalText, /[\u0600-\u06ff]/);
        assert.deepEqual(await validateCorpus(result, coverage, counter), []);
    });

    it('validator detects changed IDs, offsets, coverage, and aggregate hash', async () => {
        const result = await buildCorpus({
            corpusVersion: CORPUS_VERSION,
            tokenCounter: counter,
            sources: [{
                source: 'ibn_kathir_en_abridged',
                sourceTitle: 'Ibn Kathir (Abridged)',
                language: 'en',
                resourceId: 169,
                upstreamReference: 'https://example.test/source',
                editionLabel: 'fixture',
                files: [{ surah: 1, verses: { '1': { text: 'One. Two. Three.' } } }],
            }],
        });
        result.chunks[0]!.originalEnd -= 1;
        result.manifest.aggregateSha256 = '0'.repeat(64);
        const coverage = {
            schemaVersion: 1 as const,
            retrievedAt: '2026-08-11',
            sources: [{
                source: 'ibn_kathir_en_abridged' as const,
                sourceTitle: 'Ibn Kathir (Abridged)',
                resourceId: 169,
                fileCount: 1,
                mappingCount: 1,
                missingVerseKeys: [],
            }],
        };

        const errors = await validateCorpus(result, coverage, counter);
        assert.ok(errors.some(error => /offset|slice/i.test(error)));
        assert.ok(errors.some(error => /aggregate/i.test(error)));
    });
});
