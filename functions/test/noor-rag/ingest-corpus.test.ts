import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMBEDDING_DIMENSION, type Embedder } from '../../src/noor-rag/embedding';
import {
    LOCKED_CORPUS_VERSION,
    LOCKED_PROJECT,
    ingestCorpus,
    parseIngestArguments,
    requireProductionVertexConfig,
    type IngestArtifacts,
    type IngestRepository,
    type RepositoryWrite,
} from '../../scripts/noor-rag/ingest-corpus';

function artifacts(tokenizerMode = 'vertex-validated-deterministic'): IngestArtifacts {
    return {
        units: [{
            canonicalUnitId: 'u_1', source: 'al_sadi_ar', sourceTitle: "Tafsir Al-Sa'di",
            language: 'ar', surah: 1, verseStart: 1, verseEnd: 1, originalText: 'raw unit',
            retrievalText: 'retrieval unit', corpusVersion: LOCKED_CORPUS_VERSION, contentHash: 'unit-hash',
            resourceId: 91, upstreamReference: 'https://example.test', editionLabel: 'fixture',
            normalizationVersion: 'html-entities-nfc-whitespace-v1',
        }],
        chunks: [0, 1, 2].map(index => ({
            chunkId: `c_${index}`, canonicalUnitId: 'u_1', chunkIndex: index, source: 'al_sadi_ar' as const,
            sourceTitle: "Tafsir Al-Sa'di", language: 'ar' as const, surah: 1, verseStart: 1, verseEnd: 1,
            originalStart: index, originalEnd: index + 1, originalText: `raw ${index}`,
            retrievalText: `retrieval ${index}`, corpusVersion: LOCKED_CORPUS_VERSION,
            contentHash: `hash-${index}`, tokenCount: 10 + index,
        })),
        lookups: [{ lookupId: 'al_sadi_ar_1_1', source: 'al_sadi_ar', surah: 1, verse: 1, canonicalUnitId: 'u_1', chunkIds: ['c_0', 'c_1', 'c_2'] }],
        manifest: {
            schemaVersion: 1, corpusVersion: LOCKED_CORPUS_VERSION,
            normalizationVersion: 'html-entities-nfc-whitespace-v1',
            chunkingVersion: 'raw-paragraph-sentence-900-1400-overlap-80-v1',
            tokenizerMode, tokenizerModel: 'gemini-3.5-flash-lite', targetTokens: 900,
            ...(tokenizerMode === 'vertex-validated-deterministic' ? { tokenValidation: {
                method: 'vertex-compute-tokens-final-chunks' as const,
                location: 'global',
                validatedChunkCount: 3,
            } } : {}),
            hardMaxTokens: 1400, overlapTokens: 80, sourceCounts: [], unitCount: 1,
            chunkCount: 3, lookupCount: 1, artifactSha256: { units: 'u', chunks: 'c', lookups: 'l' },
            aggregateSha256: 'aggregate',
        },
    };
}

class FakeRepository implements IngestRepository {
    readonly calls: string[] = [];
    readonly batches: RepositoryWrite[][] = [];
    constructor(private readonly existing: Readonly<Record<string, unknown>> = {}) {}
    async readChunkMetadata(path: string): Promise<Record<string, unknown> | null> {
        this.calls.push(`read:${path}`);
        return (this.existing[path] as Record<string, unknown> | undefined) ?? null;
    }
    async writeBatch(writes: readonly RepositoryWrite[]): Promise<void> {
        this.calls.push('batch');
        this.batches.push([...writes]);
    }
    async writeManifest(path: string, data: Readonly<Record<string, unknown>>): Promise<void> {
        this.calls.push(`manifest:${path}:${String(data.status)}`);
    }
}

const embedder: Embedder = {
    embed: async (): Promise<readonly number[]> => Array<number>(EMBEDDING_DIMENSION).fill(0.25),
};

describe('Noor corpus ingestion', () => {
    it('defaults to an offline dry-run and makes zero adapter calls', async () => {
        const repository = new FakeRepository();
        let embedCalls = 0;
        const result = await ingestCorpus({
            options: parseIngestArguments([]), artifacts: artifacts('local-deterministic'), repository,
            embedder: { embed: async () => { embedCalls += 1; return []; } }, report: () => undefined,
        });
        assert.equal(result.dryRun, true);
        assert.equal(embedCalls, 0);
        assert.deepEqual(repository.calls, []);
        assert.deepEqual(result.counts, { units: 1, chunks: 3, lookups: 1, documents: 6, embeddingTokens: 33 });
    });

    it('fails closed unless the mutation flag, project, and version are exact and explicit', () => {
        assert.throws(() => parseIngestArguments(['--execute-production-write']), /project/);
        assert.throws(() => parseIngestArguments([`--project=${LOCKED_PROJECT}`, '--execute-production-write']), /version/);
        assert.throws(() => parseIngestArguments(['--project=wrong', `--version=${LOCKED_CORPUS_VERSION}`, '--execute-production-write']), /project/);
        assert.equal(parseIngestArguments([`--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--execute-production-write']).execute, true);
    });

    it('skips only complete matching vectors and resumes deterministic versioned paths', async () => {
        const chunkPath = `corpora/${LOCKED_CORPUS_VERSION}/chunks/c_0`;
        const repository = new FakeRepository({
            [chunkPath]: {
                contentHash: 'hash-0', embeddingModel: 'gemini-embedding-2', embeddingDimension: 768,
                embeddingComplete: true,
                embeddingMetadata: { model: 'gemini-embedding-2', dimension: 768, complete: true },
            },
        });
        const embeddedTexts: string[] = [];
        const result = await ingestCorpus({
            options: parseIngestArguments([`--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--execute-production-write']),
            artifacts: artifacts(), repository,
            embedder: { embed: async (text) => { embeddedTexts.push(text); return embedder.embed(text); } }, report: () => undefined,
        });
        assert.equal(result.skipped, 1);
        assert.equal(result.resumed, 1);
        assert.deepEqual(embeddedTexts, [
            "title: Tafsir Al-Sa'di | text: retrieval 1",
            "title: Tafsir Al-Sa'di | text: retrieval 2",
        ]);
        const paths = repository.batches.flat().map(write => write.path);
        assert.deepEqual(paths, [
            `corpora/${LOCKED_CORPUS_VERSION}/units/u_1`,
            `corpora/${LOCKED_CORPUS_VERSION}/chunks/c_1`,
            `corpora/${LOCKED_CORPUS_VERSION}/chunks/c_2`,
            `corpora/${LOCKED_CORPUS_VERSION}/verseLookup/al_sadi_ar_1_1`,
        ]);
        assert.ok(paths.every(path => !path.includes('activeCorpusVersion') && !path.startsWith('noorConfig/')));
    });

    it('requires the exact global Vertex location before production adapter creation', () => {
        const options = parseIngestArguments([`--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--execute-production-write']);
        assert.deepEqual(requireProductionVertexConfig({
            GOOGLE_CLOUD_PROJECT: LOCKED_PROJECT,
            GOOGLE_CLOUD_LOCATION: 'global',
        }, options), { project: LOCKED_PROJECT, location: 'global' });
        assert.throws(() => requireProductionVertexConfig({
            GOOGLE_CLOUD_PROJECT: LOCKED_PROJECT,
            GOOGLE_CLOUD_LOCATION: 'us-central1',
        }, options), /global/);
        assert.throws(() => requireProductionVertexConfig({
            GOOGLE_CLOUD_PROJECT: LOCKED_PROJECT,
        }, options), /global/);
    });

    it('records failures as incomplete and returns nonzero semantics', async () => {
        const repository = new FakeRepository();
        const result = await ingestCorpus({
            options: parseIngestArguments([`--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--execute-production-write']),
            artifacts: artifacts(), repository,
            embedder: { embed: async (text: string) => {
                if (text.endsWith('1')) throw new Error('provider failed');
                return embedder.embed(text);
            } }, report: () => undefined,
        });
        assert.equal(result.complete, false);
        assert.deepEqual(result.failedChunks, ['c_1']);
        assert.equal(result.exitCode, 1);
        assert.ok(repository.calls.some(call => call === `manifest:corpusManifests/${LOCKED_CORPUS_VERSION}:incomplete`));
    });

    it('never exceeds 450 deterministic upserts in one repository batch', async () => {
        const many = artifacts();
        const template = many.units[0]!;
        many.units = Array.from({ length: 451 }, (_, index) => ({
            ...template,
            canonicalUnitId: `u_${String(index).padStart(3, '0')}`,
        }));
        many.chunks = [];
        many.lookups = [];
        many.manifest.unitCount = many.units.length;
        many.manifest.chunkCount = 0;
        many.manifest.lookupCount = 0;
        many.manifest.tokenValidation!.validatedChunkCount = 0;
        const repository = new FakeRepository();

        const result = await ingestCorpus({
            options: parseIngestArguments([`--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--execute-production-write']),
            artifacts: many, repository, embedder, report: () => undefined,
        });

        assert.equal(result.complete, true);
        assert.deepEqual(repository.batches.map(batch => batch.length), [450, 1]);
        assert.equal(repository.batches[0]![0]!.path, `corpora/${LOCKED_CORPUS_VERSION}/units/u_000`);
        assert.equal(repository.batches[1]![0]!.path, `corpora/${LOCKED_CORPUS_VERSION}/units/u_450`);
    });
});
