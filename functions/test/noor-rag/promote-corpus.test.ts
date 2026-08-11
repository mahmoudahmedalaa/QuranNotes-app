import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    buildCorpus,
    promoteCorpusWithExactTokenCounts,
    type TokenCounter,
} from '../../src/noor-rag/corpus';
import { assertProductionArtifact } from '../../scripts/noor-rag/ingest-corpus';

const localCounter: TokenCounter = {
    mode: 'local-deterministic',
    model: 'unicode-word-punctuation-v1',
    countTokens: async text => Array.from(text).length,
};

async function localArtifacts() {
    return buildCorpus({
        corpusVersion: '2026-08-10-v1',
        tokenCounter: localCounter,
        targetTokens: 16,
        hardMaxTokens: 20,
        overlapTokens: 4,
        sources: [{
            source: 'al_sadi_ar', sourceTitle: "Tafsir Al-Sa'di", language: 'ar',
            resourceId: 91, upstreamReference: 'https://example.test', editionLabel: 'fixture',
            files: [{ surah: 1, verses: { '1': { text: 'Alpha one. Beta two. Gamma three.' } } }],
        }],
    });
}

describe('Noor deterministic corpus production promotion', () => {
    it('changes only exact token metadata, fails closed, and unlocks production ingestion', async () => {
        const local = await localArtifacts();
        const boundariesAndText = local.chunks.map(chunk => ({
            chunkId: chunk.chunkId,
            originalStart: chunk.originalStart,
            originalEnd: chunk.originalEnd,
            originalText: chunk.originalText,
            retrievalText: chunk.retrievalText,
        }));
        const exactCounter: TokenCounter = {
            mode: 'vertex-production',
            model: 'gemini-3.5-flash-lite',
            countTokens: async text => Math.ceil(text.length / 3),
        };

        const promoted = await promoteCorpusWithExactTokenCounts(local, exactCounter, 'global');

        assert.deepEqual(promoted.units, local.units);
        assert.deepEqual(promoted.lookups, local.lookups);
        assert.deepEqual(promoted.chunks.map(chunk => ({
            chunkId: chunk.chunkId,
            originalStart: chunk.originalStart,
            originalEnd: chunk.originalEnd,
            originalText: chunk.originalText,
            retrievalText: chunk.retrievalText,
        })), boundariesAndText);
        assert.deepEqual(promoted.chunks.map(chunk => chunk.tokenCount),
            local.chunks.map(chunk => Math.ceil(chunk.originalText.length / 3)));
        assert.equal(promoted.manifest.tokenizerMode, 'vertex-validated-deterministic');
        assert.equal(promoted.manifest.tokenizerModel, 'gemini-3.5-flash-lite');
        assert.deepEqual(promoted.manifest.tokenValidation, {
            method: 'vertex-compute-tokens-final-chunks',
            location: 'global',
            validatedChunkCount: promoted.chunks.length,
        });
        assert.equal(promoted.manifest.artifactSha256.units, local.manifest.artifactSha256.units);
        assert.equal(promoted.manifest.artifactSha256.lookups, local.manifest.artifactSha256.lookups);
        assert.notEqual(promoted.manifest.artifactSha256.chunks, local.manifest.artifactSha256.chunks);
        assert.notEqual(promoted.manifest.aggregateSha256, local.manifest.aggregateSha256);
        assert.doesNotThrow(() => assertProductionArtifact(promoted.manifest));
        assert.throws(() => assertProductionArtifact(local.manifest), /validated deterministic corpus/);

        await assert.rejects(
            promoteCorpusWithExactTokenCounts(local, {
                ...exactCounter,
                countTokens: async () => local.manifest.hardMaxTokens + 1,
            }, 'global'),
            /hard maximum/,
        );
        await assert.rejects(
            promoteCorpusWithExactTokenCounts(local, {
                ...exactCounter,
                countTokens: async () => Number.NaN,
            }, 'global'),
            /invalid exact token count/,
        );
    });
});
