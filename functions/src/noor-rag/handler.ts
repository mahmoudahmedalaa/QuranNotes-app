import { createHash } from 'node:crypto';

import type { NoorRuntimeConfig } from './config';
import type { EntitlementDecision } from './entitlement';
import {
    getGenerationDiagnostics,
    type GenerationDiagnostics,
    type NoorGenerationErrorClass,
} from './generation';
import { isEntitySummaryEvidenceSufficient, selectAnswerableEvidence } from './answerability';
import type { NoorPolicyCategory } from './policy';
import type {
    PersonalizedRulingClassification,
    PersonalizedRulingClassifierFailureType,
    PersonalizedRulingClassifierOutcome,
    PersonalizedRulingClassifierRequest,
} from './personalizedRulingClassifier';
import { CANONICAL_INSUFFICIENT_EVIDENCE, normalizeNoorOutcome, type OutcomeNormalizationReason } from './outcome';
import {
    applySemanticTaskClassification,
    buildChatQueryPlan,
    buildControlledRecoveryQuery,
    buildSemanticTaskFallbackInput,
    createValidatedConversationState,
    type ChatQueryPlan,
    type DiscourseEntity,
    type ValidatedConversationState,
} from './queryRewrite';
import type {
    SemanticTaskClassifierFailureType,
    SemanticTaskClassifierInput,
    SemanticTaskClassifierOutcome,
} from './semanticTaskClassifier';
import type { ClaimResult, FinalizeResult, NoorEntitlementClass } from './usage';
import type { NoorAnswer, NoorRequest, RetrievedEvidence } from './types';
import { parseNoorAnswer } from './validation';

const POLICY_REFUSAL = 'Noor only explains Quran passages using Tafsir Ibn Kathir and Tafsir Al-Sa\'di. For personal rulings, please speak with a qualified scholar.';
const SCOPE_REFUSAL = 'I’m Noor, focused on the Qur’an and Islamic tafsir. I can help explain verses, tafsir, and Qur’an-related questions.';
const INSUFFICIENT_EVIDENCE = CANONICAL_INSUFFICIENT_EVIDENCE;
const CLARIFICATION_REQUIRED = 'Please name the Quran topic, verse, or person you mean so I can search the tafsir.';
const TEMPORARILY_UNAVAILABLE = 'Noor is temporarily unavailable. Please try again shortly.';
const NOT_ENTITLED = 'Noor is available with an active QuranNotes subscription.';
const QUOTA_EXCEEDED = 'You have reached today\'s Noor answer limit. Please try again after the reset.';
const MAX_TELEMETRY_DURATION_MS = 120_000;
const MAX_TELEMETRY_CHUNK_IDS = 8;
const MAX_TELEMETRY_CHUNK_ID_CHARACTERS = 256;

export type NoorHandlerErrorClass =
    | 'config_unavailable'
    | 'corpus_unavailable'
    | 'replay_invalid'
    | 'entitlement_unavailable'
    | 'not_entitled'
    | 'usage_unavailable'
    | 'quota_exceeded'
    | 'request_busy'
    | 'policy_refusal'
    | 'policy_classifier_unavailable'
    | 'insufficient_evidence'
    | 'retrieval_unavailable'
    | 'generation_unavailable'
    | NoorGenerationErrorClass
    | 'response_invalid'
    | 'finalization_unavailable'
    | null;

export interface NoorHandlerTelemetryEvent {
    requestId: string;
    mode: NoorRequest['mode'];
    entitlementClass: NoorEntitlementClass | null;
    generationModel: string | null;
    corpusVersion: string | null;
    promptVersion: string | null;
    outcome: NoorAnswer['status'];
    citationCount: number;
    retrievedChunkIds: string[];
    errorClass: NoorHandlerErrorClass;
    durationMs: number;
    retrievalMs: number;
    generationMs: number;
    generationAttemptCount: number;
    generationFailurePhase: GenerationDiagnostics['generationFailurePhase'] | 'not_run';
    structuralValidationResult: GenerationDiagnostics['structuralValidationResult'];
    citationValidationResult: GenerationDiagnostics['citationValidationResult'];
    citationValidationFailureSubtype: GenerationDiagnostics['citationValidationFailureSubtype'];
    qualityJudgeInvoked: boolean;
    generationRetryInvoked: boolean;
    correctionInvoked: boolean;
    finalGenerationErrorClass: NoorGenerationErrorClass;
    personalizedRulingClassifierInvoked: boolean;
    personalizedRulingClassification: PersonalizedRulingClassification | 'not_run';
    personalizedRulingClassifierLatencyMs: number;
    personalizedRulingClassifierFailureType: PersonalizedRulingClassifierFailureType | null;
    semanticTaskClassifierInvoked: boolean;
    semanticTaskClassification: ChatQueryPlan['taskType'] | 'not_run';
    semanticTaskClassifierLatencyMs: number;
    semanticTaskClassifierFailureType: SemanticTaskClassifierFailureType | null;
}

export interface NoorSanitizedTrace {
    requestId: string;
    case: string;
    policy: NoorPolicyCategory;
    status: NoorAnswer['status'];
    citationCount: number;
    conversationState: ChatQueryPlan['conversationState'];
    contextSelected: boolean;
    selectedPriorUserContext: 'validated_prior_subject' | 'none';
    queryVariantCount: number;
    queryVariantKinds: Array<'original' | 'context_enriched' | 'entity_branch'>;
    taskType: ChatQueryPlan['taskType'];
    resolvedEntityIds: string[];
    sanitizedRewriteFingerprint: string;
    preAnswerabilityEvidenceIds: string[];
    postAnswerabilityEvidenceIds: string[];
    answerabilityReason: 'not_run' | 'sufficient' | 'insufficient' | 'entity_scope_filtered' | 'adaptive_coverage_insufficient' | 'balanced_multi_entity';
    policyReasonCode: NoorPolicyCategory;
    outcomeNormalizationReason: OutcomeNormalizationReason;
    stateAction: 'persisted' | 'replaced' | 'cleared' | 'unchanged';
    vectorHitCount: number;
    lexicalHitCount: number;
    lexicalSearchStatus: 'available' | 'unavailable' | 'not_configured';
    evidenceIds: string[];
    evidenceCount: number;
    generationStatus: NoorAnswer['status'] | 'not_run';
    citationValidation: 'passed' | 'failed' | 'not_run';
    generationAttemptCount: number;
    generationFailurePhase: GenerationDiagnostics['generationFailurePhase'] | 'not_run';
    structuralValidationResult: GenerationDiagnostics['structuralValidationResult'];
    citationValidationResult: GenerationDiagnostics['citationValidationResult'];
    citationValidationFailureSubtype: GenerationDiagnostics['citationValidationFailureSubtype'];
    qualityJudgeInvoked: boolean;
    generationRetryInvoked: boolean;
    correctionInvoked: boolean;
    finalGenerationErrorClass: NoorGenerationErrorClass;
    personalizedRulingClassifierInvoked: boolean;
    personalizedRulingClassification: PersonalizedRulingClassification | 'not_run';
    personalizedRulingClassifierLatencyMs: number;
    personalizedRulingClassifierFailureType: PersonalizedRulingClassifierFailureType | null;
    semanticTaskClassifierInvoked: boolean;
    semanticTaskClassification: ChatQueryPlan['taskType'] | 'not_run';
    semanticTaskClassifierLatencyMs: number;
    semanticTaskClassifierFailureType: SemanticTaskClassifierFailureType | null;
    statePersistence: 'persisted' | 'not_persisted' | 'not_expected';
    stateFingerprint: string | null;
    stageMs: {
        policy: number;
        context: number;
        retrieval: number;
        generation: number;
        citationValidation: number;
    };
    finalCopy: string;
}

export interface NoorSemanticRetrievalResult {
    evidence: readonly RetrievedEvidence[];
    vectorHitCount: number;
    lexicalHitCount: number;
    lexicalSearchStatus: 'available' | 'unavailable' | 'not_configured';
}

type NoorSemanticRetrievalOutput = readonly RetrievedEvidence[] | NoorSemanticRetrievalResult;

export interface NoorHandlerUsageInput {
    uid: string;
    requestId: string;
    invocationId: string;
    entitlementClass: NoorEntitlementClass;
}

export interface NoorHandlerFinalizeInput {
    uid: string;
    requestId: string;
    invocationId: string;
    response: NoorAnswer;
}

export interface NoorHandlerDependencies {
    loadRuntimeConfig(): Promise<NoorRuntimeConfig>;
    verifyCorpusReady(config: NoorRuntimeConfig): Promise<boolean>;
    readCompletedReplay(input: Readonly<{ uid: string; requestId: string }>): Promise<unknown | null>;
    resolveEntitlement(input: Readonly<{ uid: string }>): Promise<EntitlementDecision>;
    claimUsage(input: NoorHandlerUsageInput): Promise<ClaimResult>;
    classifyPolicy(request: NoorRequest): NoorPolicyCategory;
    classifyPersonalizedRuling(request: PersonalizedRulingClassifierRequest): Promise<PersonalizedRulingClassifierOutcome>;
    classifySemanticTask(input: SemanticTaskClassifierInput): Promise<SemanticTaskClassifierOutcome>;
    retrieveSemantic(input: Readonly<{
        request: Extract<NoorRequest, { mode: 'chat' }>;
        config: NoorRuntimeConfig;
        query: string;
    }>): Promise<NoorSemanticRetrievalOutput>;
    retrieveEntitySummary(input: Readonly<{
        request: Extract<NoorRequest, { mode: 'chat' }>;
        config: NoorRuntimeConfig;
        entity: NonNullable<ChatQueryPlan['entity']>;
    }>): Promise<Readonly<{
        evidence: readonly RetrievedEvidence[];
        candidateCount: number;
        anchorVerses: readonly number[];
        coverageCapacity?: Readonly<{ canonicalUnits: number; sections: number; span: number }>;
    }>>;
    retrieveExact(input: Readonly<{
        request: Extract<NoorRequest, { mode: 'verse_summary' | 'verse_question' }>;
        config: NoorRuntimeConfig;
    }>): Promise<readonly RetrievedEvidence[]>;
    generateGroundedAnswer(input: Readonly<{
        request: NoorRequest;
        evidence: readonly RetrievedEvidence[];
        config: NoorRuntimeConfig;
        taskPlan: ChatQueryPlan;
    }>): Promise<unknown>;
    finalizeAnswered(input: NoorHandlerFinalizeInput): Promise<FinalizeResult>;
    finalizeNonAnswer(input: NoorHandlerFinalizeInput): Promise<FinalizeResult>;
    emitTelemetry(event: NoorHandlerTelemetryEvent): Promise<void> | void;
    emitSanitizedTrace?(trace: NoorSanitizedTrace): Promise<void> | void;
    readValidatedConversationState?(input: Readonly<{ uid: string }>): Promise<ValidatedConversationState | null>;
    writeValidatedConversationState?(input: Readonly<{ uid: string; state: ValidatedConversationState }>): Promise<void>;
    nowMs(): number;
}

export interface HandleNoorRequestInput {
    request: NoorRequest;
    uid: string;
    invocationId: string;
    conversationState?: ValidatedConversationState | null;
    traceCase?: string;
    dependencies: NoorHandlerDependencies;
}

class HandlerFailure extends Error {
    constructor(readonly errorClass: Exclude<NoorHandlerErrorClass, null>) {
        super(errorClass);
    }
}

function nonQuotaAnswer(requestId: string, status: Exclude<NoorAnswer['status'], 'quota_exceeded' | 'answered'>, answer: string): NoorAnswer {
    return { requestId, status, answer, citations: [] };
}

function temporaryAnswer(requestId: string): NoorAnswer {
    return nonQuotaAnswer(requestId, 'temporarily_unavailable', TEMPORARILY_UNAVAILABLE);
}

function safeNow(dependencies: NoorHandlerDependencies): number {
    try {
        const value = dependencies.nowMs();
        return Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
}

function duration(startedAt: number, endedAt: number): number {
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
    return Math.max(0, Math.min(MAX_TELEMETRY_DURATION_MS, Math.floor(endedAt - startedAt)));
}

function validateResponse(
    value: unknown,
    requestId: string,
    explicitSurahScope: number | null = null,
): { response: NoorAnswer; normalizationReason: OutcomeNormalizationReason } {
    let response: NoorAnswer;
    try {
        response = parseNoorAnswer(value);
    } catch {
        throw new HandlerFailure('response_invalid');
    }
    if (response.requestId !== requestId) throw new HandlerFailure('response_invalid');
    const normalized = normalizeNoorOutcome(response);
    response = normalized.response;
    if (response.status === 'answered' && response.citations.length === 0) {
        throw new HandlerFailure('citation_validation_failure');
    }
    if (response.status === 'answered'
        && explicitSurahScope !== null
        && response.citations.some(citation => citation.surah !== explicitSurahScope)) {
        throw new HandlerFailure('citation_validation_failure');
    }
    return { response, normalizationReason: normalized.reason };
}

function responseErrorClass(response: NoorAnswer): NoorHandlerErrorClass {
    switch (response.status) {
        case 'answered': return null;
        case 'policy_refusal': return 'policy_refusal';
        case 'insufficient_evidence': return 'insufficient_evidence';
        case 'not_entitled': return 'not_entitled';
        case 'quota_exceeded': return 'quota_exceeded';
        case 'temporarily_unavailable': return 'generation_unavailable';
        case 'invalid_request': return 'response_invalid';
    }
}

const TRACE_COPY: Record<NoorAnswer['status'], string> = {
    answered: 'Answer available with validated tafsir citations.',
    insufficient_evidence: 'I could not find enough reliable tafsir evidence to answer that safely.',
    policy_refusal: 'I cannot help with that request.',
    not_entitled: 'Noor is available with an active QuranNotes subscription.',
    quota_exceeded: 'Your daily Noor answer limit has been reached.',
    invalid_request: 'Please revise your question and try again.',
    temporarily_unavailable: 'Noor is temporarily unavailable. Please try again shortly.',
};

function normalizeSemanticRetrieval(value: NoorSemanticRetrievalOutput): NoorSemanticRetrievalResult {
    if (!isSemanticRetrievalResult(value)) {
        return { evidence: value, vectorHitCount: 0, lexicalHitCount: 0, lexicalSearchStatus: 'not_configured' };
    }
    return {
        evidence: value.evidence,
        vectorHitCount: Number.isFinite(value.vectorHitCount) ? Math.max(0, Math.floor(value.vectorHitCount)) : 0,
        lexicalHitCount: Number.isFinite(value.lexicalHitCount) ? Math.max(0, Math.floor(value.lexicalHitCount)) : 0,
        lexicalSearchStatus: value.lexicalSearchStatus === 'unavailable' || value.lexicalSearchStatus === 'available'
            ? value.lexicalSearchStatus
            : 'not_configured',
    };
}

function isSemanticRetrievalResult(value: NoorSemanticRetrievalOutput): value is NoorSemanticRetrievalResult {
    return !Array.isArray(value) && typeof value === 'object' && value !== null && 'evidence' in value;
}

function filterAnswerableEvidence(
    variants: readonly { query: string }[],
    results: readonly NoorSemanticRetrievalResult[],
    config: NoorRuntimeConfig,
): readonly (readonly RetrievedEvidence[])[] {
    return results.map((result, index) => {
        const query = variants[index]?.query;
        if (!query) return [];
        return selectAnswerableEvidence(query, result.evidence, config);
    });
}

function mergeEvidence(
    values: readonly (readonly RetrievedEvidence[])[],
    config: NoorRuntimeConfig,
): RetrievedEvidence[] {
    const candidates = new Map<string, { item: RetrievedEvidence; variants: number; score: number; first: number }>();
    let first = 0;
    values.forEach(group => group.forEach(item => {
        const key = `${item.chunk.source}:${item.chunk.canonicalUnitId}`;
        const score = item.kind === 'semantic' ? item.similarity : 0;
        const existing = candidates.get(key);
        if (existing) {
            existing.variants += 1;
            existing.score = Math.max(existing.score, score);
        } else {
            candidates.set(key, { item, variants: 1, score, first });
        }
        first += 1;
    }));
    const ranked = [...candidates.values()].sort((left, right) => (
        right.variants - left.variants
        || right.score - left.score
        || left.item.chunk.source.localeCompare(right.item.chunk.source)
        || left.item.chunk.chunkId.localeCompare(right.item.chunk.chunkId)
        || left.first - right.first
    ));
    const bySource = new Map<string, typeof ranked>();
    for (const candidate of ranked) {
        const group = bySource.get(candidate.item.chunk.source) ?? [];
        group.push(candidate);
        bySource.set(candidate.item.chunk.source, group);
    }
    const merged: RetrievedEvidence[] = [];
    let characters = 0;
    const maximum = config.maxChunksPerSource * 2;
    while (merged.length < maximum) {
        let added = false;
        for (const source of ['ibn_kathir_en_abridged', 'al_sadi_ar'] as const) {
            const group = bySource.get(source);
            const candidate = group?.shift();
            if (!candidate) continue;
            if (characters + candidate.item.chunk.originalText.length > config.maxEvidenceCharacters) {
                // Discard only this oversized candidate; keep scanning the source for a fitting chunk.
                added = true;
                continue;
            }
            merged.push(candidate.item);
            characters += candidate.item.chunk.originalText.length;
            added = true;
            if (merged.length >= maximum) break;
        }
        if (!added) break;
    }
    return merged.map((item, index) => ({ ...item, promptSourceId: `S${index + 1}` }));
}

function evidenceKey(item: RetrievedEvidence): string {
    return `${item.chunk.source}:${item.chunk.chunkId}`;
}

function hasDistinctEntityBranchSupport(
    entities: readonly DiscourseEntity[],
    evidence: readonly RetrievedEvidence[],
    branchGroups: readonly (readonly RetrievedEvidence[])[],
): boolean {
    const finalKeys = new Set(evidence.map(evidenceKey));
    const eligibleKeys = entities.map((_entity, index) => (branchGroups[index] ?? [])
        .map(evidenceKey)
        .filter(key => finalKeys.has(key)));
    const assign = (index: number, used: ReadonlySet<string>): boolean => {
        if (index >= eligibleKeys.length) return true;
        return (eligibleKeys[index] ?? []).some(key => (
            !used.has(key) && assign(index + 1, new Set([...used, key]))
        ));
    };
    return entities.length > 1 && assign(0, new Set());
}

function traceEvidenceAliases(...groups: readonly (readonly RetrievedEvidence[])[]): Map<string, string> {
    const aliases = new Map<string, string>();
    for (const item of groups.flat()) {
        const key = `${item.chunk.source}:${item.chunk.chunkId}`;
        if (!aliases.has(key) && aliases.size < MAX_TELEMETRY_CHUNK_IDS) {
            aliases.set(key, `E${aliases.size + 1}`);
        }
    }
    return aliases;
}

function traceEvidenceIds(
    evidence: readonly RetrievedEvidence[],
    aliases = traceEvidenceAliases(evidence),
): string[] {
    return [...new Set(evidence.flatMap(item => {
        const alias = aliases.get(`${item.chunk.source}:${item.chunk.chunkId}`);
        return alias ? [alias] : [];
    }))];
}

function sanitizedEntityIds(plan: ChatQueryPlan): string[] {
    return plan.entitySet.map(entity => entity.kind === 'surah'
        ? entity.id
        : `subject:${createHash('sha256').update(entity.id).digest('hex').slice(0, 12)}`);
}

function rewriteFingerprint(plan: ChatQueryPlan): string {
    const value = [
        plan.taskType,
        plan.retrievalTask,
        plan.contextSelected ? 'context' : 'direct',
        ...plan.variants.map(variant => {
            const tokenCount = Math.min(32, variant.query.trim().split(/\s+/u).filter(Boolean).length);
            const lengthBucket = Math.min(10, Math.ceil(variant.query.length / 50));
            return `${variant.kind}:${tokenCount}:${lengthBucket}`;
        }),
    ].join('|');
    return createHash('sha256').update(value).digest('hex');
}

function scopeEvidenceToTaskBranch(
    evidence: readonly RetrievedEvidence[],
    plan: ChatQueryPlan,
    branchIndex: number,
): { evidence: RetrievedEvidence[]; filtered: boolean } {
    if (plan.retrievalTask === 'multi_entity_comparison') {
        const branchEntity = plan.entitySet[branchIndex];
        if (branchEntity?.kind !== 'surah') return { evidence: [...evidence], filtered: false };
        const scoped = evidence.filter(item => item.chunk.surah === branchEntity.surahNumber);
        return { evidence: scoped, filtered: scoped.length !== evidence.length };
    }
    if (!plan.explicitEntity || plan.entity === null) {
        return { evidence: [...evidence], filtered: false };
    }
    const scoped = evidence.filter(item => item.chunk.surah === plan.entity!.surahNumber);
    return { evidence: scoped, filtered: scoped.length !== evidence.length };
}

export async function handleNoorRequest(input: HandleNoorRequestInput): Promise<NoorAnswer> {
    const { request, uid, invocationId, dependencies } = input;
    const startedAt = safeNow(dependencies);
    let config: NoorRuntimeConfig | null = null;
    let entitlementClass: NoorEntitlementClass | null = null;
    let retrievedChunkIds: string[] = [];
    let retrievalMs = 0;
    let generationMs = 0;
    let policy: NoorPolicyCategory = 'out_of_scope';
    let personalizedRulingClassifierInvoked = false;
    let personalizedRulingClassification: PersonalizedRulingClassification | 'not_run' = 'not_run';
    let personalizedRulingClassifierLatencyMs = 0;
    let personalizedRulingClassifierFailureType: PersonalizedRulingClassifierFailureType | null = null;
    let semanticTaskClassifierInvoked = false;
    let semanticTaskClassification: ChatQueryPlan['taskType'] | 'not_run' = 'not_run';
    let semanticTaskClassifierLatencyMs = 0;
    let semanticTaskClassifierFailureType: SemanticTaskClassifierFailureType | null = null;
    let queryPlan: ChatQueryPlan = request.mode === 'chat'
        ? buildChatQueryPlan({ request, validatedConversationState: null })
        : {
            variants: [], contextSelected: false, conversationState: 'none', requiresClarification: false,
            taskType: 'point_question', retrievalTask: 'point_question', entity: null,
            entitySet: [], primaryEntity: null, explicitEntity: false,
        };
    let vectorHitCount = 0;
    let lexicalHitCount = 0;
    let lexicalSearchStatus: NoorSanitizedTrace['lexicalSearchStatus'] = 'not_configured';
    let evidence: readonly RetrievedEvidence[] = [];
    let multiEntitySupportGroups: readonly (readonly RetrievedEvidence[])[] = [];
    let preAnswerabilityEvidence: readonly RetrievedEvidence[] = [];
    let answerabilityReason: NoorSanitizedTrace['answerabilityReason'] = 'not_run';
    let outcomeNormalizationReason: OutcomeNormalizationReason = 'none';
    let generationStatus: NoorSanitizedTrace['generationStatus'] = 'not_run';
    let citationValidation: NoorSanitizedTrace['citationValidation'] = 'not_run';
    let generationDiagnostics: GenerationDiagnostics | null = null;
    let statePersistence: NoorSanitizedTrace['statePersistence'] = request.mode === 'chat' ? 'not_persisted' : 'not_expected';
    let stateFingerprint: string | null = null;
    let stateAction: NoorSanitizedTrace['stateAction'] = 'unchanged';
    let traceStatus: NoorAnswer['status'] = 'temporarily_unavailable';
    let citationCount = 0;
    const stageMs: NoorSanitizedTrace['stageMs'] = {
        policy: 0, context: 0, retrieval: 0, generation: 0, citationValidation: 0,
    };
    let traceEmitted = false;

    const finish = async (response: NoorAnswer, errorClass: NoorHandlerErrorClass): Promise<NoorAnswer> => {
        traceStatus = response.status;
        citationCount = response.citations.length;
        const event: NoorHandlerTelemetryEvent = {
            requestId: request.requestId,
            mode: request.mode,
            entitlementClass,
            generationModel: config?.generationModel ?? null,
            corpusVersion: config?.activeCorpusVersion ?? null,
            promptVersion: config?.promptVersion ?? null,
            outcome: response.status,
            citationCount: response.citations.length,
            retrievedChunkIds: retrievedChunkIds
                .slice(0, MAX_TELEMETRY_CHUNK_IDS)
                .map(chunkId => chunkId.slice(0, MAX_TELEMETRY_CHUNK_ID_CHARACTERS)),
            errorClass,
            durationMs: duration(startedAt, safeNow(dependencies)),
            retrievalMs,
            generationMs,
            generationAttemptCount: generationDiagnostics?.generationAttemptCount ?? 0,
            generationFailurePhase: generationDiagnostics?.generationFailurePhase ?? 'not_run',
            structuralValidationResult: generationDiagnostics?.structuralValidationResult ?? 'not_run',
            citationValidationResult: generationDiagnostics?.citationValidationResult ?? 'not_run',
            citationValidationFailureSubtype: generationDiagnostics?.citationValidationFailureSubtype ?? null,
            qualityJudgeInvoked: generationDiagnostics?.qualityJudgeInvoked ?? false,
            generationRetryInvoked: generationDiagnostics?.generationRetryInvoked ?? false,
            correctionInvoked: generationDiagnostics?.correctionInvoked ?? false,
            finalGenerationErrorClass: generationDiagnostics?.finalGenerationErrorClass ?? null,
            personalizedRulingClassifierInvoked,
            personalizedRulingClassification,
            personalizedRulingClassifierLatencyMs,
            personalizedRulingClassifierFailureType,
            semanticTaskClassifierInvoked,
            semanticTaskClassification,
            semanticTaskClassifierLatencyMs,
            semanticTaskClassifierFailureType,
        };
        try {
            Promise.resolve(dependencies.emitTelemetry(event)).catch(() => undefined);
        } catch {
            // Telemetry is best effort and must never alter an application outcome.
        }
        if (!traceEmitted && dependencies.emitSanitizedTrace) {
            traceEmitted = true;
            const evidenceAliases = traceEvidenceAliases(preAnswerabilityEvidence, evidence);
            const trace: NoorSanitizedTrace = {
                requestId: request.requestId,
                case: input.traceCase ?? 'noor-request',
                policy,
                status: traceStatus,
                citationCount,
                conversationState: queryPlan.conversationState,
                contextSelected: queryPlan.contextSelected,
                selectedPriorUserContext: queryPlan.contextSelected ? 'validated_prior_subject' : 'none',
                queryVariantCount: queryPlan.variants.length,
                queryVariantKinds: queryPlan.variants.map(variant => variant.kind),
                taskType: queryPlan.taskType,
                resolvedEntityIds: sanitizedEntityIds(queryPlan),
                sanitizedRewriteFingerprint: rewriteFingerprint(queryPlan),
                preAnswerabilityEvidenceIds: traceEvidenceIds(preAnswerabilityEvidence, evidenceAliases),
                postAnswerabilityEvidenceIds: traceEvidenceIds(evidence, evidenceAliases),
                answerabilityReason,
                policyReasonCode: policy,
                outcomeNormalizationReason,
                stateAction,
                vectorHitCount,
                lexicalHitCount,
                lexicalSearchStatus,
                evidenceIds: traceEvidenceIds(evidence, evidenceAliases),
                evidenceCount: evidence.length,
                generationStatus,
                citationValidation,
                generationAttemptCount: generationDiagnostics?.generationAttemptCount ?? 0,
                generationFailurePhase: generationDiagnostics?.generationFailurePhase ?? 'not_run',
                structuralValidationResult: generationDiagnostics?.structuralValidationResult ?? 'not_run',
                citationValidationResult: generationDiagnostics?.citationValidationResult ?? 'not_run',
                citationValidationFailureSubtype: generationDiagnostics?.citationValidationFailureSubtype ?? null,
                qualityJudgeInvoked: generationDiagnostics?.qualityJudgeInvoked ?? false,
                generationRetryInvoked: generationDiagnostics?.generationRetryInvoked ?? false,
                correctionInvoked: generationDiagnostics?.correctionInvoked ?? false,
                finalGenerationErrorClass: generationDiagnostics?.finalGenerationErrorClass ?? null,
                personalizedRulingClassifierInvoked,
                personalizedRulingClassification,
                personalizedRulingClassifierLatencyMs,
                personalizedRulingClassifierFailureType,
                semanticTaskClassifierInvoked,
                semanticTaskClassification,
                semanticTaskClassifierLatencyMs,
                semanticTaskClassifierFailureType,
                statePersistence,
                stateFingerprint,
                stageMs: { ...stageMs },
                finalCopy: queryPlan.requiresClarification && policy === 'allowed'
                    ? CLARIFICATION_REQUIRED
                    : TRACE_COPY[response.status],
            };
            try {
                await Promise.resolve(dependencies.emitSanitizedTrace(trace)).catch(() => undefined);
            } catch {
                // Sanitized trace emission is best effort and cannot alter an application outcome.
            }
        }
        return response;
    };

    try {
        config = await dependencies.loadRuntimeConfig();
    } catch {
        return finish(temporaryAnswer(request.requestId), 'config_unavailable');
    }
    if (!config.enabled || (!config.publicEnabled && !config.ownerUids.includes(uid))) {
        return finish(temporaryAnswer(request.requestId), 'config_unavailable');
    }
    if (config.activeCorpusVersion === 'none') {
        return finish(temporaryAnswer(request.requestId), 'corpus_unavailable');
    }
    try {
        if (!await dependencies.verifyCorpusReady(config)) {
            return finish(temporaryAnswer(request.requestId), 'corpus_unavailable');
        }
    } catch {
        return finish(temporaryAnswer(request.requestId), 'corpus_unavailable');
    }

    let replay: unknown | null;
    try {
        replay = await dependencies.readCompletedReplay({ uid, requestId: request.requestId });
    } catch {
        return finish(temporaryAnswer(request.requestId), 'replay_invalid');
    }
    if (replay !== null) {
        try {
            const normalized = validateResponse(replay, request.requestId);
            const response = normalized.response;
            outcomeNormalizationReason = normalized.normalizationReason;
            return finish(response, responseErrorClass(response));
        } catch {
            return finish(temporaryAnswer(request.requestId), 'replay_invalid');
        }
    }

    let entitlement: EntitlementDecision;
    try {
        entitlement = await dependencies.resolveEntitlement({ uid });
    } catch {
        return finish(temporaryAnswer(request.requestId), 'entitlement_unavailable');
    }
    entitlementClass = entitlement.class;
    if (entitlement.class === 'none') {
        return finish(nonQuotaAnswer(request.requestId, 'not_entitled', NOT_ENTITLED), 'not_entitled');
    }

    let claim: ClaimResult;
    try {
        claim = await dependencies.claimUsage({
            uid, requestId: request.requestId, invocationId, entitlementClass: entitlement.class,
        });
    } catch {
        return finish(temporaryAnswer(request.requestId), 'usage_unavailable');
    }
    if (claim.kind === 'replay') {
        try {
            const normalized = validateResponse(claim.response, request.requestId);
            const response = normalized.response;
            outcomeNormalizationReason = normalized.normalizationReason;
            return finish(response, responseErrorClass(response));
        } catch {
            return finish(temporaryAnswer(request.requestId), 'replay_invalid');
        }
    }
    if (claim.kind === 'quota_exceeded') {
        return finish({
            requestId: request.requestId, status: 'quota_exceeded', answer: QUOTA_EXCEEDED,
            citations: [], nextResetAt: claim.nextResetAt,
        }, 'quota_exceeded');
    }
    if (claim.kind === 'rate_limited' || claim.kind === 'in_progress') {
        return finish(temporaryAnswer(request.requestId), 'request_busy');
    }

    const finalizationInput = (response: NoorAnswer): NoorHandlerFinalizeInput => ({
        uid, requestId: request.requestId, invocationId, response,
    });
    try {
        const policyStartedAt = safeNow(dependencies);
        policy = dependencies.classifyPolicy(request);
        if (policy === 'allowed' && request.mode !== 'verse_summary') {
            personalizedRulingClassifierInvoked = true;
            const classifierStartedAt = safeNow(dependencies);
            let outcome: PersonalizedRulingClassifierOutcome;
            try {
                outcome = await dependencies.classifyPersonalizedRuling(request);
            } catch {
                outcome = { kind: 'failure', failureType: 'provider_failure' };
            } finally {
                personalizedRulingClassifierLatencyMs = duration(classifierStartedAt, safeNow(dependencies));
            }
            if (outcome.kind === 'failure') {
                personalizedRulingClassifierFailureType = outcome.failureType;
                stageMs.policy = duration(policyStartedAt, safeNow(dependencies));
                throw new HandlerFailure('policy_classifier_unavailable');
            }
            personalizedRulingClassification = outcome.classification;
            if (outcome.classification === 'personalized_ruling') policy = 'personal_ruling';
        }
        stageMs.policy = duration(policyStartedAt, safeNow(dependencies));
        if (policy !== 'allowed') {
            const response = nonQuotaAnswer(request.requestId, 'policy_refusal', policy === 'out_of_scope' ? SCOPE_REFUSAL : POLICY_REFUSAL);
            await dependencies.finalizeNonAnswer(finalizationInput(response));
            return finish(response, 'policy_refusal');
        }

        const contextStartedAt = safeNow(dependencies);
        let validatedConversationState = input.conversationState ?? null;
        if (request.mode === 'chat' && validatedConversationState === null && dependencies.readValidatedConversationState) {
            try {
                validatedConversationState = await dependencies.readValidatedConversationState({ uid });
            } catch {
                validatedConversationState = null;
            }
        }
        if (request.mode === 'chat') {
            queryPlan = buildChatQueryPlan({ request, validatedConversationState });
            const taskFallbackInput = buildSemanticTaskFallbackInput({
                request,
                deterministicPlan: queryPlan,
                validatedConversationState,
            });
            if (taskFallbackInput) {
                semanticTaskClassifierInvoked = true;
                const classifierStartedAt = safeNow(dependencies);
                let outcome: SemanticTaskClassifierOutcome;
                try {
                    outcome = await dependencies.classifySemanticTask(taskFallbackInput);
                } catch {
                    outcome = { kind: 'failure', failureType: 'provider_failure' };
                } finally {
                    semanticTaskClassifierLatencyMs = duration(classifierStartedAt, safeNow(dependencies));
                }
                if (outcome.kind === 'failure') {
                    semanticTaskClassifierFailureType = outcome.failureType;
                    queryPlan = {
                        ...queryPlan,
                        variants: [],
                        requiresClarification: true,
                    };
                } else {
                    semanticTaskClassification = outcome.taskType;
                    queryPlan = applySemanticTaskClassification({
                        request,
                        deterministicPlan: queryPlan,
                        validatedConversationState,
                        taskType: outcome.taskType,
                    });
                }
            }
        }
        stageMs.context = duration(contextStartedAt, safeNow(dependencies));

        if (queryPlan.requiresClarification) {
            const response = nonQuotaAnswer(request.requestId, 'insufficient_evidence', CLARIFICATION_REQUIRED);
            await dependencies.finalizeNonAnswer(finalizationInput(response));
            return finish(response, 'insufficient_evidence');
        }

        const retrievalStartedAt = safeNow(dependencies);
        try {
            if (request.mode === 'chat') {
                if (queryPlan.retrievalTask === 'entity_summary') {
                    if (queryPlan.entity === null) throw new HandlerFailure('insufficient_evidence');
                    const summary = await dependencies.retrieveEntitySummary({
                        request, config, entity: queryPlan.entity,
                    });
                    preAnswerabilityEvidence = [...summary.evidence];
                    evidence = isEntitySummaryEvidenceSufficient(
                        queryPlan.entity,
                        summary.evidence,
                        summary.coverageCapacity,
                    )
                        ? [...summary.evidence]
                        : [];
                    answerabilityReason = evidence.length > 0 ? 'sufficient' : 'adaptive_coverage_insufficient';
                } else {
                    const results = await Promise.all(queryPlan.variants.map(variant => dependencies.retrieveSemantic({
                        request, config, query: variant.query,
                    })));
                    let entityScopeFiltered = false;
                    const normalized = results.map(normalizeSemanticRetrieval).map((result, index) => {
                        const scoped = scopeEvidenceToTaskBranch(result.evidence, queryPlan, index);
                        if (scoped.filtered) entityScopeFiltered = true;
                        return { ...result, evidence: scoped.evidence };
                    });
                    preAnswerabilityEvidence = normalized.flatMap(value => value.evidence);
                    vectorHitCount = normalized.reduce((total, value) => total + value.vectorHitCount, 0);
                    lexicalHitCount = normalized.reduce((total, value) => total + value.lexicalHitCount, 0);
                    lexicalSearchStatus = normalized.some(value => value.lexicalSearchStatus === 'unavailable')
                        ? 'unavailable'
                        : normalized.some(value => value.lexicalSearchStatus === 'available') ? 'available' : 'not_configured';
                    const answerabilityGateActive = results.length > 0 && results.every(isSemanticRetrievalResult);
                    const answerableGroups = queryPlan.retrievalTask === 'multi_entity_comparison'
                        ? normalized.map((value, index) => {
                            const branch = queryPlan.variants[index];
                            return branch ? selectAnswerableEvidence(branch.query, value.evidence, config) : [];
                        })
                        : answerabilityGateActive
                            ? filterAnswerableEvidence(queryPlan.variants, normalized, config)
                            : normalized.map(value => value.evidence);
                    evidence = mergeEvidence(answerableGroups, config);
                    if (queryPlan.retrievalTask === 'multi_entity_comparison') {
                        multiEntitySupportGroups = answerableGroups;
                        const supportedEntityCount = answerableGroups.filter(group => group.length > 0).length;
                        if (supportedEntityCount !== queryPlan.entitySet.length
                            || !hasDistinctEntityBranchSupport(queryPlan.entitySet, evidence, answerableGroups)) {
                            evidence = [];
                        }
                        answerabilityReason = evidence.length > 0 ? 'balanced_multi_entity' : 'insufficient';
                    } else {
                        answerabilityReason = entityScopeFiltered
                            ? 'entity_scope_filtered'
                            : evidence.length > 0 ? 'sufficient' : 'insufficient';
                    }
                    if (answerabilityGateActive && evidence.length === 0 && queryPlan.retrievalTask !== 'multi_entity_comparison') {
                        const recoveryQuery = buildControlledRecoveryQuery({
                            request,
                            validatedConversationState,
                        });
                        if (recoveryQuery !== null) {
                            try {
                                const recoveryResult = normalizeSemanticRetrieval(await dependencies.retrieveSemantic({
                                    request,
                                    config,
                                    query: recoveryQuery,
                                }));
                                const scopedRecovery = scopeEvidenceToTaskBranch(recoveryResult.evidence, queryPlan, 0);
                                if (scopedRecovery.filtered) entityScopeFiltered = true;
                                const recovery = { ...recoveryResult, evidence: scopedRecovery.evidence };
                                vectorHitCount += recovery.vectorHitCount;
                                lexicalHitCount += recovery.lexicalHitCount;
                                if (recovery.lexicalSearchStatus === 'unavailable') lexicalSearchStatus = 'unavailable';
                                else if (recovery.lexicalSearchStatus === 'available' && lexicalSearchStatus === 'not_configured') lexicalSearchStatus = 'available';
                                const recoveryAnswerabilityQuery = [...queryPlan.variants]
                                    .reverse()
                                    .find(variant => variant.kind === 'context_enriched')?.query
                                    ?? queryPlan.variants[0]?.query
                                    ?? request.question;
                                const recoveryEvidence = selectAnswerableEvidence(recoveryAnswerabilityQuery, recovery.evidence, config);
                                evidence = mergeEvidence([...answerableGroups, recoveryEvidence], config);
                                if (evidence.length > 0) answerabilityReason = 'sufficient';
                            } catch {
                                // Initial retrieval succeeded. Optional recovery failure preserves the safe abstention.
                            }
                        }
                    }
                }
            } else {
                evidence = await dependencies.retrieveExact({ request, config });
                preAnswerabilityEvidence = [...evidence];
                answerabilityReason = evidence.length > 0 ? 'sufficient' : 'insufficient';
            }
        } catch {
            throw new HandlerFailure('retrieval_unavailable');
        } finally {
            retrievalMs = duration(retrievalStartedAt, safeNow(dependencies));
        }
        retrievedChunkIds = evidence.map(item => item.chunk.chunkId);
        if (evidence.length === 0) {
            const response = nonQuotaAnswer(request.requestId, 'insufficient_evidence', INSUFFICIENT_EVIDENCE);
            await dependencies.finalizeNonAnswer(finalizationInput(response));
            return finish(response, 'insufficient_evidence');
        }

        let generated: unknown;
        const generationStartedAt = safeNow(dependencies);
        try {
            generated = await dependencies.generateGroundedAnswer({ request, evidence, config, taskPlan: queryPlan });
        } catch {
            throw new HandlerFailure('generation_unavailable');
        } finally {
            generationMs = duration(generationStartedAt, safeNow(dependencies));
            stageMs.generation = generationMs;
        }
        generationDiagnostics = getGenerationDiagnostics(generated);
        const citationStartedAt = safeNow(dependencies);
        let response: NoorAnswer;
        try {
            const normalized = validateResponse(
                generated,
                request.requestId,
                queryPlan.explicitEntity && queryPlan.entity !== null && queryPlan.retrievalTask !== 'multi_entity_comparison'
                    ? queryPlan.entity.surahNumber
                    : null,
            );
            response = normalized.response;
            outcomeNormalizationReason = normalized.normalizationReason;
            if (response.status === 'answered' && queryPlan.retrievalTask === 'multi_entity_comparison') {
                const citedKeys = new Set(response.citations.map(citation => `${citation.source}:${citation.chunkId}`));
                const citedEvidence = evidence.filter(item => citedKeys.has(evidenceKey(item)));
                if (!hasDistinctEntityBranchSupport(queryPlan.entitySet, citedEvidence, multiEntitySupportGroups)) {
                    throw new HandlerFailure('citation_validation_failure');
                }
            }
            citationValidation = generationDiagnostics?.errorClass === 'citation_validation_failure'
                ? 'failed'
                : response.status === 'answered' && response.citations.length > 0 ? 'passed' : 'not_run';
        } catch (error) {
            citationValidation = 'failed';
            if (error instanceof HandlerFailure) throw error;
            throw new HandlerFailure('response_invalid');
        } finally {
            stageMs.citationValidation = duration(citationStartedAt, safeNow(dependencies));
        }
        generationStatus = response.status;
        if (response.status === 'answered') {
            try {
                await dependencies.finalizeAnswered(finalizationInput(response));
            } catch {
                throw new HandlerFailure('finalization_unavailable');
            }
            const nextState = request.mode === 'chat'
                ? createValidatedConversationState({
                    request,
                    response,
                    evidence,
                    taskPlan: queryPlan,
                    previousState: validatedConversationState,
                })
                : null;
            if (nextState && dependencies.writeValidatedConversationState) {
                try {
                    await dependencies.writeValidatedConversationState({ uid, state: nextState });
                    statePersistence = 'persisted';
                    stateFingerprint = nextState.sourceQuestionFingerprint;
                    stateAction = validatedConversationState ? 'replaced' : 'persisted';
                } catch {
                    // Conversation state is optional context and must never invalidate a grounded answer.
                }
            }
        } else {
            await dependencies.finalizeNonAnswer(finalizationInput(response));
        }
        return finish(response, generationDiagnostics?.errorClass ?? responseErrorClass(response));
    } catch (error) {
        const response = temporaryAnswer(request.requestId);
        generationStatus = 'temporarily_unavailable';
        try {
            await dependencies.finalizeNonAnswer(finalizationInput(response));
        } catch {
            // The reservation lease may expire; never return an unaccounted answer.
        }
        const errorClass = error instanceof HandlerFailure ? error.errorClass : 'finalization_unavailable';
        return finish(response, errorClass);
    }
}
