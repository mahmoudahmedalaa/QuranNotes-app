import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyPolicy } from '../../src/noor-rag/policy';
import {
    buildChatQueryPlan,
    createValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import {
    handleNoorRequest,
    type NoorHandlerDependencies,
    type NoorSanitizedTrace,
} from '../../src/noor-rag/handler';
import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import type { NoorAnswer, NoorRequest, RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const CONFIG: NoorRuntimeConfig = {
    enabled: true,
    publicEnabled: true,
    ownerUids: [],
    activeCorpusVersion: 'corpus-v1',
    promptVersion: 'prompt-v1',
    generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768,
    pseudonymKeyVersion: 'key-v1',
    sourceThresholds: { ibn_kathir_en_abridged: 0.6, al_sadi_ar: 0.7 },
    maxChunksPerSource: 4,
    maxEvidenceCharacters: 5000,
};

function evidence(): RetrievedEvidence {
    const chunk: TafsirChunk = {
        chunkId: 'chunk-riba-secret',
        canonicalUnitId: 'unit-riba-secret',
        chunkIndex: 0,
        source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir',
        language: 'en',
        surah: 2,
        verseStart: 275,
        verseEnd: 279,
        originalStart: 0,
        originalEnd: 19,
        originalText: 'Private provider source text',
        retrievalText: 'Riba tafsir evidence',
        corpusVersion: 'corpus-v1',
        contentHash: 'hash',
        tokenCount: 4,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
    return { kind: 'semantic', promptSourceId: 'S1', chunk, similarity: 0.92 };
}

const ANSWERED: NoorAnswer = {
    requestId: REQUEST_ID,
    status: 'answered',
    answer: 'Provider answer text must not enter the trace. [S1]',
    citations: [{
        chunkId: 'chunk-riba-secret',
        canonicalUnitId: 'unit-riba-secret',
        source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir',
        surah: 2,
        verseStart: 275,
        verseEnd: 279,
        corpusVersion: 'corpus-v1',
    }],
};

describe('riba follow-up sanitized trace', () => {
    it('keeps doctrinal riba questions general and emits only aggregate safe trace fields', async () => {
        assert.equal(classifyPolicy('Is riba haram'), 'allowed');
        assert.equal(classifyPolicy('Is riba haram?'), 'allowed');
        assert.equal(classifyPolicy('Should I take this loan for my situation?'), 'personal_ruling');

        const firstQuestion: NoorRequest = {
            mode: 'chat',
            requestId: REQUEST_ID,
            question: 'Is riba haram?',
            history: [],
        };
        const followUpQuestion: NoorRequest = {
            mode: 'chat',
            requestId: '22222222-2222-4222-8222-222222222222',
            question: 'What is the Islamic alternative?',
            history: [
                { role: 'user', content: 'Is riba haram?' },
                { role: 'assistant', content: 'Provider answer text and secret-error details' },
            ],
        };
        const firstEvidence = [evidence()];
        const state = createValidatedConversationState({
            request: firstQuestion,
            response: ANSWERED,
            evidence: firstEvidence,
        });
        assert.ok(state);

        const plan = buildChatQueryPlan({
            request: followUpQuestion,
            validatedConversationState: state,
        });
        assert.deepEqual(plan.variants.map(variant => variant.kind), ['original', 'context_enriched']);
        assert.equal(plan.variants.length, 2);
        assert.equal(plan.contextSelected, true);
        assert.match(plan.variants[1]!.query, /riba/i);
        assert.doesNotMatch(plan.variants[1]!.query, /Provider answer|secret-error/i);

        const traces: NoorSanitizedTrace[] = [];
        const queries: string[] = [];
        const dependencies: NoorHandlerDependencies = {
            loadRuntimeConfig: async () => CONFIG,
            verifyCorpusReady: async () => true,
            readCompletedReplay: async () => null,
            resolveEntitlement: async () => ({ class: 'paid', expiresAt: null, source: 'revenuecat' }),
            claimUsage: async () => ({ kind: 'claimed', leaseOwnerId: 'lease', leaseExpiresAt: '2026-08-15T00:00:00.000Z' }),
            classifyPolicy: () => 'allowed',
            retrieveSemantic: async ({ query }) => {
                queries.push(query);
                return { evidence: firstEvidence, vectorHitCount: 4, lexicalHitCount: 2, lexicalSearchStatus: 'available' as const };
            },
            retrieveExact: async () => firstEvidence,
            generateGroundedAnswer: async ({ request: currentRequest }) => ({
                ...ANSWERED,
                requestId: currentRequest.requestId,
            }),
            finalizeAnswered: async () => ({ kind: 'finalized' }),
            finalizeNonAnswer: async () => ({ kind: 'finalized' }),
            emitTelemetry: () => undefined,
            emitSanitizedTrace: async trace => {
                await new Promise(resolve => setTimeout(resolve, 0));
                traces.push(trace);
            },
            readValidatedConversationState: async () => state,
            writeValidatedConversationState: async () => undefined,
            nowMs: () => 100,
        };

        const response = await handleNoorRequest({
            request: followUpQuestion,
            uid: 'user@example.com',
            invocationId: 'invocation-secret',
            conversationState: state,
            traceCase: 'riba-followup',
            dependencies,
        });
        assert.equal(response.status, 'answered');
        assert.deepEqual(queries, [
            'What is the Islamic alternative?',
            'What is the Islamic alternative? Regarding riba.',
        ]);

        const trace = traces.at(-1) as NoorSanitizedTrace;
        assert.deepEqual(trace, {
            case: 'riba-followup',
            policy: 'allowed',
            status: 'answered',
            citationCount: 1,
            conversationState: 'validated_subject_and_evidence',
            contextSelected: true,
            selectedPriorUserContext: 'validated_prior_subject',
            queryVariantCount: 2,
            queryVariantKinds: ['original', 'context_enriched'],
            vectorHitCount: 8,
            lexicalHitCount: 4,
            lexicalSearchStatus: 'available',
            evidenceIds: ['E1'],
            evidenceCount: 1,
            generationStatus: 'answered',
            citationValidation: 'passed',
            stageMs: { policy: 0, context: 0, retrieval: 0, generation: 0, citationValidation: 0 },
            finalCopy: 'Answer available with validated tafsir citations.',
        });

        const serialized = JSON.stringify(trace);
        for (const forbidden of [
            'Is riba haram',
            'Provider answer',
            'secret-error',
            'Private provider',
            'chunk-riba-secret',
            '11111111-1111-4111-8111-111111111111',
            'user@example.com',
        ]) {
            assert.equal(serialized.includes(forbidden), false);
        }
    });
});
