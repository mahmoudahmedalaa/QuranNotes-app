import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseNoorRuntimeConfig } from '../../src/noor-rag/config';
import { createNoorSanitizedTraceSink, type NoorSanitizedTrace } from '../../src/noor-rag/callable';
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
    it('wires the callable trace sink through privacy-safe telemetry without raw values', async () => {
        const documents = new Map<string, unknown>();
        const firestore = fakeFirestore(documents);
        const trace: NoorSanitizedTrace = {
            requestId: '11111111-1111-4111-8111-111111111111',
            case: 'riba-followup',
            policy: 'allowed',
            status: 'answered',
            citationCount: 1,
            conversationState: 'validated_subject_and_evidence',
            contextSelected: true,
            selectedPriorUserContext: 'validated_prior_subject',
            queryVariantCount: 2,
            queryVariantKinds: ['original', 'context_enriched'],
            taskType: 'contextual_followup', resolvedEntityIds: [], sanitizedRewriteFingerprint: 'b'.repeat(64),
            preAnswerabilityEvidenceIds: ['E1'], postAnswerabilityEvidenceIds: ['E1'], answerabilityReason: 'sufficient',
            policyReasonCode: 'allowed', outcomeNormalizationReason: 'none', stateAction: 'persisted',
            vectorHitCount: 8,
            lexicalHitCount: 4,
            lexicalSearchStatus: 'available',
            evidenceIds: ['E1'],
            evidenceCount: 1,
            generationStatus: 'answered',
            citationValidation: 'passed',
            generationAttemptCount: 1,
            generationFailurePhase: 'none',
            structuralValidationResult: 'passed_first_attempt',
            citationValidationResult: 'passed_first_attempt',
            citationValidationFailureSubtype: null,
            qualityJudgeInvoked: true,
            generationRetryInvoked: false,
            correctionInvoked: false,
            finalGenerationErrorClass: null,
            personalizedRulingClassifierInvoked: true,
            personalizedRulingClassification: 'general_information',
            personalizedRulingClassifierLatencyMs: 12,
            personalizedRulingClassifierFailureType: null,
            semanticTaskClassifierInvoked: false,
            semanticTaskClassification: 'not_run',
            semanticTaskClassifierLatencyMs: 0,
            semanticTaskClassifierFailureType: null,
            statePersistence: 'persisted',
            stateFingerprint: 'a'.repeat(64),
            stageMs: { policy: 1, context: 2, retrieval: 3, generation: 4, citationValidation: 5 },
            finalCopy: 'Answer available with validated tafsir citations.',
        };
        const sink = createNoorSanitizedTraceSink({
            firestore,
            uid: 'sensitive-user@example.com',
            secret: 'telemetry-secret',
            pseudonymKeyVersion: 'key-v1',
            traceId: 'server-trace-1',
            now: () => new Date('2026-08-15T00:00:00.000Z'),
        });

        await sink(trace);

        const stored = documents.get('noorTelemetry/server-trace-1') as Record<string, unknown>;
        assert.deepEqual(stored.sanitizedTrace, trace);
        const serialized = JSON.stringify(stored);
        for (const forbidden of [
            'sensitive-user@example.com',
            'telemetry-secret',
            'raw question text',
            'provider response body',
            'chunk-riba-secret',
        ]) {
            assert.equal(serialized.includes(forbidden), false);
        }
    });

    it('preserves arbitrary bounded evaluation class labels without a production topic list', async () => {
        const documents = new Map<string, unknown>();
        const firestore = fakeFirestore(documents);
        const sink = createNoorSanitizedTraceSink({
            firestore, uid: 'user-1', secret: 'secret', pseudonymKeyVersion: 'key-v1', traceId: 'trace-class',
        });
        await sink({
            requestId: '22222222-2222-4222-8222-222222222222',
            case: 'modern-concept-paraphrase', policy: 'allowed', status: 'insufficient_evidence', citationCount: 0,
            conversationState: 'none', contextSelected: false, selectedPriorUserContext: 'none', queryVariantCount: 1,
            taskType: 'point_question', resolvedEntityIds: [], sanitizedRewriteFingerprint: 'b'.repeat(64),
            preAnswerabilityEvidenceIds: [], postAnswerabilityEvidenceIds: [], answerabilityReason: 'insufficient',
            policyReasonCode: 'allowed', outcomeNormalizationReason: 'none', stateAction: 'unchanged',
            queryVariantKinds: ['original'], vectorHitCount: 0, lexicalHitCount: 0, lexicalSearchStatus: 'not_configured', evidenceIds: [], evidenceCount: 0,
            generationStatus: 'not_run', citationValidation: 'not_run',
            generationAttemptCount: 0, generationFailurePhase: 'not_run',
            structuralValidationResult: 'not_run', citationValidationResult: 'not_run',
            citationValidationFailureSubtype: null, qualityJudgeInvoked: false,
            generationRetryInvoked: false, correctionInvoked: false, finalGenerationErrorClass: null,
            personalizedRulingClassifierInvoked: true, personalizedRulingClassification: 'general_information',
            personalizedRulingClassifierLatencyMs: 12, personalizedRulingClassifierFailureType: null,
            semanticTaskClassifierInvoked: false, semanticTaskClassification: 'not_run',
            semanticTaskClassifierLatencyMs: 0, semanticTaskClassifierFailureType: null,
            statePersistence: 'not_persisted', stateFingerprint: null,
            stageMs: { policy: 1, context: 1, retrieval: 1, generation: 0, citationValidation: 0 },
            finalCopy: 'I could not find enough reliable tafsir evidence to answer that safely.',
        });
        assert.equal((documents.get('noorTelemetry/trace-class') as { sanitizedTrace: NoorSanitizedTrace }).sanitizedTrace.case, 'modern-concept-paraphrase');
    });

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
                generationAttemptCount: 1, generationFailurePhase: 'none',
                structuralValidationResult: 'passed_first_attempt', citationValidationResult: 'passed_first_attempt',
                citationValidationFailureSubtype: null, qualityJudgeInvoked: true,
                generationRetryInvoked: false, correctionInvoked: false, finalGenerationErrorClass: null,
                personalizedRulingClassifierInvoked: true, personalizedRulingClassification: 'general_information',
                personalizedRulingClassifierLatencyMs: 4, personalizedRulingClassifierFailureType: null,
                semanticTaskClassifierInvoked: false, semanticTaskClassification: 'not_run',
                semanticTaskClassifierLatencyMs: 0, semanticTaskClassifierFailureType: null,
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
        set: async (value: unknown, options: unknown) => {
            if (path.startsWith('noorTelemetry/')) assert.deepEqual(options, { merge: true });
            else assert.deepEqual(options, { merge: false });
            documents.set(path, value);
        } });
    return { doc: reference, runTransaction: async (worker: (transaction: object) => Promise<unknown>) => worker({
        get: async (ref: { path: string }) => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) }),
        set: (ref: { path: string }, value: unknown, options: unknown) => { assert.deepEqual(options, { merge: false }); documents.set(ref.path, value); },
    }) };
}
