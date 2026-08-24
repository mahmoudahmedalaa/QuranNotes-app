import { createHash } from 'node:crypto';

import { GoogleGenAI } from '@google/genai';

import { GENERATION_MODEL, VERTEX_GENERATION_LOCATION } from '../../src/noor-rag/generation';
import {
    applySemanticTaskClassification,
    buildChatQueryPlan,
    buildSemanticTaskFallbackInput,
    type DiscourseEntity,
    type NoorTaskType,
    type ValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import {
    createVertexSemanticTaskClassifier,
    type SemanticTaskClassifier,
    type VertexSemanticTaskClassifierClient,
} from '../../src/noor-rag/semanticTaskClassifier';
import type { NoorChatRequest } from '../../src/noor-rag/types';

const NOOR_PROJECT = 'qurannotes-9f7a1';
const REQUEST_ID = '93000000-0000-4000-8000-000000000001';

export type SemanticTaskEvaluationGroup = 'synthesis' | 'point' | 'contextual' | 'multi_entity';

export interface SemanticTaskEvaluationCase {
    id: string;
    group: SemanticTaskEvaluationGroup;
    question: string;
    expectedTaskType: NoorTaskType;
    expectedEntityIds: readonly string[];
    frame?: 'single' | 'pair';
}

export interface SemanticTaskEvaluationSummary {
    classifierModel: typeof GENERATION_MODEL;
    totalCases: number;
    deterministicCases: number;
    semanticFallbackCases: number;
    deterministicPlannerRate: number;
    semanticFallbackRate: number;
    fallbackMedianLatencyMs: number;
    fallbackP95LatencyMs: number;
    materialFailures: number;
    classifierFailures: number;
    failureCaseIds: string[];
    failureDetails: Array<{
        caseId: string;
        observed: NoorTaskType | `failure:${string}` | 'entity_mismatch';
    }>;
}

const PAIR_ENTITIES: readonly DiscourseEntity[] = [
    { id: 'subject:nuh', label: 'nuh', kind: 'subject' },
    { id: 'subject:musa', label: 'musa', kind: 'subject' },
];
const PAIR_QUESTION = 'nuh vs musa whats different';
const SINGLE_QUESTION = 'tell me abt nuh';

function evaluationCase(
    id: string,
    group: SemanticTaskEvaluationGroup,
    question: string,
    expectedTaskType: NoorTaskType,
    expectedEntityIds: readonly string[] = [],
    frame?: 'single' | 'pair',
): SemanticTaskEvaluationCase {
    return { id, group, question, expectedTaskType, expectedEntityIds, ...(frame ? { frame } : {}) };
}

export const SEMANTIC_TASK_EVALUATION_CASES: readonly SemanticTaskEvaluationCase[] = [
    evaluationCase('summary-maryam-abt', 'synthesis', 'what surah maryam abt', 'entity_summary', ['surah:19']),
    evaluationCase('summary-kahf-main-thing', 'synthesis', 'tell me main thing in kahf', 'entity_summary', ['surah:18']),
    evaluationCase('summary-baqarah-basically', 'synthesis', 'whats baqarah basically about', 'entity_summary', ['surah:2']),
    evaluationCase('summary-yusuf-simple', 'synthesis', 'explain surah yusuf simply', 'entity_summary', ['surah:12']),
    evaluationCase('summary-mulk-gist', 'synthesis', 'give me gist of surah mulk', 'entity_summary', ['surah:67']),
    evaluationCase('summary-kahf-learn', 'synthesis', 'what can i learn frm surah kahf', 'entity_summary', ['surah:18']),
    evaluationCase('summary-nas-plz', 'synthesis', 'summarise al nas plz', 'entity_summary', ['surah:114']),
    evaluationCase('summary-maryam-mainly', 'synthesis', 'what maryam mainly saying', 'entity_summary', ['surah:19']),
    evaluationCase('summary-baqara-new', 'synthesis', 'explain baqara like im new', 'entity_summary', ['surah:2']),
    evaluationCase('summary-yusuf-msg', 'synthesis', 'what is the overall msg of surah yusuf', 'entity_summary', ['surah:12']),
    evaluationCase('summary-yusuf-modified-about', 'synthesis', 'What is Surah Yusuf basically about?', 'entity_summary', ['surah:12']),

    evaluationCase('point-who-maryam', 'point', 'who is maryam', 'point_question'),
    evaluationCase('point-nuh-rejection', 'point', 'why did nuh ppl reject him', 'point_question'),
    evaluationCase('point-yusuf-prison', 'point', 'what happened to yusuf in prison', 'point_question'),
    evaluationCase('point-exact-verse', 'point', 'what does 2:275 say', 'point_question'),
    evaluationCase('point-riba', 'point', 'is riba harram', 'point_question'),
    evaluationCase('point-arrogance', 'point', 'why is arrogance bad', 'point_question'),
    evaluationCase('point-nuh-duration', 'point', 'how long did nuh preach', 'point_question'),
    evaluationCase('point-musa-sea', 'point', 'what happened after musa crossed the sea', 'point_question'),
    evaluationCase('point-yusuf-person', 'point', 'tell me about Yusuf', 'point_question'),
    evaluationCase('point-nuh-person', 'point', 'tell me abt nuh', 'point_question'),

    evaluationCase('context-why-tho', 'contextual', 'why tho', 'contextual_followup', [], 'single'),
    evaluationCase('context-next-misspelled', 'contextual', 'what happened nxt', 'contextual_followup', [], 'single'),
    evaluationCase('context-musa-fragment', 'contextual', 'what abt musa', 'contextual_followup', ['subject:musa'], 'pair'),
    evaluationCase('context-and-then', 'contextual', 'and then?', 'contextual_followup', [], 'single'),
    evaluationCase('context-reject', 'contextual', 'why didnt they listen', 'contextual_followup', [], 'single'),
    evaluationCase('context-both', 'contextual', 'and both of them?', 'multi_entity_comparison', ['subject:nuh', 'subject:musa'], 'pair'),

    evaluationCase('multi-vs', 'multi_entity', 'nuh vs musa whats different', 'multi_entity_comparison', ['subject:nuh', 'subject:musa']),
    evaluationCase('multi-compare', 'multi_entity', 'compare nuh and musa', 'multi_entity_comparison', ['subject:nuh', 'subject:musa']),
    evaluationCase('multi-yusuf-nuh', 'multi_entity', 'how r yusuf and nuh different', 'multi_entity_comparison', ['subject:yusuf', 'subject:nuh']),
    evaluationCase('multi-learn-both', 'multi_entity', 'what can we learn frm both', 'multi_entity_comparison', ['subject:nuh', 'subject:musa'], 'pair'),
    evaluationCase('multi-stories', 'multi_entity', 'both their stories teach what', 'multi_entity_comparison', ['subject:nuh', 'subject:musa'], 'pair'),
];

function fingerprintQuestion(question: string): string {
    return createHash('sha256')
        .update(question.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim())
        .digest('hex');
}

function pairState(nowMs: number): ValidatedConversationState {
    const fingerprint = fingerprintQuestion(PAIR_QUESTION);
    return {
        subjectTokens: ['stories'],
        evidenceIds: ['pair-a', 'pair-b'],
        evidenceCount: 2,
        expiresAt: new Date(nowMs + 60_000).toISOString(),
        sourceQuestionFingerprint: fingerprint,
        activeTask: 'multi_entity_comparison',
        primaryEntity: PAIR_ENTITIES[0]!,
        entitySet: PAIR_ENTITIES,
        comparisonFrame: true,
        referentialRoles: PAIR_ENTITIES.map(entity => entity.id),
        semanticSubject: ['stories'],
        previousTurnFingerprint: fingerprint,
        validatedEvidenceRefs: ['pair-a', 'pair-b'],
    };
}

function singleState(nowMs: number): ValidatedConversationState {
    const fingerprint = fingerprintQuestion(SINGLE_QUESTION);
    const entity: DiscourseEntity = { id: 'subject:nuh', label: 'nuh', kind: 'subject' };
    return {
        subjectTokens: ['nuh'],
        evidenceIds: ['single-a'],
        evidenceCount: 1,
        expiresAt: new Date(nowMs + 60_000).toISOString(),
        sourceQuestionFingerprint: fingerprint,
        activeTask: 'point_question',
        primaryEntity: entity,
        entitySet: [entity],
        comparisonFrame: false,
        referentialRoles: [entity.id],
        semanticSubject: ['nuh'],
        previousTurnFingerprint: fingerprint,
        validatedEvidenceRefs: ['single-a'],
    };
}

function requestFor(item: SemanticTaskEvaluationCase): NoorChatRequest {
    return {
        mode: 'chat',
        requestId: REQUEST_ID,
        question: item.question,
        history: item.frame
            ? [{ role: 'user', content: item.frame === 'pair' ? PAIR_QUESTION : SINGLE_QUESTION }]
            : [],
    };
}

function percentile(values: readonly number[], rank: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)] ?? 0;
}

export async function evaluateSemanticTaskPlanning(
    classifier: SemanticTaskClassifier,
    cases: readonly SemanticTaskEvaluationCase[] = SEMANTIC_TASK_EVALUATION_CASES,
    nowMs: () => number = Date.now,
): Promise<SemanticTaskEvaluationSummary> {
    const latencies: number[] = [];
    const failureCaseIds: string[] = [];
    const failureDetails: SemanticTaskEvaluationSummary['failureDetails'] = [];
    let deterministicCases = 0;
    let semanticFallbackCases = 0;
    let classifierFailures = 0;

    for (const item of cases) {
        const request = requestFor(item);
        const state = item.frame === 'pair' ? pairState(nowMs()) : item.frame === 'single' ? singleState(nowMs()) : null;
        let plan = buildChatQueryPlan({ request, validatedConversationState: state });
        const fallbackInput = buildSemanticTaskFallbackInput({
            request,
            deterministicPlan: plan,
            validatedConversationState: state,
        });
        if (fallbackInput) {
            semanticFallbackCases += 1;
            const startedAt = nowMs();
            const outcome = await classifier.classify(fallbackInput);
            latencies.push(Math.max(0, Math.floor(nowMs() - startedAt)));
            if (outcome.kind === 'failure') {
                classifierFailures += 1;
                failureCaseIds.push(item.id);
                failureDetails.push({ caseId: item.id, observed: `failure:${outcome.failureType}` });
                continue;
            }
            plan = applySemanticTaskClassification({
                request,
                deterministicPlan: plan,
                validatedConversationState: state,
                taskType: outcome.taskType,
            });
        } else {
            deterministicCases += 1;
        }
        if (plan.taskType !== item.expectedTaskType) {
            failureCaseIds.push(item.id);
            failureDetails.push({ caseId: item.id, observed: plan.taskType });
            continue;
        }
        if (plan.entitySet.map(entity => entity.id).join('|') !== item.expectedEntityIds.join('|')) {
            failureCaseIds.push(item.id);
            failureDetails.push({ caseId: item.id, observed: 'entity_mismatch' });
        }
    }

    return {
        classifierModel: GENERATION_MODEL,
        totalCases: cases.length,
        deterministicCases,
        semanticFallbackCases,
        deterministicPlannerRate: cases.length === 0 ? 0 : deterministicCases / cases.length,
        semanticFallbackRate: cases.length === 0 ? 0 : semanticFallbackCases / cases.length,
        fallbackMedianLatencyMs: percentile(latencies, 0.5),
        fallbackP95LatencyMs: percentile(latencies, 0.95),
        materialFailures: failureCaseIds.length,
        classifierFailures,
        failureCaseIds,
        failureDetails,
    };
}

async function main(): Promise<void> {
    const vertex = new GoogleGenAI({ vertexai: true, project: NOOR_PROJECT, location: VERTEX_GENERATION_LOCATION });
    const classifier = createVertexSemanticTaskClassifier(vertex as unknown as VertexSemanticTaskClassifierClient);
    const summary = await evaluateSemanticTaskPlanning(classifier);
    process.stdout.write(`${JSON.stringify(summary, undefined, 2)}\n`);
    if (summary.materialFailures > 0) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('Noor semantic task classifier verification unavailable.\n');
        process.exitCode = 1;
    });
}
