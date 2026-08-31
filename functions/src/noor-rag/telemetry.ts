import { createHmac } from 'node:crypto';

import { GENERATION_ABSTENTION_REASONS } from './citations';
import { isSafeProviderDiagnosticCode } from './generation';
import type { NoorHandlerTelemetryEvent, NoorSanitizedTrace } from './handler';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_SUBJECT_ENTRIES = 10;
const MAX_STAGE_DURATION_MS = 120_000;

interface SnapshotLike { exists: boolean; data(): unknown }
interface ReferenceLike { path?: string; get(): Promise<SnapshotLike>; set(value: unknown, options: { merge: boolean }): Promise<void> }
interface TransactionLike { get(reference: ReferenceLike): Promise<SnapshotLike>; set(reference: ReferenceLike, value: unknown, options: { merge: false }): void }
interface FirestoreLike { doc(path: string): ReferenceLike; runTransaction<T>(worker: (transaction: TransactionLike) => Promise<T>): Promise<T> }

interface TelemetryInput {
    firestore: object;
    uid: string;
    secret: string;
    pseudonymKeyVersion: string;
    traceId: string;
    now: Date;
    event: NoorHandlerTelemetryEvent;
}

interface SubjectEntry { pseudonym: string; pseudonymKeyVersion: string }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntries(value: unknown): SubjectEntry[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_SUBJECT_ENTRIES) throw new Error('Invalid Noor telemetry subject');
    return value.map(item => {
        if (!isRecord(item) || typeof item.pseudonym !== 'string' || typeof item.pseudonymKeyVersion !== 'string') {
            throw new Error('Invalid Noor telemetry subject');
        }
        return { pseudonym: item.pseudonym, pseudonymKeyVersion: item.pseudonymKeyVersion };
    });
}

function boundedStageDuration(value: number): number {
    return Number.isFinite(value)
        ? Math.max(0, Math.min(MAX_STAGE_DURATION_MS, Math.floor(value)))
        : 0;
}

function boundedCount(value: number, maximum: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;
}

function safeTraceCase(value: string): string {
    return /^[a-z0-9][a-z0-9_-]{0,63}$/u.test(value) ? value : 'noor-request';
}

function safeRequestId(value: string): string {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
        ? value
        : '00000000-0000-4000-8000-000000000000';
}

function safeStateFingerprint(value: string | null): string | null {
    return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function safeTraceFinalCopy(value: string): string {
    return [
        'Answer available with validated tafsir citations.',
        'I could not find enough reliable tafsir evidence to answer that safely.',
        'I cannot help with that request.',
        'Noor is available with an active QuranNotes subscription.',
        'Your daily Noor answer limit has been reached.',
        'Please revise your question and try again.',
        'Noor is temporarily unavailable. Please try again shortly.',
        'Please name the Quran topic, verse, or person you mean so I can search the tafsir.',
    ].includes(value) ? value : 'Noor trace recorded.';
}

function sanitizeNoorTrace(trace: NoorSanitizedTrace): NoorSanitizedTrace {
    return {
        requestId: safeRequestId(trace.requestId),
        case: safeTraceCase(trace.case),
        policy: trace.policy,
        status: trace.status,
        citationCount: boundedCount(trace.citationCount, 8),
        conversationState: trace.conversationState,
        contextSelected: trace.contextSelected === true,
        selectedPriorUserContext: trace.selectedPriorUserContext,
        queryVariantCount: boundedCount(trace.queryVariantCount, 2),
        queryVariantKinds: trace.queryVariantKinds
            .filter(value => value === 'original' || value === 'context_enriched' || value === 'entity_branch')
            .slice(0, 2),
        taskType: trace.taskType,
        resolvedEntityIds: trace.resolvedEntityIds
            .filter(value => /^(?:surah:\d{1,3}|subject:[a-f0-9]{12})$/u.test(value))
            .slice(0, 2),
        sanitizedRewriteFingerprint: /^[a-f0-9]{64}$/u.test(trace.sanitizedRewriteFingerprint)
            ? trace.sanitizedRewriteFingerprint
            : '0'.repeat(64),
        preAnswerabilityEvidenceIds: trace.preAnswerabilityEvidenceIds
            .filter(value => /^E\d{1,2}$/u.test(value))
            .slice(0, 8),
        postAnswerabilityEvidenceIds: trace.postAnswerabilityEvidenceIds
            .filter(value => /^E\d{1,2}$/u.test(value))
            .slice(0, 8),
        answerabilityReason: trace.answerabilityReason,
        policyReasonCode: trace.policyReasonCode,
        outcomeNormalizationReason: trace.outcomeNormalizationReason,
        stateAction: trace.stateAction,
        vectorHitCount: boundedCount(trace.vectorHitCount, 100),
        lexicalHitCount: boundedCount(trace.lexicalHitCount, 100),
        lexicalSearchStatus: trace.lexicalSearchStatus === 'available' || trace.lexicalSearchStatus === 'unavailable'
            ? trace.lexicalSearchStatus
            : 'not_configured',
        evidenceIds: trace.evidenceIds.filter(value => /^E\d{1,2}$/u.test(value)).slice(0, 8),
        evidenceCount: boundedCount(trace.evidenceCount, 8),
        generationStatus: trace.generationStatus,
        citationValidation: trace.citationValidation,
        generationAttemptCount: boundedCount(trace.generationAttemptCount, 4),
        generationFailurePhase: trace.generationFailurePhase,
        structuralValidationResult: trace.structuralValidationResult,
        citationValidationResult: trace.citationValidationResult,
        citationValidationFailureSubtype: trace.citationValidationFailureSubtype,
        qualityJudgeInvoked: trace.qualityJudgeInvoked === true,
        generationRetryInvoked: trace.generationRetryInvoked === true,
        providerFailureCategory: [
            'retryable_transport', 'request_deterministic', 'safety_block', 'timeout', 'unknown',
        ].includes(trace.providerFailureCategory ?? '') ? trace.providerFailureCategory : null,
        providerFailureStatus: Number.isInteger(trace.providerFailureStatus)
            && (trace.providerFailureStatus ?? 0) >= 100
            && (trace.providerFailureStatus ?? 0) <= 599
            ? trace.providerFailureStatus
            : null,
        providerFailureCode: isSafeProviderDiagnosticCode(trace.providerFailureCode)
            ? trace.providerFailureCode
            : null,
        providerRetryCount: boundedCount(trace.providerRetryCount ?? 0, 1),
        providerRetryRecovered: trace.providerRetryRecovered === true,
        correctionInvoked: trace.correctionInvoked === true,
        generationAbstentionReason: GENERATION_ABSTENTION_REASONS.includes(
            trace.generationAbstentionReason as typeof GENERATION_ABSTENTION_REASONS[number],
        ) ? trace.generationAbstentionReason : null,
        generationAbstentionDisagreement: trace.generationAbstentionDisagreement === true,
        finalGenerationErrorClass: trace.finalGenerationErrorClass,
        personalizedRulingClassifierInvoked: trace.personalizedRulingClassifierInvoked === true,
        personalizedRulingClassification: trace.personalizedRulingClassification === 'general_information'
            || trace.personalizedRulingClassification === 'personalized_ruling'
            ? trace.personalizedRulingClassification
            : 'not_run',
        personalizedRulingClassifierLatencyMs: boundedStageDuration(trace.personalizedRulingClassifierLatencyMs),
        personalizedRulingClassifierFailureType: [
            'timeout',
            'malformed_output',
            'schema_validation_failure',
            'provider_failure',
        ].includes(trace.personalizedRulingClassifierFailureType ?? '')
            ? trace.personalizedRulingClassifierFailureType
            : null,
        semanticTaskClassifierInvoked: trace.semanticTaskClassifierInvoked === true,
        semanticTaskClassification: [
            'point_question',
            'entity_summary',
            'multi_entity_comparison',
            'contextual_followup',
        ].includes(trace.semanticTaskClassification)
            ? trace.semanticTaskClassification
            : 'not_run',
        semanticTaskClassifierLatencyMs: boundedStageDuration(trace.semanticTaskClassifierLatencyMs),
        semanticTaskClassifierFailureType: [
            'timeout',
            'malformed_output',
            'schema_validation_failure',
            'provider_failure',
        ].includes(trace.semanticTaskClassifierFailureType ?? '')
            ? trace.semanticTaskClassifierFailureType
            : null,
        statePersistence: trace.statePersistence,
        stateFingerprint: safeStateFingerprint(trace.stateFingerprint),
        stageMs: {
            policy: boundedStageDuration(trace.stageMs.policy),
            context: boundedStageDuration(trace.stageMs.context),
            retrieval: boundedStageDuration(trace.stageMs.retrieval),
            generation: boundedStageDuration(trace.stageMs.generation),
            citationValidation: boundedStageDuration(trace.stageMs.citationValidation),
        },
        finalCopy: safeTraceFinalCopy(trace.finalCopy),
    };
}

export function createNoorPseudonym(uid: string, secret: string): string {
    if (!uid || !secret) throw new Error('Invalid Noor telemetry identity');
    return createHmac('sha256', secret).update(uid, 'utf8').digest('hex');
}

export async function recordNoorTelemetry(input: TelemetryInput): Promise<void> {
    if (!Number.isFinite(input.now.getTime()) || !input.pseudonymKeyVersion || !input.traceId) {
        throw new Error('Invalid Noor telemetry input');
    }
    const db = input.firestore as FirestoreLike;
    const pseudonym = createNoorPseudonym(input.uid, input.secret);
    const createdAt = new Date(input.now.getTime());
    const expiresAt = new Date(input.now.getTime() + RETENTION_MS);
    const telemetry = {
        ...input.event,
        retrievalMs: boundedStageDuration(input.event.retrievalMs),
        generationMs: boundedStageDuration(input.event.generationMs),
        generationAttemptCount: boundedCount(input.event.generationAttemptCount, 4),
        providerFailureCode: isSafeProviderDiagnosticCode(input.event.providerFailureCode)
            ? input.event.providerFailureCode
            : null,
        providerRetryCount: boundedCount(input.event.providerRetryCount ?? 0, 1),
        providerRetryRecovered: input.event.providerRetryRecovered === true,
        personalizedRulingClassifierLatencyMs: boundedStageDuration(input.event.personalizedRulingClassifierLatencyMs),
        semanticTaskClassifierLatencyMs: boundedStageDuration(input.event.semanticTaskClassifierLatencyMs),
        pseudonym,
        pseudonymKeyVersion: input.pseudonymKeyVersion,
        serverTraceId: input.traceId,
        createdAt,
        expiresAt,
    };
    await db.doc(`noorTelemetry/${input.traceId}`).set(telemetry, { merge: true });
    await db.runTransaction(async transaction => {
        const reference = db.doc(`noorTelemetrySubjects/${input.uid}`);
        const snapshot = await transaction.get(reference);
        const data = snapshot.exists ? snapshot.data() : undefined;
        if (data !== undefined && !isRecord(data)) throw new Error('Invalid Noor telemetry subject');
        const entries = parseEntries(data?.entries);
        const next = { pseudonym, pseudonymKeyVersion: input.pseudonymKeyVersion };
        const unique = entries.filter(entry => entry.pseudonym !== pseudonym || entry.pseudonymKeyVersion !== input.pseudonymKeyVersion);
        unique.push(next);
        transaction.set(reference, { entries: unique.slice(-MAX_SUBJECT_ENTRIES), updatedAt: createdAt }, { merge: false });
    });
}

export interface NoorSanitizedTraceInput {
    firestore: object;
    uid: string;
    secret: string;
    pseudonymKeyVersion: string;
    traceId: string;
    now: Date;
    trace: NoorSanitizedTrace;
}

export async function recordNoorSanitizedTrace(input: NoorSanitizedTraceInput): Promise<void> {
    if (!Number.isFinite(input.now.getTime()) || !input.pseudonymKeyVersion || !input.traceId) {
        throw new Error('Invalid Noor sanitized trace input');
    }
    const db = input.firestore as FirestoreLike;
    const pseudonym = createNoorPseudonym(input.uid, input.secret);
    const createdAt = new Date(input.now.getTime());
    const expiresAt = new Date(input.now.getTime() + RETENTION_MS);
    await db.doc(`noorTelemetry/${input.traceId}`).set({
        sanitizedTrace: sanitizeNoorTrace(input.trace),
        pseudonym,
        pseudonymKeyVersion: input.pseudonymKeyVersion,
        serverTraceId: input.traceId,
        createdAt,
        expiresAt,
    }, { merge: true });
}
