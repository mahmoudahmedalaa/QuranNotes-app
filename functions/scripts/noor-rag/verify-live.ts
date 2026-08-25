import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { NoorAnswer, NoorRequest } from '../../src/noor-rag/types';
import { CANONICAL_INSUFFICIENT_EVIDENCE } from '../../src/noor-rag/outcome';
import { parseNoorAnswer } from '../../src/noor-rag/validation';
import {
    buildCallableRequest,
    parseLiveSmokeCredentials,
    type LiveSmokeCredentials,
} from './live-smoke';
import {
    parseGoldenManifest,
    type GoldenCase,
    type GoldenManifest,
} from './golden';
import { readCorpusArtifacts } from './evaluate-golden';
import { LOCKED_PROJECT } from './verify-index';

interface LiveCitation {
    chunkId: string;
    canonicalUnitId: string;
    source: string;
    corpusVersion: string;
    verse: string;
    rank: number;
}

interface LiveCaseResult {
    id: string;
    requestCount: number;
    expectedStatus: string;
    actualStatus: string;
    passed: boolean;
    activeCorpusVersion: string | null;
    retrievedSourceIds: readonly string[];
    retrievedUnitIds: readonly string[];
    retrievedChunkIds: readonly string[];
    rankingPositions: Record<string, number | null>;
    citations: readonly LiveCitation[];
    latencyMs: number;
    errorClass: string | null;
    turns: readonly LiveTurnResult[];
}

interface LiveTurnTrace {
    requestId: string;
    taskType: string;
    generationStatus: string;
    generationFailurePhase: string;
    finalGenerationErrorClass: string | null;
    backendFailureSubtype: string | null;
    citationValidation: string;
    structuralValidationResult: string;
    citationValidationResult: string;
    qualityJudgeInvoked: boolean;
    answerabilityReason: string;
    preAnswerabilityEvidenceIds: readonly string[];
    postAnswerabilityEvidenceIds: readonly string[];
    statePersistence: string;
    stateAction: string;
    answeredUsageIncrement: number | null;
    stateFingerprint: string | null;
    conversationState: string;
    contextSelected: boolean;
    queryVariantKinds: readonly string[];
}

interface LiveTurnResult {
    turnNumber: number;
    requestId: string;
    question: string;
    responseStatus: NoorAnswer['status'];
    generationFailurePhase: string;
    failureSubtype: LiveFailureSubtype | null;
    verifierFailureReason: string | null;
    citationValidation: string;
    qualityJudgeInvoked: boolean;
    stateExpected: boolean;
    stateFound: boolean;
    statePersisted: boolean;
    stateFingerprint: string | null;
    contextSelected: boolean;
    contextualQueryProduced: boolean;
    passed: boolean;
    latencyMs: number;
    providerReplayUsed: boolean;
}

export type LiveFailureSubtype =
    | 'provider_transient_failure'
    | 'provider_timeout'
    | 'structured_generation_failure'
    | 'citation_validation_failure'
    | 'answer_quality_failure'
    | 'policy_failure'
    | 'state_failure'
    | 'retrieval_failure'
    | 'schema_outcome_contract_failure';

export interface LiveProviderReplayBudget { availabilityFailures: number }

interface SequentialLiveTurnsInput {
    questions: readonly string[];
    expectedFinalStatus: NoorAnswer['status'];
    call(request: NoorRequest): Promise<{ answer: NoorAnswer; latencyMs: number }>;
    readTrace(requestId: string): Promise<unknown>;
    validateAnsweredCitations(answer: NoorAnswer): boolean;
    providerReplayBudget?: LiveProviderReplayBudget;
    sleep?: (milliseconds: number) => Promise<void>;
}

interface SequentialLiveTurnsResult {
    requestCount: number;
    completed: boolean;
    turns: LiveTurnResult[];
    finalAnswer: NoorAnswer | null;
}

interface LiveVerificationReport {
    status: 'PASSED' | 'FAILED' | 'UNVERIFIED';
    endpoint: string | null;
    corpusVersion: string;
    caseCount: number;
    requestCount: number;
    passedCaseCount: number;
    failedCaseIds: readonly string[];
    results?: readonly LiveCaseResult[];
    reason?: string;
}

const LIVE_CASE_IDS = [
    'riba-direct-01',
    'riba-followup-01',
    'arrogance-haram-01',
    'patience-direct-01',
    'noah-story-01',
    'exact-verse-2-153',
    'unsupported-unrelated-01',
    'policy-personal-ruling-01',
] as const;
const MAX_HISTORY_ANSWER_CHARACTERS = 1_000;
const DEFAULT_REQUEST_INTERVAL_MS = 15_000;
const PROVIDER_REPLAY_DELAY_MS = 10_000;

export interface LiveRequestPacerOptions {
    intervalMs?: number;
    nowMs?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
}

export function createLiveRequestPacer(
    options: LiveRequestPacerOptions = {},
): () => Promise<void> {
    const intervalMs = options.intervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
    const nowMs = options.nowMs ?? Date.now;
    const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    if (!Number.isSafeInteger(intervalMs) || intervalMs < 0) {
        throw new Error('Invalid live verification request interval');
    }
    let previousRequestAt: number | null = null;
    return async (): Promise<void> => {
        const now = nowMs();
        if (!Number.isFinite(now)) throw new Error('Invalid live verification clock');
        if (previousRequestAt !== null) {
            const remaining = intervalMs - (now - previousRequestAt);
            if (remaining > 0) await sleep(remaining);
        }
        previousRequestAt = nowMs();
    };
}

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function caseById(manifest: GoldenManifest, id: string): GoldenCase {
    const value = manifest.cases.find(item => item.id === id);
    if (!value) throw new Error(`Live golden case is missing: ${id}`);
    return value;
}

function safeErrorClass(status: number): string {
    if (status === 401) return 'auth_required';
    if (status === 403) return 'app_check_required';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'temporarily_unavailable';
    return status >= 400 ? 'http_error' : 'malformed_response';
}

const SAFE_TRANSPORT_ERROR_CLASSES = new Set([
    'auth_required',
    'app_check_required',
    'rate_limited',
    'temporarily_unavailable',
    'http_error',
    'malformed_response',
    'request_id_mismatch',
]);

export function classifyLiveTransportError(error: unknown): string {
    return error instanceof Error && SAFE_TRANSPORT_ERROR_CLASSES.has(error.message)
        ? error.message
        : 'network_error';
}

export function boundedLiveHistoryAnswer(answer: string): string {
    return [...answer].slice(0, MAX_HISTORY_ANSWER_CHARACTERS).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLiveTurnTrace(value: unknown, requestId: string): LiveTurnTrace | null {
    if (!isRecord(value)
        || value.requestId !== requestId
        || typeof value.generationStatus !== 'string'
        || typeof value.generationFailurePhase !== 'string'
        || (value.finalGenerationErrorClass !== null && typeof value.finalGenerationErrorClass !== 'string')
        || typeof value.citationValidation !== 'string'
        || typeof value.qualityJudgeInvoked !== 'boolean'
        || typeof value.answerabilityReason !== 'string'
        || typeof value.statePersistence !== 'string'
        || (value.stateFingerprint !== null && typeof value.stateFingerprint !== 'string')
        || typeof value.conversationState !== 'string'
        || typeof value.contextSelected !== 'boolean'
        || !Array.isArray(value.queryVariantKinds)
        || !value.queryVariantKinds.every(kind => typeof kind === 'string')) {
        return null;
    }
    return {
        requestId,
        taskType: typeof value.taskType === 'string' ? value.taskType : 'unknown',
        generationStatus: value.generationStatus,
        generationFailurePhase: value.generationFailurePhase,
        finalGenerationErrorClass: value.finalGenerationErrorClass,
        backendFailureSubtype: typeof value.backendFailureSubtype === 'string' ? value.backendFailureSubtype : null,
        citationValidation: value.citationValidation,
        structuralValidationResult: typeof value.structuralValidationResult === 'string'
            ? value.structuralValidationResult
            : 'not_run',
        citationValidationResult: typeof value.citationValidationResult === 'string'
            ? value.citationValidationResult
            : 'not_run',
        qualityJudgeInvoked: value.qualityJudgeInvoked,
        answerabilityReason: value.answerabilityReason,
        preAnswerabilityEvidenceIds: Array.isArray(value.preAnswerabilityEvidenceIds)
            ? value.preAnswerabilityEvidenceIds.filter((item): item is string => typeof item === 'string')
            : [],
        postAnswerabilityEvidenceIds: Array.isArray(value.postAnswerabilityEvidenceIds)
            ? value.postAnswerabilityEvidenceIds.filter((item): item is string => typeof item === 'string')
            : [],
        statePersistence: value.statePersistence,
        stateAction: typeof value.stateAction === 'string' ? value.stateAction : 'unknown',
        answeredUsageIncrement: typeof value.answeredUsageIncrement === 'number'
            ? value.answeredUsageIncrement
            : null,
        stateFingerprint: value.stateFingerprint,
        conversationState: value.conversationState,
        contextSelected: value.contextSelected,
        queryVariantKinds: value.queryVariantKinds,
    };
}

export function classifyLiveFailureSubtype(
    expectedStatus: NoorAnswer['status'],
    answer: NoorAnswer,
    trace: LiveTurnTrace | null,
): LiveFailureSubtype | null {
    const reportedFailure = trace?.backendFailureSubtype ?? trace?.finalGenerationErrorClass;
    if (reportedFailure === 'provider_transient_failure') return 'provider_transient_failure';
    if (reportedFailure === 'provider_timeout') return 'provider_timeout';
    if (reportedFailure === 'malformed_json' || reportedFailure === 'answer_validation_failure') {
        return 'structured_generation_failure';
    }
    if (reportedFailure === 'citation_validation_failure') return 'citation_validation_failure';
    if (reportedFailure === 'answer_quality_failure' || reportedFailure === 'answer_quality_judgement_failure') {
        return 'answer_quality_failure';
    }
    if (reportedFailure === 'policy_failure') return 'policy_failure';
    if (reportedFailure === 'state_failure') return 'state_failure';
    if (reportedFailure === 'retrieval_failure') return 'retrieval_failure';
    if (reportedFailure === 'schema_outcome_contract_failure') return 'schema_outcome_contract_failure';
    if (answer.status === 'answered' && trace?.citationValidation !== 'passed') return 'citation_validation_failure';
    if (answer.status === expectedStatus) {
        if (answer.status === 'answered' && trace?.statePersistence === 'not_persisted') return 'state_failure';
        return null;
    }
    if (trace?.citationValidation === 'failed') return 'citation_validation_failure';
    if (reportedFailure === 'answer_quality_failure'
        || reportedFailure === 'answer_quality_judgement_failure'
        || trace?.generationFailurePhase === 'quality_correction'
        || trace?.generationFailurePhase === 'quality_judgement') return 'answer_quality_failure';
    if (answer.status === 'policy_refusal') return 'policy_failure';
    if (trace?.generationFailurePhase === 'not_run'
        && trace.finalGenerationErrorClass === null
        && trace.answerabilityReason !== 'sufficient') return 'retrieval_failure';
    return 'schema_outcome_contract_failure';
}

export function safeAbstentionFailureReason(answer: NoorAnswer, trace: unknown): string | null {
    if (!isRecord(trace)) return 'verifier_trace_unavailable';
    try {
        parseNoorAnswer(answer);
    } catch {
        return 'verifier_public_response_schema';
    }
    if (answer.status !== 'insufficient_evidence') return 'verifier_status_mismatch';
    if (answer.answer !== CANONICAL_INSUFFICIENT_EVIDENCE) return 'verifier_unsupported_answer_leak';
    if (answer.citations.length !== 0) return 'verifier_citations_non_empty';
    if (trace.statePersistence !== 'not_persisted' || trace.stateAction === 'persisted') {
        return 'verifier_conversation_state_persisted';
    }
    if (trace.answeredUsageIncrement !== undefined
        && trace.answeredUsageIncrement !== null
        && trace.answeredUsageIncrement !== 0) {
        return 'verifier_answered_usage_increment';
    }
    if ((trace.backendFailureSubtype !== undefined && trace.backendFailureSubtype !== null)
        || (trace.finalGenerationErrorClass !== undefined && trace.finalGenerationErrorClass !== null)) {
        return 'backend_deterministic_failure';
    }
    if (!Array.isArray(trace.preAnswerabilityEvidenceIds)
        || !Array.isArray(trace.postAnswerabilityEvidenceIds)) {
        return 'verifier_evidence_trace_invalid';
    }

    if (trace.generationStatus === 'not_run') {
        if (trace.answerabilityReason !== 'insufficient'
            || trace.postAnswerabilityEvidenceIds.length !== 0
            || trace.generationFailurePhase !== 'not_run'
            || trace.citationValidation !== 'not_run'
            || trace.structuralValidationResult !== 'not_run'
            || trace.citationValidationResult !== 'not_run'
            || trace.qualityJudgeInvoked !== false) {
            return 'verifier_abstention_trace_incoherent';
        }
        return null;
    }

    if (trace.generationStatus === 'insufficient_evidence') {
        const passedValidation = trace.structuralValidationResult === 'passed_first_attempt'
            || trace.structuralValidationResult === 'passed_after_retry';
        const passedCitations = trace.citationValidationResult === 'passed_first_attempt'
            || trace.citationValidationResult === 'passed_after_retry';
        if (trace.answerabilityReason === 'not_run'
            || trace.postAnswerabilityEvidenceIds.length === 0
            || trace.generationFailurePhase !== 'none'
            || !passedValidation
            || !passedCitations
            || trace.qualityJudgeInvoked !== false) {
            return 'verifier_abstention_trace_incoherent';
        }
        return null;
    }

    return 'verifier_abstention_trace_incoherent';
}

export function safeAbstentionSatisfied(answer: NoorAnswer, trace: unknown): boolean {
    return safeAbstentionFailureReason(answer, trace) === null;
}

function replayableProviderFailure(subtype: LiveFailureSubtype | null): boolean {
    return subtype === 'provider_transient_failure' || subtype === 'provider_timeout';
}

export async function executeSequentialLiveTurns(
    input: SequentialLiveTurnsInput,
): Promise<SequentialLiveTurnsResult> {
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const turns: LiveTurnResult[] = [];
    let finalAnswer: NoorAnswer | null = null;
    let requestCount = 0;
    const replayBudget = input.providerReplayBudget ?? { availabilityFailures: 0 };
    const sleep = input.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    for (let index = 0; index < input.questions.length; index += 1) {
        const question = input.questions[index]!;
        const expectedStatus = index < input.questions.length - 1 ? 'answered' : input.expectedFinalStatus;
        let request: NoorRequest = { mode: 'chat', requestId: randomUUID(), question, history: [...history] };
        let called = await input.call(request);
        requestCount += 1;
        let trace = parseLiveTurnTrace(await input.readTrace(request.requestId), request.requestId);
        let failureSubtype = classifyLiveFailureSubtype(expectedStatus, called.answer, trace);
        let verifierFailureReason = expectedStatus === 'insufficient_evidence'
            ? safeAbstentionFailureReason(called.answer, trace)
            : null;
        let providerReplayUsed = false;
        if (replayableProviderFailure(failureSubtype)) {
            replayBudget.availabilityFailures += 1;
            if (replayBudget.availabilityFailures === 1) {
                await sleep(PROVIDER_REPLAY_DELAY_MS);
                providerReplayUsed = true;
                request = { mode: 'chat', requestId: randomUUID(), question, history: [...history] };
                called = await input.call(request);
                requestCount += 1;
                trace = parseLiveTurnTrace(await input.readTrace(request.requestId), request.requestId);
                failureSubtype = classifyLiveFailureSubtype(expectedStatus, called.answer, trace);
                verifierFailureReason = expectedStatus === 'insufficient_evidence'
                    ? safeAbstentionFailureReason(called.answer, trace)
                    : null;
                if (replayableProviderFailure(failureSubtype)) replayBudget.availabilityFailures += 1;
            }
        }
        finalAnswer = called.answer;
        const stateExpected = expectedStatus === 'answered';
        const stateFound = trace?.conversationState === 'validated_subject_and_evidence';
        const statePersisted = trace?.statePersistence === 'persisted';
        const followUpExpected = index > 0 && expectedStatus === 'answered';
        const contextualQueryProduced = trace?.queryVariantKinds.includes('context_enriched') === true;
        const passed = called.answer.status === expectedStatus
            && trace !== null
            && (expectedStatus !== 'insufficient_evidence'
                || (failureSubtype === null && verifierFailureReason === null))
            && (expectedStatus !== 'answered' || (
                called.answer.citations.length > 0
                && input.validateAnsweredCitations(called.answer)
                && trace.citationValidation === 'passed'
                && trace.qualityJudgeInvoked
                && statePersisted
            ))
            && (!followUpExpected || (
                trace.conversationState === 'validated_subject_and_evidence'
                && trace.contextSelected
                && contextualQueryProduced
            ));
        turns.push({
            turnNumber: index + 1,
            requestId: request.requestId,
            question,
            responseStatus: called.answer.status,
            generationFailurePhase: trace?.generationFailurePhase ?? 'trace_unavailable',
            failureSubtype,
            verifierFailureReason,
            citationValidation: trace?.citationValidation ?? 'trace_unavailable',
            qualityJudgeInvoked: trace?.qualityJudgeInvoked ?? false,
            stateExpected,
            stateFound,
            statePersisted,
            stateFingerprint: trace?.stateFingerprint ?? null,
            contextSelected: trace?.contextSelected ?? false,
            contextualQueryProduced,
            passed,
            latencyMs: called.latencyMs,
            providerReplayUsed,
        });
        if (!passed) return { requestCount, completed: false, turns, finalAnswer };
        history.push({ role: 'user', content: question });
        history.push({ role: 'assistant', content: boundedLiveHistoryAnswer(called.answer.answer) });
    }
    return { requestCount, completed: true, turns, finalAnswer };
}

function answerFromResponse(status: number, body: unknown, expectedRequestId: string): NoorAnswer {
    if (status < 200 || status >= 300 || typeof body !== 'object' || body === null || Array.isArray(body)
        || !Object.prototype.hasOwnProperty.call(body, 'result')) {
        throw new Error(safeErrorClass(status));
    }
    const answer = parseNoorAnswer((body as { result: unknown }).result);
    if (answer.requestId !== expectedRequestId) throw new Error('request_id_mismatch');
    return answer;
}

function citationSnapshot(answer: NoorAnswer): LiveCitation[] {
    return answer.citations.map((citation, index) => ({
        chunkId: citation.chunkId,
        canonicalUnitId: citation.canonicalUnitId,
        source: citation.source,
        corpusVersion: citation.corpusVersion,
        verse: `${citation.surah}:${citation.verseStart}-${citation.verseEnd}`,
        rank: index + 1,
    }));
}

async function callNoor(
    request: NoorRequest,
    credentials: LiveSmokeCredentials,
    paceRequest: () => Promise<void>,
): Promise<{ answer: NoorAnswer; latencyMs: number }> {
    await paceRequest();
    const built = buildCallableRequest(request, credentials);
    const startedAt = Date.now();
    const response = await fetch(built.url, built.init);
    const body = await response.json() as unknown;
    return { answer: answerFromResponse(response.status, body, request.requestId), latencyMs: Math.max(0, Date.now() - startedAt) };
}

function expectedChunkIds(goldenCase: GoldenCase): string[] {
    return goldenCase.expectedEvidence.flatMap(evidence => [...evidence.chunkIds]);
}

function liveCitationsResolve(
    citations: readonly LiveCitation[],
    corpusVersion: string,
    artifacts: ReturnType<typeof readCorpusArtifacts>,
): boolean {
    const chunksById = new Map(artifacts.chunks.map(chunk => [chunk.chunkId, chunk]));
    return citations.every(citation => {
        const chunk = chunksById.get(citation.chunkId);
        return chunk !== undefined
            && chunk.canonicalUnitId === citation.canonicalUnitId
            && chunk.source === citation.source
            && corpusVersion === citation.corpusVersion;
    });
}

export function expectedCitationEvidenceSatisfied(
    goldenCase: Pick<GoldenCase, 'exact' | 'expectedEvidence'>,
    citations: readonly Pick<LiveCitation, 'chunkId' | 'canonicalUnitId' | 'source'>[],
): boolean {
    if (goldenCase.exact) {
        const actualChunkIds = new Set(citations.map(citation => citation.chunkId));
        return goldenCase.expectedEvidence
            .flatMap(evidence => evidence.chunkIds)
            .every(chunkId => actualChunkIds.has(chunkId));
    }
    return goldenCase.expectedEvidence.some(expected => citations.some(citation => (
        citation.source === expected.source
        && citation.canonicalUnitId === expected.canonicalUnitId
        && expected.chunkIds.includes(citation.chunkId)
    )));
}

function validateResult(
    goldenCase: GoldenCase,
    answer: NoorAnswer,
    citations: readonly LiveCitation[],
    corpusVersion: string,
    artifacts: ReturnType<typeof readCorpusArtifacts>,
): { passed: boolean; rankingPositions: Record<string, number | null>; errorClass: string | null } {
    const actualChunkIds = new Set(citations.map(citation => citation.chunkId));
    const expectedIds = expectedChunkIds(goldenCase);
    const rankingPositions = Object.fromEntries(expectedIds.map(chunkId => [
        chunkId,
        citations.find(citation => citation.chunkId === chunkId)?.rank ?? null,
    ]));
    const citationsResolve = liveCitationsResolve(citations, corpusVersion, artifacts);
    const forbiddenChunkAbsent = goldenCase.forbiddenChunkIds.every(chunkId => !actualChunkIds.has(chunkId));
    const forbiddenStatus = !goldenCase.forbiddenStatuses.some(status => status === answer.status);
    const passed = answer.status === goldenCase.expectedStatus
        && citationsResolve
        && forbiddenChunkAbsent
        && forbiddenStatus
        && (goldenCase.expectedStatus !== 'answered'
            ? citations.length === 0
            : expectedCitationEvidenceSatisfied(goldenCase, citations));
    return {
        passed,
        rankingPositions,
        errorClass: passed ? null : answer.status,
    };
}

async function runCase(
    goldenCase: GoldenCase,
    credentials: LiveSmokeCredentials,
    corpusVersion: string,
    artifacts: ReturnType<typeof readCorpusArtifacts>,
    paceRequest: () => Promise<void>,
    readTrace: (requestId: string) => Promise<unknown>,
    providerReplayBudget: LiveProviderReplayBudget,
): Promise<LiveCaseResult> {
    const startedAt = Date.now();
    let answer: NoorAnswer;
    let requestCount = 0;
    let turns: LiveTurnResult[] = [];
    try {
        if (goldenCase.exact) {
            let request = {
                mode: 'verse_summary' as const,
                requestId: randomUUID(),
                source: goldenCase.exact.source,
                surah: goldenCase.exact.surah,
                verse: goldenCase.exact.verse,
            };
            let called = await callNoor(request, credentials, paceRequest);
            requestCount = 1;
            let trace = parseLiveTurnTrace(await readTrace(request.requestId), request.requestId);
            let failureSubtype = classifyLiveFailureSubtype(goldenCase.expectedStatus, called.answer, trace);
            let providerReplayUsed = false;
            if (replayableProviderFailure(failureSubtype)) {
                providerReplayBudget.availabilityFailures += 1;
                if (providerReplayBudget.availabilityFailures === 1) {
                    await new Promise(resolve => setTimeout(resolve, PROVIDER_REPLAY_DELAY_MS));
                    providerReplayUsed = true;
                    request = { ...request, requestId: randomUUID() };
                    called = await callNoor(request, credentials, paceRequest);
                    requestCount += 1;
                    trace = parseLiveTurnTrace(await readTrace(request.requestId), request.requestId);
                    failureSubtype = classifyLiveFailureSubtype(goldenCase.expectedStatus, called.answer, trace);
                    if (replayableProviderFailure(failureSubtype)) providerReplayBudget.availabilityFailures += 1;
                }
            }
            answer = called.answer;
            turns = [{
                turnNumber: 1,
                requestId: request.requestId,
                question: `${goldenCase.exact.source}:${goldenCase.exact.surah}:${goldenCase.exact.verse}`,
                responseStatus: answer.status,
                generationFailurePhase: trace?.generationFailurePhase ?? 'trace_unavailable',
                failureSubtype,
                verifierFailureReason: null,
                citationValidation: trace?.citationValidation ?? 'trace_unavailable',
                qualityJudgeInvoked: trace?.qualityJudgeInvoked ?? false,
                stateExpected: false,
                stateFound: false,
                statePersisted: false,
                stateFingerprint: null,
                contextSelected: trace?.contextSelected ?? false,
                contextualQueryProduced: false,
                passed: trace !== null
                    && answer.status === goldenCase.expectedStatus
                    && (answer.status !== 'answered' || (trace.citationValidation === 'passed' && trace.qualityJudgeInvoked)),
                latencyMs: called.latencyMs,
                providerReplayUsed,
            }];
        } else {
            const executed = await executeSequentialLiveTurns({
                questions: goldenCase.turns,
                expectedFinalStatus: goldenCase.expectedStatus,
                call: request => callNoor(request, credentials, paceRequest),
                readTrace,
                validateAnsweredCitations: current => liveCitationsResolve(
                    citationSnapshot(current), corpusVersion, artifacts,
                ),
                providerReplayBudget,
            });
            requestCount = executed.requestCount;
            turns = executed.turns;
            if (executed.finalAnswer === null) throw new Error('malformed_response');
            answer = executed.finalAnswer;
        }
    } catch (error: unknown) {
        return {
            id: goldenCase.id,
            requestCount,
            expectedStatus: goldenCase.expectedStatus,
            actualStatus: 'transport_error',
            passed: false,
            activeCorpusVersion: null,
            retrievedSourceIds: [],
            retrievedUnitIds: [],
            retrievedChunkIds: [],
            rankingPositions: {},
            citations: [],
            latencyMs: Math.max(0, Date.now() - startedAt),
            errorClass: classifyLiveTransportError(error),
            turns,
        };
    }
    const finalAnswer = answer!;
    const citations = citationSnapshot(finalAnswer);
    const activeVersions = [...new Set(citations.map(citation => citation.corpusVersion))];
    const activeCorpusVersion = activeVersions.length === 1 ? activeVersions[0]! : null;
    const validation = validateResult(goldenCase, finalAnswer, citations, corpusVersion, artifacts);
    const turnFailureSubtype = turns.find(turn => !turn.passed)?.failureSubtype ?? null;
    const turnVerifierFailureReason = turns.find(turn => !turn.passed)?.verifierFailureReason ?? null;
    return {
        id: goldenCase.id,
        requestCount,
        expectedStatus: goldenCase.expectedStatus,
        actualStatus: finalAnswer.status,
        passed: validation.passed && turns.length > 0 && turns.every(turn => turn.passed),
        activeCorpusVersion,
        retrievedSourceIds: [...new Set(citations.map(citation => citation.source))],
        retrievedUnitIds: [...new Set(citations.map(citation => citation.canonicalUnitId))],
        retrievedChunkIds: citations.map(citation => citation.chunkId),
        rankingPositions: validation.rankingPositions,
        citations,
        latencyMs: Math.max(0, Date.now() - startedAt),
        errorClass: validation.passed && turns.length > 0 && turns.every(turn => turn.passed)
            ? null
            : turnFailureSubtype ?? turnVerifierFailureReason ?? validation.errorClass ?? 'schema_outcome_contract_failure',
        turns,
    };
}

function createLiveTraceReader(firestore: ReturnType<typeof getFirestore>): (requestId: string) => Promise<unknown> {
    return async requestId => {
        const snapshot = await firestore.collection('noorTelemetry')
            .where('sanitizedTrace.requestId', '==', requestId)
            .limit(2)
            .get();
        if (snapshot.size !== 1) return null;
        const data = snapshot.docs[0]?.data();
        return isRecord(data) ? data.sanitizedTrace ?? null : null;
    };
}

async function main(): Promise<void> {
    const version = '2026-08-10-v1';
    const casesPath = resolve(__dirname, '../../../evals/noor-golden-cases.json');
    const artifactsPath = resolve(__dirname, '../../../.generated/noor-corpus', version);
    const manifest = parseGoldenManifest(readJson(casesPath));
    if (manifest.corpusVersion !== version) throw new Error('Live golden corpus version is not locked');
    let credentials: LiveSmokeCredentials;
    try {
        credentials = parseLiveSmokeCredentials(process.env);
        if (new URL(credentials.endpoint).protocol !== 'https:') throw new Error('live endpoint must use HTTPS');
    } catch (error: unknown) {
        const report: LiveVerificationReport = {
            status: 'UNVERIFIED', endpoint: null, corpusVersion: version, caseCount: LIVE_CASE_IDS.length,
            requestCount: 0, passedCaseCount: 0, failedCaseIds: [],
            reason: error instanceof Error ? error.message : 'credentials_unavailable',
        };
        process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
        process.exitCode = 2;
        return;
    }
    const artifacts = readCorpusArtifacts(artifactsPath);
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: LOCKED_PROJECT }, `noor-live-verify-${Date.now()}`);
    const results: LiveCaseResult[] = [];
    const providerReplayBudget: LiveProviderReplayBudget = { availabilityFailures: 0 };
    try {
        const readTrace = createLiveTraceReader(getFirestore(app));
        const paceRequest = createLiveRequestPacer();
        for (const id of LIVE_CASE_IDS) {
            results.push(await runCase(
                caseById(manifest, id),
                credentials,
                version,
                artifacts,
                paceRequest,
                readTrace,
                providerReplayBudget,
            ));
        }
    } finally {
        await deleteApp(app);
    }
    const failedCaseIds = results.filter(result => !result.passed).map(result => result.id);
    const report: LiveVerificationReport = {
        status: failedCaseIds.length === 0 ? 'PASSED' : 'FAILED',
        endpoint: credentials.endpoint,
        corpusVersion: version,
        caseCount: results.length,
        requestCount: results.reduce((total, result) => total + result.requestCount, 0),
        passedCaseCount: results.filter(result => result.passed).length,
        failedCaseIds,
        results,
    };
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
    if (failedCaseIds.length > 0) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('Noor live verification failed; no provider details or credentials were emitted.\n');
        process.exitCode = 1;
    });
}
