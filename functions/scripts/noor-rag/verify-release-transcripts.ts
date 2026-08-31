import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GoogleGenAI } from '@google/genai';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { createVertexEmbedder, type VertexEmbeddingClient } from '../../src/noor-rag/embedding';
import { readRuntimeConfig, verifyCorpusReady } from '../../src/noor-rag/firestore';
import {
    createVertexGenerationProvider,
    generateGroundedAnswer,
    type VertexGenerationClient,
} from '../../src/noor-rag/generation';
import {
    handleNoorRequest,
    type NoorHandlerTelemetryEvent,
    type NoorSanitizedTrace,
} from '../../src/noor-rag/handler';
import { createVertexPersonalizedRulingClassifier, type VertexPersonalizedRulingClassifierClient } from '../../src/noor-rag/personalizedRulingClassifier';
import { classifyRequestPolicy } from '../../src/noor-rag/policy';
import type { ValidatedConversationState } from '../../src/noor-rag/queryRewrite';
import {
    createFirestoreRetrievalRepository,
    retrieveEntitySummaryWithStats,
    retrieveExactVerse,
    retrieveSemanticWithStats,
} from '../../src/noor-rag/retrieval';
import { createVertexSemanticTaskClassifier, type VertexSemanticTaskClassifierClient } from '../../src/noor-rag/semanticTaskClassifier';
import type { NoorAnswer, NoorHistoryTurn, NoorRequest } from '../../src/noor-rag/types';
import { classifyAvailabilityFailure, parseReleaseBenchmarkManifest, safeBenchmarkError } from './release-benchmark';
import { LOCKED_PROJECT } from './verify-index';

type TranscriptName = 'clean' | 'messy';
type ExpectedStatus = 'answered' | 'insufficient_evidence' | 'policy_refusal';

interface TurnResult {
    transcript: TranscriptName;
    turn: number;
    status: NoorAnswer['status'];
    expectedStatus: ExpectedStatus;
    passed: boolean;
    citationCount: number;
    latencyMs: number;
    generationFailurePhase: NoorSanitizedTrace['generationFailurePhase'];
    failureSubtype: string | null;
    taskType: NoorSanitizedTrace['taskType'];
    contextSelected: boolean;
    answerabilityReason: NoorSanitizedTrace['answerabilityReason'];
    statePersistence: NoorSanitizedTrace['statePersistence'];
    stateAction: NoorSanitizedTrace['stateAction'];
    answeredUsageIncrement: number;
    providerReplayUsed: boolean;
}

const MAX_HISTORY_ENTRIES = 6;

export function boundBenchmarkHistory(history: readonly NoorHistoryTurn[]): NoorHistoryTurn[] {
    return history.slice(-MAX_HISTORY_ENTRIES).map(item => ({ ...item }));
}

export function expectedTranscriptStatus(name: TranscriptName, turn: number): ExpectedStatus {
    if (name === 'clean') {
        if (turn === 13 || turn === 14) return 'insufficient_evidence';
        if (turn === 16) return 'policy_refusal';
        return 'answered';
    }
    if (turn === 12 || turn === 13) return 'insufficient_evidence';
    if (turn === 15) return 'policy_refusal';
    return 'answered';
}

function percentile(values: readonly number[], rank: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.max(0, Math.ceil(sorted.length * rank) - 1)]!;
}

async function main(): Promise<void> {
    const manifest = parseReleaseBenchmarkManifest(JSON.parse(readFileSync(
        resolve(process.cwd(), 'evals/noor-final-release-benchmark.json'), 'utf8',
    )) as unknown);
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: LOCKED_PROJECT }, `noor-release-transcripts-${Date.now()}`);
    const results: TurnResult[] = [];
    try {
        const firestore = getFirestore(app);
        const config = await readRuntimeConfig(firestore);
        if (!await verifyCorpusReady(firestore, config)) throw new Error('promoted corpus is not ready');
        if (config.activeCorpusVersion !== manifest.corpus.promoted.version) throw new Error('promoted corpus version mismatch');
        const repository = createFirestoreRetrievalRepository(firestore);
        const vertex = new GoogleGenAI({ vertexai: true, project: LOCKED_PROJECT, location: 'global' });
        const embedder = createVertexEmbedder(vertex.models as VertexEmbeddingClient);
        const generation = createVertexGenerationProvider(LOCKED_PROJECT, () => vertex as unknown as VertexGenerationClient);
        const personalized = createVertexPersonalizedRulingClassifier(vertex as unknown as VertexPersonalizedRulingClassifierClient);
        const semantic = createVertexSemanticTaskClassifier(vertex as unknown as VertexSemanticTaskClassifierClient);

        for (const name of ['clean', 'messy'] as const) {
            const questions = manifest.transcripts[name];
            let history: NoorHistoryTurn[] = [];
            let state: ValidatedConversationState | null = null;
            for (const [index, question] of questions.entries()) {
                const expectedStatus = expectedTranscriptStatus(name, index + 1);
                let answer: NoorAnswer | null = null;
                let trace: NoorSanitizedTrace | null = null;
                let telemetry: NoorHandlerTelemetryEvent | null = null;
                let answeredUsageIncrement = 0;
                let stateWriteCount = 0;
                let latencyMs = 0;
                const run = async (): Promise<void> => {
                    const request: NoorRequest = {
                        mode: 'chat', requestId: randomUUID(), question, history: boundBenchmarkHistory(history),
                    };
                    trace = null;
                    telemetry = null;
                    answeredUsageIncrement = 0;
                    stateWriteCount = 0;
                    const startedAt = Date.now();
                    answer = await handleNoorRequest({
                        request,
                        uid: `release-benchmark-${name}`,
                        invocationId: randomUUID(),
                        conversationState: state,
                        traceCase: `release-${name}-${index + 1}`,
                        dependencies: {
                            loadRuntimeConfig: async () => config,
                            verifyCorpusReady: async () => true,
                            readCompletedReplay: async () => null,
                            resolveEntitlement: async () => ({ class: 'paid', expiresAt: null, source: 'revenuecat' }),
                            claimUsage: async () => ({ kind: 'claimed', leaseOwnerId: 'benchmark', leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() }),
                            classifyPolicy: classifyRequestPolicy,
                            classifyPersonalizedRuling: input => personalized.classify(input),
                            classifySemanticTask: input => semantic.classify(input),
                            retrieveSemantic: input => retrieveSemanticWithStats({
                                content: input.query, config: input.config, embedder, repository,
                            }),
                            retrieveEntitySummary: input => retrieveEntitySummaryWithStats({
                                entity: input.entity, config: input.config, repository,
                            }),
                            retrieveExact: input => retrieveExactVerse({
                                source: input.request.source, surah: input.request.surah,
                                verse: input.request.verse, config: input.config, repository,
                            }),
                            generateGroundedAnswer: input => generateGroundedAnswer({
                                request: input.request,
                                evidence: input.evidence,
                                maxEvidenceCharacters: input.config.maxEvidenceCharacters,
                                provider: generation,
                                taskPlan: input.taskPlan,
                                comparisonCitationContract: input.comparisonCitationContract,
                                answerabilityContract: input.answerabilityContract,
                            }),
                            finalizeAnswered: async input => {
                                answeredUsageIncrement += 1;
                                return { kind: 'finalized', response: input.response };
                            },
                            finalizeNonAnswer: async input => ({ kind: 'finalized', response: input.response }),
                            emitTelemetry: event => { telemetry = event; },
                            emitSanitizedTrace: value => { trace = value; },
                            writeValidatedConversationState: async input => {
                                stateWriteCount += 1;
                                state = input.state;
                            },
                            nowMs: Date.now,
                        },
                    });
                    latencyMs = Date.now() - startedAt;
                };
                await run();
                const finalAnswer = answer as NoorAnswer | null;
                const finalTrace = trace as NoorSanitizedTrace | null;
                const finalTelemetry = telemetry as NoorHandlerTelemetryEvent | null;
                if (!finalAnswer || !finalTrace || !finalTelemetry) throw new Error(`missing transcript diagnostics ${name}-${index + 1}`);
                const nonAnswerLeak = finalAnswer.status !== 'answered' && (answeredUsageIncrement !== 0 || stateWriteCount !== 0);
                const passed = finalAnswer.status === expectedStatus
                    && !nonAnswerLeak
                    && (finalAnswer.status !== 'answered' || (finalAnswer.citations.length > 0 && finalTrace.citationValidation === 'passed'));
                results.push({
                    transcript: name,
                    turn: index + 1,
                    status: finalAnswer.status,
                    expectedStatus,
                    passed,
                    citationCount: finalAnswer.citations.length,
                    latencyMs,
                    generationFailurePhase: finalTrace.generationFailurePhase,
                    failureSubtype: finalTrace.finalGenerationErrorClass,
                    taskType: finalTrace.taskType,
                    contextSelected: finalTrace.contextSelected,
                    answerabilityReason: finalTrace.answerabilityReason,
                    statePersistence: finalTrace.statePersistence,
                    stateAction: finalTrace.stateAction,
                    answeredUsageIncrement,
                    providerReplayUsed: false,
                });
                history.push({ role: 'user', content: question }, { role: 'assistant', content: finalAnswer.answer.slice(0, 1_000) });
                history = boundBenchmarkHistory(history);
            }
        }
    } finally {
        await deleteApp(app);
    }

    const latencies = results.map(item => item.latencyMs);
    const supported = results.filter(item => item.expectedStatus === 'answered');
    const providerAvailability = results.filter(item => item.failureSubtype === 'provider_transient_failure'
        || item.failureSubtype === 'provider_timeout');
    const availability = results.map(item => classifyAvailabilityFailure(item.failureSubtype));
    const report = {
        phase: 'real_transcripts',
        corpusVersion: manifest.corpus.promoted.version,
        cleanTurns: results.filter(item => item.transcript === 'clean').length,
        messyTurns: results.filter(item => item.transcript === 'messy').length,
        passedTurns: results.filter(item => item.passed).length,
        failedTurns: results.filter(item => !item.passed).map(item => `${item.transcript}-${item.turn}`),
        supportedGenerationCases: supported.length,
        supportedGenerationSuccessRate: supported.length === 0 ? 0 : supported.filter(item => item.status === 'answered').length / supported.length,
        providerTransients: providerAvailability.filter(item => item.failureSubtype === 'provider_transient_failure').length,
        providerTimeouts: providerAvailability.filter(item => item.failureSubtype === 'provider_timeout').length,
        structuredFailures: availability.filter(item => item === 'structured_generation_fail_closed').length,
        citationValidationFailures: availability.filter(item => item === 'citation_validation_fail_closed').length,
        qualityFailures: availability.filter(item => item === 'quality_validation_fail_closed').length,
        otherSafeFailures: availability.filter(item => item === 'other_safe_failure').length,
        nonAnswerStateLeaks: results.filter(item => item.status !== 'answered' && item.statePersistence === 'persisted').length,
        nonAnswerQuotaLeaks: results.filter(item => item.status !== 'answered' && item.answeredUsageIncrement !== 0).length,
        p50LatencyMs: percentile(latencies, 0.5),
        p95LatencyMs: percentile(latencies, 0.95),
        results,
    };
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
    if (report.failedTurns.length > 0 || report.supportedGenerationSuccessRate < manifest.thresholds.supportedGenerationSuccessRate
        || report.nonAnswerStateLeaks > 0 || report.nonAnswerQuotaLeaks > 0) process.exitCode = 1;
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${JSON.stringify({
            phase: 'real_transcripts', status: 'UNVERIFIED', ...safeBenchmarkError(error),
        }, undefined, 2)}\n`);
        process.exitCode = 2;
    });
}
