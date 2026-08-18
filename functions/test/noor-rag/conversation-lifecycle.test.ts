import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import { handleNoorRequest, type NoorHandlerDependencies } from '../../src/noor-rag/handler';
import type { ValidatedConversationState } from '../../src/noor-rag/queryRewrite';
import type { NoorAnswer, NoorChatRequest, RetrievedEvidence } from '../../src/noor-rag/types';
import { RIBA_PRODUCTION_REPLAY } from './productionReplayFixtures';

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

function answered(requestId: string, evidence: RetrievedEvidence): NoorAnswer {
    return {
        requestId,
        status: 'answered',
        answer: 'A grounded riba answer. [S1]',
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

interface LifecycleHarness {
    dependencies: NoorHandlerDependencies;
    queries: string[];
    state(): ValidatedConversationState | null;
}

function lifecycleHarness(generate: (request: NoorChatRequest, evidence: readonly RetrievedEvidence[]) => unknown): LifecycleHarness {
    let persistedState: ValidatedConversationState | null = null;
    const queries: string[] = [];
    const dependencies: NoorHandlerDependencies = {
        loadRuntimeConfig: async () => CONFIG,
        verifyCorpusReady: async () => true,
        readCompletedReplay: async () => null,
        resolveEntitlement: async () => ({ class: 'paid', expiresAt: null, source: 'revenuecat' }),
        claimUsage: async () => ({ kind: 'claimed', leaseOwnerId: 'lease', leaseExpiresAt: '2026-08-18T12:00:00.000Z' }),
        classifyPolicy: () => 'allowed',
        retrieveSemantic: async input => {
            queries.push(input.query);
            return {
                evidence: [RIBA_PRODUCTION_REPLAY],
                vectorHitCount: 4,
                lexicalHitCount: 2,
                lexicalSearchStatus: 'available',
            };
        },
        retrieveExact: async () => [],
        generateGroundedAnswer: async input => generate(input.request as NoorChatRequest, input.evidence),
        finalizeAnswered: async () => ({ kind: 'finalized' }),
        finalizeNonAnswer: async () => ({ kind: 'finalized' }),
        readValidatedConversationState: async () => persistedState,
        writeValidatedConversationState: async input => {
            persistedState = input.state;
        },
        emitTelemetry: () => undefined,
        nowMs: () => Date.parse('2026-08-18T10:00:00.000Z'),
    };
    return { dependencies, queries, state: () => persistedState };
}

async function execute(request: NoorChatRequest, harness: LifecycleHarness): Promise<NoorAnswer> {
    return handleNoorRequest({
        request,
        uid: 'lifecycle-user',
        invocationId: `invocation-${request.requestId}`,
        dependencies: harness.dependencies,
    });
}

const FIRST_TURN: NoorChatRequest = {
    mode: 'chat',
    requestId: '20000000-0000-4000-8000-000000000001',
    question: 'What does the Quran say about riba?',
    history: [],
};

const FOLLOW_UP: NoorChatRequest = {
    mode: 'chat',
    requestId: '20000000-0000-4000-8000-000000000002',
    question: 'What is an Islamic alternative?',
    history: [
        { role: 'user', content: FIRST_TURN.question },
        { role: 'assistant', content: 'A grounded first-turn answer.' },
    ],
};

describe('validated conversation-state lifecycle', () => {
    it('earns state from a validated first turn and uses it in the second-turn retrieval', async () => {
        const harness = lifecycleHarness((request, evidence) => answered(request.requestId, evidence[0]!));

        const first = await execute(FIRST_TURN, harness);
        assert.equal(first.status, 'answered');
        assert.ok(harness.state());

        const second = await execute(FOLLOW_UP, harness);
        assert.equal(second.status, 'answered');
        assert.equal(harness.queries.slice(1)[0], 'What is an Islamic alternative?');
        assert.match(harness.queries.slice(1)[1] ?? '', /Regarding .*riba/i);
    });

    it('does not persist state from invalid citations or fabricate it for the follow-up', async () => {
        let generationCalls = 0;
        const harness = lifecycleHarness(request => {
            generationCalls += 1;
            return {
                requestId: request.requestId,
                status: 'answered',
                answer: 'This output has no validated citations.',
                citations: [],
            };
        });

        const first = await execute(FIRST_TURN, harness);
        assert.equal(first.status, 'temporarily_unavailable');
        assert.equal(harness.state(), null);

        const second = await execute(FOLLOW_UP, harness);
        assert.equal(second.status, 'insufficient_evidence');
        assert.equal(harness.state(), null);
        assert.equal(generationCalls, 1);
        assert.deepEqual(harness.queries, [FIRST_TURN.question]);
    });
});
