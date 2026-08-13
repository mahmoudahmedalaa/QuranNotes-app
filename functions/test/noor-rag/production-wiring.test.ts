import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseNoorRuntimeConfig } from '../../src/noor-rag/config';
import { createEntitlementRepository, createUsageRepository, readRuntimeConfig, verifyCorpusReady } from '../../src/noor-rag/firestore';
import { createNoorPseudonym, recordNoorTelemetry } from '../../src/noor-rag/telemetry';

const VERSION = '2026-08-10-v1';
const CONFIG = parseNoorRuntimeConfig({
    enabled: true, publicEnabled: false, ownerUids: ['owner'], activeCorpusVersion: VERSION,
    promptVersion: 'p1', generationModel: 'gemini-3.5-flash-lite', embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768, pseudonymKeyVersion: 'key-v1',
    sourceThresholds: { ibn_kathir_en_abridged: 0.7, al_sadi_ar: 0.7 },
    maxChunksPerSource: 4, maxEvidenceCharacters: 50_000,
});

describe('Noor production Firestore wiring', () => {
    it('loads strict runtime config and fails closed on corrupt manifest counts', async () => {
        const documents = new Map<string, unknown>([
            ['noorConfig/runtime', CONFIG],
            [`corpusManifests/${VERSION}`, { corpusVersion: VERSION, status: 'complete', complete: true,
                embeddingModel: 'gemini-embedding-2', embeddingDimension: 768, unitCount: 2, chunkCount: 3,
                lookupCount: 4, expected: { units: 2, chunks: 3, lookups: 4 }, failedChunks: [], failedWrites: [] }],
        ]);
        const firestore = fakeFirestore(documents);
        assert.deepEqual(await readRuntimeConfig(firestore), CONFIG);
        assert.equal(await verifyCorpusReady(firestore, CONFIG), true);
        documents.set(`corpusManifests/${VERSION}`, { ...(documents.get(`corpusManifests/${VERSION}`) as object), chunkCount: 2 });
        assert.equal(await verifyCorpusReady(firestore, CONFIG), false);
    });

    it('adapts Timestamp-like reads and transaction overwrite writes', async () => {
        const documents = new Map<string, unknown>([['noorOwnerQa/u1', { active: true, expiresAt: { toMillis: () => 1_800_000_000_000 } }]]);
        const firestore = fakeFirestore(documents);
        assert.deepEqual(await createEntitlementRepository(firestore).readDocument('noorOwnerQa/u1'),
            { active: true, expiresAt: new Date(1_800_000_000_000).toISOString() });
        await createUsageRepository(firestore).runTransaction(async transaction => {
            assert.equal(await transaction.get('state/a'), null);
            transaction.set('state/a', { expiresAt: new Date(1_800_000_000_000) });
        });
        assert.deepEqual(documents.get('state/a'), { expiresAt: new Date(1_800_000_000_000) });
    });
});

describe('Noor telemetry', () => {
    it('uses key-versioned pseudonyms and excludes sensitive fields', async () => {
        const documents = new Map<string, unknown>();
        const firestore = fakeFirestore(documents);
        const first = createNoorPseudonym('user-1', 'secret-a');
        assert.notEqual(first, createNoorPseudonym('user-1', 'secret-b'));
        await recordNoorTelemetry({ firestore, uid: 'user-1', secret: 'secret-a', pseudonymKeyVersion: 'v1',
            traceId: 'trace-1', now: new Date('2026-08-11T00:00:00.000Z'), event: {
                requestId: '123e4567-e89b-42d3-a456-426614174000', mode: 'chat', entitlementClass: 'paid',
                generationModel: 'gemini-3.5-flash-lite', corpusVersion: VERSION, promptVersion: 'p1',
                outcome: 'answered', citationCount: 1, retrievedChunkIds: ['c1'], errorClass: null, durationMs: 10,
                retrievalMs: 3, generationMs: 7,
            } });
        const serialized = JSON.stringify(documents.get('noorTelemetry/trace-1'));
        for (const forbidden of ['user-1', 'raw question text', 'raw answer text', 'person@example.com', 'provider response body']) {
            assert.equal(serialized.includes(forbidden), false);
        }
        const telemetry = documents.get('noorTelemetry/trace-1') as Record<string, unknown>;
        assert.equal(telemetry.retrievalMs, 3);
        assert.equal(telemetry.generationMs, 7);
        for (const forbiddenKey of ['uid', 'question', 'history', 'answer', 'email', 'callablePayload', 'providerBody']) {
            assert.equal(Object.prototype.hasOwnProperty.call(telemetry, forbiddenKey), false);
        }
        assert.equal(serialized.includes(first), true);
        assert.equal(documents.has('noorTelemetrySubjects/user-1'), true);
    });
});

function fakeFirestore(documents: Map<string, unknown>): object {
    const reference = (path: string) => ({ path, get: async () => ({ exists: documents.has(path), data: () => documents.get(path) }),
        set: async (value: unknown, options: unknown) => { assert.deepEqual(options, { merge: false }); documents.set(path, value); } });
    return { doc: reference, runTransaction: async (worker: (transaction: object) => Promise<unknown>) => worker({
        get: async (ref: { path: string }) => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) }),
        set: (ref: { path: string }, value: unknown, options: unknown) => { assert.deepEqual(options, { merge: false }); documents.set(ref.path, value); },
    }) };
}
