import { GoogleGenAI } from '@google/genai';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { createVertexEmbedder } from '../../src/noor-rag/embedding';
import {
    createVertexGenerationProvider,
    generateGroundedAnswer,
} from '../../src/noor-rag/generation';
import { handleNoorRequest, type NoorSanitizedTrace } from '../../src/noor-rag/handler';
import { classifyRequestPolicy } from '../../src/noor-rag/policy';
import { createVertexPersonalizedRulingClassifier } from '../../src/noor-rag/personalizedRulingClassifier';
import {
    createFirestoreRetrievalRepository,
    retrieveEntitySummaryWithStats,
    retrieveExactVerse,
    retrieveSemanticWithStats,
} from '../../src/noor-rag/retrieval';
import { createVertexSemanticTaskClassifier } from '../../src/noor-rag/semanticTaskClassifier';
import type { NoorAnswer, NoorRequest, RetrievedEvidence } from '../../src/noor-rag/types';
import { readRuntimeConfig, verifyCorpusReady } from '../../src/noor-rag/firestore';
import { LOCKED_PROJECT } from './verify-index';

export type NormativeExpectation = 'safe_abstention' | 'direct_answer' | 'descriptive_answer';

export interface NormativeObservation {
    taskType: string;
    contextSelected: boolean;
    retrievedRelevant: boolean;
    requestedRelation: 'prohibition' | 'description' | 'condemnation';
    postAnswerabilityEvidenceCount: number;
    generationCalls: number;
    status: NoorAnswer['status'];
    citationCount: number;
    statePersisted: boolean;
    answeredUsageIncrement: number;
    answerability: string;
}

export interface NormativeEvaluation {
    passed: boolean;
    failures: string[];
}

export function evaluateNormativeObservation(
    expectation: NormativeExpectation,
    observation: NormativeObservation,
): NormativeEvaluation {
    const failures: string[] = [];
    if (observation.taskType !== 'point_question') failures.push('task must be point_question');
    if (!observation.retrievedRelevant) failures.push('retrieval must find relevant evidence');
    if (expectation === 'safe_abstention') {
        if (observation.contextSelected) failures.push('context must not be selected');
        if (observation.requestedRelation !== 'prohibition') failures.push('requested relation must be prohibition');
        if (observation.postAnswerabilityEvidenceCount !== 0) failures.push('post-answerability evidence must be empty');
        if (observation.generationCalls !== 0) failures.push('generation must not be invoked');
        if (observation.status !== 'insufficient_evidence') failures.push('status must be insufficient_evidence');
        if (observation.citationCount !== 0) failures.push('citations must be empty');
        if (observation.statePersisted) failures.push('conversation state must not persist');
        if (observation.answeredUsageIncrement !== 0) failures.push('answered usage increment must be zero');
        if (observation.answerability !== 'insufficient') failures.push('answerability must be insufficient');
    } else {
        if (observation.status !== 'answered') failures.push('status must be answered');
        if (observation.citationCount === 0) failures.push('answered result must contain citations');
        if (observation.generationCalls === 0) failures.push('generation must be eligible and invoked');
        if (!observation.statePersisted) failures.push('answered conversation state must persist');
        if (observation.answeredUsageIncrement !== 1) failures.push('answered usage increment must be one');
        if (observation.answerability !== 'sufficient') failures.push('answerability must be sufficient');
    }
    return { passed: failures.length === 0, failures };
}

interface NormativeCase {
    id: string;
    question: string;
    expectation: NormativeExpectation;
    requestedRelation: NormativeObservation['requestedRelation'];
    relevantPattern: RegExp;
}

const CASES: readonly NormativeCase[] = [
    {
        id: 'ArroganceHaram',
        question: 'Is arrogance haram?',
        expectation: 'safe_abstention',
        requestedRelation: 'prohibition',
        relevantPattern: /arrog|pride|proud|haught|boast|conceit/iu,
    },
    {
        id: 'RibaHaram',
        question: 'Is riba haram?',
        expectation: 'direct_answer',
        requestedRelation: 'prohibition',
        relevantPattern: /\briba\b|\binterest\b/iu,
    },
    {
        id: 'ArroganceDescription',
        question: 'What does the Quran say about arrogance?',
        expectation: 'descriptive_answer',
        requestedRelation: 'description',
        relevantPattern: /arrog|pride|proud|haught|boast|conceit/iu,
    },
    {
        id: 'ArroganceCondemnation',
        question: 'Why is arrogance condemned?',
        expectation: 'descriptive_answer',
        requestedRelation: 'condemnation',
        relevantPattern: /arrog|pride|proud|haught|boast|conceit|condemn/iu,
    },
];

interface CaseResult {
    id: string;
    question: string;
    expectation: NormativeExpectation;
    corpusVersion: string;
    taskType: string | null;
    contextSelected: boolean | null;
    retrievedRelevant: boolean;
    requestedRelation: NormativeObservation['requestedRelation'];
    postAnswerabilityEvidenceCount: number | null;
    generationCalls: number;
    status: NoorAnswer['status'] | 'error';
    citationCount: number;
    statePersisted: boolean;
    answeredUsageIncrement: number;
    answerability: string | null;
    passed: boolean;
    failures: readonly string[];
}

function relevantEvidence(evidence: readonly RetrievedEvidence[], pattern: RegExp): boolean {
    return evidence.some(item => pattern.test(`${item.chunk.retrievalText} ${item.chunk.originalText}`));
}

function requestFor(question: string, index: number): NoorRequest {
    return {
        mode: 'chat',
        requestId: `77777777-7777-4777-8777-${String(index + 1).padStart(12, '0')}`,
        question,
        history: [],
    };
}

async function runCase(
    testCase: NormativeCase,
    index: number,
    config: Awaited<ReturnType<typeof readRuntimeConfig>>,
    firestore: ReturnType<typeof getFirestore>,
    embedder: ReturnType<typeof createVertexEmbedder>,
    generationProvider: ReturnType<typeof createVertexGenerationProvider>,
    personalizedClassifier: ReturnType<typeof createVertexPersonalizedRulingClassifier>,
    semanticTaskClassifier: ReturnType<typeof createVertexSemanticTaskClassifier>,
): Promise<CaseResult> {
    const request = requestFor(testCase.question, index);
    const repository = createFirestoreRetrievalRepository(firestore);
    const retrieved: RetrievedEvidence[] = [];
    let trace: NoorSanitizedTrace | null = null;
    let generationCalls = 0;
    let answeredUsageIncrement = 0;
    let statePersisted = false;
    try {
        const response = await handleNoorRequest({
            request,
            uid: `normative-harness-${index}`,
            invocationId: `normative-harness-${index}`,
            dependencies: {
                loadRuntimeConfig: async () => config,
                verifyCorpusReady: async () => true,
                readCompletedReplay: async () => null,
                resolveEntitlement: async () => ({ class: 'paid', expiresAt: null, source: 'revenuecat' }),
                claimUsage: async input => ({
                    kind: 'claimed',
                    leaseOwnerId: input.invocationId,
                    leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
                }),
                classifyPolicy: classifyRequestPolicy,
                classifyPersonalizedRuling: input => personalizedClassifier.classify(input),
                classifySemanticTask: input => semanticTaskClassifier.classify(input),
                retrieveSemantic: async input => {
                    const result = await retrieveSemanticWithStats({
                        content: input.query,
                        config: input.config,
                        embedder,
                        repository,
                    });
                    retrieved.push(...result.evidence);
                    return result;
                },
                retrieveEntitySummary: input => retrieveEntitySummaryWithStats({
                    entity: input.entity,
                    config: input.config,
                    repository,
                }),
                retrieveExact: input => retrieveExactVerse({
                    source: input.request.source,
                    surah: input.request.surah,
                    verse: input.request.verse,
                    config: input.config,
                    repository,
                }),
                generateGroundedAnswer: async input => {
                    generationCalls += 1;
                    return generateGroundedAnswer({
                        request: input.request,
                        evidence: input.evidence,
                        maxEvidenceCharacters: input.config.maxEvidenceCharacters,
                        provider: generationProvider,
                        taskPlan: input.taskPlan,
                    });
                },
                finalizeAnswered: async () => {
                    answeredUsageIncrement += 1;
                    return { kind: 'finalized' };
                },
                finalizeNonAnswer: async () => ({ kind: 'finalized' }),
                readValidatedConversationState: async () => null,
                writeValidatedConversationState: async () => {
                    statePersisted = true;
                },
                emitTelemetry: async () => undefined,
                emitSanitizedTrace: async value => {
                    trace = value;
                },
                nowMs: Date.now,
            },
        });
        const capturedTrace = trace as NoorSanitizedTrace | null;
        const observation: NormativeObservation = {
            taskType: capturedTrace?.taskType ?? 'unknown',
            contextSelected: capturedTrace?.contextSelected ?? true,
            retrievedRelevant: relevantEvidence(retrieved, testCase.relevantPattern),
            requestedRelation: testCase.requestedRelation,
            postAnswerabilityEvidenceCount: capturedTrace?.postAnswerabilityEvidenceIds.length ?? -1,
            generationCalls,
            status: response.status,
            citationCount: response.citations.length,
            statePersisted: statePersisted || capturedTrace?.statePersistence === 'persisted',
            answeredUsageIncrement,
            answerability: capturedTrace?.answerabilityReason ?? 'not_run',
        };
        const evaluation = evaluateNormativeObservation(testCase.expectation, observation);
        return {
            id: testCase.id,
            question: testCase.question,
            expectation: testCase.expectation,
            corpusVersion: config.activeCorpusVersion,
            taskType: capturedTrace?.taskType ?? null,
            contextSelected: capturedTrace?.contextSelected ?? null,
            retrievedRelevant: observation.retrievedRelevant,
            requestedRelation: testCase.requestedRelation,
            postAnswerabilityEvidenceCount: capturedTrace?.postAnswerabilityEvidenceIds.length ?? null,
            generationCalls,
            status: response.status,
            citationCount: response.citations.length,
            statePersisted: observation.statePersisted,
            answeredUsageIncrement,
            answerability: capturedTrace?.answerabilityReason ?? null,
            passed: evaluation.passed,
            failures: evaluation.failures,
        };
    } catch (error: unknown) {
        const capturedTrace = trace as NoorSanitizedTrace | null;
        return {
            id: testCase.id,
            question: testCase.question,
            expectation: testCase.expectation,
            corpusVersion: config.activeCorpusVersion,
            taskType: capturedTrace?.taskType ?? null,
            contextSelected: capturedTrace?.contextSelected ?? null,
            retrievedRelevant: relevantEvidence(retrieved, testCase.relevantPattern),
            requestedRelation: testCase.requestedRelation,
            postAnswerabilityEvidenceCount: capturedTrace?.postAnswerabilityEvidenceIds.length ?? null,
            generationCalls,
            status: 'error',
            citationCount: 0,
            statePersisted,
            answeredUsageIncrement,
            answerability: capturedTrace?.answerabilityReason ?? null,
            passed: false,
            failures: [error instanceof Error ? error.message : 'normative verifier error'],
        };
    }
}

async function main(): Promise<void> {
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: LOCKED_PROJECT }, `noor-normative-${Date.now()}`);
    try {
        const firestore = getFirestore(app);
        const config = await readRuntimeConfig(firestore);
        if (config.activeCorpusVersion !== '2026-08-10-v1' || !await verifyCorpusReady(firestore, config)) {
            throw new Error('Promoted Noor corpus is not the locked ready version');
        }
        const vertex = new GoogleGenAI({ vertexai: true, project: LOCKED_PROJECT, location: 'global' });
        const embedder = createVertexEmbedder(vertex.models);
        const generationProvider = createVertexGenerationProvider(LOCKED_PROJECT, () => vertex);
        const personalizedClassifier = createVertexPersonalizedRulingClassifier(vertex);
        const semanticTaskClassifier = createVertexSemanticTaskClassifier(vertex);
        const results = [] as CaseResult[];
        for (const [index, testCase] of CASES.entries()) {
            results.push(await runCase(
                testCase,
                index,
                config,
                firestore,
                embedder,
                generationProvider,
                personalizedClassifier,
                semanticTaskClassifier,
            ));
        }
        const failed = results.filter(result => !result.passed);
        process.stdout.write(`${JSON.stringify({
            project: LOCKED_PROJECT,
            corpusVersion: config.activeCorpusVersion,
            cases: results,
            passed: results.length - failed.length,
            failed: failed.length,
        }, undefined, 2)}\n`);
        process.stdout.write(`NORMATIVE REAL-CORPUS GATE: ${failed.length === 0 ? 'VERIFIED' : 'FAILED'}\n`);
        if (failed.length > 0) process.exitCode = 1;
    } finally {
        await deleteApp(app);
    }
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('NORMATIVE REAL-CORPUS GATE: UNVERIFIED\n');
        process.exitCode = 2;
    });
}
