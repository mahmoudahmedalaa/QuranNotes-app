import type { NoorRuntimeConfig } from './config';
import { parseNoorRuntimeConfig } from './config';
import type { EntitlementRepository } from './entitlement';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from './embedding';
import type { UsageRepository } from './usage';

interface SnapshotLike { exists: boolean; data(): unknown }
interface ReferenceLike { path?: string; get(): Promise<SnapshotLike>; set(value: unknown, options: { merge: false }): Promise<void> }
interface TransactionLike {
    get(reference: ReferenceLike): Promise<SnapshotLike>;
    set(reference: ReferenceLike, value: unknown, options: { merge: false }): void;
}
interface FirestoreLike {
    doc(path: string): ReferenceLike;
    runTransaction<T>(worker: (transaction: TransactionLike) => Promise<T>): Promise<T>;
}

function client(value: object): FirestoreLike {
    return value as FirestoreLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestampToIso(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(timestampToIso);
    if (!isRecord(value)) return value;
    if (typeof value.toMillis === 'function') {
        const millis = (value.toMillis as () => unknown)();
        if (typeof millis !== 'number' || !Number.isFinite(millis)) throw new Error('Invalid Firestore timestamp');
        return new Date(millis).toISOString();
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, timestampToIso(item)]));
}

function dateWrites(value: unknown): unknown {
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        if ((key === 'expiresAt' || key === 'cachedAt' || key === 'validUntil') && typeof item === 'string') {
            const parsed = new Date(item);
            if (Number.isFinite(parsed.getTime())) return [key, parsed];
        }
        return [key, item];
    }));
}

async function readData(firestore: object, path: string): Promise<unknown | null> {
    const snapshot = await client(firestore).doc(path).get();
    if (!snapshot.exists) return null;
    return snapshot.data() ?? null;
}

export async function readRuntimeConfig(firestore: object): Promise<NoorRuntimeConfig> {
    return parseNoorRuntimeConfig(await readData(firestore, 'noorConfig/runtime'));
}

export async function verifyCorpusReady(firestore: object, config: NoorRuntimeConfig): Promise<boolean> {
    const value = await readData(firestore, `corpusManifests/${config.activeCorpusVersion}`);
    if (!isRecord(value) || !isRecord(value.expected)) return false;
    return value.status === 'complete'
        && value.complete === true
        && value.corpusVersion === config.activeCorpusVersion
        && value.embeddingModel === EMBEDDING_MODEL
        && value.embeddingDimension === EMBEDDING_DIMENSION
        && typeof value.unitCount === 'number' && Number.isSafeInteger(value.unitCount) && value.unitCount > 0
        && typeof value.chunkCount === 'number' && Number.isSafeInteger(value.chunkCount) && value.chunkCount > 0
        && typeof value.lookupCount === 'number' && Number.isSafeInteger(value.lookupCount) && value.lookupCount > 0
        && value.expected.units === value.unitCount
        && value.expected.chunks === value.chunkCount
        && value.expected.lookups === value.lookupCount
        && Array.isArray(value.failedChunks) && value.failedChunks.length === 0
        && Array.isArray(value.failedWrites) && value.failedWrites.length === 0;
}

export function createEntitlementRepository(firestore: object): EntitlementRepository {
    const db = client(firestore);
    return {
        readDocument: async path => timestampToIso(await readData(firestore, path)),
        writeDocument: async (path, data) => db.doc(path).set(dateWrites(data), { merge: false }),
    };
}

export function createUsageRepository(firestore: object): UsageRepository {
    const db = client(firestore);
    return {
        runTransaction: worker => db.runTransaction(async transaction => worker({
            get: async path => {
                const snapshot = await transaction.get(db.doc(path));
                return snapshot.exists ? snapshot.data() ?? null : null;
            },
            set: (path, value) => transaction.set(db.doc(path), value, { merge: false }),
        })),
    };
}

export async function readDocument(firestore: object, path: string): Promise<unknown | null> {
    return readData(firestore, path);
}
