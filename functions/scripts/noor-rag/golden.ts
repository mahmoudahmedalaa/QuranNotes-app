import type { CorpusArtifacts, CorpusChunk } from '../../src/noor-rag/corpus';
import type { NoorSource } from '../../src/noor-rag/generatedContract';

export type GoldenStatus = 'answered' | 'insufficient_evidence' | 'policy_refusal';

export interface GoldenEvidenceExpectation {
    source: NoorSource;
    canonicalUnitId: string;
    chunkIds: readonly string[];
}

export interface GoldenExactRequest {
    source: NoorSource;
    surah: number;
    verse: number;
}

export interface GoldenCase {
    id: string;
    category: string;
    turns: readonly string[];
    expectedStatus: GoldenStatus;
    expectedEvidence: readonly GoldenEvidenceExpectation[];
    forbiddenChunkIds: readonly string[];
    forbiddenStatuses: readonly GoldenStatus[];
    exact?: GoldenExactRequest;
}

export interface GoldenManifest {
    schemaVersion: 1;
    corpusVersion: string;
    topK: number;
    cases: readonly GoldenCase[];
}

const SOURCE_VALUES = new Set<NoorSource>(['ibn_kathir_en_abridged', 'al_sadi_ar']);
const STATUS_VALUES = new Set<GoldenStatus>(['answered', 'insufficient_evidence', 'policy_refusal']);
const LABEL_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,255}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, pattern: RegExp = ID_PATTERN): string {
    if (typeof value !== 'string' || value.length === 0 || !pattern.test(value)) {
        throw new Error(`Invalid golden ${field}`);
    }
    return value;
}

function requireStringArray(value: unknown, field: string, maximum: number): string[] {
    if (!Array.isArray(value) || value.length > maximum
        || !value.every(item => typeof item === 'string' && item.length > 0 && ID_PATTERN.test(item))) {
        throw new Error(`Invalid golden ${field}`);
    }
    return [...value] as string[];
}

function requireStatus(value: unknown, field: string): GoldenStatus {
    if (typeof value !== 'string' || !STATUS_VALUES.has(value as GoldenStatus)) {
        throw new Error(`Invalid golden ${field}`);
    }
    return value as GoldenStatus;
}

function parseEvidence(value: unknown): GoldenEvidenceExpectation[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 8) throw new Error('Invalid golden expectedEvidence');
    return value.map((item, index) => {
        if (!isRecord(item)
            || typeof item.source !== 'string' || !SOURCE_VALUES.has(item.source as NoorSource)) {
            throw new Error(`Invalid golden expectedEvidence[${index}]`);
        }
        const chunkIds = requireStringArray(item.chunkIds, `expectedEvidence[${index}].chunkIds`, 8);
        if (chunkIds.length === 0) throw new Error(`Invalid golden expectedEvidence[${index}].chunkIds`);
        return {
            source: item.source as NoorSource,
            canonicalUnitId: requireString(item.canonicalUnitId, `expectedEvidence[${index}].canonicalUnitId`),
            chunkIds,
        };
    });
}

function parseExact(value: unknown): GoldenExactRequest {
    if (!isRecord(value)
        || typeof value.source !== 'string' || !SOURCE_VALUES.has(value.source as NoorSource)
        || typeof value.surah !== 'number' || !Number.isSafeInteger(value.surah) || value.surah < 1 || value.surah > 114
        || typeof value.verse !== 'number' || !Number.isSafeInteger(value.verse) || value.verse < 1) {
        throw new Error('Invalid golden exact request');
    }
    return { source: value.source as NoorSource, surah: value.surah, verse: value.verse };
}

export function parseGoldenManifest(value: unknown): GoldenManifest {
    if (!isRecord(value)
        || value.schemaVersion !== 1
        || typeof value.corpusVersion !== 'string' || !VERSION_PATTERN.test(value.corpusVersion)
        || typeof value.topK !== 'number' || !Number.isSafeInteger(value.topK) || value.topK < 1 || value.topK > 20
        || !Array.isArray(value.cases) || value.cases.length < 1 || value.cases.length > 20) {
        throw new Error('Invalid Noor golden manifest schema');
    }
    const seen = new Set<string>();
    const cases = value.cases.map((item, index): GoldenCase => {
        if (!isRecord(item)) throw new Error(`Invalid golden case ${index}`);
        const id = requireString(item.id, `case[${index}].id`, LABEL_PATTERN);
        if (seen.has(id)) throw new Error(`Duplicate golden case ${id}`);
        seen.add(id);
        if (!Array.isArray(item.turns) || item.turns.length < 1 || item.turns.length > 6
            || !item.turns.every(turn => typeof turn === 'string' && turn.trim().length > 0 && turn.length <= 500)) {
            throw new Error(`Invalid golden case ${id}.turns`);
        }
        const expectedStatus = requireStatus(item.expectedStatus, `case[${index}].expectedStatus`);
        const expectedEvidence = parseEvidence(item.expectedEvidence);
        const forbiddenChunkIds = requireStringArray(item.forbiddenChunkIds, `case[${index}].forbiddenChunkIds`, 32);
        const forbiddenStatuses = item.forbiddenStatuses === undefined
            ? (() => { throw new Error(`Invalid golden case ${id}.forbiddenStatuses`); })()
            : (item.forbiddenStatuses as unknown[]).map((status, statusIndex) => requireStatus(status, `case[${index}].forbiddenStatuses[${statusIndex}]`));
        if (expectedStatus === 'answered' && expectedEvidence.length === 0) {
            throw new Error(`Golden positive case ${id} requires expectedEvidence`);
        }
        if (expectedStatus !== 'answered' && expectedEvidence.length > 0) {
            throw new Error(`Golden abstention case ${id} cannot contain expectedEvidence`);
        }
        if (forbiddenStatuses.includes(expectedStatus)) {
            throw new Error(`Golden case ${id} forbids its expected status`);
        }
        return {
            id,
            category: requireString(item.category, `case[${index}].category`, LABEL_PATTERN),
            turns: [...item.turns] as string[],
            expectedStatus,
            expectedEvidence,
            forbiddenChunkIds,
            forbiddenStatuses,
            ...(item.exact === undefined ? {} : { exact: parseExact(item.exact) }),
        };
    });
    return { schemaVersion: 1, corpusVersion: value.corpusVersion, topK: value.topK, cases };
}

function chunkKey(chunk: CorpusChunk): string {
    return `${chunk.source}\0${chunk.chunkId}`;
}

export interface GoldenCorpusValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateGoldenAgainstCorpus(
    manifest: GoldenManifest,
    artifacts: CorpusArtifacts,
): GoldenCorpusValidationResult {
    const errors: string[] = [];
    if (artifacts.manifest.corpusVersion !== manifest.corpusVersion) {
        errors.push(`golden corpus version ${manifest.corpusVersion} does not match artifact ${artifacts.manifest.corpusVersion}`);
    }
    const chunksByKey = new Map(artifacts.chunks.map(chunk => [chunkKey(chunk), chunk]));
    const units = new Map(artifacts.units.map(unit => [`${unit.source}\0${unit.canonicalUnitId}`, unit]));
    const lookups = new Map(artifacts.lookups.map(lookup => [`${lookup.source}\0${lookup.lookupId}`, lookup]));
    for (const goldenCase of manifest.cases) {
        for (const expected of goldenCase.expectedEvidence) {
            const unit = units.get(`${expected.source}\0${expected.canonicalUnitId}`);
            if (!unit) errors.push(`${goldenCase.id}: missing expected unit ${expected.canonicalUnitId}`);
            for (const chunkId of expected.chunkIds) {
                const chunk = chunksByKey.get(`${expected.source}\0${chunkId}`);
                if (!chunk) {
                    errors.push(`${goldenCase.id}: missing expected chunk ${chunkId}`);
                } else if (chunk.canonicalUnitId !== expected.canonicalUnitId) {
                    errors.push(`${goldenCase.id}: chunk ${chunkId} points to ${chunk.canonicalUnitId}, not ${expected.canonicalUnitId}`);
                }
            }
        }
        for (const chunkId of goldenCase.forbiddenChunkIds) {
            if (!artifacts.chunks.some(chunk => chunk.chunkId === chunkId)) {
                errors.push(`${goldenCase.id}: forbidden chunk ${chunkId} is not in the corpus`);
            }
        }
        if (goldenCase.exact) {
            const lookupId = `${goldenCase.exact.source}_${goldenCase.exact.surah}_${goldenCase.exact.verse}`;
            if (!lookups.has(`${goldenCase.exact.source}\0${lookupId}`)) {
                errors.push(`${goldenCase.id}: exact lookup ${lookupId} is missing`);
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
