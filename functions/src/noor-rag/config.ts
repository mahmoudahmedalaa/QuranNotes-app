import type { NoorSource } from './generatedContract';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from './embedding';

const GENERATION_MODEL = 'gemini-3.5-flash-lite';
const MAX_OWNER_UIDS = 100;
const MAX_VERSION_CHARACTERS = 128;
const MAX_CHUNKS_PER_SOURCE = 4;
const MAX_EVIDENCE_CHARACTERS = 50000;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const OWNER_UID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const CONFIG_KEYS: readonly (keyof NoorRuntimeConfig)[] = [
    'enabled',
    'publicEnabled',
    'ownerUids',
    'activeCorpusVersion',
    'promptVersion',
    'generationModel',
    'embeddingModel',
    'embeddingDimension',
    'pseudonymKeyVersion',
    'sourceThresholds',
    'maxChunksPerSource',
    'maxEvidenceCharacters',
];

export interface NoorRuntimeConfig {
    enabled: boolean;
    publicEnabled: boolean;
    ownerUids: string[];
    activeCorpusVersion: string;
    promptVersion: string;
    generationModel: typeof GENERATION_MODEL;
    embeddingModel: typeof EMBEDDING_MODEL;
    embeddingDimension: typeof EMBEDDING_DIMENSION;
    pseudonymKeyVersion: string;
    sourceThresholds: Record<NoorSource, number>;
    maxChunksPerSource: number;
    maxEvidenceCharacters: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidConfig(): never {
    throw new Error('Invalid Noor runtime config');
}

function hasExactConfigKeys(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);
    return keys.length === CONFIG_KEYS.length
        && CONFIG_KEYS.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isVersion(value: unknown): value is string {
    return typeof value === 'string'
        && value.length <= MAX_VERSION_CHARACTERS
        && VERSION_PATTERN.test(value);
}

function parseOwnerUids(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > MAX_OWNER_UIDS) {
        return invalidConfig();
    }
    const inputs: unknown[] = value;
    if (!inputs.every((uid): uid is string => typeof uid === 'string' && OWNER_UID_PATTERN.test(uid))) {
        return invalidConfig();
    }
    if (new Set(inputs).size !== inputs.length) {
        return invalidConfig();
    }
    return [...inputs];
}

function isThreshold(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isFinite(value)
        && value > 0
        && value <= 1;
}

function parseSourceThresholds(value: unknown): Record<NoorSource, number> {
    if (!isRecord(value)
        || Object.keys(value).length !== 2
        || !Object.prototype.hasOwnProperty.call(value, 'ibn_kathir_en_abridged')
        || !Object.prototype.hasOwnProperty.call(value, 'al_sadi_ar')
        || !isThreshold(value.ibn_kathir_en_abridged)
        || !isThreshold(value.al_sadi_ar)) {
        return invalidConfig();
    }
    return {
        ibn_kathir_en_abridged: value.ibn_kathir_en_abridged,
        al_sadi_ar: value.al_sadi_ar,
    };
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
    return typeof value === 'number'
        && Number.isInteger(value)
        && value >= minimum
        && value <= maximum;
}

export function parseNoorRuntimeConfig(value: unknown): NoorRuntimeConfig {
    if (!isRecord(value)
        || !hasExactConfigKeys(value)
        || typeof value.enabled !== 'boolean'
        || typeof value.publicEnabled !== 'boolean'
        || !isVersion(value.activeCorpusVersion)
        || !isVersion(value.promptVersion)
        || value.generationModel !== GENERATION_MODEL
        || value.embeddingModel !== EMBEDDING_MODEL
        || value.embeddingDimension !== EMBEDDING_DIMENSION
        || !isVersion(value.pseudonymKeyVersion)
        || !isBoundedInteger(value.maxChunksPerSource, 1, MAX_CHUNKS_PER_SOURCE)
        || !isBoundedInteger(value.maxEvidenceCharacters, 1, MAX_EVIDENCE_CHARACTERS)) {
        return invalidConfig();
    }

    return {
        enabled: value.enabled,
        publicEnabled: value.publicEnabled,
        ownerUids: parseOwnerUids(value.ownerUids),
        activeCorpusVersion: value.activeCorpusVersion,
        promptVersion: value.promptVersion,
        generationModel: value.generationModel,
        embeddingModel: value.embeddingModel,
        embeddingDimension: value.embeddingDimension,
        pseudonymKeyVersion: value.pseudonymKeyVersion,
        sourceThresholds: parseSourceThresholds(value.sourceThresholds),
        maxChunksPerSource: value.maxChunksPerSource,
        maxEvidenceCharacters: value.maxEvidenceCharacters,
    };
}
