import { GoogleGenAI } from '@google/genai';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { isEntitySummaryEvidenceSufficient, selectAnswerableEvidence } from '../../src/noor-rag/answerability';
import { createVertexEmbedder, type VertexEmbeddingClient } from '../../src/noor-rag/embedding';
import { readRuntimeConfig, verifyCorpusReady } from '../../src/noor-rag/firestore';
import {
    buildChatQueryPlan,
    buildControlledRecoveryQuery,
    createValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import {
    createFirestoreRetrievalRepository,
    retrieveEntitySummaryWithStats,
    retrieveSemanticWithStats,
} from '../../src/noor-rag/retrieval';
import type { NoorAnswer, NoorChatRequest, RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';
import { LOCKED_PROJECT } from './verify-index';

const EXPECTED_NOAH_CHUNK = 'c_0ad0b17c1dc61edfe7924318e1cb73dfeaf1c32415783dde9fe71b99bba1f8e4_000_e29e57df16f7';
const EXPECTED_RIBA_UNIT = 'u_3e82d7e6606c4f68383c9a038f58da1b418018fcbc9409974167a44bef94399c';
const EXPECTED_BAQARAH_CHUNK = 'c_4bf4f3f0cf5d6a2c2b05debd600e5533150ce9f4aa8540578f09bfc493d15e11_000_58fe037abefb';
const FORBIDDEN_BAQARAH_CHUNK = 'c_0c5c342e9579326bbc457839c78ef9603ecd8c7de87c9c8b26e6a0757503a299_000_12f0dac8ffdc';

interface RetrievalPreflightCase {
    id: 'Noah' | 'Riba' | 'AlBaqarah' | 'Football';
    query: string;
    expectAnswerable: boolean;
    matchesExpectedEvidence(evidence: RetrievedEvidence): boolean;
    forbiddenAnswerableIds?: readonly string[];
}

interface RetrievalPreflightCaseResult {
    id: RetrievalPreflightCase['id'];
    query: string;
    candidateIds: string[];
    answerableIds: string[];
    passed: boolean;
    retrievalPath: 'point_question';
    retrievalMs: number;
    evidenceCount: number;
    evidenceTokenCount: number;
}

interface SynthesisPreflightCase {
    id: 'AlBaqarahThemes' | 'YusufSummary' | 'MaryamOverview';
    query: string;
}

interface SynthesisPreflightCaseResult {
    id: SynthesisPreflightCase['id'];
    query: string;
    retrievalPath: 'entity_summary';
    entity: { surahNumber: number; canonicalName: string };
    anchorVerses: readonly number[];
    candidateCount: number;
    evidenceCount: number;
    evidenceTokenCount: number;
    evidenceRanges: string[];
    sourceCount: number;
    retrievalMs: number;
    passed: boolean;
}

function baqarahContextQuery(): string {
    const priorRequest: NoorChatRequest = {
        mode: 'chat',
        requestId: '30000000-0000-4000-8000-000000000001',
        question: 'Tell me about Surah Al-Baqarah.',
        history: [],
    };
    const text = 'Virtues of Surat Al-Baqarah';
    const chunk: TafsirChunk = {
        chunkId: EXPECTED_BAQARAH_CHUNK,
        canonicalUnitId: 'preflight-baqarah-unit',
        chunkIndex: 0,
        source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir',
        language: 'en',
        surah: 2,
        verseStart: 1,
        verseEnd: 1,
        originalStart: 0,
        originalEnd: text.length,
        originalText: text,
        retrievalText: text,
        corpusVersion: 'state-fixture-only',
        contentHash: 'state-fixture-only',
        tokenCount: 4,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
    const evidence: RetrievedEvidence = { kind: 'semantic', promptSourceId: 'S1', chunk, similarity: 1 };
    const response: NoorAnswer = {
        requestId: priorRequest.requestId,
        status: 'answered',
        answer: 'Grounded preflight state fixture. [S1]',
        citations: [{
            chunkId: chunk.chunkId,
            canonicalUnitId: chunk.canonicalUnitId,
            source: chunk.source,
            sourceTitle: chunk.sourceTitle,
            surah: chunk.surah,
            verseStart: chunk.verseStart,
            verseEnd: chunk.verseEnd,
            corpusVersion: chunk.corpusVersion,
        }],
    };
    const state = createValidatedConversationState({ request: priorRequest, response, evidence: [evidence] });
    if (state === null) throw new Error('Could not construct the deterministic conversation-state preflight fixture');
    const request: NoorChatRequest = {
        mode: 'chat',
        requestId: '30000000-0000-4000-8000-000000000002',
        question: 'But what is its significance in Islam?',
        history: [
            { role: 'user', content: priorRequest.question },
            { role: 'assistant', content: 'Grounded prior answer.' },
        ],
    };
    const plan = buildChatQueryPlan({ request, validatedConversationState: state });
    const contextual = plan.variants.find(variant => variant.kind === 'context_enriched');
    if (!plan.contextSelected || contextual === undefined) {
        throw new Error('Al-Baqarah contextual query was not constructed');
    }
    return contextual.query;
}

function preflightCases(): readonly RetrievalPreflightCase[] {
    return [
        {
            id: 'Noah',
            query: 'Tell me about Noah.',
            expectAnswerable: true,
            matchesExpectedEvidence: evidence => evidence.chunk.chunkId === EXPECTED_NOAH_CHUNK,
        },
        {
            id: 'Riba',
            query: 'What does the Quran say about riba?',
            expectAnswerable: true,
            matchesExpectedEvidence: evidence => evidence.chunk.canonicalUnitId === EXPECTED_RIBA_UNIT,
        },
        {
            id: 'AlBaqarah',
            query: baqarahContextQuery(),
            expectAnswerable: true,
            matchesExpectedEvidence: evidence => evidence.chunk.chunkId === EXPECTED_BAQARAH_CHUNK
                || /virtues of surat al-baqarah/iu.test(`${evidence.chunk.retrievalText} ${evidence.chunk.originalText}`),
            forbiddenAnswerableIds: [FORBIDDEN_BAQARAH_CHUNK],
        },
        {
            id: 'Football',
            query: 'What was the latest football score?',
            expectAnswerable: false,
            matchesExpectedEvidence: () => true,
        },
    ];
}

function synthesisPreflightCases(): readonly SynthesisPreflightCase[] {
    return [
        { id: 'AlBaqarahThemes', query: 'What are the main themes of Surah Al-Baqarah?' },
        { id: 'YusufSummary', query: 'Summarize Surah Yusuf.' },
        { id: 'MaryamOverview', query: 'What is Surah Maryam mainly about?' },
    ];
}

async function main(): Promise<void> {
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: LOCKED_PROJECT }, `noor-retrieval-preflight-${Date.now()}`);
    const firestore = getFirestore(app);
    const config = await readRuntimeConfig(firestore);
    if (!await verifyCorpusReady(firestore, config)) throw new Error('Active Noor corpus is not ready');
    const vertex = new GoogleGenAI({ vertexai: true, project: LOCKED_PROJECT, location: 'global' });
    const embedder = createVertexEmbedder(vertex.models as VertexEmbeddingClient);
    const repository = createFirestoreRetrievalRepository(firestore);
    const results: RetrievalPreflightCaseResult[] = [];
    const synthesisResults: SynthesisPreflightCaseResult[] = [];

    for (const testCase of preflightCases()) {
        const startedAt = Date.now();
        const retrieval = await retrieveSemanticWithStats({
            content: testCase.query,
            config,
            embedder,
            repository,
        });
        const answerable = selectAnswerableEvidence(testCase.query, retrieval.evidence, config);
        const hasExpectedEvidence = testCase.expectAnswerable
            ? answerable.some(testCase.matchesExpectedEvidence)
            : answerable.length === 0;
        const hasForbiddenEvidence = (testCase.forbiddenAnswerableIds ?? [])
            .some(chunkId => answerable.some(item => item.chunk.chunkId === chunkId));
        results.push({
            id: testCase.id,
            query: testCase.query,
            candidateIds: retrieval.evidence.map(item => item.chunk.chunkId),
            answerableIds: answerable.map(item => item.chunk.chunkId),
            passed: hasExpectedEvidence && !hasForbiddenEvidence,
            retrievalPath: 'point_question',
            retrievalMs: Math.max(0, Date.now() - startedAt),
            evidenceCount: answerable.length,
            evidenceTokenCount: answerable.reduce((total, item) => total + item.chunk.tokenCount, 0),
        });
    }

    for (const testCase of synthesisPreflightCases()) {
        const request: NoorChatRequest = {
            mode: 'chat',
            requestId: `40000000-0000-4000-8000-${String(synthesisResults.length + 1).padStart(12, '0')}`,
            question: testCase.query,
            history: [],
        };
        const plan = buildChatQueryPlan({ request, validatedConversationState: null });
        if (plan.retrievalTask !== 'entity_summary' || plan.entity === null) {
            throw new Error(`Synthesis task did not resolve: ${testCase.id}`);
        }
        const startedAt = Date.now();
        const retrieval = await retrieveEntitySummaryWithStats({
            entity: plan.entity,
            config,
            repository,
        });
        const retrievalMs = Math.max(0, Date.now() - startedAt);
        const evidenceRanges = retrieval.evidence.map(item => `${item.chunk.surah}:${item.chunk.verseStart}-${item.chunk.verseEnd}`);
        const sameEntity = retrieval.evidence.every(item => item.chunk.surah === plan.entity!.surahNumber);
        const bounded = retrieval.candidateCount <= 48 && retrieval.evidence.length <= 8;
        synthesisResults.push({
            id: testCase.id,
            query: testCase.query,
            retrievalPath: 'entity_summary',
            entity: { surahNumber: plan.entity.surahNumber, canonicalName: plan.entity.canonicalName },
            anchorVerses: retrieval.anchorVerses,
            candidateCount: retrieval.candidateCount,
            evidenceCount: retrieval.evidence.length,
            evidenceTokenCount: retrieval.evidence.reduce((total, item) => total + item.chunk.tokenCount, 0),
            evidenceRanges,
            sourceCount: new Set(retrieval.evidence.map(item => item.chunk.source)).size,
            retrievalMs,
            passed: sameEntity && bounded && isEntitySummaryEvidenceSufficient(plan.entity, retrieval.evidence),
        });
    }

    const failed = [...results, ...synthesisResults].filter(result => !result.passed);
    process.stdout.write(`${JSON.stringify({
        project: LOCKED_PROJECT,
        corpusVersion: config.activeCorpusVersion,
        generationCalls: 0,
        recoveryQueryForUnsupported: buildControlledRecoveryQuery({
            request: {
                mode: 'chat',
                requestId: '30000000-0000-4000-8000-000000000003',
                question: 'What was the latest football score?',
                history: [],
            },
        }),
        passed: results.length + synthesisResults.length - failed.length,
        failed: failed.length,
        cases: results,
        synthesisCases: synthesisResults,
    }, undefined, 2)}\n`);
    process.stdout.write(`SEMANTIC RETRIEVAL PREFLIGHT: ${failed.length === 0 ? 'VERIFIED' : 'FAILED'}\n`);
    if (failed.length > 0) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('SEMANTIC RETRIEVAL PREFLIGHT: UNVERIFIED\n');
        process.exitCode = 2;
    });
}
