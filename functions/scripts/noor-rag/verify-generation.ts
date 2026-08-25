import { randomUUID } from 'node:crypto';

import { GoogleGenAI } from '@google/genai';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { isEntitySummaryEvidenceSufficient } from '../../src/noor-rag/answerability';
import { readRuntimeConfig, verifyCorpusReady } from '../../src/noor-rag/firestore';
import {
    buildGroundedPrompt,
    createVertexGenerationProvider,
    generateGroundedAnswer,
    getGenerationDiagnostics,
    type GenerationDiagnostics,
} from '../../src/noor-rag/generation';
import { buildChatQueryPlan } from '../../src/noor-rag/queryRewrite';
import { createFirestoreRetrievalRepository, retrieveEntitySummaryWithStats } from '../../src/noor-rag/retrieval';
import { buildSynthesisCoverageRequirement, synthesisCoveragePassed } from '../../src/noor-rag/synthesisCoverage';
import type { NoorAnswer, NoorChatRequest, RetrievedEvidence } from '../../src/noor-rag/types';
import { LOCKED_CORPUS_VERSION, LOCKED_PROJECT } from './verify-index';

type GenerationOutcomeClass =
    | 'answered'
    | 'provider_failure'
    | 'structured_failure'
    | 'citation_failure'
    | 'quality_failure'
    | 'other_failure';

interface VerificationCase {
    id: 'AlNas' | 'Maryam' | 'Yusuf';
    question: string;
}

interface CaseMetrics {
    id: VerificationCase['id'];
    runs: number;
    answered: number;
    providerFailure: number;
    structuredFailure: number;
    citationFailure: number;
    qualityFailure: number;
    otherFailure: number;
    medianLatencyMs: number;
    p95LatencyMs: number;
    unsupportedCitationsAccepted: number;
    selectedEvidenceCitationMismatch: number;
    crossSurahEvidenceAccepted: number;
    coverageFailuresAccepted: number;
}

const CASES: readonly VerificationCase[] = [
    { id: 'AlNas', question: 'Summarize Surah Al-Nas.' },
    { id: 'Maryam', question: 'What is Surah Maryam about?' },
    { id: 'Yusuf', question: 'Give me an overview of Surah Yusuf.' },
];

export function classifyGenerationOutcome(
    answer: Pick<NoorAnswer, 'status'>,
    diagnostics: GenerationDiagnostics | null,
): GenerationOutcomeClass {
    if (answer.status === 'answered') return 'answered';
    const errorClass = diagnostics?.errorClass;
    if (errorClass === 'provider_transient_failure'
        || errorClass === 'provider_permanent_failure'
        || errorClass === 'provider_timeout') return 'provider_failure';
    if (errorClass === 'malformed_json' || errorClass === 'answer_validation_failure') return 'structured_failure';
    if (errorClass === 'citation_validation_failure') return 'citation_failure';
    if (errorClass === 'answer_quality_failure' || errorClass === 'answer_quality_judgement_failure') return 'quality_failure';
    return 'other_failure';
}

function percentile(values: readonly number[], percentileValue: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)]!;
}

function parseRuns(args: readonly string[]): number {
    const raw = args.find(value => value.startsWith('--runs='))?.slice('--runs='.length) ?? '10';
    const runs = Number(raw);
    if (!Number.isSafeInteger(runs) || runs < 1 || runs > 20) throw new Error('runs must be an integer from 1 to 20');
    return runs;
}

function selectedEvidenceCitationMismatch(answer: NoorAnswer, evidence: readonly RetrievedEvidence[]): boolean {
    const selected = new Set(evidence.map(item => [
        item.chunk.chunkId,
        item.chunk.canonicalUnitId,
        item.chunk.source,
        item.chunk.surah,
        item.chunk.verseStart,
        item.chunk.verseEnd,
    ].join(':')));
    return answer.citations.some(citation => !selected.has([
        citation.chunkId,
        citation.canonicalUnitId,
        citation.source,
        citation.surah,
        citation.verseStart,
        citation.verseEnd,
    ].join(':')));
}

async function main(): Promise<void> {
    const runs = parseRuns(process.argv.slice(2));
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: LOCKED_PROJECT }, `noor-generation-verify-${Date.now()}`);
    const results: CaseMetrics[] = [];
    try {
        const firestore = getFirestore(app);
        const config = await readRuntimeConfig(firestore);
        if (!await verifyCorpusReady(firestore, config)) throw new Error('active corpus is not ready');
        if (config.activeCorpusVersion !== LOCKED_CORPUS_VERSION) throw new Error('active corpus version is not locked');
        const repository = createFirestoreRetrievalRepository(firestore);
        const vertex = new GoogleGenAI({ vertexai: true, project: LOCKED_PROJECT, location: 'global' });
        const provider = createVertexGenerationProvider(LOCKED_PROJECT, () => vertex);

        for (const testCase of CASES) {
            const seedRequest: NoorChatRequest = {
                mode: 'chat', requestId: randomUUID(), question: testCase.question, history: [],
            };
            const plan = buildChatQueryPlan({ request: seedRequest, validatedConversationState: null });
            if (plan.retrievalTask !== 'entity_summary' || plan.entity === null) {
                throw new Error(`case ${testCase.id} did not resolve to entity summary`);
            }
            const retrieval = await retrieveEntitySummaryWithStats({ entity: plan.entity, config, repository });
            if (!isEntitySummaryEvidenceSufficient(plan.entity, retrieval.evidence)) {
                throw new Error(`case ${testCase.id} evidence was not answerable`);
            }
            const selected = buildGroundedPrompt(
                seedRequest,
                retrieval.evidence,
                config.maxEvidenceCharacters,
                plan,
            ).evidence;
            const coverageRequirement = buildSynthesisCoverageRequirement(plan.entity, selected);
            const counts: Record<GenerationOutcomeClass, number> = {
                answered: 0,
                provider_failure: 0,
                structured_failure: 0,
                citation_failure: 0,
                quality_failure: 0,
                other_failure: 0,
            };
            const latencies: number[] = [];
            let unsupportedCitationsAccepted = 0;
            let citationSelectionMismatch = 0;
            let crossSurahEvidenceAccepted = 0;
            let coverageFailuresAccepted = 0;

            for (let run = 0; run < runs; run += 1) {
                const request: NoorChatRequest = { ...seedRequest, requestId: randomUUID() };
                const startedAt = Date.now();
                const answer = await generateGroundedAnswer({
                    request,
                    evidence: retrieval.evidence,
                    maxEvidenceCharacters: config.maxEvidenceCharacters,
                    provider,
                    taskPlan: plan,
                });
                latencies.push(Math.max(0, Date.now() - startedAt));
                const diagnostics = getGenerationDiagnostics(answer);
                counts[classifyGenerationOutcome(answer, diagnostics)] += 1;
                if (answer.status !== 'answered') continue;
                const selectionMismatch = selectedEvidenceCitationMismatch(answer, selected);
                if (selectionMismatch) citationSelectionMismatch += 1;
                if (selectionMismatch || diagnostics?.qualityJudgeInvoked !== true) unsupportedCitationsAccepted += 1;
                if (answer.citations.some(citation => citation.surah !== plan.entity!.surahNumber)) crossSurahEvidenceAccepted += 1;
                if (!synthesisCoveragePassed(answer.answer, selected, coverageRequirement)) coverageFailuresAccepted += 1;
            }

            results.push({
                id: testCase.id,
                runs,
                answered: counts.answered,
                providerFailure: counts.provider_failure,
                structuredFailure: counts.structured_failure,
                citationFailure: counts.citation_failure,
                qualityFailure: counts.quality_failure,
                otherFailure: counts.other_failure,
                medianLatencyMs: percentile(latencies, 0.5),
                p95LatencyMs: percentile(latencies, 0.95),
                unsupportedCitationsAccepted,
                selectedEvidenceCitationMismatch: citationSelectionMismatch,
                crossSurahEvidenceAccepted,
                coverageFailuresAccepted,
            });
        }
    } finally {
        await deleteApp(app);
    }

    const failed = results.some(result => (
        result.answered < result.runs - 1
        || result.structuredFailure + result.citationFailure + result.qualityFailure + result.otherFailure > 1
        || result.unsupportedCitationsAccepted > 0
        || result.crossSurahEvidenceAccepted > 0
        || result.coverageFailuresAccepted > 0
    ));
    process.stdout.write(`${JSON.stringify({
        project: LOCKED_PROJECT,
        provider: 'vertex',
        corpusVersion: LOCKED_CORPUS_VERSION,
        semanticSupportValidation: 'enforced_by_evidence_bound_quality_judge',
        results,
        status: failed ? 'FAILED' : 'VERIFIED',
    }, undefined, 2)}\n`);
    if (failed) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('REAL VERTEX GENERATION CONTRACT: UNVERIFIED\n');
        process.exitCode = 2;
    });
}
