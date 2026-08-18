import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import {
    handleNoorRequest,
    type NoorHandlerDependencies,
    type NoorSemanticRetrievalResult,
} from '../../src/noor-rag/handler';
import { buildControlledRecoveryQuery, createValidatedConversationState } from '../../src/noor-rag/queryRewrite';
import type { NoorAnswer, NoorChatRequest, RetrievedEvidence } from '../../src/noor-rag/types';
import {
    BAQARAH_UNRELATED_PRODUCTION_REPLAY,
    BAQARAH_VIRTUES_PRODUCTION_REPLAY,
    FOOTBALL_PRODUCTION_REPLAY,
    NOAH_PRODUCTION_REPLAY,
    RIBA_PRODUCTION_REPLAY,
} from './productionReplayFixtures';

const CONFIG: NoorRuntimeConfig = {
    enabled: true,
    publicEnabled: true,
    ownerUids: [],
    activeCorpusVersion: '2026-08-10-v1',
    promptVersion: 'prompt-v1',
    generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768,
    pseudonymKeyVersion: 'key-v1',
    sourceThresholds: { ibn_kathir_en_abridged: 0.72, al_sadi_ar: 0.76 },
    maxChunksPerSource: 4,
    maxEvidenceCharacters: 5000,
};

const UID = 'fixture-user';

function citationAnswer(requestId: string, evidence: RetrievedEvidence): NoorAnswer {
    return {
        requestId,
        status: 'answered',
        answer: 'Grounded fixture answer. [S1]',
        citations: [{
            chunkId: evidence.chunk.chunkId,
            canonicalUnitId: evidence.chunk.canonicalUnitId,
            source: evidence.chunk.source,
            sourceTitle: evidence.chunk.sourceTitle,
            surah: evidence.chunk.surah,
            verseStart: evidence.chunk.verseStart,
            verseEnd: evidence.chunk.verseEnd,
            corpusVersion: evidence.chunk.corpusVersion,
        }],
    };
}

function retrievalResult(evidence: readonly RetrievedEvidence[]): NoorSemanticRetrievalResult {
    return {
        evidence,
        vectorHitCount: evidence.length,
        lexicalHitCount: 0,
        lexicalSearchStatus: 'available',
    };
}

function dependencies(overrides: Partial<NoorHandlerDependencies>): NoorHandlerDependencies {
    return {
        loadRuntimeConfig: async () => CONFIG,
        verifyCorpusReady: async () => true,
        readCompletedReplay: async () => null,
        resolveEntitlement: async () => ({ class: 'paid', expiresAt: null, source: 'revenuecat' }),
        claimUsage: async () => ({ kind: 'claimed', leaseOwnerId: 'lease', leaseExpiresAt: '2026-08-18T12:00:00.000Z' }),
        classifyPolicy: () => 'allowed',
        retrieveSemantic: async () => retrievalResult([]),
        retrieveExact: async () => [],
        generateGroundedAnswer: async input => citationAnswer(input.request.requestId, input.evidence[0]!),
        finalizeAnswered: async () => ({ kind: 'finalized' }),
        finalizeNonAnswer: async () => ({ kind: 'finalized' }),
        emitTelemetry: () => undefined,
        nowMs: () => 100,
        ...overrides,
    };
}

async function run(request: NoorChatRequest, value: NoorHandlerDependencies): Promise<NoorAnswer> {
    return handleNoorRequest({ request, uid: UID, invocationId: `invocation-${request.requestId}`, dependencies: value });
}

describe('production-shaped semantic replay', () => {
    it('accepts strong Noah evidence expressed with the corpus spelling Nuh', async () => {
        let generatedEvidence: readonly RetrievedEvidence[] = [];
        const value = dependencies({
            retrieveSemantic: async () => retrievalResult([NOAH_PRODUCTION_REPLAY]),
            generateGroundedAnswer: async input => {
                generatedEvidence = input.evidence;
                return citationAnswer(input.request.requestId, input.evidence[0]!);
            },
        });

        const response = await run({
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000001',
            question: 'Tell me about Noah.',
            history: [],
        }, value);

        assert.equal(response.status, 'answered');
        assert.deepEqual(generatedEvidence.map(item => item.chunk.chunkId), [NOAH_PRODUCTION_REPLAY.chunk.chunkId]);
    });

    it('rejects unrelated above-threshold football evidence before generation', async () => {
        let generationCalls = 0;
        let retrievalCalls = 0;
        const value = dependencies({
            retrieveSemantic: async () => {
                retrievalCalls += 1;
                return retrievalResult(FOOTBALL_PRODUCTION_REPLAY);
            },
            generateGroundedAnswer: async input => {
                generationCalls += 1;
                return citationAnswer(input.request.requestId, input.evidence[0]!);
            },
        });

        const response = await run({
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000002',
            question: 'What was the latest football score?',
            history: [],
        }, value);

        assert.equal(response.status, 'insufficient_evidence');
        assert.equal(retrievalCalls, 1);
        assert.equal(generationCalls, 0);
        assert.deepEqual(response.citations, []);
    });

    it('accepts production-shaped riba evidence with direct subject support', async () => {
        let generatedEvidence: readonly RetrievedEvidence[] = [];
        const value = dependencies({
            retrieveSemantic: async () => retrievalResult([RIBA_PRODUCTION_REPLAY]),
            generateGroundedAnswer: async input => {
                generatedEvidence = input.evidence;
                return citationAnswer(input.request.requestId, input.evidence[0]!);
            },
        });

        const response = await run({
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000003',
            question: 'What does the Quran say about riba?',
            history: [],
        }, value);

        assert.equal(response.status, 'answered');
        assert.deepEqual(generatedEvidence.map(item => item.chunk.chunkId), [RIBA_PRODUCTION_REPLAY.chunk.chunkId]);
    });

    it('keeps Al-Baqarah virtues evidence without treating an unrelated same-surah passage as answerable', async () => {
        const firstRequest: NoorChatRequest = {
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000008',
            question: 'Tell me about Surah Al-Baqarah.',
            history: [],
        };
        const state = createValidatedConversationState({
            request: firstRequest,
            response: citationAnswer(firstRequest.requestId, BAQARAH_VIRTUES_PRODUCTION_REPLAY),
            evidence: [BAQARAH_VIRTUES_PRODUCTION_REPLAY],
        });
        assert.ok(state);
        let generatedEvidence: readonly RetrievedEvidence[] = [];
        const value = dependencies({
            readValidatedConversationState: async () => state,
            retrieveSemantic: async () => retrievalResult([
                BAQARAH_UNRELATED_PRODUCTION_REPLAY,
                BAQARAH_VIRTUES_PRODUCTION_REPLAY,
            ]),
            generateGroundedAnswer: async input => {
                generatedEvidence = input.evidence;
                return citationAnswer(input.request.requestId, input.evidence[0]!);
            },
        });

        const response = await run({
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000009',
            question: 'But what is its significance in Islam?',
            history: [
                { role: 'user', content: firstRequest.question },
                { role: 'assistant', content: 'A grounded first-turn answer.' },
            ],
        }, value);

        assert.equal(response.status, 'answered');
        assert.deepEqual(generatedEvidence.map(item => item.chunk.chunkId), [
            BAQARAH_VIRTUES_PRODUCTION_REPLAY.chunk.chunkId,
        ]);
    });

    it('does not create a generic Quran-tafsir retry without a validated signal', () => {
        const query = buildControlledRecoveryQuery({
            request: {
                mode: 'chat',
                requestId: '10000000-0000-4000-8000-000000000004',
                question: 'What was the latest football score?',
                history: [],
            },
        });

        assert.equal(query, null);
    });

    it('judges contextual recovery evidence against the unanswered intent, not only the subject query', async () => {
        const firstRequest: NoorChatRequest = {
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000010',
            question: 'Tell me about Surah Al-Baqarah.',
            history: [],
        };
        const state = createValidatedConversationState({
            request: firstRequest,
            response: citationAnswer(firstRequest.requestId, BAQARAH_VIRTUES_PRODUCTION_REPLAY),
            evidence: [BAQARAH_VIRTUES_PRODUCTION_REPLAY],
        });
        assert.ok(state);
        let retrievalCalls = 0;
        let generationCalls = 0;
        const value = dependencies({
            readValidatedConversationState: async () => state,
            retrieveSemantic: async () => {
                retrievalCalls += 1;
                return retrievalCalls <= 2
                    ? retrievalResult([])
                    : retrievalResult([BAQARAH_UNRELATED_PRODUCTION_REPLAY]);
            },
            generateGroundedAnswer: async input => {
                generationCalls += 1;
                return citationAnswer(input.request.requestId, input.evidence[0]!);
            },
        });

        const response = await run({
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000011',
            question: 'But what is its significance in Islam?',
            history: [
                { role: 'user', content: firstRequest.question },
                { role: 'assistant', content: 'A grounded first-turn answer.' },
            ],
        }, value);

        assert.equal(retrievalCalls, 3);
        assert.equal(response.status, 'insufficient_evidence');
        assert.equal(generationCalls, 0);
    });

    it('keeps a safe abstention when an optional contextual retry fails', async () => {
        const firstRequest: NoorChatRequest = {
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000005',
            question: 'What does the Quran say about riba?',
            history: [],
        };
        const state = createValidatedConversationState({
            request: firstRequest,
            response: citationAnswer(firstRequest.requestId, RIBA_PRODUCTION_REPLAY),
            evidence: [RIBA_PRODUCTION_REPLAY],
        });
        assert.ok(state);
        let retrievalCalls = 0;
        const value = dependencies({
            readValidatedConversationState: async () => state,
            retrieveSemantic: async () => {
                retrievalCalls += 1;
                if (retrievalCalls <= 2) return retrievalResult(FOOTBALL_PRODUCTION_REPLAY);
                throw new Error('embedding provider unavailable during optional recovery');
            },
        });

        const response = await run({
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000006',
            question: 'What is the alternative?',
            history: [
                { role: 'user', content: firstRequest.question },
                { role: 'assistant', content: 'A grounded first-turn answer.' },
            ],
        }, value);

        assert.equal(retrievalCalls, 3);
        assert.equal(response.status, 'insufficient_evidence');
        assert.deepEqual(response.citations, []);
    });

    it('maps an initial retrieval provider exception to temporary unavailability', async () => {
        const response = await run({
            mode: 'chat',
            requestId: '10000000-0000-4000-8000-000000000007',
            question: 'What does the Quran say about riba?',
            history: [],
        }, dependencies({
            retrieveSemantic: async () => {
                throw new Error('initial repository failure');
            },
        }));

        assert.equal(response.status, 'temporarily_unavailable');
    });
});
