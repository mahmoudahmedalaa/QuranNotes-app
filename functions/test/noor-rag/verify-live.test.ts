import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as verifyLiveModule from '../../scripts/noor-rag/verify-live';
import type { NoorAnswer, NoorRequest } from '../../src/noor-rag/types';

interface PacerOptions {
    intervalMs?: number;
    nowMs(): number;
    sleep(milliseconds: number): Promise<void>;
}

type PacerFactory = (options: PacerOptions) => () => Promise<void>;

interface EvidenceExpectation {
    source: string;
    canonicalUnitId: string;
    chunkIds: readonly string[];
}

interface CitationEvidence {
    source: string;
    canonicalUnitId: string;
    chunkId: string;
}

type CitationEvidenceValidator = (
    goldenCase: { exact?: unknown; expectedEvidence: readonly EvidenceExpectation[] },
    citations: readonly CitationEvidence[],
) => boolean;

type TransportErrorClassifier = (error: unknown) => string;
type HistoryAnswerBounder = (answer: string) => string;
type SafeAbstentionValidator = (answer: NoorAnswer, trace: Record<string, unknown> | null) => boolean;

interface SequentialRunnerInput {
    questions: readonly string[];
    expectedFinalStatus: NoorAnswer['status'];
    credentials: { endpoint: string; firebaseIdToken: string; appCheckToken: string };
    paceRequest(): Promise<void>;
    call(request: NoorRequest): Promise<{ answer: NoorAnswer; latencyMs: number }>;
    readTrace(requestId: string): Promise<unknown>;
    validateAnsweredCitations(answer: NoorAnswer): boolean;
    providerReplayBudget?: { availabilityFailures: number };
    sleep?: (milliseconds: number) => Promise<void>;
}

type SequentialRunner = (input: SequentialRunnerInput) => Promise<{
    requestCount: number;
    completed: boolean;
    turns: Array<{
        turnNumber: number;
        requestId: string;
        responseStatus: NoorAnswer['status'];
        failureSubtype: string | null;
        citationValidation: string;
        qualityJudgeInvoked: boolean;
        stateExpected: boolean;
        statePersisted: boolean;
        contextSelected: boolean;
        contextualQueryProduced: boolean;
        passed: boolean;
        providerReplayUsed: boolean;
    }>;
}>;

const ANSWERED = (requestId: string): NoorAnswer => ({
    requestId,
    status: 'answered',
    answer: 'Grounded answer. [S1]',
    citations: [{
        chunkId: 'chunk-1', canonicalUnitId: 'unit-1', source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir', surah: 2, verseStart: 275, verseEnd: 279,
        corpusVersion: '2026-08-10-v1',
    }],
});

function answeredTrace(requestId: string, followUp: boolean): object {
    return {
        requestId,
        generationStatus: 'answered',
        generationFailurePhase: 'none',
        finalGenerationErrorClass: null,
        citationValidation: 'passed',
        qualityJudgeInvoked: true,
        answerabilityReason: 'sufficient',
        statePersistence: 'persisted',
        stateFingerprint: 'a'.repeat(64),
        conversationState: followUp ? 'validated_subject_and_evidence' : 'none',
        contextSelected: followUp,
        queryVariantKinds: followUp ? ['original', 'context_enriched'] : ['original'],
    };
}

describe('Noor authenticated live verifier', () => {
    it('accepts only a grounded safe abstention for an insufficient-evidence gate', () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.safeAbstentionSatisfied, 'function');
        const validate = module.safeAbstentionSatisfied as SafeAbstentionValidator;
        const trace = {
            taskType: 'point_question',
            contextSelected: false,
            preAnswerabilityEvidenceIds: ['E1'],
            postAnswerabilityEvidenceIds: [],
            answerabilityReason: 'insufficient',
            generationStatus: 'not_run',
            generationFailurePhase: 'not_run',
            citationValidation: 'not_run',
            qualityJudgeInvoked: false,
            statePersistence: 'not_persisted',
        };
        assert.equal(validate({ requestId: 'id', status: 'insufficient_evidence', answer: 'safe', citations: [] }, trace), true);
        assert.equal(validate({ requestId: 'id', status: 'answered', answer: 'unsafe', citations: [] }, trace), false);
        assert.equal(validate({ requestId: 'id', status: 'insufficient_evidence', answer: 'safe', citations: [] }, {
            ...trace,
            postAnswerabilityEvidenceIds: ['E1'],
        }), false);
    });

    it('paces requests to respect the production rolling-minute limit', async () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.createLiveRequestPacer, 'function');
        const createPacer = module.createLiveRequestPacer as PacerFactory;
        let now = 1_000;
        const sleeps: number[] = [];
        const pace = createPacer({
            nowMs: () => now,
            sleep: async milliseconds => {
                sleeps.push(milliseconds);
                now += milliseconds;
            },
        });

        await pace();
        now += 3_000;
        await pace();
        now += 13_000;
        await pace();

        assert.deepEqual(sleeps, [12_000, 2_000]);
    });

    it('accepts one grounded golden evidence group for semantic chat but keeps exact lookup strict', () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.expectedCitationEvidenceSatisfied, 'function');
        const validate = module.expectedCitationEvidenceSatisfied as CitationEvidenceValidator;
        const expectedEvidence = [
            { source: 'ibn_kathir_en_abridged', canonicalUnitId: 'unit-riba', chunkIds: ['chunk-1', 'chunk-2'] },
            { source: 'al_sadi_ar', canonicalUnitId: 'unit-riba-ar', chunkIds: ['chunk-ar'] },
        ];
        const citations = [
            { source: 'ibn_kathir_en_abridged', canonicalUnitId: 'unit-riba', chunkId: 'chunk-1' },
        ];

        assert.equal(validate({ expectedEvidence }, citations), true);
        assert.equal(validate({ expectedEvidence }, [{ ...citations[0]!, canonicalUnitId: 'wrong-unit' }]), false);
        assert.equal(validate({ exact: {}, expectedEvidence }, citations), false);
    });

    it('preserves only allowlisted transport diagnostics', () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.classifyLiveTransportError, 'function');
        const classify = module.classifyLiveTransportError as TransportErrorClassifier;

        assert.equal(classify(new Error('request_id_mismatch')), 'request_id_mismatch');
        assert.equal(classify(new Error('temporarily_unavailable')), 'temporarily_unavailable');
        assert.equal(classify(new Error('provider response contained secret details')), 'network_error');
        assert.equal(classify('not-an-error'), 'network_error');
    });

    it('bounds replayed assistant history to the production per-turn contract', () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.boundedLiveHistoryAnswer, 'function');
        const bound = module.boundedLiveHistoryAnswer as HistoryAnswerBounder;
        const result = bound('😀'.repeat(1_001));

        assert.equal([...result].length, 1_000);
        assert.equal(result, '😀'.repeat(1_000));
    });

    it('fails a sequential case immediately when turn one is not answered', async () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.executeSequentialLiveTurns, 'function');
        const runTurns = module.executeSequentialLiveTurns as SequentialRunner;
        let callCount = 0;
        const result = await runTurns({
            questions: ['What does the Quran say about riba?', 'What is an Islamic alternative?'],
            expectedFinalStatus: 'answered',
            credentials: { endpoint: 'https://example.com', firebaseIdToken: 'token', appCheckToken: 'app-check' },
            paceRequest: async () => undefined,
            call: async request => {
                callCount += 1;
                return {
                    answer: callCount === 1
                        ? { requestId: request.requestId, status: 'temporarily_unavailable', answer: 'safe', citations: [] }
                        : ANSWERED(request.requestId),
                    latencyMs: 10,
                };
            },
            readTrace: async requestId => ({
                ...answeredTrace(requestId, false),
                generationStatus: 'temporarily_unavailable',
                generationFailurePhase: 'citation_validation',
                finalGenerationErrorClass: 'citation_validation_failure',
                citationValidation: 'failed',
                qualityJudgeInvoked: false,
                statePersistence: 'not_persisted',
                stateFingerprint: null,
            }),
            validateAnsweredCitations: () => true,
        });

        assert.equal(callCount, 1);
        assert.equal(result.requestCount, 1);
        assert.equal(result.completed, false);
        assert.equal(result.turns.length, 1);
        assert.equal(result.turns[0]?.passed, false);
        assert.equal(result.turns[0]?.responseStatus, 'temporarily_unavailable');
        assert.equal(result.turns[0]?.failureSubtype, 'citation_validation_failure');
    });

    it('replays one provider availability failure after ten seconds with a fresh request ID', async () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        const runTurns = module.executeSequentialLiveTurns as SequentialRunner;
        const requests: NoorRequest[] = [];
        const delays: number[] = [];
        const traces = new Map<string, object>();
        const result = await runTurns({
            questions: ['What does the Quran say about patience?'],
            expectedFinalStatus: 'answered',
            providerReplayBudget: { availabilityFailures: 0 },
            credentials: { endpoint: 'https://example.com', firebaseIdToken: 'token', appCheckToken: 'app-check' },
            paceRequest: async () => undefined,
            sleep: async milliseconds => { delays.push(milliseconds); },
            call: async request => {
                requests.push(request);
                const first = requests.length === 1;
                traces.set(request.requestId, first ? {
                    ...answeredTrace(request.requestId, false),
                    generationStatus: 'temporarily_unavailable',
                    generationFailurePhase: 'provider',
                    finalGenerationErrorClass: 'provider_transient_failure',
                    citationValidation: 'not_run',
                    qualityJudgeInvoked: false,
                    statePersistence: 'not_persisted',
                    stateFingerprint: null,
                } : answeredTrace(request.requestId, false));
                return {
                    answer: first
                        ? { requestId: request.requestId, status: 'temporarily_unavailable', answer: 'safe', citations: [] }
                        : ANSWERED(request.requestId),
                    latencyMs: 10,
                };
            },
            readTrace: async requestId => traces.get(requestId) ?? null,
            validateAnsweredCitations: () => true,
        });

        assert.equal(result.completed, true);
        assert.equal(result.requestCount, 2);
        assert.deepEqual(delays, [10_000]);
        assert.notEqual(requests[0]?.requestId, requests[1]?.requestId);
        assert.equal(requests[0]?.mode === 'chat' ? requests[0].question : '', requests[1]?.mode === 'chat' ? requests[1].question : '');
        assert.equal(result.turns[0]?.providerReplayUsed, true);
        assert.equal(result.turns[0]?.failureSubtype, null);
    });

    it('blocks after a replayed provider failure and never performs a third attempt', async () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        const runTurns = module.executeSequentialLiveTurns as SequentialRunner;
        let calls = 0;
        const traces = new Map<string, object>();
        const budget = { availabilityFailures: 0 };
        const result = await runTurns({
            questions: ['What does the Quran say about patience?'],
            expectedFinalStatus: 'answered',
            providerReplayBudget: budget,
            credentials: { endpoint: 'https://example.com', firebaseIdToken: 'token', appCheckToken: 'app-check' },
            paceRequest: async () => undefined,
            sleep: async () => undefined,
            call: async request => {
                calls += 1;
                traces.set(request.requestId, {
                    ...answeredTrace(request.requestId, false),
                    generationStatus: 'temporarily_unavailable',
                    generationFailurePhase: 'provider',
                    finalGenerationErrorClass: 'provider_timeout',
                    citationValidation: 'not_run',
                    qualityJudgeInvoked: false,
                    statePersistence: 'not_persisted',
                    stateFingerprint: null,
                });
                return {
                    answer: { requestId: request.requestId, status: 'temporarily_unavailable', answer: 'safe', citations: [] },
                    latencyMs: 10,
                };
            },
            readTrace: async requestId => traces.get(requestId) ?? null,
            validateAnsweredCitations: () => true,
        });

        assert.equal(result.completed, false);
        assert.equal(calls, 2);
        assert.equal(budget.availabilityFailures, 2);
        assert.equal(result.turns[0]?.failureSubtype, 'provider_timeout');
    });

    it('reports and asserts state before sending turn two, then verifies contextual selection', async () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.executeSequentialLiveTurns, 'function');
        const runTurns = module.executeSequentialLiveTurns as SequentialRunner;
        const requests: NoorRequest[] = [];
        const traces = new Map<string, object>();
        const result = await runTurns({
            questions: ['What does the Quran say about riba?', 'What is an Islamic alternative?'],
            expectedFinalStatus: 'answered',
            credentials: { endpoint: 'https://example.com', firebaseIdToken: 'token', appCheckToken: 'app-check' },
            paceRequest: async () => undefined,
            call: async request => {
                requests.push(request);
                traces.set(request.requestId, answeredTrace(request.requestId, requests.length === 2));
                return { answer: ANSWERED(request.requestId), latencyMs: 12 };
            },
            readTrace: async requestId => traces.get(requestId) ?? null,
            validateAnsweredCitations: () => true,
        });

        assert.equal(result.completed, true);
        assert.equal(result.requestCount, 2);
        assert.equal(result.turns[0]?.statePersisted, true);
        assert.equal(result.turns[1]?.contextSelected, true);
        assert.equal(result.turns[1]?.contextualQueryProduced, true);
        assert.equal(result.turns.every(turn => turn.passed), true);
        assert.equal(requests[1]?.mode, 'chat');
        assert.equal(requests[1]?.mode === 'chat' ? requests[1].history.length : 0, 2);
    });
});
