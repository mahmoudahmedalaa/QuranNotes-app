import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
    LOCKED_CORPUS_VERSION,
    LOCKED_PROJECT,
    activateCorpus,
    inspectActivationProvenance,
    parseActivationArguments,
    parseActivationPreflightArguments,
    parseExpectedManifestArtifacts,
    preflightActivation,
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
    it('rejects a contradictory approval after validating the full provenance record', () => {
        const provenance = JSON.parse(readFileSync(resolve(
            __dirname, '../../../..', 'docs/noor-rag/corpus-provenance.json',
        ), 'utf8')) as Record<string, unknown>;
        const result = inspectActivationProvenance({
            ...provenance,
            publicActivationApproved: true,
        }, '2026-08-12');

        assert.equal(result.publicActivationApproved, false);
        assert.ok(result.blockers.includes('provenance_record_invalid'));
        assert.ok(result.blockers.includes('commercial_redistribution_license_not_proven'));
    });

    it('rejects malformed or count-mismatched local chunk artifacts', () => {
        assert.throws(() => parseExpectedManifestArtifacts({}, [], LOCKED_CORPUS_VERSION), /local corpus/i);
        assert.throws(() => parseExpectedManifestArtifacts({ ...EXPECTED, chunkCount: 1 }, [{}], LOCKED_CORPUS_VERSION), /local corpus/i);
        assert.throws(() => parseExpectedManifestArtifacts(
            { ...EXPECTED, chunkCount: 2 }, [{ originalText: 'one' }], LOCKED_CORPUS_VERSION,
        ), /local corpus/i);
    });

    it('parses an explicit zero-write preflight and rejects production execution', () => {
        const args = [
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
            '--expected-current=none', '--preflight',
        ];
        assert.equal(parseActivationPreflightArguments(args).execute, false);
        assert.throws(() => parseActivationPreflightArguments([
            ...args, '--execute-production-write',
        ]), /zero-write/i);
    });

    it('reports every readiness blocker without activating', async () => {
        const repository = new FakeRepository(null, MANIFEST);
        const result = await preflightActivation({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
            repository,
            expectedManifest: EXPECTED,
            publicActivationApproved: false,
            provenanceBlockers: ['commercial_redistribution_license_not_proven', 'upstream_corpus_has_known_coverage_gaps'],
            probeIndex: async () => true,
        });

        assert.deepEqual(result, {
            ready: false,
            exitCode: 1,
            blockers: [
                'provenance:commercial_redistribution_license_not_proven',
                'provenance:upstream_corpus_has_known_coverage_gaps',
                'runtime_config_missing_or_invalid',
            ],
        });
        assert.deepEqual(repository.activations, []);
    });

    it('aggregates a missing local artifact with independent readiness blockers', async () => {
        const repository = new FakeRepository(null, MANIFEST);
        const result = await preflightActivation({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
            repository,
            expectedManifest: null,
            publicActivationApproved: false,
            provenanceBlockers: ['commercial_redistribution_license_not_proven'],
            probeIndex: async source => source === 'ibn_kathir_en_abridged',
        });

        assert.deepEqual(result.blockers, [
            'provenance:commercial_redistribution_license_not_proven',
            'locked_local_corpus_manifest_invalid',
            'runtime_config_missing_or_invalid',
            'vector_index_not_ready:al_sadi_ar',
        ]);
        assert.deepEqual(repository.activations, []);
    });

    it('recognizes a fully ready state without writing', async () => {
        const repository = new FakeRepository();
        const result = await preflightActivation({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
            repository,
            expectedManifest: EXPECTED,
            publicActivationApproved: true,
            provenanceBlockers: [],
            probeIndex: async () => true,
        });

        assert.deepEqual(result, { ready: true, exitCode: 0, blockers: [] });
        assert.deepEqual(repository.activations, []);
    });

    it('reports unsafe runtime, manifest, budget, and index state together', async () => {
        const repository = new FakeRepository(
            { ...CONFIG, enabled: true, maxEvidenceCharacters: 1000 },
            { ...MANIFEST, failedWrites: ['write_failed'] },
        );
        const result = await preflightActivation({
            options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent: 'none', execute: false },
            repository,
            expectedManifest: EXPECTED,
            publicActivationApproved: true,
            provenanceBlockers: [],
            probeIndex: async source => source === 'ibn_kathir_en_abridged',
        });

        assert.deepEqual(result.blockers, [
            'runtime_config_not_disabled_private_owner_empty_or_expected_current',
            'production_ingestion_manifest_incomplete_or_mismatched',
            'runtime_evidence_budget_smaller_than_largest_chunk',
            'vector_index_not_ready:al_sadi_ar',
        ]);
        assert.deepEqual(repository.activations, []);
    });

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

    it('requires an explicit operator risk flag to activate unresolved provenance', async () => {
        const options = parseActivationArguments([
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--expected-current=none',
            '--execute-production-write', '--operator-accepted-provenance-risk',
        ]);
        assert.equal(options.acceptUnverifiedProvenance, true);
        const repository = new FakeRepository();
        await activateCorpus({
            options, repository, expectedManifest: EXPECTED, publicActivationApproved: false,
            probeIndex: async () => true,
        });
        assert.deepEqual(repository.activations, [LOCKED_CORPUS_VERSION]);
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
