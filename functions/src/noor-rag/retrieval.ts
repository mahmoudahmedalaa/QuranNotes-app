import { FieldValue } from 'firebase-admin/firestore';

import type { NoorRuntimeConfig } from './config';
import {
    EMBEDDING_DIMENSION,
    formatEmbeddingQuery,
    validateEmbedding,
    type Embedder,
} from './embedding';
import type {
    ExactRetrievedEvidence,
    NoorSource,
    SemanticRetrievedEvidence,
    TafsirChunk,
    TafsirUnit,
} from './types';

const SOURCE_ORDER: readonly NoorSource[] = ['ibn_kathir_en_abridged', 'al_sadi_ar'];
const VECTOR_SEARCH_LIMIT = 8 as const;
const DISTANCE_RESULT_FIELD = '_noorVectorDistance' as const;

export interface StoredDocument {
    id: string;
    data: unknown;
}

export interface SemanticSearchRequest {
    corpusVersion: string;
    source: NoorSource;
    queryVector: readonly number[];
    distanceMeasure: 'COSINE';
    limit: typeof VECTOR_SEARCH_LIMIT;
    distanceResultField: typeof DISTANCE_RESULT_FIELD;
}

export interface SemanticSearchHit {
    chunk: TafsirChunk;
    distance: number;
}

export interface RetrievalRepository {
    readDocument(path: string): Promise<StoredDocument | null>;
    readDocuments(paths: readonly string[]): Promise<readonly StoredDocument[]>;
    searchChunks(request: SemanticSearchRequest): Promise<readonly SemanticSearchHit[]>;
}

interface FirestoreSnapshotLike {
    readonly id: string;
    readonly exists?: boolean;
    data(): unknown;
}

interface FirestoreReferenceLike {
    get(): Promise<FirestoreSnapshotLike>;
}

interface FirestoreVectorQueryLike {
    get(): Promise<{ readonly docs: readonly FirestoreSnapshotLike[] }>;
}

interface FirestoreQueryLike {
    where(field: string, operator: '==', value: unknown): FirestoreQueryLike;
    findNearest(options: Readonly<Record<string, unknown>>): FirestoreVectorQueryLike;
}

interface FirestoreLike {
    doc(path: string): FirestoreReferenceLike;
    getAll(...references: readonly FirestoreReferenceLike[]): Promise<readonly FirestoreSnapshotLike[]>;
    collectionGroup(name: string): FirestoreQueryLike;
}

interface VerseLookup {
    lookupId: string;
    source: NoorSource;
    surah: number;
    verse: number;
    canonicalUnitId: string;
    chunkIds: string[];
    corpusVersion: string;
}

export interface ExactRetrievalInput {
    source: NoorSource;
    surah: number;
    verse: number;
    config: NoorRuntimeConfig;
    repository: RetrievalRepository;
}

export interface SemanticRetrievalInput {
    content: string;
    config: NoorRuntimeConfig;
    embedder: Embedder;
    repository: RetrievalRepository;
}

export interface SemanticRetrievalResult {
    evidence: readonly SemanticRetrievedEvidence[];
    vectorHitCount: number;
    lexicalHitCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSource(value: unknown): value is NoorSource {
    return value === 'ibn_kathir_en_abridged' || value === 'al_sadi_ar';
}

function isNonblankString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseLookup(document: StoredDocument, expected: {
    id: string;
    source: NoorSource;
    surah: number;
    verse: number;
    corpusVersion: string;
}): VerseLookup {
    const value = document.data;
    if (document.id !== expected.id
        || !isRecord(value)
        || value.lookupId !== expected.id
        || value.source !== expected.source
        || value.surah !== expected.surah
        || value.verse !== expected.verse
        || value.corpusVersion !== expected.corpusVersion
        || !isNonblankString(value.canonicalUnitId)
        || !Array.isArray(value.chunkIds)
        || !value.chunkIds.every(isNonblankString)) {
        throw new Error('Invalid exact verse lookup document');
    }
    return {
        lookupId: value.lookupId,
        source: expected.source,
        surah: expected.surah,
        verse: expected.verse,
        canonicalUnitId: value.canonicalUnitId,
        chunkIds: [...value.chunkIds],
        corpusVersion: expected.corpusVersion,
    };
}

function parseUnit(document: StoredDocument): TafsirUnit {
    const value = document.data;
    if (!isRecord(value)
        || document.id !== value.canonicalUnitId
        || !isNonblankString(value.canonicalUnitId)
        || !isSource(value.source)
        || !isNonblankString(value.sourceTitle)
        || (value.language !== 'en' && value.language !== 'ar')
        || !isPositiveInteger(value.surah)
        || !isPositiveInteger(value.verseStart)
        || !isPositiveInteger(value.verseEnd)
        || value.verseEnd < value.verseStart
        || !isNonblankString(value.originalText)
        || !isNonblankString(value.retrievalText)
        || !isNonblankString(value.corpusVersion)
        || !isNonblankString(value.contentHash)
        || !isPositiveInteger(value.resourceId)
        || !isNonblankString(value.upstreamReference)
        || !isNonblankString(value.editionLabel)
        || !isNonblankString(value.normalizationVersion)
        || !isNonblankString(value.embeddingModel)
        || value.embeddingDimension !== EMBEDDING_DIMENSION) {
        throw new Error('Invalid exact canonical unit document');
    }
    return value as unknown as TafsirUnit;
}

function parseChunk(document: StoredDocument): TafsirChunk {
    const value = document.data;
    if (!isRecord(value)
        || document.id !== value.chunkId
        || !isNonblankString(value.chunkId)
        || !isNonblankString(value.canonicalUnitId)
        || typeof value.chunkIndex !== 'number'
        || !Number.isInteger(value.chunkIndex)
        || value.chunkIndex < 0
        || !isSource(value.source)
        || !isNonblankString(value.sourceTitle)
        || (value.language !== 'en' && value.language !== 'ar')
        || !isPositiveInteger(value.surah)
        || !isPositiveInteger(value.verseStart)
        || !isPositiveInteger(value.verseEnd)
        || value.verseEnd < value.verseStart
        || typeof value.originalStart !== 'number'
        || !Number.isInteger(value.originalStart)
        || value.originalStart < 0
        || typeof value.originalEnd !== 'number'
        || !Number.isInteger(value.originalEnd)
        || value.originalEnd <= value.originalStart
        || !isNonblankString(value.originalText)
        || !isNonblankString(value.retrievalText)
        || !isNonblankString(value.corpusVersion)
        || !isNonblankString(value.contentHash)
        || !isPositiveInteger(value.tokenCount)
        || !isNonblankString(value.embeddingModel)
        || value.embeddingDimension !== EMBEDDING_DIMENSION) {
        throw new Error('Invalid retrieval chunk document');
    }
    return value as unknown as TafsirChunk;
}

function uniqueInOrder(values: readonly string[]): string[] {
    const seen = new Set<string>();
    return values.filter(value => {
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}

function assertExactRelationships(
    lookup: VerseLookup,
    unit: TafsirUnit,
    chunks: readonly TafsirChunk[],
): void {
    if (unit.canonicalUnitId !== lookup.canonicalUnitId
        || unit.source !== lookup.source
        || unit.corpusVersion !== lookup.corpusVersion
        || unit.surah !== lookup.surah
        || lookup.verse < unit.verseStart
        || lookup.verse > unit.verseEnd
        || chunks.some(chunk => chunk.canonicalUnitId !== unit.canonicalUnitId
            || chunk.source !== unit.source
            || chunk.corpusVersion !== unit.corpusVersion
            || chunk.surah !== unit.surah
            || chunk.verseStart !== unit.verseStart
            || chunk.verseEnd !== unit.verseEnd
            || chunk.originalEnd > unit.originalText.length
            || unit.originalText.slice(chunk.originalStart, chunk.originalEnd) !== chunk.originalText)) {
        throw new Error('Invalid exact unit or chunk relationship');
    }
}

export async function retrieveExactVerse(input: ExactRetrievalInput): Promise<ExactRetrievedEvidence[]> {
    const lookupId = `${input.source}_${input.surah}_${input.verse}`;
    const basePath = `corpora/${input.config.activeCorpusVersion}`;
    const lookupDocument = await input.repository.readDocument(`${basePath}/verseLookup/${lookupId}`);
    if (!lookupDocument) throw new Error('Exact verse lookup document is missing');
    const lookup = parseLookup(lookupDocument, {
        id: lookupId,
        source: input.source,
        surah: input.surah,
        verse: input.verse,
        corpusVersion: input.config.activeCorpusVersion,
    });

    const unitDocument = await input.repository.readDocument(`${basePath}/units/${lookup.canonicalUnitId}`);
    if (!unitDocument) throw new Error('Exact canonical unit document is missing');
    const storedUnit = parseUnit(unitDocument);
    const chunkIds = uniqueInOrder(lookup.chunkIds);
    const chunkDocuments = await input.repository.readDocuments(
        chunkIds.map(chunkId => `${basePath}/chunks/${chunkId}`),
    );
    const chunksById = new Map(chunkDocuments.map(document => [document.id, parseChunk(document)]));
    const chunks = chunkIds.map(chunkId => {
        const value = chunksById.get(chunkId);
        if (!value) throw new Error(`Exact chunk document is missing: ${chunkId}`);
        return value;
    });
    assertExactRelationships(lookup, storedUnit, chunks);

    const selected: TafsirChunk[] = [];
    let characters = 0;
    for (const value of chunks) {
        if (characters + value.originalText.length > input.config.maxEvidenceCharacters) break;
        selected.push(value);
        characters += value.originalText.length;
    }
    return selected.map((value, index) => ({
        kind: 'exact',
        promptSourceId: `S${index + 1}`,
        chunk: value,
    }));
}

function validateSemanticHit(
    hit: SemanticSearchHit,
    source: NoorSource,
    corpusVersion: string,
): SemanticSearchHit {
    if (!Number.isFinite(hit.distance)
        || hit.distance < 0
        || hit.distance > 2
        || hit.chunk.source !== source
        || hit.chunk.corpusVersion !== corpusVersion) {
        throw new Error('Invalid semantic search result');
    }
    return hit;
}

function selectPerSource(
    hits: readonly SemanticSearchHit[],
    source: NoorSource,
    config: NoorRuntimeConfig,
): Array<{ chunk: TafsirChunk; similarity: number }> {
    const sorted = hits
        .map(hit => validateSemanticHit(hit, source, config.activeCorpusVersion))
        .map(hit => ({ ...hit, similarity: 1 - hit.distance }))
        .filter(hit => hit.similarity >= config.sourceThresholds[source])
        .sort((left, right) => left.distance - right.distance
            || left.chunk.chunkId.localeCompare(right.chunk.chunkId));
    const chunkIds = new Set<string>();
    const unitIds = new Set<string>();
    const selected: Array<{ chunk: TafsirChunk; similarity: number }> = [];
    for (const hit of sorted) {
        if (chunkIds.has(hit.chunk.chunkId) || unitIds.has(hit.chunk.canonicalUnitId)) continue;
        chunkIds.add(hit.chunk.chunkId);
        unitIds.add(hit.chunk.canonicalUnitId);
        selected.push({ chunk: hit.chunk, similarity: hit.similarity });
        if (selected.length === config.maxChunksPerSource) break;
    }
    return selected;
}

function roundRobin<T>(groups: readonly (readonly T[])[]): T[] {
    const output: T[] = [];
    const maximum = Math.max(0, ...groups.map(group => group.length));
    for (let index = 0; index < maximum; index += 1) {
        for (const group of groups) {
            const value = group[index];
            if (value !== undefined) output.push(value);
        }
    }
    return output;
}

export async function retrieveSemanticWithStats(input: SemanticRetrievalInput): Promise<SemanticRetrievalResult> {
    const queryVector = validateEmbedding(await input.embedder.embed(formatEmbeddingQuery(input.content)));
    const sourceResults = await Promise.all(SOURCE_ORDER.map(source => input.repository.searchChunks({
        corpusVersion: input.config.activeCorpusVersion,
        source,
        queryVector,
        distanceMeasure: 'COSINE',
        limit: VECTOR_SEARCH_LIMIT,
        distanceResultField: DISTANCE_RESULT_FIELD,
    })));
    const vectorHitCount = sourceResults.reduce((total, hits) => total + hits.length, 0);
    const merged = roundRobin(sourceResults.map((hits, index) => selectPerSource(
        hits,
        SOURCE_ORDER[index]!,
        input.config,
    )));
    const selected: Array<{ chunk: TafsirChunk; similarity: number }> = [];
    let characters = 0;
    for (const value of merged) {
        if (characters + value.chunk.originalText.length > input.config.maxEvidenceCharacters) continue;
        selected.push(value);
        characters += value.chunk.originalText.length;
    }
    return {
        evidence: selected.map((value, index) => ({
        kind: 'semantic',
        promptSourceId: `S${index + 1}`,
        chunk: value.chunk,
        similarity: value.similarity,
        })),
        vectorHitCount,
        // The lexical route is intentionally absent until the bounded hybrid slice.
        // Keep this explicit so trace metrics never infer lexical hits from evidence.
        lexicalHitCount: 0,
    };
}

export async function retrieveSemantic(input: SemanticRetrievalInput): Promise<SemanticRetrievedEvidence[]> {
    return (await retrieveSemanticWithStats(input)).evidence as SemanticRetrievedEvidence[];
}

export function createFirestoreRetrievalRepository(firestore: object): RetrievalRepository {
    const client = firestore as FirestoreLike;
    return {
        readDocument: async (path): Promise<StoredDocument | null> => {
            if (typeof client.doc !== 'function') throw new Error('Firestore document reads are unavailable');
            const snapshot = await client.doc(path).get();
            if (snapshot.exists === false) return null;
            const data = snapshot.data();
            return data === undefined ? null : { id: snapshot.id, data };
        },
        readDocuments: async (paths): Promise<readonly StoredDocument[]> => {
            if (typeof client.doc !== 'function' || typeof client.getAll !== 'function') {
                throw new Error('Firestore batch document reads are unavailable');
            }
            const snapshots = await client.getAll(...paths.map(path => client.doc(path)));
            return snapshots.flatMap(snapshot => {
                if (snapshot.exists === false) return [];
                const data = snapshot.data();
                return data === undefined ? [] : [{ id: snapshot.id, data }];
            });
        },
        searchChunks: async (request): Promise<readonly SemanticSearchHit[]> => {
            const snapshot = await client.collectionGroup('chunks')
                .where('corpusVersion', '==', request.corpusVersion)
                .where('source', '==', request.source)
                .findNearest({
                    vectorField: 'embedding',
                    queryVector: FieldValue.vector([...request.queryVector]),
                    distanceMeasure: request.distanceMeasure,
                    limit: request.limit,
                    distanceResultField: request.distanceResultField,
                })
                .get();
            return snapshot.docs.map(document => {
                const data = document.data();
                if (!isRecord(data)) throw new Error('Invalid semantic search result document');
                const distance = data[request.distanceResultField];
                const parsed = parseChunk({ id: document.id, data });
                if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0 || distance > 2) {
                    throw new Error('Invalid semantic search result distance');
                }
                if (parsed.corpusVersion !== request.corpusVersion || parsed.source !== request.source) {
                    throw new Error('Invalid semantic search result metadata');
                }
                return { chunk: parsed, distance };
            });
        },
    };
}
