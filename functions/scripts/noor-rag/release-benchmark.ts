import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { VERTEX_GENERATION_LOCATION } from '../../src/noor-rag/generation';
import {
    applySemanticTaskClassification,
    buildChatQueryPlan,
    buildSemanticTaskFallbackInput,
    type DiscourseEntity,
    type ValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import {
    createVertexPersonalizedRulingClassifier,
    type PersonalizedRulingClassifier,
    type VertexPersonalizedRulingClassifierClient,
} from '../../src/noor-rag/personalizedRulingClassifier';
import {
    createVertexSemanticTaskClassifier,
    type SemanticTaskClassifier,
    type VertexSemanticTaskClassifierClient,
} from '../../src/noor-rag/semanticTaskClassifier';
import type { NoorChatRequest } from '../../src/noor-rag/types';

export type ReleaseBenchmarkCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type ReleaseBenchmarkTaskType = 'point_question' | 'entity_summary' | 'multi_entity_comparison' | 'contextual_followup';
export type ReleaseBenchmarkStatus = 'answered' | 'insufficient_evidence' | 'policy_refusal';
export type ReleaseAvailabilityFailure =
    | 'provider_transient'
    | 'provider_timeout'
    | 'structured_generation_fail_closed'
    | 'citation_validation_fail_closed'
    | 'quality_validation_fail_closed'
    | 'other_safe_failure';

export interface ReleaseBenchmarkCase {
    id: string;
    category: ReleaseBenchmarkCategory;
    question: string;
    expectedTaskType: ReleaseBenchmarkTaskType;
    expectedEntityIds: readonly string[];
    expectedStatus: ReleaseBenchmarkStatus;
    messyEquivalentOf?: string;
    priorCaseId?: string;
    runtimeRule?: never;
}

export interface ReleaseBenchmarkManifest {
    schemaVersion: 1;
    historyLimit: 6;
    corpus: {
        promoted: { version: '2026-08-10-v1'; chunks: 9248; hash: string };
        local: { chunks: 9057; hash: string };
    };
    thresholds: {
        deterministicSemanticPassRate: 1;
        messyEquivalenceRate: 0.95;
        supportedGenerationSuccessRate: 0.98;
        multiEntityAnswerSuccessRate: 0.95;
        multiEntityProvenancePassRate: 1;
        policyPassRate: 1;
    };
    invariants: readonly { name: string; maximum: 0 }[];
    transcripts: { clean: readonly string[]; messy: readonly string[] };
    cases: readonly ReleaseBenchmarkCase[];
}

export interface ReleaseBenchmarkDeterministicResult {
    totalCases: number;
    passedCases: number;
    passRate: number;
    messyCases: number;
    messyPassed: number;
    messyEquivalenceRate: number;
    policyCases: number;
    policyPassed: number;
    policyPassRate: number;
    classifierFailures: number;
    failureCaseIds: readonly string[];
    details: readonly { id: string; observedTask: string; observedEntityIds: readonly string[]; observedPolicy: string }[];
}

const CATEGORY = new Set<ReleaseBenchmarkCategory>(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
const TASK = new Set<ReleaseBenchmarkTaskType>([
    'point_question', 'entity_summary', 'multi_entity_comparison', 'contextual_followup',
]);
const STATUS = new Set<ReleaseBenchmarkStatus>(['answered', 'insufficient_evidence', 'policy_refusal']);
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/u;
const HASH = /^[a-f0-9]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function safeBenchmarkError(error: unknown): { errorClass: string; message: string } {
    const errorClass = error instanceof Error && error.name ? error.name : 'benchmark_failure';
    const message = (error instanceof Error ? error.message : String(error))
        .replace(/Bearer\s+[^\s]+/giu, 'Bearer [REDACTED]')
        .replace(/(token|secret|password|credential|api[_-]?key)=[^\s&]+/giu, '$1=[REDACTED]')
        .slice(0, 500);
    return { errorClass, message };
}

export function classifyAvailabilityFailure(value: string | null): ReleaseAvailabilityFailure | null {
    if (value === null) return null;
    if (value === 'provider_transient_failure') return 'provider_transient';
    if (value === 'provider_timeout') return 'provider_timeout';
    if (value === 'malformed_json' || value === 'answer_validation_failure') {
        return 'structured_generation_fail_closed';
    }
    if (value === 'citation_validation_failure') return 'citation_validation_fail_closed';
    if (value === 'answer_quality_judgement_failure' || value === 'answer_quality_failure') {
        return 'quality_validation_fail_closed';
    }
    return 'other_safe_failure';
}

function requiredString(value: unknown, name: string): string {
    if (typeof value !== 'string' || value.trim().length === 0 || [...value].length > 500) {
        throw new Error(`Invalid release benchmark ${name}`);
    }
    return value;
}

function stringArray(value: unknown, name: string, maximum = 6): string[] {
    if (!Array.isArray(value) || value.length > maximum || !value.every(item => typeof item === 'string' && item.length > 0)) {
        throw new Error(`Invalid release benchmark ${name}`);
    }
    return [...value];
}

function parseCase(value: unknown): ReleaseBenchmarkCase {
    if (!isRecord(value)) throw new Error('Invalid release benchmark case');
    const id = requiredString(value.id, 'case id');
    if (!ID.test(id)) throw new Error('Invalid release benchmark case id');
    if (typeof value.category !== 'string' || !CATEGORY.has(value.category as ReleaseBenchmarkCategory)) {
        throw new Error(`Invalid release benchmark category: ${id}`);
    }
    if (typeof value.expectedTaskType !== 'string' || !TASK.has(value.expectedTaskType as ReleaseBenchmarkTaskType)) {
        throw new Error(`Invalid release benchmark task type: ${id}`);
    }
    if (typeof value.expectedStatus !== 'string' || !STATUS.has(value.expectedStatus as ReleaseBenchmarkStatus)) {
        throw new Error(`Invalid release benchmark status: ${id}`);
    }
    const expectedEntityIds = stringArray(value.expectedEntityIds, 'entity ids', 2);
    if (value.category === 'G' && expectedEntityIds.length !== 2) throw new Error(`Comparison pair missing: ${id}`);
    const optional = (name: 'messyEquivalentOf' | 'priorCaseId'): string | undefined => (
        value[name] === undefined ? undefined : requiredString(value[name], name)
    );
    return {
        id,
        category: value.category as ReleaseBenchmarkCategory,
        question: requiredString(value.question, 'question'),
        expectedTaskType: value.expectedTaskType as ReleaseBenchmarkTaskType,
        expectedEntityIds,
        expectedStatus: value.expectedStatus as ReleaseBenchmarkStatus,
        ...(optional('messyEquivalentOf') ? { messyEquivalentOf: optional('messyEquivalentOf') } : {}),
        ...(optional('priorCaseId') ? { priorCaseId: optional('priorCaseId') } : {}),
    };
}

export function parseReleaseBenchmarkManifest(value: unknown): ReleaseBenchmarkManifest {
    if (!isRecord(value) || value.schemaVersion !== 1 || value.historyLimit !== 6
        || !isRecord(value.corpus) || !isRecord(value.corpus.promoted) || !isRecord(value.corpus.local)
        || value.corpus.promoted.version !== '2026-08-10-v1' || value.corpus.promoted.chunks !== 9248
        || value.corpus.local.chunks !== 9057 || typeof value.corpus.promoted.hash !== 'string'
        || typeof value.corpus.local.hash !== 'string' || !HASH.test(value.corpus.promoted.hash)
        || !HASH.test(value.corpus.local.hash) || !isRecord(value.thresholds)
        || !Array.isArray(value.invariants) || !isRecord(value.transcripts)
        || !Array.isArray(value.transcripts.clean) || !Array.isArray(value.transcripts.messy)
        || !Array.isArray(value.cases)) {
        throw new Error('Invalid release benchmark manifest');
    }
    const thresholds = value.thresholds;
    const expectedThresholds = {
        deterministicSemanticPassRate: 1,
        messyEquivalenceRate: 0.95,
        supportedGenerationSuccessRate: 0.98,
        multiEntityAnswerSuccessRate: 0.95,
        multiEntityProvenancePassRate: 1,
        policyPassRate: 1,
    } as const;
    if (Object.entries(expectedThresholds).some(([key, expected]) => thresholds[key] !== expected)) {
        throw new Error('Release benchmark thresholds changed');
    }
    const invariants = value.invariants.map(item => {
        if (!isRecord(item) || typeof item.name !== 'string' || item.name.length === 0 || item.maximum !== 0) {
            throw new Error('Invalid release benchmark invariant');
        }
        return { name: item.name, maximum: 0 as const };
    });
    const cases = value.cases.map(parseCase);
    if (new Set(cases.map(item => item.id)).size !== cases.length) throw new Error('Duplicate release benchmark case');
    return {
        schemaVersion: 1,
        historyLimit: 6,
        corpus: value.corpus as ReleaseBenchmarkManifest['corpus'],
        thresholds: expectedThresholds,
        invariants,
        transcripts: {
            clean: stringArray(value.transcripts.clean, 'clean transcript', 16),
            messy: stringArray(value.transcripts.messy, 'messy transcript', 15),
        },
        cases,
    };
}

function fingerprint(value: string): string {
    return createHash('sha256').update(value.normalize('NFKC').toLocaleLowerCase().trim()).digest('hex');
}

function entityFromId(id: string): DiscourseEntity {
    if (id.startsWith('surah:')) {
        return { id, label: id, kind: 'surah', surahNumber: Number(id.slice('surah:'.length)) };
    }
    return { id, label: id.slice('subject:'.length), kind: 'subject' };
}

function priorState(item: ReleaseBenchmarkCase, cases: ReadonlyMap<string, ReleaseBenchmarkCase>): ValidatedConversationState | null {
    if (!item.priorCaseId) return null;
    const prior = cases.get(item.priorCaseId);
    if (!prior) return null;
    const entities = prior.expectedEntityIds.map(entityFromId);
    const source = fingerprint(prior.question);
    const evidenceIds = entities.length > 0
        ? entities.map((_entity, index) => `benchmark-evidence-${index + 1}`)
        : ['benchmark-evidence-1'];
    return {
        subjectTokens: entities.length > 0 ? entities.map(entity => entity.label) : ['validated-subject'],
        evidenceIds,
        evidenceCount: evidenceIds.length,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        sourceQuestionFingerprint: source,
        activeTask: prior.expectedTaskType,
        primaryEntity: entities[0] ?? null,
        entitySet: entities,
        comparisonFrame: entities.length > 1,
        referentialRoles: entities.map(entity => entity.id),
        semanticSubject: entities.length > 0 ? entities.map(entity => entity.label) : ['validated-subject'],
        previousTurnFingerprint: source,
        validatedEvidenceRefs: evidenceIds,
    };
}

export async function evaluateReleaseBenchmarkDeterministic(
    manifest: ReleaseBenchmarkManifest,
    semanticClassifier: SemanticTaskClassifier,
    personalizedClassifier: PersonalizedRulingClassifier,
): Promise<ReleaseBenchmarkDeterministicResult> {
    const byId = new Map(manifest.cases.map(item => [item.id, item]));
    const failures: ReleaseBenchmarkDeterministicResult['details'][number][] = [];
    let classifierFailures = 0;
    let messyPassed = 0;
    let policyPassed = 0;
    for (const item of manifest.cases) {
        const state = priorState(item, byId);
        const prior = item.priorCaseId ? byId.get(item.priorCaseId) : undefined;
        const request: NoorChatRequest = {
            mode: 'chat',
            requestId: `80000000-0000-4000-8000-${(manifest.cases.indexOf(item) + 1).toString().padStart(12, '0')}`,
            question: item.question,
            history: prior ? [{ role: 'user', content: prior.question }] : [],
        };
        let plan = buildChatQueryPlan({ request, validatedConversationState: state });
        const fallback = buildSemanticTaskFallbackInput({ request, deterministicPlan: plan, validatedConversationState: state });
        if (fallback) {
            const outcome = await semanticClassifier.classify(fallback);
            if (outcome.kind === 'failure') {
                classifierFailures += 1;
            } else {
                plan = applySemanticTaskClassification({
                    request, deterministicPlan: plan, validatedConversationState: state, taskType: outcome.taskType,
                });
            }
        }
        let observedPolicy = 'not_applicable';
        let policyCorrect = true;
        if (item.category === 'H') {
            const outcome = await personalizedClassifier.classify(request);
            observedPolicy = outcome.kind === 'success' ? outcome.classification : `failure:${outcome.failureType}`;
            if (outcome.kind === 'failure') classifierFailures += 1;
            const expectedPolicy = item.expectedStatus === 'policy_refusal' ? 'personalized_ruling' : 'general_information';
            policyCorrect = observedPolicy === expectedPolicy;
            if (policyCorrect) policyPassed += 1;
        }
        const observedEntityIds = plan.entitySet.map(entity => entity.id);
        const planningCorrect = plan.taskType === item.expectedTaskType
            && observedEntityIds.join('|') === item.expectedEntityIds.join('|');
        const passed = planningCorrect && policyCorrect;
        if (item.category === 'E' && passed) messyPassed += 1;
        if (!passed) failures.push({ id: item.id, observedTask: plan.taskType, observedEntityIds, observedPolicy });
    }
    const passedCases = manifest.cases.length - failures.length;
    const messyCases = manifest.cases.filter(item => item.category === 'E').length;
    const policyCases = manifest.cases.filter(item => item.category === 'H').length;
    return {
        totalCases: manifest.cases.length,
        passedCases,
        passRate: passedCases / manifest.cases.length,
        messyCases,
        messyPassed,
        messyEquivalenceRate: messyPassed / messyCases,
        policyCases,
        policyPassed,
        policyPassRate: policyPassed / policyCases,
        classifierFailures,
        failureCaseIds: failures.map(item => item.id),
        details: failures,
    };
}

async function main(): Promise<void> {
    const manifest = parseReleaseBenchmarkManifest(JSON.parse(readFileSync(
        resolve(process.cwd(), 'evals/noor-final-release-benchmark.json'), 'utf8',
    )) as unknown);
    const vertex = new GoogleGenAI({ vertexai: true, project: 'qurannotes-9f7a1', location: VERTEX_GENERATION_LOCATION });
    const result = await evaluateReleaseBenchmarkDeterministic(
        manifest,
        createVertexSemanticTaskClassifier(vertex as unknown as VertexSemanticTaskClassifierClient),
        createVertexPersonalizedRulingClassifier(vertex as unknown as VertexPersonalizedRulingClassifierClient),
    );
    process.stdout.write(`${JSON.stringify({ phase: 'deterministic', ...result }, undefined, 2)}\n`);
    if (result.passRate < manifest.thresholds.deterministicSemanticPassRate
        || result.messyEquivalenceRate < manifest.thresholds.messyEquivalenceRate
        || result.policyPassRate < manifest.thresholds.policyPassRate) process.exitCode = 1;
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${JSON.stringify({
            phase: 'deterministic', status: 'UNVERIFIED', ...safeBenchmarkError(error),
        }, undefined, 2)}\n`);
        process.exitCode = 2;
    });
}
