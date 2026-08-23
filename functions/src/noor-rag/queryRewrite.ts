import { createHash } from 'node:crypto';

import type { NoorAnswer, NoorChatRequest, NoorRequest } from './types';
import type { RetrievedEvidence } from './types';
import {
    canonicalSurahByNumber,
    hasEntitySummarySignal,
    resolveQuranSurahEntity,
    resolveQuranSurahEntities,
    type QuranSurahEntity,
} from './quranEntities';

const MAX_SUBJECT_TOKENS = 8;
const MAX_STORED_EVIDENCE_IDS = 8;
export const CONVERSATION_STATE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SAFE_TOKEN = /^[\p{L}\p{N}_'-]{2,48}$/u;
const SAFE_QUESTION_FINGERPRINT = /^[a-f0-9]{64}$/;
const SAFE_ENTITY_ID = /^(?:surah:\d{1,3}|subject:[\p{L}\p{N}_'-]+(?:-[\p{L}\p{N}_'-]+){0,2})$/u;
const STOP_WORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'can', 'does', 'do', 'for', 'from', 'how',
    'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
    'was', 'what', 'when', 'where', 'which', 'why', 'with', 'halal', 'haram',
    'permissible', 'forbidden', 'islam', 'islamic', 'tell', 'say', 'explain',
    'describe', 'discuss', 'mention', 'tafsir', 'prophet', 'muslims', 'use',
    'instead', 'important', 'special', 'significance', 'virtue', 'virtues',
    'meaning', 'teach', 'teaches',
]);
const FOLLOW_UP_TOKENS = new Set([
    'alternative', 'alternatives', 'else', 'happened', 'he', 'her', 'hers', 'him',
    'his', 'more', 'next', 'she', 'their', 'theirs', 'them', 'then', 'they',
    'this', 'those', 'tell', 'instead', 'its',
]);
const SUMMARY_TASK_TOKENS = new Set([
    'across', 'its', 'learn', 'lesson', 'lessons', 'main', 'mainly', 'overview',
    'summary', 'summarise', 'summarize', 'surah', 'theme', 'themes',
]);

const ENTITY_PHRASE_NOISE = new Set([
    'a', 'an', 'and', 'are', 'account', 'accounts', 'compare', 'contrast', 'different', 'difference',
    'differences', 'how', 'of', 'prophet', 'prophets', 'similar', 'similarities', 'story', 'stories',
    'the', 'their', 'versus', 'with',
]);

export type NoorTaskType = 'point_question' | 'entity_summary' | 'multi_entity_comparison' | 'contextual_followup';
export type NoorRetrievalTask = 'point_question' | 'entity_summary' | 'multi_entity_comparison';

export interface DiscourseEntity {
    id: string;
    label: string;
    kind: 'surah' | 'subject';
    surahNumber?: number;
}

export interface ValidatedConversationState {
    subjectTokens: readonly string[];
    evidenceIds: readonly string[];
    evidenceCount: number;
    expiresAt: string;
    sourceQuestionFingerprint: string;
    entity?: QuranSurahEntity;
    activeTask: NoorTaskType;
    primaryEntity: DiscourseEntity | null;
    entitySet: readonly DiscourseEntity[];
    comparisonFrame: boolean;
    referentialRoles: readonly string[];
    semanticSubject: readonly string[];
    previousTurnFingerprint: string;
    validatedEvidenceRefs: readonly string[];
}

export interface QueryVariant {
    kind: 'original' | 'context_enriched' | 'entity_branch';
    query: string;
    entityId?: string;
}

export interface ChatQueryPlan {
    variants: readonly QueryVariant[];
    contextSelected: boolean;
    conversationState: 'validated_subject_and_evidence' | 'none';
    requiresClarification: boolean;
    taskType: NoorTaskType;
    retrievalTask: NoorRetrievalTask;
    entity: QuranSurahEntity | null;
    entitySet: readonly DiscourseEntity[];
    primaryEntity: DiscourseEntity | null;
    explicitEntity: boolean;
}

export interface CreateValidatedConversationStateInput {
    request: Extract<NoorRequest, { mode: 'chat' }>;
    response: NoorAnswer;
    evidence: readonly RetrievedEvidence[];
    taskPlan?: ChatQueryPlan;
    previousState?: ValidatedConversationState | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeToken(value: unknown): value is string {
    return typeof value === 'string' && SAFE_TOKEN.test(value);
}

function boundedTokens(value: readonly string[]): string[] {
    const result: string[] = [];
    for (const rawToken of value) {
        const token = rawToken.normalize('NFKC').toLocaleLowerCase();
        if (!isSafeToken(token) || STOP_WORDS.has(token) || result.includes(token)) continue;
        result.push(token);
        if (result.length === MAX_SUBJECT_TOKENS) break;
    }
    return result;
}

function tokenize(value: string): string[] {
    return value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}_'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean);
}

export function extractSubjectTokens(question: string): string[] {
    return boundedTokens(tokenize(question));
}

function normalizeEntityLabel(value: string): string {
    return tokenize(value)
        .filter(token => !ENTITY_PHRASE_NOISE.has(token))
        .slice(0, 3)
        .join(' ')
        .trim();
}

function discourseEntityForSurah(entity: QuranSurahEntity): DiscourseEntity {
    return {
        id: `surah:${entity.surahNumber}`,
        label: `Surah ${entity.canonicalName}`,
        kind: 'surah',
        surahNumber: entity.surahNumber,
    };
}

function subjectEntity(value: string): DiscourseEntity | null {
    const label = normalizeEntityLabel(value);
    if (label.length === 0) return null;
    const id = `subject:${label.replace(/\s+/gu, '-')}`;
    return SAFE_ENTITY_ID.test(id) ? { id, label, kind: 'subject' } : null;
}

function extractComparisonEntitySet(question: string): DiscourseEntity[] {
    const surahs = resolveQuranSurahEntities(question);
    if (surahs.length >= 2) return surahs.slice(0, 2).map(discourseEntityForSurah);
    const patterns = [
        /\b(?:compare|contrast)\s+(.{1,80}?)\s+(?:and|with|to|versus|vs\.?)\s+(.{1,80}?)(?:[?!.]|$)/iu,
        /\b(?:differences?|similarities?)\s+between\s+(.{1,80}?)\s+and\s+(.{1,80}?)(?:[?!.]|$)/iu,
        /\bhow\s+are\s+(.{1,80}?)\s+and\s+(.{1,80}?)\s+(?:different|similar|alike)\b/iu,
        /\b(?:stories?|accounts?)\s+of\s+(.{1,80}?)\s+and\s+(.{1,80}?)(?:\s+(?:different|similar|alike)|[?!.]|$)/iu,
    ];
    for (const pattern of patterns) {
        const match = pattern.exec(question);
        if (!match) continue;
        const left = subjectEntity(match[1] ?? '');
        const right = subjectEntity(match[2] ?? '');
        if (left && right && left.id !== right.id) return [left, right];
    }
    return [];
}

function isPluralReference(question: string): boolean {
    return /\b(?:both|those\s+two|the\s+two|their\s+(?:stories|accounts)|them|they)\b/iu.test(question);
}

function entityBranchQuery(question: string, entity: DiscourseEntity, entitySet: readonly DiscourseEntity[]): string {
    const entityTokens = new Set(entitySet.flatMap(item => tokenize(item.label)));
    const operation = extractSubjectTokens(question)
        .filter(token => !entityTokens.has(token) && !FOLLOW_UP_TOKENS.has(token))
        .slice(0, 5);
    return [entity.label, ...operation].join(' ').trim();
}

function parseDiscourseEntity(value: unknown): DiscourseEntity | null {
    if (!isRecord(value)
        || typeof value.id !== 'string'
        || !SAFE_ENTITY_ID.test(value.id)
        || typeof value.label !== 'string'
        || value.label.trim().length === 0
        || value.label.length > 96
        || (value.kind !== 'surah' && value.kind !== 'subject')) {
        return null;
    }
    if (value.kind === 'surah') {
        if (typeof value.surahNumber !== 'number' || !Number.isInteger(value.surahNumber)) return null;
        const canonical = canonicalSurahByNumber(value.surahNumber);
        if (!canonical || value.id !== `surah:${canonical.surahNumber}`) return null;
        return discourseEntityForSurah(canonical);
    }
    if (value.surahNumber !== undefined) return null;
    return { id: value.id, label: value.label.trim(), kind: 'subject' };
}

function extractCitedEvidenceTokens(evidence: readonly RetrievedEvidence[]): string[] {
    const tokens: string[] = [];
    for (const item of evidence) tokens.push(...tokenize(item.chunk.retrievalText));
    return boundedTokens(tokens);
}

function fingerprintQuestion(question: string): string {
    const normalized = question.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
    return createHash('sha256').update(normalized).digest('hex');
}

function expiryMillis(value: unknown): number | null {
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (value instanceof Date) return value.getTime();
    if (isRecord(value) && typeof value.toMillis === 'function') {
        const millis = (value.toMillis as () => unknown)();
        return typeof millis === 'number' && Number.isFinite(millis) ? millis : null;
    }
    return null;
}

export function parseValidatedConversationState(value: unknown, nowMs = Date.now()): ValidatedConversationState | null {
    const evidenceCount = isRecord(value) ? value.evidenceCount : null;
    const expiresAtMs = isRecord(value) ? expiryMillis(value.expiresAt) : null;
    const sourceQuestionFingerprint = isRecord(value) ? value.sourceQuestionFingerprint : undefined;
    if (!isRecord(value)
        || !Array.isArray(value.subjectTokens)
        || !Array.isArray(value.evidenceIds)
        || typeof evidenceCount !== 'number'
        || !Number.isInteger(evidenceCount)
        || evidenceCount < 1
        || evidenceCount > MAX_STORED_EVIDENCE_IDS
        || expiresAtMs === null
        || expiresAtMs <= nowMs
        || typeof sourceQuestionFingerprint !== 'string'
        || !SAFE_QUESTION_FINGERPRINT.test(sourceQuestionFingerprint)) {
        return null;
    }
    const subjectTokens = boundedTokens(value.subjectTokens.filter((item): item is string => typeof item === 'string'));
    const evidenceIds = value.evidenceIds
        .filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 256)
        .slice(0, MAX_STORED_EVIDENCE_IDS);
    if (subjectTokens.length === 0 || evidenceIds.length === 0 || evidenceIds.length !== evidenceCount) return null;
    let entity: QuranSurahEntity | undefined;
    if (value.entity !== undefined) {
        if (!isRecord(value.entity)
            || value.entity.entityType !== 'surah'
            || typeof value.entity.surahNumber !== 'number'
            || !Number.isInteger(value.entity.surahNumber)
            || typeof value.entity.canonicalName !== 'string'
            || typeof value.entity.verseCount !== 'number') {
            return null;
        }
        const canonical = canonicalSurahByNumber(value.entity.surahNumber);
        if (canonical === null
            || canonical.canonicalName !== value.entity.canonicalName
            || canonical.verseCount !== value.entity.verseCount) {
            return null;
        }
        entity = canonical;
    }
    const semanticSubject = Array.isArray(value.semanticSubject)
        ? boundedTokens(value.semanticSubject.filter((item): item is string => typeof item === 'string'))
        : subjectTokens;
    if (semanticSubject.length === 0) return null;
    const rawEntitySet = value.entitySet === undefined
        ? (entity ? [discourseEntityForSurah(entity)] : [])
        : value.entitySet;
    if (!Array.isArray(rawEntitySet) || rawEntitySet.length > 2) return null;
    const entitySet = rawEntitySet.map(parseDiscourseEntity);
    if (entitySet.some(item => item === null)) return null;
    const parsedEntitySet = entitySet as DiscourseEntity[];
    const primaryEntity = value.primaryEntity === undefined
        ? parsedEntitySet[0] ?? null
        : value.primaryEntity === null ? null : parseDiscourseEntity(value.primaryEntity);
    if (value.primaryEntity !== undefined && value.primaryEntity !== null && primaryEntity === null) return null;
    const activeTask = value.activeTask === 'entity_summary'
        || value.activeTask === 'multi_entity_comparison'
        || value.activeTask === 'contextual_followup'
        || value.activeTask === 'point_question'
        ? value.activeTask
        : parsedEntitySet.length > 1 ? 'multi_entity_comparison' : 'point_question';
    const comparisonFrame = value.comparisonFrame === undefined
        ? parsedEntitySet.length > 1
        : value.comparisonFrame;
    if (typeof comparisonFrame !== 'boolean' || comparisonFrame !== (parsedEntitySet.length > 1)) return null;
    const referentialRoles = value.referentialRoles === undefined
        ? parsedEntitySet.map(item => item.id)
        : value.referentialRoles;
    if (!Array.isArray(referentialRoles)
        || referentialRoles.length > 2
        || !referentialRoles.every(item => typeof item === 'string' && parsedEntitySet.some(entityItem => entityItem.id === item))) {
        return null;
    }
    const previousTurnFingerprint = value.previousTurnFingerprint === undefined
        ? sourceQuestionFingerprint
        : value.previousTurnFingerprint;
    if (typeof previousTurnFingerprint !== 'string' || !SAFE_QUESTION_FINGERPRINT.test(previousTurnFingerprint)) return null;
    const validatedEvidenceRefs = value.validatedEvidenceRefs === undefined ? evidenceIds : value.validatedEvidenceRefs;
    if (!Array.isArray(validatedEvidenceRefs)
        || validatedEvidenceRefs.length !== evidenceIds.length
        || !validatedEvidenceRefs.every((item, index) => item === evidenceIds[index])) {
        return null;
    }
    return {
        subjectTokens,
        evidenceIds,
        evidenceCount: evidenceIds.length,
        expiresAt: new Date(expiresAtMs).toISOString(),
        sourceQuestionFingerprint,
        ...(entity ? { entity } : {}),
        activeTask,
        primaryEntity,
        entitySet: parsedEntitySet,
        comparisonFrame,
        referentialRoles: [...referentialRoles],
        semanticSubject,
        previousTurnFingerprint,
        validatedEvidenceRefs: evidenceIds,
    };
}

export function createValidatedConversationState(
    input: CreateValidatedConversationStateInput,
    nowMs = Date.now(),
): ValidatedConversationState | null {
    if (input.request.mode !== 'chat' || input.response.status !== 'answered' || input.response.citations.length === 0) {
        return null;
    }
    const evidenceByChunkId = new Map(input.evidence.map(item => [item.chunk.chunkId, item]));
    const citedEvidence: RetrievedEvidence[] = [];
    for (const citation of input.response.citations) {
        const item = evidenceByChunkId.get(citation.chunkId);
        if (!item) return null;
        if (citedEvidence.length < MAX_STORED_EVIDENCE_IDS) citedEvidence.push(item);
    }
    const previousState = input.previousState ? parseValidatedConversationState(input.previousState, nowMs) : null;
    const taskPlan = input.taskPlan ?? buildChatQueryPlan({
        request: input.request,
        validatedConversationState: previousState,
    });
    const questionTokens = extractSubjectTokens(input.request.question);
    const preservesFrame = taskPlan.contextSelected && previousState !== null;
    const subjectTokens = preservesFrame
        ? [...previousState.semanticSubject]
        : !isStructuralFollowUp(input.request.question) && questionTokens.length > 0
            ? questionTokens
            : extractCitedEvidenceTokens(citedEvidence);
    if (citedEvidence.length === 0 || subjectTokens.length === 0) return null;
    const resolvedEntity = taskPlan.entity ?? resolveQuranSurahEntity(input.request.question);
    const entity = resolvedEntity !== null
        && citedEvidence.every(item => item.chunk.surah === resolvedEntity.surahNumber)
        ? resolvedEntity
        : preservesFrame ? previousState.entity : undefined;
    const entitySet = taskPlan.entitySet.length > 0
        ? taskPlan.entitySet
        : preservesFrame ? previousState.entitySet : [];
    const primaryEntity = taskPlan.primaryEntity ?? (preservesFrame ? previousState.primaryEntity : null);
    const fingerprint = fingerprintQuestion(input.request.question);
    return parseValidatedConversationState({
        subjectTokens,
        evidenceIds: citedEvidence.map(item => item.chunk.chunkId),
        evidenceCount: citedEvidence.length,
        expiresAt: new Date(nowMs + CONVERSATION_STATE_RETENTION_MS).toISOString(),
        sourceQuestionFingerprint: fingerprint,
        ...(entity ? { entity } : {}),
        activeTask: taskPlan.taskType,
        primaryEntity,
        entitySet,
        comparisonFrame: entitySet.length > 1,
        referentialRoles: entitySet.map(item => item.id),
        semanticSubject: subjectTokens,
        previousTurnFingerprint: fingerprint,
        validatedEvidenceRefs: citedEvidence.map(item => item.chunk.chunkId),
    }, nowMs);
}

function isStructuralFollowUp(question: string): boolean {
    const subjectTokens = extractSubjectTokens(question);
    const hasOnlyFollowUpTokens = subjectTokens.length === 0
        || subjectTokens.every(token => FOLLOW_UP_TOKENS.has(token));
    const hasReferentialPronoun = /\b(?:its|it|this|that|these|those|his|him|her|their|them)\b/i.test(question);
    const hasExplicitSubject = /\b(?:about|regarding)\s+(?!it\b|this\b|that\b|these\b|those\b|him\b|her\b|them\b)[\p{L}\p{N}][\p{L}\p{N}'-]*/iu.test(question)
        || /^\s*(?:what|who)\s+is\s+(?:the\s+)?(?!important\b|special\b|significance\b|meaning\b)[\p{L}\p{N}][\p{L}\p{N}'-]*/iu.test(question);
    if (/^\s*(?:why|how|and\s+then|then\s+what|what\s+next|go\s+on|more)\s*[?!.]?\s*$/i.test(question)) {
        return true;
    }
    if (/^\s*what\s+happened(?:\s+next|\s+to\s+(?:him|her|them|it))?\s*[?!.]?\s*$/i.test(question)) return true;
    if (/^\s*(?:he|she|it|they)\b[^?!.]*[?!.]?\s*$/i.test(question)) return true;
    if (/^\s*(?:(?:why|how|when|where|what|who)\s+)?(?:did|does|do|is|are|was|were|can|could|would|should|will|has|have|had)\s+(?:he|she|it|they)\b[^?!.]*[?!.]?\s*$/i.test(question)) {
        return true;
    }
    if (/^\s*(?:(?:why|how|when|where|what|who)\s+)?(?:did|does|do|is|are|was|were|can|could|would|should|will|has|have|had)\s+(?:this|that|these|those)\b[^?!.]*[?!.]?\s*$/i.test(question)
        && hasOnlyFollowUpTokens) {
        return true;
    }
    if (hasReferentialPronoun && !hasExplicitSubject) return true;
    if (!/\b(?:alternative|alternatives|what about|what happened next|tell me more|instead)\b/i.test(question)) return false;
    return hasOnlyFollowUpTokens;
}

function hasPriorSubjectMatch(request: NoorChatRequest, state: ValidatedConversationState): boolean {
    const priorUserTurn = [...request.history]
        .reverse()
        .find(turn => turn.role === 'user' && turn.content !== request.question);
    if (!priorUserTurn) return false;
    return fingerprintQuestion(priorUserTurn.content) === state.sourceQuestionFingerprint;
}

export function buildChatQueryPlan(input: Readonly<{
    request: NoorChatRequest;
    validatedConversationState?: ValidatedConversationState | null;
}>): ChatQueryPlan {
    const original: QueryVariant = { kind: 'original', query: input.request.question };
    const state = input.validatedConversationState
        ? parseValidatedConversationState(input.validatedConversationState)
        : null;
    const verseReference = input.request.verseContext
        ? ` Regarding Quran ${input.request.verseContext.surah}:${input.request.verseContext.verse}.`
        : '';
    const summarySignal = hasEntitySummarySignal(input.request.question);
    const directEntity = resolveQuranSurahEntity(input.request.question);
    const directEntitySet = extractComparisonEntitySet(input.request.question);
    const structuralFollowUp = isStructuralFollowUp(input.request.question)
        && directEntity === null
        && directEntitySet.length === 0;
    const priorMatches = state !== null && hasPriorSubjectMatch(input.request, state);
    const contextualSummary = summarySignal && directEntity === null && state?.entity !== undefined && priorMatches;
    const entity = directEntity ?? (contextualSummary ? state?.entity ?? null : null);
    const contextualMultiEntity = directEntitySet.length === 0
        && state !== null
        && state.entitySet.length > 1
        && isPluralReference(input.request.question)
        && priorMatches;
    const entitySet = directEntitySet.length > 1
        ? directEntitySet
        : contextualMultiEntity ? [...state!.entitySet]
            : directEntity ? [discourseEntityForSurah(directEntity)] : [];
    const retrievalTask: NoorRetrievalTask = directEntitySet.length > 1 || contextualMultiEntity
        ? 'multi_entity_comparison'
        : summarySignal && entity !== null ? 'entity_summary' : 'point_question';
    const unresolvedSurahReference = directEntity === null && /\b(?:surah|surat)\b/iu.test(input.request.question);
    const summaryNeedsEntity = summarySignal
        && entity === null
        && (unresolvedSurahReference
            || extractSubjectTokens(input.request.question).every(token => SUMMARY_TASK_TOKENS.has(token)));
    const contextSelected = state !== null
        && (structuralFollowUp || contextualSummary || contextualMultiEntity)
        && priorMatches;
    const taskType: ChatQueryPlan['taskType'] = contextualSummary
        ? 'contextual_followup'
        : retrievalTask === 'multi_entity_comparison' ? 'multi_entity_comparison'
        : retrievalTask === 'entity_summary' ? 'entity_summary'
            : contextSelected ? 'contextual_followup' : 'point_question';
    const primaryEntity = entitySet[0] ?? (entity ? discourseEntityForSurah(entity) : null);
    const explicitEntity = directEntity !== null || directEntitySet.length > 1;
    const multiEntityVariants = entitySet.map(item => ({
        kind: 'entity_branch' as const,
        query: entityBranchQuery(input.request.question, item, entitySet),
        entityId: item.id,
    }));
    if (summaryNeedsEntity) {
        return {
            variants: [],
            contextSelected: false,
            conversationState: 'none',
            requiresClarification: true,
            taskType: 'entity_summary',
            retrievalTask: 'entity_summary',
            entity: null,
            entitySet: [],
            primaryEntity: null,
            explicitEntity: false,
        };
    }
    if (!contextSelected || state === null) {
        return {
            variants: retrievalTask === 'multi_entity_comparison'
                ? multiEntityVariants
                : structuralFollowUp
                ? (input.request.verseContext ? [{ kind: 'original', query: `${original.query}${verseReference}` }] : [])
                : [{ kind: 'original', query: `${original.query}${verseReference}` }],
            contextSelected: false,
            conversationState: 'none',
            requiresClarification: structuralFollowUp && !input.request.verseContext,
            taskType,
            retrievalTask,
            entity,
            entitySet,
            primaryEntity,
            explicitEntity,
        };
    }
    return {
        variants: retrievalTask === 'multi_entity_comparison' ? multiEntityVariants : [
            { kind: 'original', query: `${original.query}${verseReference}` },
            {
                kind: 'context_enriched',
                query: `${input.request.question} Regarding ${state.semanticSubject.join(' ')}.${verseReference}`,
            },
        ],
        contextSelected: true,
        conversationState: 'validated_subject_and_evidence',
        requiresClarification: false,
        taskType,
        retrievalTask,
        entity,
        entitySet: retrievalTask === 'multi_entity_comparison' ? [...state.entitySet] : entitySet,
        primaryEntity: retrievalTask === 'multi_entity_comparison' ? state.primaryEntity : primaryEntity,
        explicitEntity,
    };
}

export function buildControlledRecoveryQuery(input: Readonly<{
    request: Extract<NoorRequest, { mode: 'chat' }>;
    validatedConversationState?: ValidatedConversationState | null;
}>): string | null {
    const state = input.validatedConversationState
        ? parseValidatedConversationState(input.validatedConversationState)
        : null;
    if (state !== null) {
        const plan = buildChatQueryPlan({ request: input.request, validatedConversationState: state });
        if (plan.contextSelected) return state.semanticSubject.join(' ');
    }
    if (input.request.verseContext) {
        return `Quran ${input.request.verseContext.surah}:${input.request.verseContext.verse}`;
    }
    return null;
}
