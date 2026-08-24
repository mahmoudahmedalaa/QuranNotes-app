import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import {
    handleNoorRequest,
    type NoorHandlerDependencies,
    type NoorSanitizedTrace,
} from '../../src/noor-rag/handler';
import {
    buildChatQueryPlan,
    buildSemanticTaskFallbackInput,
    createValidatedConversationState,
    type ChatQueryPlan,
} from '../../src/noor-rag/queryRewrite';
import type { NoorAnswer, NoorChatRequest, RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';
import { parseNoorRequest } from '../../src/noor-rag/validation';

type ExpectedTask = 'entity_summary' | 'point_question';

interface FocusPolarityFixture {
    id: string;
    category: 'broad_control' | 'excluded_focus' | 'positive_focus' | 'mixed_intent' | 'cross_surah';
    input: string;
    expectedTask: ExpectedTask;
    expectedSurah: number | null;
    expectedFallback: boolean;
}

const FIXTURE_PATH = resolve(process.cwd(), 'test/noor-rag/fixtures/planner-focus-polarity.json');
const FIXTURES = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as FocusPolarityFixture[];
const PRIOR_REQUEST_ID = '31000000-0000-4000-8000-000000000000';
const PRIOR_QUESTION = 'What are the main themes of Surah Al-Baqarah?';
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

function request(question: string, requestId = PRIOR_REQUEST_ID): NoorChatRequest {
    return { mode: 'chat', requestId, question, history: [] };
}

function baqarahEvidence(): RetrievedEvidence {
    const chunk: TafsirChunk = {
        chunkId: 'baqarah-prior-chunk',
        canonicalUnitId: 'baqarah-prior-unit',
        chunkIndex: 0,
        source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir',
        language: 'en',
        surah: 2,
        verseStart: 1,
        verseEnd: 5,
        originalStart: 0,
        originalEnd: 20,
        originalText: 'A grounded Al-Baqarah overview.',
        retrievalText: 'A grounded Al-Baqarah overview.',
        corpusVersion: 'corpus-v1',
        contentHash: 'baqarah-prior-hash',
        tokenCount: 5,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
    return { kind: 'semantic', promptSourceId: 'S1', chunk, similarity: 0.9 };
}

function priorConversationState() {
    const priorRequest = request(PRIOR_QUESTION);
    const evidence = baqarahEvidence();
    const response: NoorAnswer = {
        requestId: priorRequest.requestId,
        status: 'answered',
        answer: 'Grounded Al-Baqarah themes. [S1]',
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
    const state = createValidatedConversationState({
        request: priorRequest,
        response,
        evidence: [evidence],
        taskPlan: buildChatQueryPlan({ request: priorRequest }),
    }, 100);
    assert.ok(state);
    return { state, response };
}

function requestId(index: number): string {
    return `32000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function assertPlan(
    fixture: FocusPolarityFixture,
    plan: ChatQueryPlan,
    fallbackInvoked: boolean,
): void {
    assert.equal(plan.taskType, fixture.expectedTask, fixture.id);
    assert.equal(plan.entity?.surahNumber ?? null, fixture.expectedSurah, fixture.id);
    assert.equal(plan.contextSelected, false, fixture.id);
    assert.equal(fallbackInvoked, fixture.expectedFallback, fixture.id);
}

describe('Noor point-focus polarity shared fixture', () => {
    it('enforces the invariant through the raw planner helper', () => {
        for (const fixture of FIXTURES) {
            const currentRequest = request(fixture.input);
            const plan = buildChatQueryPlan({ request: currentRequest });
            const fallback = buildSemanticTaskFallbackInput({ request: currentRequest, deterministicPlan: plan });
            assertPlan(fixture, plan, fallback !== null);
        }
    });

    it('enforces the invariant through request parsing and the full handler planning path after Al-Baqarah', async () => {
        const prior = priorConversationState();
        for (const [index, fixture] of FIXTURES.entries()) {
            const traces: NoorSanitizedTrace[] = [];
            let semanticFallbackCalls = 0;
            const parsed = parseNoorRequest({
                mode: 'chat',
                requestId: requestId(index),
                question: fixture.input,
                history: [
                    { role: 'user', content: PRIOR_QUESTION },
                    { role: 'assistant', content: prior.response.answer },
                ],
            });
            assert.equal(parsed.mode, 'chat', fixture.id);
            const dependencies: NoorHandlerDependencies = {
                loadRuntimeConfig: async () => CONFIG,
                verifyCorpusReady: async () => true,
                readCompletedReplay: async () => null,
                resolveEntitlement: async () => ({ class: 'paid', expiresAt: null, source: 'revenuecat' }),
                claimUsage: async () => ({
                    kind: 'claimed', leaseOwnerId: 'polarity-review', leaseExpiresAt: '2026-08-25T00:02:00.000Z',
                }),
                classifyPolicy: () => 'allowed',
                classifyPersonalizedRuling: async () => ({
                    kind: 'success',
                    classification: 'general_information',
                    reasonCode: 'general_religious_information',
                }),
                classifySemanticTask: async () => {
                    semanticFallbackCalls += 1;
                    return { kind: 'success', taskType: fixture.expectedTask };
                },
                retrieveSemantic: async () => [],
                retrieveEntitySummary: async () => ({ evidence: [], candidateCount: 0, anchorVerses: [] }),
                retrieveExact: async () => [],
                generateGroundedAnswer: async () => { throw new Error('generation must not run without evidence'); },
                finalizeAnswered: async () => ({ kind: 'finalized' }),
                finalizeNonAnswer: async () => ({ kind: 'finalized' }),
                emitTelemetry: () => undefined,
                emitSanitizedTrace: trace => { traces.push(trace); },
                nowMs: () => 100,
            };
            await handleNoorRequest({
                request: parsed,
                uid: 'polarity-review-user',
                invocationId: `polarity-${index}`,
                conversationState: prior.state,
                traceCase: fixture.id,
                dependencies,
            });
            const trace = traces[0];
            assert.ok(trace, fixture.id);
            assert.equal(trace.taskType, fixture.expectedTask, fixture.id);
            assert.deepEqual(
                trace.resolvedEntityIds,
                fixture.expectedSurah === null ? [] : [`surah:${fixture.expectedSurah}`],
                fixture.id,
            );
            assert.equal(trace.contextSelected, false, fixture.id);
            assert.equal(semanticFallbackCalls > 0, fixture.expectedFallback, fixture.id);
        }
    });

    it('enforces the same fixture through the compiled deployment JavaScript', () => {
        const compiled = require(resolve(process.cwd(), 'lib/noor-rag/queryRewrite.js')) as {
            buildChatQueryPlan(input: { request: NoorChatRequest }): ChatQueryPlan;
            buildSemanticTaskFallbackInput(input: {
                request: NoorChatRequest;
                deterministicPlan: ChatQueryPlan;
            }): unknown | null;
        };
        for (const fixture of FIXTURES) {
            const currentRequest = request(fixture.input);
            const plan = compiled.buildChatQueryPlan({ request: currentRequest });
            const fallback = compiled.buildSemanticTaskFallbackInput({ request: currentRequest, deterministicPlan: plan });
            assertPlan(fixture, plan, fallback !== null);
        }
    });
});
