import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GoogleGenAI } from '@google/genai';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { createVertexEmbedder, type VertexEmbeddingClient } from '../../src/noor-rag/embedding';
import type { ComparisonCitationContract } from '../../src/noor-rag/citations';
import { readRuntimeConfig, verifyCorpusReady } from '../../src/noor-rag/firestore';
import {
    createVertexGenerationProvider,
    generateGroundedAnswer,
    type GenerationProvider,
    type VertexGenerationClient,
    type VertexGenerationRequest,
} from '../../src/noor-rag/generation';
import { handleNoorRequest, type NoorSanitizedTrace } from '../../src/noor-rag/handler';
import { createVertexPersonalizedRulingClassifier, type VertexPersonalizedRulingClassifierClient } from '../../src/noor-rag/personalizedRulingClassifier';
import { classifyRequestPolicy } from '../../src/noor-rag/policy';
import {
    createFirestoreRetrievalRepository,
    retrieveEntitySummaryWithStats,
    retrieveExactVerse,
    retrieveSemanticWithStats,
} from '../../src/noor-rag/retrieval';
import { createVertexSemanticTaskClassifier, type VertexSemanticTaskClassifierClient } from '../../src/noor-rag/semanticTaskClassifier';
import type { NoorAnswer, NoorRequest, RetrievedEvidence } from '../../src/noor-rag/types';
import { classifyAvailabilityFailure, parseReleaseBenchmarkManifest, safeBenchmarkError } from './release-benchmark';
import { LOCKED_PROJECT } from './verify-index';

type ProviderDiagnostic = Readonly<{
    caseId: string;
    providerCall: number;
    stage: 'answer' | 'quality_judge';
    outcome: 'success' | 'error' | 'missing_text';
    latencyMs: number;
    model: string;
    inputCharacters: number;
    inputTokenEstimate: number;
    outputTokenLimit: number;
    requestPayloadBytes: number;
    evidenceItems: number;
    evidenceCharacters: number;
    schemaBytes: number;
    errorName: string | null;
    errorStatus: number | null;
    errorCode: string | null;
    causeName: string | null;
    causeCode: string | null;
    causeStatus: number | null;
    finishReason: string | null;
    safetyBlockReason: string | null;
    responseBodyReturned: boolean;
    structuredParsingAttempted: boolean;
}>;

function recordValue(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)[key]
        : undefined;
}

function boundedString(value: unknown): string | null {
    if (typeof value !== 'string' || value.length === 0) return null;
    return value.slice(0, 80);
}

function numericCode(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^[0-9]+$/.test(value)) return Number(value);
    return null;
}

function percentile(values: readonly number[], fraction: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

function createDiagnosticGenerationProvider(
    vertex: GoogleGenAI,
    diagnostics: ProviderDiagnostic[],
    context: () => Readonly<{ caseId: string; providerCall: number; evidenceItems: number; evidenceCharacters: number }>,
): GenerationProvider {
    const client: VertexGenerationClient = {
        models: {
            generateContent: async (request: VertexGenerationRequest) => {
            const active = context();
            const startedAt = Date.now();
            const stage = request.config.maxOutputTokens <= 256 ? 'quality_judge' : 'answer';
            const common = {
                caseId: active.caseId,
                providerCall: active.providerCall,
                stage,
                model: request.model,
                inputCharacters: request.contents.length,
                inputTokenEstimate: Math.ceil(request.contents.length / 4),
                outputTokenLimit: request.config.maxOutputTokens,
                requestPayloadBytes: Buffer.byteLength(JSON.stringify(request)),
                evidenceItems: active.evidenceItems,
                evidenceCharacters: active.evidenceCharacters,
                schemaBytes: Buffer.byteLength(JSON.stringify(request.config.responseJsonSchema)),
            } as const;
            try {
                const response = await vertex.models.generateContent(request);
                const candidate = response.candidates?.[0];
                const finishReason = boundedString(candidate?.finishReason);
                const safetyBlockReason = boundedString(response.promptFeedback?.blockReason);
                if (typeof response.text !== 'string') {
                    diagnostics.push({
                        ...common,
                        outcome: 'missing_text',
                        latencyMs: Date.now() - startedAt,
                        errorName: null,
                        errorStatus: null,
                        errorCode: null,
                        causeName: null,
                        causeCode: null,
                        causeStatus: null,
                        finishReason,
                        safetyBlockReason,
                        responseBodyReturned: true,
                        structuredParsingAttempted: false,
                    });
                    return response;
                }
                diagnostics.push({
                    ...common,
                    outcome: 'success',
                    latencyMs: Date.now() - startedAt,
                    errorName: null,
                    errorStatus: null,
                    errorCode: null,
                    causeName: null,
                    causeCode: null,
                    causeStatus: null,
                    finishReason,
                    safetyBlockReason,
                    responseBodyReturned: true,
                    structuredParsingAttempted: true,
                });
                return response;
            } catch (error: unknown) {
                const cause = recordValue(error, 'cause');
                diagnostics.push({
                    ...common,
                    outcome: 'error',
                    latencyMs: Date.now() - startedAt,
                    errorName: boundedString(recordValue(error, 'name')),
                    errorStatus: numericCode(recordValue(error, 'status') ?? recordValue(error, 'statusCode')),
                    errorCode: boundedString(recordValue(error, 'code')),
                    causeName: boundedString(recordValue(cause, 'name')),
                    causeCode: boundedString(recordValue(cause, 'code')),
                    causeStatus: numericCode(recordValue(cause, 'status') ?? recordValue(cause, 'statusCode')),
                    finishReason: null,
                    safetyBlockReason: null,
                    responseBodyReturned: false,
                    structuredParsingAttempted: false,
                });
                throw error;
            }
            },
        },
    };
    return createVertexGenerationProvider(LOCKED_PROJECT, () => client);
}

function independentlyValidateProvenance(
    answer: NoorAnswer,
    evidence: readonly RetrievedEvidence[],
    contract: ComparisonCitationContract | null,
): { valid: boolean; unsupportedCitationCount: number } {
    const selectedIdByChunk = new Map(evidence.map(item => (
        [`${item.chunk.source}:${item.chunk.chunkId}`, item.promptSourceId]
    )));
    const citedSourceIds = answer.citations.flatMap(citation => {
        const id = selectedIdByChunk.get(`${citation.source}:${citation.chunkId}`);
        return id === undefined ? [] : [id];
    });
    const unsupportedCitationCount = answer.citations.length - citedSourceIds.length;
    return {
        valid: answer.status === 'answered'
            && contract !== null
            && unsupportedCitationCount === 0
            && contract.entities.every(entity => entity.evidenceIds.some(id => citedSourceIds.includes(id)))
            && citedSourceIds.every(id => contract.allowedEvidenceIds.includes(id)),
        unsupportedCitationCount,
    };
}

async function main(): Promise<void> {
    const manifest = parseReleaseBenchmarkManifest(JSON.parse(readFileSync(
        resolve(process.cwd(), 'evals/noor-final-release-benchmark.json'),
        'utf8',
    )) as unknown);
    const frozenCases = manifest.cases.filter(item => item.category === 'G');
    const repetitionPlan = (process.env.NOOR_MULTI_ENTITY_STRESS === '1' ? [
        ['g-nuh-musa', 12],
        ['g-maryam-yusuf', 12],
        ['g-musa-yusuf', 12],
        ['g-nuh-maryam', 12],
        ['g-yusuf-nuh', 12],
    ] : [
        ['g-nuh-musa', 10],
        ['g-maryam-yusuf', 5],
        ['g-musa-yusuf', 5],
        ['g-nuh-maryam', 5],
        ['g-yusuf-nuh', 5],
    ]) as ReadonlyArray<readonly [string, number]>;
    const cases = process.env.NOOR_MULTI_ENTITY_REPETITION === '1'
        ? repetitionPlan.flatMap(([id, count]) => {
            const testCase = frozenCases.find(item => item.id === id);
            if (!testCase) throw new Error(`missing frozen multi-entity case ${id}`);
            return Array.from({ length: count }, (_value, index) => ({ ...testCase, id: `${id}-repeat-${index + 1}` }));
        })
        : frozenCases;
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: LOCKED_PROJECT }, `noor-release-multi-${Date.now()}`);
    const results: Array<Record<string, unknown>> = [];
    const providerDiagnostics: ProviderDiagnostic[] = [];
    const harnessErrors: Array<Record<string, unknown>> = [];
    try {
        const firestore = getFirestore(app);
        const config = await readRuntimeConfig(firestore);
        if (!await verifyCorpusReady(firestore, config)) throw new Error('promoted corpus is not ready');
        if (config.activeCorpusVersion !== manifest.corpus.promoted.version) throw new Error('promoted corpus version mismatch');
        const repository = createFirestoreRetrievalRepository(firestore);
        const vertex = new GoogleGenAI({ vertexai: true, project: LOCKED_PROJECT, location: 'global' });
        const embedder = createVertexEmbedder(vertex.models as VertexEmbeddingClient);
        let activeCaseId = 'not_started';
        let activeProviderCall = 0;
        let activeEvidenceItems = 0;
        let activeEvidenceCharacters = 0;
        const generation = process.env.NOOR_PROVIDER_DIAGNOSTICS === '1'
            ? createDiagnosticGenerationProvider(vertex, providerDiagnostics, () => ({
                caseId: activeCaseId,
                providerCall: ++activeProviderCall,
                evidenceItems: activeEvidenceItems,
                evidenceCharacters: activeEvidenceCharacters,
            }))
            : createVertexGenerationProvider(LOCKED_PROJECT, () => vertex as unknown as VertexGenerationClient);
        const personalized = createVertexPersonalizedRulingClassifier(vertex as unknown as VertexPersonalizedRulingClassifierClient);
        const semantic = createVertexSemanticTaskClassifier(vertex as unknown as VertexSemanticTaskClassifierClient);

        for (const testCase of cases) {
            let answer: NoorAnswer | null = null;
            let trace: NoorSanitizedTrace | null = null;
            let latencyMs = 0;
            let selectedEvidence: readonly RetrievedEvidence[] = [];
            let selectedContract: ComparisonCitationContract | null = null;
            let handlerErrorClass: string | null = null;
            const run = async (): Promise<void> => {
                activeCaseId = testCase.id;
                activeProviderCall = 0;
                activeEvidenceItems = 0;
                activeEvidenceCharacters = 0;
                const request: NoorRequest = {
                    mode: 'chat', requestId: randomUUID(), question: testCase.question, history: [],
                };
                trace = null;
                selectedEvidence = [];
                selectedContract = null;
                handlerErrorClass = null;
                const startedAt = Date.now();
                answer = await handleNoorRequest({
                    request,
                    uid: 'release-benchmark-multi',
                    invocationId: randomUUID(),
                    conversationState: null,
                    traceCase: testCase.id,
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
                        generateGroundedAnswer: async input => {
                            selectedEvidence = input.evidence;
                            selectedContract = input.comparisonCitationContract;
                            activeEvidenceItems = input.evidence.length;
                            activeEvidenceCharacters = input.evidence.reduce(
                                (total, item) => total + item.chunk.originalText.length,
                                0,
                            );
                            try {
                                return await generateGroundedAnswer({
                                    request: input.request,
                                    evidence: input.evidence,
                                    maxEvidenceCharacters: input.config.maxEvidenceCharacters,
                                    provider: generation,
                                    taskPlan: input.taskPlan,
                                    comparisonCitationContract: input.comparisonCitationContract,
                                    answerabilityContract: input.answerabilityContract,
                                });
                            } catch (error: unknown) {
                                harnessErrors.push({
                                    caseId: activeCaseId,
                                    phase: activeProviderCall === 0 ? 'before_provider' : 'provider_or_generation',
                                    name: boundedString(recordValue(error, 'name')),
                                    message: boundedString(recordValue(error, 'message')),
                                });
                                throw error;
                            }
                        },
                        finalizeAnswered: async input => ({ kind: 'finalized', response: input.response }),
                        finalizeNonAnswer: async input => ({ kind: 'finalized', response: input.response }),
                        emitTelemetry: event => { handlerErrorClass = event.errorClass; },
                        emitSanitizedTrace: value => { trace = value; },
                        writeValidatedConversationState: async () => undefined,
                        nowMs: Date.now,
                    },
                });
                latencyMs = Date.now() - startedAt;
            };
            await run();
            const finalAnswer = answer as NoorAnswer | null;
            const finalTrace = trace as NoorSanitizedTrace | null;
            if (!finalAnswer || !finalTrace) throw new Error(`missing multi-entity diagnostics ${testCase.id}`);
            const expectedEntityCount = testCase.expectedEntityIds.length;
            const resolvedEntityCount = finalTrace.resolvedEntityIds.length;
            const independent = independentlyValidateProvenance(
                finalAnswer,
                selectedEvidence,
                selectedContract as ComparisonCitationContract | null,
            );
            const independentProvenanceValid = independent.valid;
            const unsupportedCitationCount = independent.unsupportedCitationCount;
            const provenanceValid = finalAnswer.status === 'answered'
                ? finalTrace.citationValidation === 'passed' && independentProvenanceValid
                : null;
            const passed = finalAnswer.status === 'answered'
                && finalTrace.taskType === 'multi_entity_comparison'
                && finalTrace.answerabilityReason === 'balanced_multi_entity'
                && provenanceValid
                && resolvedEntityCount === expectedEntityCount;
            results.push({
                id: testCase.id,
                pair: [...testCase.expectedEntityIds].sort().join('|'),
                status: finalAnswer.status,
                passed,
                resolvedEntityCount,
                citationCount: finalAnswer.citations.length,
                citationValidation: finalTrace.citationValidation,
                provenanceValid,
                independentProvenanceValid,
                unsupportedCitationCount,
                thirdEntityContamination: finalAnswer.status === 'answered' && !independentProvenanceValid ? 1 : 0,
                answerabilityReason: finalTrace.answerabilityReason,
                failureSubtype: finalTrace.finalGenerationErrorClass,
                providerFailureCategory: finalTrace.providerFailureCategory ?? null,
                providerFailureStatus: finalTrace.providerFailureStatus ?? null,
                providerFailureCode: finalTrace.providerFailureCode ?? null,
                providerRetryCount: finalTrace.providerRetryCount ?? 0,
                providerRetryRecovered: finalTrace.providerRetryRecovered ?? false,
                handlerErrorClass,
                latencyMs,
            });
        }
    } finally {
        await deleteApp(app);
    }

    const answered = results.filter(item => item.status === 'answered').length;
    const providerRetries = results.reduce((total, item) => total + Number(item.providerRetryCount ?? 0), 0);
    const retryRecoveries = results.filter(item => item.providerRetryRecovered === true && item.status === 'answered').length;
    const availability = results.map(item => classifyAvailabilityFailure(
        typeof item.failureSubtype === 'string' ? item.failureSubtype : null,
    ));
    const report = {
        phase: 'real_multi_entity',
        corpusVersion: manifest.corpus.promoted.version,
        totalCases: results.length,
        distinctPairs: new Set(results.map(item => item.pair)).size,
        answered,
        answerSuccessRate: results.length === 0 ? 0 : answered / results.length,
        firstAttemptAnswered: answered - retryRecoveries,
        firstAttemptAvailability: results.length === 0 ? 0 : (answered - retryRecoveries) / results.length,
        providerRetries,
        retryRecoveries,
        finalProviderFailures: results.filter(item => typeof item.failureSubtype === 'string'
            && String(item.failureSubtype).startsWith('provider_')).length,
        latencyP50Ms: percentile(results.map(item => Number(item.latencyMs ?? 0)), 0.5),
        latencyP95Ms: percentile(results.map(item => Number(item.latencyMs ?? 0)), 0.95),
        provenancePassRate: answered === 0
            ? 0
            : results.filter(item => item.status === 'answered' && item.provenanceValid === true).length / answered,
        provenanceViolations: results.filter(item => item.status === 'answered' && item.citationValidation !== 'passed').length,
        independentProvenanceViolations: results.filter(item => item.status === 'answered' && item.independentProvenanceValid !== true).length,
        unsupportedCitations: results.reduce((total, item) => total + Number(item.unsupportedCitationCount ?? 0), 0),
        thirdEntityContamination: results.reduce((total, item) => total + Number(item.thirdEntityContamination ?? 0), 0),
        providerTransients: results.filter(item => item.failureSubtype === 'provider_transient_failure').length,
        providerTimeouts: results.filter(item => item.failureSubtype === 'provider_timeout').length,
        providerPermanentFailures: results.filter(item => item.failureSubtype === 'provider_permanent_failure').length,
        providerSafetyBlocks: results.filter(item => item.failureSubtype === 'provider_safety_block').length,
        unknownProviderFailures: results.filter(item => item.failureSubtype === 'provider_unknown_failure').length,
        structuredFailures: availability.filter(item => item === 'structured_generation_fail_closed').length,
        citationValidationFailures: availability.filter(item => item === 'citation_validation_fail_closed').length,
        qualityFailures: availability.filter(item => item === 'quality_validation_fail_closed').length,
        otherSafeFailures: availability.filter(item => item === 'other_safe_failure').length,
        providerDiagnostics: process.env.NOOR_PROVIDER_DIAGNOSTICS === '1'
            ? {
                totalCalls: providerDiagnostics.length,
                successfulCalls: providerDiagnostics.filter(item => item.outcome === 'success').length,
                failedCalls: providerDiagnostics.filter(item => item.outcome !== 'success'),
                latencyP50Ms: percentile(providerDiagnostics.map(item => item.latencyMs), 0.5),
                latencyP95Ms: percentile(providerDiagnostics.map(item => item.latencyMs), 0.95),
                inputCharactersMin: Math.min(...providerDiagnostics.map(item => item.inputCharacters)),
                inputCharactersMax: Math.max(...providerDiagnostics.map(item => item.inputCharacters)),
                requestPayloadBytesMin: Math.min(...providerDiagnostics.map(item => item.requestPayloadBytes)),
                requestPayloadBytesMax: Math.max(...providerDiagnostics.map(item => item.requestPayloadBytes)),
            }
            : undefined,
        harnessErrors: process.env.NOOR_PROVIDER_DIAGNOSTICS === '1'
            ? harnessErrors
            : undefined,
        failedCaseIds: results.filter(item => !item.passed).map(item => item.id),
        results,
    };
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
    if (report.answerSuccessRate < manifest.thresholds.multiEntityAnswerSuccessRate
        || report.provenancePassRate < manifest.thresholds.multiEntityProvenancePassRate) process.exitCode = 1;
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${JSON.stringify({
            phase: 'real_multi_entity', status: 'UNVERIFIED', ...safeBenchmarkError(error),
        }, undefined, 2)}\n`);
        process.exitCode = 2;
    });
}
