import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMBEDDING_DIMENSION } from '../../src/noor-rag/embedding';
import {
    createFirestoreRetrievalRepository,
    retrieveExactVerse,
    retrieveSemantic,
    type RetrievalRepository,
    type SemanticSearchRequest,
    type StoredDocument,
} from '../../src/noor-rag/retrieval';
import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import type { NoorSource, TafsirChunk, TafsirUnit } from '../../src/noor-rag/types';

const VERSION = '2026-08-10-v1';
const SOURCE_ORDER: readonly NoorSource[] = ['ibn_kathir_en_abridged', 'al_sadi_ar'];

function config(overrides: Partial<NoorRuntimeConfig> = {}): NoorRuntimeConfig {
    return {
        enabled: true,
        publicEnabled: false,
        ownerUids: [],
        activeCorpusVersion: VERSION,
        promptVersion: 'v1',
        generationModel: 'gemini-2.5-flash',
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: EMBEDDING_DIMENSION,
        pseudonymKeyVersion: 'v1',
        sourceThresholds: { ibn_kathir_en_abridged: 0.6, al_sadi_ar: 0.7 },
        maxChunksPerSource: 4,
        maxEvidenceCharacters: 100,
        ...overrides,
    };
}

function unit(source: NoorSource, id = `u_${source}`, start = 2, end = 3): TafsirUnit {
    return {
        canonicalUnitId: id,
        source,
        sourceTitle: source === 'al_sadi_ar' ? "Tafsir Al-Sa'di" : 'Tafsir Ibn Kathir',
        language: source === 'al_sadi_ar' ? 'ar' : 'en',
        surah: 1,
        verseStart: start,
        verseEnd: end,
        originalText: 'unit text',
        retrievalText: 'unit text',
        corpusVersion: VERSION,
        contentHash: `hash-${id}`,
        resourceId: 1,
        upstreamReference: 'https://example.test/source',
        editionLabel: 'fixture',
        normalizationVersion: 'html-entities-nfc-whitespace-v1',
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: EMBEDDING_DIMENSION,
    };
}

function chunk(
    source: NoorSource,
    id: string,
    canonicalUnitId = `u_${source}_${id}`,
    text = id,
    start = 2,
    end = 3,
): TafsirChunk {
    return {
        chunkId: id,
        canonicalUnitId,
        chunkIndex: Number(id.replace(/\D/gu, '')) || 0,
        source,
        sourceTitle: source === 'al_sadi_ar' ? "Tafsir Al-Sa'di" : 'Tafsir Ibn Kathir',
        language: source === 'al_sadi_ar' ? 'ar' : 'en',
        surah: 1,
        verseStart: start,
        verseEnd: end,
        originalStart: 0,
        originalEnd: text.length,
        originalText: text,
        retrievalText: text,
        corpusVersion: VERSION,
        contentHash: `hash-${id}`,
        tokenCount: 1,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: EMBEDDING_DIMENSION,
        embedding: Array<number>(EMBEDDING_DIMENSION).fill(0.1),
    };
}

function doc(id: string, data: unknown): StoredDocument {
    return { id, data };
}

class FakeRepository implements RetrievalRepository {
    readonly reads: string[] = [];
    readonly searches: SemanticSearchRequest[] = [];

    constructor(
        private readonly documents: Readonly<Record<string, StoredDocument>> = {},
        private readonly searchResults: Readonly<Partial<Record<NoorSource, readonly {
            chunk: TafsirChunk;
            distance: number;
        }[]>>> = {},
    ) {}

    async readDocument(path: string): Promise<StoredDocument | null> {
        this.reads.push(path);
        return this.documents[path] ?? null;
    }

    async readDocuments(paths: readonly string[]): Promise<readonly StoredDocument[]> {
        this.reads.push(...paths);
        return paths.flatMap(path => this.documents[path] ? [this.documents[path]!] : []).reverse();
    }

    async searchChunks(request: SemanticSearchRequest): Promise<readonly { chunk: TafsirChunk; distance: number }[]> {
        this.searches.push(request);
        return this.searchResults[request.source] ?? [];
    }
}

function exactRepository(options: {
    source?: NoorSource;
    chunkIds?: string[];
    chunks?: TafsirChunk[];
    lookup?: Readonly<Record<string, unknown>>;
    storedUnit?: TafsirUnit;
} = {}): FakeRepository {
    const source = options.source ?? 'al_sadi_ar';
    const storedUnit = options.storedUnit ?? unit(source, `u_${source}`);
    const chunks = options.chunks ?? [
        chunk(source, 'c1', storedUnit.canonicalUnitId, '111'),
        chunk(source, 'c2', storedUnit.canonicalUnitId, '2222'),
    ];
    const chunkIds = options.chunkIds ?? chunks.map(value => value.chunkId);
    const lookupId = `${source}_1_2`;
    const lookup = options.lookup ?? {
        lookupId,
        source,
        surah: 1,
        verse: 2,
        canonicalUnitId: storedUnit.canonicalUnitId,
        chunkIds,
        corpusVersion: VERSION,
    };
    return new FakeRepository(Object.fromEntries([
        [`corpora/${VERSION}/verseLookup/${lookupId}`, doc(lookupId, lookup)],
        [`corpora/${VERSION}/units/${storedUnit.canonicalUnitId}`, doc(storedUnit.canonicalUnitId, storedUnit)],
        ...chunks.map(value => [
            `corpora/${VERSION}/chunks/${value.chunkId}`,
            doc(value.chunkId, value),
        ] as const),
    ]));
}

describe('Noor exact verse retrieval', () => {
    it('uses the exact lookup path, restores lookup order, preserves a shared range, and never embeds or searches', async () => {
        const repository = exactRepository({ chunkIds: ['c2', 'c1', 'c2'] });
        const result = await retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2, config: config(), repository,
        });

        assert.deepEqual(repository.reads, [
            `corpora/${VERSION}/verseLookup/al_sadi_ar_1_2`,
            `corpora/${VERSION}/units/u_al_sadi_ar`,
            `corpora/${VERSION}/chunks/c2`,
            `corpora/${VERSION}/chunks/c1`,
        ]);
        assert.deepEqual(result.map(value => ({
            id: value.promptSourceId,
            kind: value.kind,
            chunkId: value.chunk.chunkId,
            range: [value.chunk.verseStart, value.chunk.verseEnd],
            hasSimilarity: 'similarity' in value,
        })), [
            { id: 'S1', kind: 'exact', chunkId: 'c2', range: [2, 3], hasSimilarity: false },
            { id: 'S2', kind: 'exact', chunkId: 'c1', range: [2, 3], hasSimilarity: false },
        ]);
        assert.deepEqual(repository.searches, []);
    });

    it('returns only a stable whole-chunk prefix, including equality and stopping at the first overflow', async () => {
        const repository = exactRepository();
        const equal = await retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2,
            config: config({ maxEvidenceCharacters: 7 }), repository,
        });
        assert.deepEqual(equal.map(value => value.chunk.chunkId), ['c1', 'c2']);

        const overflow = await retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2,
            config: config({ maxEvidenceCharacters: 3 }), repository,
        });
        assert.deepEqual(overflow.map(value => value.chunk.chunkId), ['c1']);

        const firstDoesNotFit = exactRepository({
            chunkIds: ['c2', 'c1'],
            chunks: [
                chunk('al_sadi_ar', 'c1', 'u_al_sadi_ar', '1'),
                chunk('al_sadi_ar', 'c2', 'u_al_sadi_ar', '2222'),
            ],
        });
        const stopped = await retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2,
            config: config({ maxEvidenceCharacters: 3 }), repository: firstDoesNotFit,
        });
        assert.deepEqual(stopped, []);
    });

    it('fails closed for missing or inconsistent lookup, unit, and chunk documents', async () => {
        const missing = new FakeRepository();
        await assert.rejects(() => retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2, config: config(), repository: missing,
        }), /lookup/i);

        const wrongLookup = exactRepository({ lookup: {
            lookupId: 'al_sadi_ar_1_2', source: 'ibn_kathir_en_abridged', surah: 1, verse: 2,
            canonicalUnitId: 'u_al_sadi_ar', chunkIds: ['c1'], corpusVersion: VERSION,
        } });
        await assert.rejects(() => retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2, config: config(), repository: wrongLookup,
        }), /lookup/i);

        const missingChunk = exactRepository({ chunkIds: ['c1', 'missing'] });
        await assert.rejects(() => retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2, config: config(), repository: missingChunk,
        }), /chunk/i);

        const wrongRange = exactRepository({ chunks: [
            chunk('al_sadi_ar', 'c1', 'u_al_sadi_ar', 'bad', 2, 2),
        ] });
        await assert.rejects(() => retrieveExactVerse({
            source: 'al_sadi_ar', surah: 1, verse: 2, config: config(), repository: wrongRange,
        }), /chunk/i);
    });
});

describe('Noor semantic retrieval', () => {
    const vector = Array<number>(EMBEDDING_DIMENSION).fill(0.25);

    it('formats and embeds once, then starts exactly two fixed-source searches concurrently with the locked contract', async () => {
        const calls: string[] = [];
        const pending: Array<() => void> = [];
        const repository: RetrievalRepository = {
            readDocument: async () => null,
            readDocuments: async () => [],
            searchChunks: async request => {
                calls.push(request.source);
                await new Promise<void>(resolve => pending.push(resolve));
                return [];
            },
        };
        const embedded: string[] = [];
        const resultPromise = retrieveSemantic({
            content: 'What is patience?',
            config: config(),
            embedder: { embed: async text => { embedded.push(text); return vector; } },
            repository,
        });
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.deepEqual(calls, SOURCE_ORDER);
        pending.forEach(resolve => resolve());
        assert.deepEqual(await resultPromise, []);
        assert.deepEqual(embedded, ['task: question answering | query: What is patience?']);
        const requests = (repository as RetrievalRepository & { searches?: SemanticSearchRequest[] }).searches;
        assert.equal(requests, undefined);
    });

    it('validates the 768 finite embedding once before any search', async () => {
        for (const invalid of [vector.slice(1), [...vector.slice(0, -1), Number.NaN]]) {
            const repository = new FakeRepository();
            let embedCalls = 0;
            await assert.rejects(() => retrieveSemantic({
                content: 'question', config: config(), repository,
                embedder: { embed: async () => { embedCalls += 1; return invalid; } },
            }), /embedding/i);
            assert.equal(embedCalls, 1);
            assert.deepEqual(repository.searches, []);
        }
    });

    it('uses corpus/source filters, cosine distance, top 8, and converts distance to similarity at inclusive thresholds', async () => {
        const ibn = chunk('ibn_kathir_en_abridged', 'i1');
        const sadiBoundary = chunk('al_sadi_ar', 'a1');
        const below = chunk('al_sadi_ar', 'a2');
        const repository = new FakeRepository({}, {
            ibn_kathir_en_abridged: [{ chunk: ibn, distance: 0.1 }],
            al_sadi_ar: [
                { chunk: below, distance: 0.3000001 },
                { chunk: sadiBoundary, distance: 0.3 },
            ],
        });
        const result = await retrieveSemantic({ content: 'question', config: config(), repository, embedder: { embed: async () => vector } });

        assert.deepEqual(repository.searches.map(request => ({
            corpusVersion: request.corpusVersion,
            source: request.source,
            distanceMeasure: request.distanceMeasure,
            limit: request.limit,
            distanceResultField: request.distanceResultField,
        })), SOURCE_ORDER.map(source => ({
            corpusVersion: VERSION, source, distanceMeasure: 'COSINE', limit: 8,
            distanceResultField: '_noorVectorDistance',
        })));
        assert.deepEqual(result.map(value => [value.promptSourceId, value.chunk.chunkId, value.similarity]), [
            ['S1', 'i1', 0.9],
            ['S2', 'a1', 0.7],
        ]);
        assert.ok(result.every(value => value.kind === 'semantic' && Number.isFinite(value.similarity)));
    });

    it('sorts stably, dedupes chunks and canonical units, caps each source, and merges round-robin', async () => {
        const i1 = chunk('ibn_kathir_en_abridged', 'i1', 'iu1');
        const i2 = chunk('ibn_kathir_en_abridged', 'i2', 'iu2');
        const i3 = chunk('ibn_kathir_en_abridged', 'i3', 'iu3');
        const a1 = chunk('al_sadi_ar', 'a1', 'au1');
        const a2 = chunk('al_sadi_ar', 'a2', 'au2');
        const repository = new FakeRepository({}, {
            ibn_kathir_en_abridged: [
                { chunk: i3, distance: 0.1 },
                { chunk: i2, distance: 0.1 },
                { chunk: i1, distance: 0.1 },
                { chunk: { ...i1, chunkId: 'i1-duplicate-unit' }, distance: 0.05 },
                { chunk: i1, distance: 0.2 },
            ],
            al_sadi_ar: [{ chunk: a2, distance: 0.1 }, { chunk: a1, distance: 0.1 }],
        });
        const result = await retrieveSemantic({
            content: 'question', config: config({ maxChunksPerSource: 2 }), repository,
            embedder: { embed: async () => vector },
        });
        assert.deepEqual(result.map(value => value.chunk.chunkId), ['i1-duplicate-unit', 'a1', 'i2', 'a2']);
    });

    it('skips semantic chunks that do not fit the whole global budget and continues', async () => {
        const repository = new FakeRepository({}, {
            ibn_kathir_en_abridged: [
                { chunk: chunk('ibn_kathir_en_abridged', 'i1', 'iu1', '123456'), distance: 0.1 },
                { chunk: chunk('ibn_kathir_en_abridged', 'i2', 'iu2', '12'), distance: 0.2 },
            ],
            al_sadi_ar: [{ chunk: chunk('al_sadi_ar', 'a1', 'au1', '123'), distance: 0.1 }],
        });
        const result = await retrieveSemantic({
            content: 'question', config: config({ maxEvidenceCharacters: 5 }), repository,
            embedder: { embed: async () => vector },
        });
        assert.deepEqual(result.map(value => [value.promptSourceId, value.chunk.chunkId]), [['S1', 'a1'], ['S2', 'i2']]);
    });

    it('accepts one or both source searches being empty', async () => {
        const one = new FakeRepository({}, {
            al_sadi_ar: [{ chunk: chunk('al_sadi_ar', 'a1'), distance: 0.1 }],
        });
        assert.deepEqual((await retrieveSemantic({
            content: 'question', config: config(), repository: one, embedder: { embed: async () => vector },
        })).map(value => value.chunk.chunkId), ['a1']);
        assert.deepEqual(await retrieveSemantic({
            content: 'question', config: config(), repository: new FakeRepository(),
            embedder: { embed: async () => vector },
        }), []);
    });

    it('fails closed on invalid distances or candidate source/version metadata', async () => {
        const wrongSource = chunk('al_sadi_ar', 'a1');
        for (const hit of [
            { chunk: chunk('ibn_kathir_en_abridged', 'i1'), distance: 2.1 },
            { chunk: wrongSource, distance: 0.1 },
            { chunk: { ...chunk('ibn_kathir_en_abridged', 'i2'), corpusVersion: 'wrong' }, distance: 0.1 },
        ]) {
            const repository = new FakeRepository({}, { ibn_kathir_en_abridged: [hit] });
            await assert.rejects(() => retrieveSemantic({
                content: 'question', config: config(), repository, embedder: { embed: async () => vector },
            }), /result/i);
        }
    });
});

describe('Firestore retrieval adapter', () => {
    it('uses collection-group chunks, both equality filters, cosine top 8, and maps validated distance results', async () => {
        const events: Array<readonly unknown[]> = [];
        const resultChunk = chunk('al_sadi_ar', 'a1');
        const query = {
            where: (field: string, operator: string, value: unknown) => {
                events.push(['where', field, operator, value]);
                return query;
            },
            findNearest: (options: Readonly<Record<string, unknown>>) => {
                events.push(['findNearest', options]);
                return {
                    get: async () => ({ docs: [{ id: 'a1', data: () => ({ ...resultChunk, _noorVectorDistance: 0.25 }) }] }),
                };
            },
        };
        const firestore = {
            collectionGroup: (name: string) => { events.push(['collectionGroup', name]); return query; },
        };
        const repository = createFirestoreRetrievalRepository(firestore);
        const results = await repository.searchChunks({
            corpusVersion: VERSION,
            source: 'al_sadi_ar',
            queryVector: Array<number>(EMBEDDING_DIMENSION).fill(0.5),
            distanceMeasure: 'COSINE',
            limit: 8,
            distanceResultField: '_noorVectorDistance',
        });

        assert.deepEqual(events.slice(0, 3), [
            ['collectionGroup', 'chunks'],
            ['where', 'corpusVersion', '==', VERSION],
            ['where', 'source', '==', 'al_sadi_ar'],
        ]);
        const nearest = events[3]?.[1] as Readonly<Record<string, unknown>>;
        assert.equal(nearest.vectorField, 'embedding');
        assert.equal(nearest.distanceMeasure, 'COSINE');
        assert.equal(nearest.limit, 8);
        assert.equal(nearest.distanceResultField, '_noorVectorDistance');
        assert.deepEqual(results.map(value => [value.chunk.chunkId, value.distance]), [['a1', 0.25]]);
    });
});
