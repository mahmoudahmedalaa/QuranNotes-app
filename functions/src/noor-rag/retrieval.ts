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
import { tokenizeLexicalQuery } from './lexical';
import type { QuranSurahEntity } from './quranEntities';
export { tokenizeLexicalQuery } from './lexical';

const SOURCE_ORDER: readonly NoorSource[] = ['ibn_kathir_en_abridged', 'al_sadi_ar'];
const VECTOR_SEARCH_LIMIT = 8 as const;
const DISTANCE_RESULT_FIELD = '_noorVectorDistance' as const;
const LEXICAL_SEARCH_LIMIT = 8 as const;
const ENTITY_SUMMARY_SECTION_COUNT = 6;
const ENTITY_SUMMARY_ANCHORS_PER_SECTION = 4;
const ENTITY_SUMMARY_EVIDENCE_LIMIT = 8;

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

export interface LexicalSearchRequest {
    corpusVersion: string;
    source: NoorSource;
    tokens: readonly string[];
    limit: typeof LEXICAL_SEARCH_LIMIT;
}

export interface LexicalSearchHit {
    chunk: TafsirChunk;
    score: number;
}

export interface RetrievalRepository {
    readDocument(path: string): Promise<StoredDocument | null>;
    readDocuments(paths: readonly string[]): Promise<readonly StoredDocument[]>;
    searchChunks(request: SemanticSearchRequest): Promise<readonly SemanticSearchHit[]>;
    searchLexical?(request: LexicalSearchRequest): Promise<readonly LexicalSearchHit[]>;
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
    where(field: string, operator: '==' | 'array-contains' | 'array-contains-any', value: unknown): FirestoreQueryLike;
    limit?(count: number): FirestoreQueryLike;
    get(): Promise<{ readonly docs: readonly FirestoreSnapshotLike[] }>;
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
    lexicalSearchStatus: 'available' | 'unavailable' | 'not_configured';
}

export interface EntitySummaryRetrievalInput {
    entity: QuranSurahEntity;
    config: NoorRuntimeConfig;
    repository: RetrievalRepository;
}

export interface EntitySummaryRetrievalResult {
    evidence: readonly ExactRetrievedEvidence[];
    candidateCount: number;
    anchorVerses: readonly number[];
    coverageCapacity: {
        canonicalUnits: number;
        sections: number;
        span: number;
    };
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

function entitySummaryAnchorVerses(verseCount: number): number[] {
    const anchors: number[] = [];
    const sectionCount = Math.min(ENTITY_SUMMARY_SECTION_COUNT, verseCount);
    for (let section = 0; section < sectionCount; section += 1) {
        const start = Math.floor(section * verseCount / sectionCount) + 1;
        const end = Math.floor((section + 1) * verseCount / sectionCount);
        const positions = Math.min(ENTITY_SUMMARY_ANCHORS_PER_SECTION, end - start + 1);
        for (let index = 0; index < positions; index += 1) {
            anchors.push(Math.floor(start + (index + 0.5) * (end - start + 1) / positions));
        }
    }
    return uniqueInOrder(anchors.map(String)).map(Number);
}

function entityCoverageSection(verse: number, verseCount: number): number {
    return Math.min(
        ENTITY_SUMMARY_SECTION_COUNT - 1,
        Math.floor((Math.max(1, verse) - 1) * ENTITY_SUMMARY_SECTION_COUNT / verseCount),
    );
}

function coverageTokens(value: string): Set<string> {
    return new Set(value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(token => token.length >= 3));
}

function candidateSimilarity(left: ExactRetrievedEvidence, right: ExactRetrievedEvidence): number {
    const leftEmbedding = left.chunk.embedding;
    const rightEmbedding = right.chunk.embedding;
    if (leftEmbedding?.length === EMBEDDING_DIMENSION
        && rightEmbedding?.length === EMBEDDING_DIMENSION
        && leftEmbedding.every(Number.isFinite)
        && rightEmbedding.every(Number.isFinite)) {
        let dot = 0;
        let leftNorm = 0;
        let rightNorm = 0;
        for (let index = 0; index < EMBEDDING_DIMENSION; index += 1) {
            const leftValue = leftEmbedding[index]!;
            const rightValue = rightEmbedding[index]!;
            dot += leftValue * rightValue;
            leftNorm += leftValue * leftValue;
            rightNorm += rightValue * rightValue;
        }
        if (leftNorm > 0 && rightNorm > 0) return Math.max(-1, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
    }
    const leftTokens = coverageTokens(left.chunk.retrievalText);
    const rightTokens = coverageTokens(right.chunk.retrievalText);
    const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 0 : intersection / union;
}

function candidateCentrality(
    item: ExactRetrievedEvidence,
    pool: readonly ExactRetrievedEvidence[],
    entity: QuranSurahEntity,
): number {
    const section = entityCoverageSection(item.chunk.verseStart, entity.verseCount);
    const similarities = pool
        .filter(other => other.chunk.chunkId !== item.chunk.chunkId
            && other.chunk.source === item.chunk.source
            && entityCoverageSection(other.chunk.verseStart, entity.verseCount) !== section)
        .map(other => candidateSimilarity(item, other))
        .sort((left, right) => right - left)
        .slice(0, 4);
    return similarities.length === 0
        ? 0
        : similarities.reduce((total, value) => total + value, 0) / similarities.length;
}

function selectEntitySummaryCoverage(
    candidates: readonly ExactRetrievedEvidence[],
    entity: QuranSurahEntity,
    maximumCharacters: number,
): ExactRetrievedEvidence[] {
    const representatives = new Map<string, ExactRetrievedEvidence>();
    for (const item of candidates) {
        if (item.chunk.surah !== entity.surahNumber) continue;
        const key = `${item.chunk.source}:${item.chunk.canonicalUnitId}`;
        const current = representatives.get(key);
        if (current === undefined || item.chunk.chunkIndex < current.chunk.chunkIndex) representatives.set(key, item);
    }
    const pool = [...representatives.values()].sort((left, right) => (
        left.chunk.verseStart - right.chunk.verseStart
        || left.chunk.source.localeCompare(right.chunk.source)
        || left.chunk.chunkId.localeCompare(right.chunk.chunkId)
    ));
    const centrality = new Map(pool.map(item => [item.chunk.chunkId, candidateCentrality(item, pool, entity)]));
    const selected: ExactRetrievedEvidence[] = [];
    const selectedIds = new Set<string>();
    const sourceCounts = new Map<NoorSource, number>();
    const sectionCounts = new Map<number, number>();
    let characters = 0;

    const add = (item: ExactRetrievedEvidence): boolean => {
        if (selectedIds.has(item.chunk.chunkId)
            || selected.length >= ENTITY_SUMMARY_EVIDENCE_LIMIT
            || characters + item.chunk.originalText.length > maximumCharacters) {
            return false;
        }
        selected.push(item);
        selectedIds.add(item.chunk.chunkId);
        characters += item.chunk.originalText.length;
        sourceCounts.set(item.chunk.source, (sourceCounts.get(item.chunk.source) ?? 0) + 1);
        const section = entityCoverageSection(item.chunk.verseStart, entity.verseCount);
        sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
        return true;
    };

    for (let section = 0; section < Math.min(ENTITY_SUMMARY_SECTION_COUNT, entity.verseCount); section += 1) {
        const inSection = pool.filter(item => entityCoverageSection(item.chunk.verseStart, entity.verseCount) === section);
        const preferredSource = SOURCE_ORDER[section % SOURCE_ORDER.length];
        const preferredPool = inSection.some(item => item.chunk.source === preferredSource)
            ? inSection.filter(item => item.chunk.source === preferredSource)
            : inSection;
        const preferred = [...preferredPool].sort((left, right) => (
            (centrality.get(right.chunk.chunkId) ?? 0) - (centrality.get(left.chunk.chunkId) ?? 0)
            || left.chunk.verseStart - right.chunk.verseStart
            || left.chunk.chunkId.localeCompare(right.chunk.chunkId)
        ))[0];
        if (preferred) add(preferred);
    }

    while (selected.length < ENTITY_SUMMARY_EVIDENCE_LIMIT) {
        const remaining = pool
            .filter(item => !selectedIds.has(item.chunk.chunkId))
            .sort((left, right) => {
                const leftSection = entityCoverageSection(left.chunk.verseStart, entity.verseCount);
                const rightSection = entityCoverageSection(right.chunk.verseStart, entity.verseCount);
                const leftNovelty = selected.length === 0 ? 0 : Math.max(...selected.map(item => candidateSimilarity(left, item)));
                const rightNovelty = selected.length === 0 ? 0 : Math.max(...selected.map(item => candidateSimilarity(right, item)));
                const leftScore = (centrality.get(left.chunk.chunkId) ?? 0) - 0.35 * leftNovelty;
                const rightScore = (centrality.get(right.chunk.chunkId) ?? 0) - 0.35 * rightNovelty;
                return (sectionCounts.get(leftSection) ?? 0) - (sectionCounts.get(rightSection) ?? 0)
                    || (sourceCounts.get(left.chunk.source) ?? 0) - (sourceCounts.get(right.chunk.source) ?? 0)
                    || rightScore - leftScore
                    || left.chunk.verseStart - right.chunk.verseStart
                    || left.chunk.chunkId.localeCompare(right.chunk.chunkId);
            });
        if (remaining.length === 0) break;
        let added = false;
        for (const item of remaining) {
            if (add(item)) {
                added = true;
                break;
            }
        }
        if (!added) break;
    }

    return selected.map((item, index) => ({ ...item, promptSourceId: `S${index + 1}` }));
}

export async function retrieveEntitySummaryWithStats(
    input: EntitySummaryRetrievalInput,
): Promise<EntitySummaryRetrievalResult> {
    const anchorVerses = entitySummaryAnchorVerses(input.entity.verseCount);
    const basePath = `corpora/${input.config.activeCorpusVersion}`;
    const expectedLookups = SOURCE_ORDER.flatMap(source => anchorVerses.map(verse => ({
        source,
        verse,
        id: `${source}_${input.entity.surahNumber}_${verse}`,
    })));
    const lookupDocuments = await input.repository.readDocuments(
        expectedLookups.map(item => `${basePath}/verseLookup/${item.id}`),
    );
    const lookupDocumentsById = new Map(lookupDocuments.map(document => [document.id, document]));
    const lookups = expectedLookups.map(expected => {
        const document = lookupDocumentsById.get(expected.id);
        if (!document) throw new Error(`Entity-summary verse lookup document is missing: ${expected.id}`);
        return parseLookup(document, {
            id: expected.id,
            source: expected.source,
            surah: input.entity.surahNumber,
            verse: expected.verse,
            corpusVersion: input.config.activeCorpusVersion,
        });
    });
    const unitIds = uniqueInOrder(lookups.map(lookup => lookup.canonicalUnitId));
    const unitDocuments = await input.repository.readDocuments(unitIds.map(id => `${basePath}/units/${id}`));
    const unitsById = new Map(unitDocuments.map(document => [document.id, parseUnit(document)]));
    const chunkIds = uniqueInOrder(lookups.flatMap(lookup => lookup.chunkIds));
    const chunkDocuments = await input.repository.readDocuments(chunkIds.map(id => `${basePath}/chunks/${id}`));
    const chunksById = new Map(chunkDocuments.map(document => [document.id, parseChunk(document)]));
    const candidates = lookups.flatMap(lookup => {
        const unit = unitsById.get(lookup.canonicalUnitId);
        if (!unit) throw new Error(`Entity-summary canonical unit document is missing: ${lookup.canonicalUnitId}`);
        const chunks = uniqueInOrder(lookup.chunkIds).map(chunkId => {
            const chunk = chunksById.get(chunkId);
            if (!chunk) throw new Error(`Entity-summary chunk document is missing: ${chunkId}`);
            return chunk;
        });
        assertExactRelationships(lookup, unit, chunks);
        return chunks.map((chunk, index): ExactRetrievedEvidence => ({
            kind: 'exact',
            promptSourceId: `C${index + 1}`,
            chunk,
        }));
    });
    const candidateVerses = candidates.map(item => item.chunk.verseStart);
    const candidateCount = new Set(candidates.map(item => `${item.chunk.source}:${item.chunk.canonicalUnitId}`)).size;
    return {
        evidence: selectEntitySummaryCoverage(candidates, input.entity, input.config.maxEvidenceCharacters),
        candidateCount,
        anchorVerses,
        coverageCapacity: {
            canonicalUnits: candidateCount,
            sections: new Set(candidateVerses.map(verse => entityCoverageSection(verse, input.entity.verseCount))).size,
            span: candidateVerses.length === 0 ? 0 : Math.max(...candidateVerses) - Math.min(...candidateVerses),
        },
    };
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

function validateLexicalHit(
    hit: LexicalSearchHit,
    source: NoorSource,
    corpusVersion: string,
): LexicalSearchHit {
    if (!Number.isFinite(hit.score)
        || hit.score <= 0
        || hit.chunk.source !== source
        || hit.chunk.corpusVersion !== corpusVersion) {
        throw new Error('Invalid lexical search result');
    }
    return hit;
}

function selectHybridPerSource(
    vectorHits: readonly SemanticSearchHit[],
    lexicalHits: readonly LexicalSearchHit[],
    source: NoorSource,
    config: NoorRuntimeConfig,
): Array<{ chunk: TafsirChunk; similarity: number }> {
    const candidates = new Map<string, {
        chunk: TafsirChunk;
        similarity: number;
        lexicalScore: number;
        vectorDistance: number;
    }>();
    for (const hit of vectorHits.map(value => validateSemanticHit(value, source, config.activeCorpusVersion))) {
        const similarity = 1 - hit.distance;
        if (similarity < config.sourceThresholds[source]) continue;
        candidates.set(hit.chunk.chunkId, {
            chunk: hit.chunk, similarity, lexicalScore: 0, vectorDistance: hit.distance,
        });
    }
    for (const hit of lexicalHits.map(value => validateLexicalHit(value, source, config.activeCorpusVersion))) {
        const existing = candidates.get(hit.chunk.chunkId);
        if (existing) {
            existing.lexicalScore = Math.max(existing.lexicalScore, hit.score);
        } else {
            candidates.set(hit.chunk.chunkId, {
                chunk: hit.chunk,
                // Lexical-only evidence remains below a vector match but is still usable.
                similarity: config.sourceThresholds[source],
                lexicalScore: hit.score,
                vectorDistance: 2,
            });
        }
    }
    const sorted = [...candidates.values()].sort((left, right) => {
        const leftAgreement = left.lexicalScore > 0 && left.vectorDistance < 2 ? 1 : 0;
        const rightAgreement = right.lexicalScore > 0 && right.vectorDistance < 2 ? 1 : 0;
        return rightAgreement - leftAgreement
            || right.similarity - left.similarity
            || right.lexicalScore - left.lexicalScore
            || left.vectorDistance - right.vectorDistance
            || left.chunk.chunkId.localeCompare(right.chunk.chunkId);
    });
    const unitIds = new Set<string>();
    const selected: Array<{ chunk: TafsirChunk; similarity: number }> = [];
    for (const value of sorted) {
        if (unitIds.has(value.chunk.canonicalUnitId)) continue;
        unitIds.add(value.chunk.canonicalUnitId);
        selected.push({ chunk: value.chunk, similarity: value.similarity });
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
    const lexicalTokens = tokenizeLexicalQuery(input.content);
    const queryVectorPromise = input.embedder.embed(formatEmbeddingQuery(input.content));
    let lexicalSearchStatus: SemanticRetrievalResult['lexicalSearchStatus'] = input.repository.searchLexical && lexicalTokens.length > 0
        ? 'available'
        : 'not_configured';
    const lexicalPromise = Promise.all(SOURCE_ORDER.map(async source => {
        if (!input.repository.searchLexical || lexicalTokens.length === 0) return [] as readonly LexicalSearchHit[];
        try {
            return await input.repository.searchLexical({
                corpusVersion: input.config.activeCorpusVersion,
                source,
                tokens: lexicalTokens,
                limit: LEXICAL_SEARCH_LIMIT,
            });
        } catch {
            // A missing/unbuilt lexical index must fall back to the vector route.
            lexicalSearchStatus = 'unavailable';
            return [] as readonly LexicalSearchHit[];
        }
    }));
    const queryVector = validateEmbedding(await queryVectorPromise);
    const vectorPromise = Promise.all(SOURCE_ORDER.map(source => input.repository.searchChunks({
        corpusVersion: input.config.activeCorpusVersion,
        source,
        queryVector,
        distanceMeasure: 'COSINE',
        limit: VECTOR_SEARCH_LIMIT,
        distanceResultField: DISTANCE_RESULT_FIELD,
    })));
    const [sourceResults, lexicalResults] = await Promise.all([vectorPromise, lexicalPromise]);
    const vectorHitCount = sourceResults.reduce((total, hits) => total + hits.length, 0);
    const lexicalHitCount = lexicalResults.reduce((total, hits) => total + hits.length, 0);
    const merged = roundRobin(SOURCE_ORDER.map((source, index) => selectHybridPerSource(
        sourceResults[index]!, lexicalResults[index]!, source, input.config,
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
        lexicalHitCount,
        lexicalSearchStatus,
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
        searchLexical: async (request): Promise<readonly LexicalSearchHit[]> => {
            if (request.tokens.length === 0) return [];
            let query = client.collectionGroup('chunks')
                .where('corpusVersion', '==', request.corpusVersion)
                .where('source', '==', request.source)
                .where('lexicalTokens', 'array-contains-any', [...request.tokens]);
            if (query.limit) query = query.limit(request.limit);
            const snapshot = await query.get();
            return snapshot.docs.map(document => {
                const data = document.data();
                if (!isRecord(data)) throw new Error('Invalid lexical search result document');
                const parsed = parseChunk({ id: document.id, data });
                if (parsed.corpusVersion !== request.corpusVersion || parsed.source !== request.source) {
                    throw new Error('Invalid lexical search result metadata');
                }
                const storedTokens = new Set(Array.isArray(data.lexicalTokens)
                    ? data.lexicalTokens.filter((value): value is string => typeof value === 'string')
                    : []);
                return { chunk: parsed, score: request.tokens.filter(token => storedTokens.has(token)).length };
            })
                .sort((left, right) => right.score - left.score || left.chunk.chunkId.localeCompare(right.chunk.chunkId))
                .slice(0, request.limit);
        },
    };
}
