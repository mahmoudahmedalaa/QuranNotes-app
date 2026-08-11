import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    LOCKED_CORPUS_VERSION,
    LOCKED_PROJECT,
    activateCorpus,
    parseActivationArguments,
    type ActivationRepository,
} from '../../scripts/noor-rag/activate-corpus';

const CONFIG = {
    enabled: false, publicEnabled: false, ownerUids: [], activeCorpusVersion: 'none',
    promptVersion: 'noor-prompt-v1', generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2', embeddingDimension: 768, pseudonymKeyVersion: 'hmac-v1',
    sourceThresholds: { ibn_kathir_en_abridged: 0.72, al_sadi_ar: 0.76 },
    maxChunksPerSource: 4, maxEvidenceCharacters: 24000,
};
const EXPECTED = {
    corpusVersion: LOCKED_CORPUS_VERSION, unitCount: 2, chunkCount: 3, lookupCount: 4,
    aggregateSha256: 'a'.repeat(64), largestChunkCharacters: 12000,
};
const MANIFEST = {
    ...EXPECTED, status: 'complete', complete: true,
    embeddingModel: 'gemini-embedding-2', embeddingDimension: 768,
    expected: { units: 2, chunks: 3, lookups: 4, aggregateSha256: 'a'.repeat(64) },
    failedChunks: [], failedWrites: [],
};

class FakeRepository implements ActivationRepository {
    readonly activations: string[] = [];
    constructor(readonly config: unknown = CONFIG, readonly manifest: unknown = MANIFEST) {}
    async readRuntimeConfig(): Promise<unknown> { return this.config; }
    async readManifest(): Promise<unknown> { return this.manifest; }
    async activate(_expectedCurrent: string, version: string): Promise<void> { this.activations.push(version); }
}

describe('Noor corpus activation', () => {
    it('requires exact project, version, and expected-current gates', () => {
        assert.throws(() => parseActivationArguments([]), /project/);
        assert.throws(() => parseActivationArguments([
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
        ]), /expected-current/);
        assert.throws(() => parseActivationArguments([
            '--project=wrong', `--version=${LOCKED_CORPUS_VERSION}`, '--expected-current=none',
        ]), /project/);
    });

    it('fails closed on the current provenance authority without probing or writing', async () => {
        const repository = new FakeRepository();
        let probes = 0;
        await assert.rejects(() => activateCorpus({
            options: parseActivationArguments([
                `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--expected-current=none',
            ]),
            repository,
            expectedManifest: EXPECTED,
            publicActivationApproved: false,
            probeIndex: async () => { probes += 1; return true; },
        }), /provenance.*not approved/i);
        assert.equal(probes, 0);
        assert.deepEqual(repository.activations, []);
    });

    it('rejects incomplete, failed, hash/count/model/dimension/budget mismatches and nonready sources', async () => {
        const mutations: unknown[] = [
            { ...MANIFEST, complete: false },
            { ...MANIFEST, failedChunks: ['c1'] },
            { ...MANIFEST, aggregateSha256: 'b'.repeat(64) },
            { ...MANIFEST, chunkCount: 2 },
            { ...MANIFEST, embeddingModel: 'wrong' },
            { ...MANIFEST, embeddingDimension: 3072 },
        ];
        for (const manifest of mutations) {
            await assert.rejects(() => activateCorpus({
                options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
                repository: new FakeRepository(CONFIG, manifest), expectedManifest: EXPECTED,
                publicActivationApproved: true, probeIndex: async () => true,
            }));
        }
        await assert.rejects(() => activateCorpus({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
            repository: new FakeRepository({ ...CONFIG, maxEvidenceCharacters: 1000 }), expectedManifest: EXPECTED,
            publicActivationApproved: true, probeIndex: async () => true,
        }), /evidence budget/i);
        await assert.rejects(() => activateCorpus({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
            repository: new FakeRepository(), expectedManifest: EXPECTED,
            publicActivationApproved: true, probeIndex: async source => source === 'ibn_kathir_en_abridged',
        }), /index/i);
    });

    it('checks both sources and defaults to a zero-write dry-run before explicit execution', async () => {
        const repository = new FakeRepository();
        const sources: string[] = [];
        const dryRun = await activateCorpus({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
            repository, expectedManifest: EXPECTED, publicActivationApproved: true,
            probeIndex: async source => { sources.push(source); return true; },
        });
        assert.equal(dryRun.dryRun, true);
        assert.deepEqual(sources, ['ibn_kathir_en_abridged', 'al_sadi_ar']);
        assert.deepEqual(repository.activations, []);

        await activateCorpus({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: true },
            repository, expectedManifest: EXPECTED, publicActivationApproved: true,
            probeIndex: async () => true,
        });
        assert.deepEqual(repository.activations, [LOCKED_CORPUS_VERSION]);
    });
});
