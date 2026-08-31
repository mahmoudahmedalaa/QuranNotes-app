import { createHash } from 'node:crypto';

import type { NoorAnswer, NoorChatRequest, NoorRequest } from './types';
import type { RetrievedEvidence } from './types';
import { normalizeQueryInterpretation } from './queryInterpretation';
import {
    canonicalSurahByNumber,
    hasEntitySummarySignal,
    hasPolarQuestionSignal,
    hasWholeEntityScopeSignal,
    pointFocusPolarity,
    resolveQuranSurahEntity,
    resolveQuranSurahEntityCandidate,
    resolveQuranSurahEntityCandidateMatch,
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
    'alternative', 'alternatives', 'both', 'compare', 'contrast', 'difference', 'differences',
    'different', 'else', 'happened', 'he', 'her', 'hers', 'him', 'his', 'learn',
    'more', 'next', 'she', 'their', 'theirs', 'them', 'then', 'they', 'this',
    'those', 'tell', 'instead', 'its', 'versus', 'vs', "what's", 'whats',
]);
const SUMMARY_TASK_TOKENS = new Set([
    'across', 'its', 'learn', 'lesson', 'lessons', 'main', 'mainly', 'overview',
    'summary', 'summarise', 'summarize', 'surah', 'theme', 'themes',
]);
const ELLIPTICAL_NORMATIVE_PREDICATES = new Set([
    'allowed', 'forbidden', 'halal', 'haram', 'impermissible', 'mandatory',
    'obligatory', 'permissible', 'permitted', 'prohibited', 'required',
]);
const EXPLICIT_QUESTION_FRAME_TOKENS = new Set([
    'are', 'can', 'could', 'did', 'do', 'does', 'has', 'have', 'how', 'is', 'may',
    'must', 'should', 'was', 'were', 'what', 'when', 'where', 'who', 'why', 'will', 'would',
]);

const ENTITY_PHRASE_NOISE = new Set([
    'a', 'about', 'an', 'and', 'are', 'account', 'accounts', 'compare', 'contrast', 'different', 'difference',
    'differences', 'how', 'of', 'prophet', 'prophets', 'similar', 'similarities', 'story', 'stories',
    'me', 'tell', 'the', 'their', 'versus', 'what', 'with',
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

export interface SemanticTaskFallbackInput {
    question: string;
    candidateEntityLabels: readonly string[];
    discourseEntityLabels: readonly string[];
    hasValidatedDiscourseFrame: boolean;
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
    const surahCandidate = resolveQuranSurahEntityCandidate(label);
    const canonicalLabel = surahCandidate
        ? normalizeEntityLabel(surahCandidate.canonicalName)
        : label;
    const id = `subject:${canonicalLabel.replace(/\s+/gu, '-')}`;
    return SAFE_ENTITY_ID.test(id) ? { id, label: canonicalLabel, kind: 'subject' } : null;
}

function extractComparisonEntitySet(question: string): DiscourseEntity[] {
    const surahs = resolveQuranSurahEntities(question);
    if (surahs.length >= 2) return surahs.slice(0, 2).map(discourseEntityForSurah);
    const patterns = [
        /\b(.{1,40}?)\s+(?:versus|vs\.?)\s+(.{1,40}?)(?:\s+(?:what(?:'s|s)?|how)\b.*)?(?:[?!.]|$)/iu,
        /\b(?:compare|contrast)\s+(.{1,40}?)\s+(?:and|with|to|versus|vs\.?)\s+(.{1,40}?)(?:\s+(?:what(?:'s|s)?|how)\b.*)?(?:[?!.]|$)/iu,
        /\b(?:differences?|similarities?)\s+between\s+(.{1,80}?)\s+and\s+(.{1,80}?)(?:[?!.]|$)/iu,
        /\bhow\s+are\s+(.{1,80}?)\s+and\s+(.{1,80}?)\s+(?:different|similar|alike)\b/iu,
        /\bhow\s+\S{1,8}\s+(.{1,40}?)\s+and\s+(.{1,40}?)\s+(?:different|similar|alike)\b/iu,
        /\b(.{1,40}?)\s+and\s+(.{1,40}?)\s+(?:what(?:'s|s)?\s+)?(?:diff|different|similar|alike)\b/iu,
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
    const hasReferentialPronoun = /\b(?:its|it|this|that|these|those|his|him|her|their|they|them)\b/i.test(question);
    const hasExplicitSubject = /\b(?:about|regarding)\s+(?!it\b|this\b|that\b|these\b|those\b|him\b|her\b|them\b)[\p{L}\p{N}][\p{L}\p{N}'-]*/iu.test(question)
        || /^\s*(?:what|who)\s+is\s+(?:the\s+)?(?!important\b|special\b|significance\b|meaning\b)[\p{L}\p{N}][\p{L}\p{N}'-]*/iu.test(question)
        || (/^\s*(?:(?:why|how|when|where|what|who)\s+)?(?:did|does|do|is|are|was|were|can|could|would|should|will|has|have|had)\s+(?!(?:he|she|it|its|they|this|that|these|those|him|her|them|there|you|important|special|significance|meaning|virtue|virtues|alternative)\b)[\p{L}\p{N}][\p{L}\p{N}'-]*/iu.test(question)
            && !/\babout\s+(?:it|this|that|these|those|him|her|them)\b/iu.test(question))
        || (/^\s*why\s+/iu.test(question) && resolveQuranSurahEntityCandidate(question) !== null);
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

function isAmbiguousStandaloneFragment(question: string): boolean {
    const tokens = tokenize(question);
    if (tokens.length === 0 || tokens.length > 5) return false;
    const first = tokens[0] ?? '';
    const second = tokens[1] ?? '';
    if (resolveQuranSurahEntityCandidate(question) !== null && hasClearPointFocus(question)) return false;
    if (first === 'what' && tokens.length === 1) return true;
    if (first === 'why' && tokens.length <= 2) return true;
    if (first === 'what' && second === 'happened' && tokens.length <= 3) return true;
    return tokens.some(token => ['they', 'them', 'him', 'her'].includes(token))
        && !resolveQuranSurahEntity(question);
}

function hasPriorSubjectMatch(request: NoorChatRequest, state: ValidatedConversationState): boolean {
    const priorUserTurn = [...request.history]
        .reverse()
        .find(turn => turn.role === 'user' && turn.content !== request.question);
    if (!priorUserTurn) return false;
    return fingerprintQuestion(priorUserTurn.content) === state.sourceQuestionFingerprint;
}

function referencedDiscourseEntities(
    question: string,
    entities: readonly DiscourseEntity[],
): DiscourseEntity[] {
    const questionTokens = tokenize(question);
    const surahCandidate = resolveQuranSurahEntityCandidate(question);
    return entities.filter(entity => {
        if (entity.kind === 'surah'
            && surahCandidate !== null
            && entity.surahNumber === surahCandidate.surahNumber) return true;
        const labelTokens = tokenize(entity.label);
        if (labelTokens.length === 0 || labelTokens.length > questionTokens.length) return false;
        return questionTokens.some((_token, start) => labelTokens.every((labelToken, offset) => (
            questionTokens[start + offset] === labelToken
        )));
    });
}

function hasClearPointFocus(question: string): boolean {
    const tokens = tokenize(question);
    if (hasPolarQuestionSignal(question)) return true;
    if (/\b\d{1,3}\s*:\s*\d{1,3}\b/u.test(question)) return true;
    const focusPolarity = pointFocusPolarity(question);
    if (focusPolarity === 'positive' || focusPolarity === 'mixed') return true;
    const first = tokens[0] ?? '';
    const second = tokens[1] ?? '';
    if (first === 'who' || first === 'when' || first === 'where') return true;
    if (['are', 'can', 'could', 'did', 'do', 'does', 'has', 'have', 'is', 'should', 'was', 'were', 'will', 'would'].includes(first)) return true;
    if (first === 'why' && ['is', 'are', 'did', 'does', 'do', 'was', 'were'].includes(second)) return true;
    if (first === 'why' && resolveQuranSurahEntityCandidate(question) !== null) return true;
    if (first === 'how' && ['long', 'many', 'much', 'is', 'are', 'did', 'does', 'was', 'were'].includes(second)) return true;
    if (first === 'what' && ['does', 'did', 'is', 'was'].includes(second)) {
        const broadExplicitSurahFrame = resolveQuranSurahEntityCandidate(question) !== null
            && tokens.some(token => token === 'surah' || token === 'surat')
            && tokens.includes('about');
        if (broadExplicitSurahFrame) return false;
        return true;
    }
    if (first === 'what' && second === 'happened' && tokens.length > 3) return true;
    return false;
}

function isAmbiguousContextFragment(
    request: NoorChatRequest,
    state: ValidatedConversationState,
): boolean {
    if (!hasPriorSubjectMatch(request, state)) return false;
    const tokens = tokenize(request.question);
    if (tokens.length === 0 || tokens.length > 5) return false;
    if (resolveQuranSurahEntity(request.question) || extractComparisonEntitySet(request.question).length > 0) return false;
    const first = tokens[0] ?? '';
    const second = tokens[1] ?? '';
    if (first === 'why' && !['is', 'are', 'did', 'does', 'do', 'was', 'were'].includes(second)) return true;
    if (first === 'what' && second === 'happened' && tokens.length <= 3) return true;
    return first === 'what' && !hasClearPointFocus(request.question);
}

export function buildSemanticTaskFallbackInput(input: Readonly<{
    request: NoorChatRequest;
    deterministicPlan: ChatQueryPlan;
    validatedConversationState?: ValidatedConversationState | null;
}>): SemanticTaskFallbackInput | null {
    const candidate = resolveQuranSurahEntityCandidate(input.request.question);
    const lowConfidencePoint = input.deterministicPlan.taskType === 'point_question'
        && !input.deterministicPlan.requiresClarification
        && input.deterministicPlan.retrievalTask === 'point_question';
    const unresolvedSummaryCandidate = input.deterministicPlan.taskType === 'entity_summary'
        && input.deterministicPlan.requiresClarification
        && input.deterministicPlan.retrievalTask === 'entity_summary'
        && candidate !== null;
    if (!lowConfidencePoint && !unresolvedSummaryCandidate) return null;
    const state = input.validatedConversationState
        ? parseValidatedConversationState(input.validatedConversationState)
        : null;
    const ambiguousContext = state !== null && isAmbiguousContextFragment(input.request, state);
    if (!ambiguousContext && (candidate === null || hasClearPointFocus(input.request.question))) return null;
    return {
        question: input.request.question,
        candidateEntityLabels: candidate ? [`Surah ${candidate.canonicalName}`] : [],
        discourseEntityLabels: state?.entitySet.map(entity => entity.label) ?? [],
        hasValidatedDiscourseFrame: state !== null && hasPriorSubjectMatch(input.request, state),
    };
}

function clarificationPlan(plan: ChatQueryPlan, taskType: NoorTaskType): ChatQueryPlan {
    return {
        ...plan,
        variants: [],
        contextSelected: false,
        conversationState: 'none',
        requiresClarification: true,
        taskType,
        retrievalTask: taskType === 'entity_summary' ? 'entity_summary' : 'point_question',
        entity: null,
        entitySet: [],
        primaryEntity: null,
        explicitEntity: false,
    };
}

export function applySemanticTaskClassification(input: Readonly<{
    request: NoorChatRequest;
    deterministicPlan: ChatQueryPlan;
    validatedConversationState?: ValidatedConversationState | null;
    taskType: NoorTaskType;
}>): ChatQueryPlan {
    if (input.taskType === 'point_question') {
        const explicitCandidate = resolveQuranSurahEntityCandidateMatch(input.request.question);
        if (input.deterministicPlan.entity === null
            && explicitCandidate?.explicitSurahMarker === true) {
            const entitySet = [discourseEntityForSurah(explicitCandidate.entity)];
            return {
                ...input.deterministicPlan,
                variants: [{ kind: 'original', query: input.request.question }],
                requiresClarification: false,
                taskType: 'point_question',
                retrievalTask: 'point_question',
                entity: explicitCandidate.entity,
                entitySet,
                primaryEntity: entitySet[0] ?? null,
                explicitEntity: true,
            };
        }
        return input.deterministicPlan;
    }
    const state = input.validatedConversationState
        ? parseValidatedConversationState(input.validatedConversationState)
        : null;
    if (input.taskType === 'entity_summary') {
        if (hasClearPointFocus(input.request.question)) return input.deterministicPlan;
        const candidateMatch = resolveQuranSurahEntityCandidateMatch(input.request.question);
        const candidate = candidateMatch?.entity ?? null;
        const articleNamedSurah = candidate?.canonicalName.includes('-') ?? false;
        const unmarkedExactAliasIsConservative = candidateMatch?.matchKind !== 'exact_alias'
            || (candidate?.canonicalName.replace(/[^\p{L}\p{N}]+/gu, '').length ?? 0) >= 5;
        const candidateHasWholeSurahScope = candidateMatch?.explicitSurahMarker === true
            || (unmarkedExactAliasIsConservative && hasWholeEntityScopeSignal(input.request.question))
            || (articleNamedSurah && hasEntitySummarySignal(input.request.question));
        const entity = input.deterministicPlan.entity ?? (candidateHasWholeSurahScope ? candidate : null);
        if (!entity && candidate !== null) return input.deterministicPlan;
        if (!entity) return clarificationPlan(input.deterministicPlan, 'entity_summary');
        const discourseEntity = discourseEntityForSurah(entity);
        return {
            ...input.deterministicPlan,
            variants: [{ kind: 'original', query: input.request.question }],
            contextSelected: false,
            conversationState: 'none',
            requiresClarification: false,
            taskType: 'entity_summary',
            retrievalTask: 'entity_summary',
            entity,
            entitySet: [discourseEntity],
            primaryEntity: discourseEntity,
            explicitEntity: true,
        };
    }
    if (input.taskType === 'multi_entity_comparison') {
        if (input.deterministicPlan.entitySet.length !== 2) {
            return clarificationPlan(input.deterministicPlan, 'multi_entity_comparison');
        }
        return {
            ...input.deterministicPlan,
            variants: input.deterministicPlan.entitySet.map(entity => ({
                kind: 'entity_branch' as const,
                query: entityBranchQuery(input.request.question, entity, input.deterministicPlan.entitySet),
                entityId: entity.id,
            })),
            requiresClarification: false,
            taskType: 'multi_entity_comparison',
            retrievalTask: 'multi_entity_comparison',
        };
    }
    if (state === null || !hasPriorSubjectMatch(input.request, state)) {
        return clarificationPlan(input.deterministicPlan, 'contextual_followup');
    }
    const currentCandidate = resolveQuranSurahEntityCandidate(input.request.question);
    const stateRepresentsCandidate = currentCandidate === null || state.entitySet.some(entity => (
        entity.id === `surah:${currentCandidate.surahNumber}`
        || tokenize(entity.label).includes(tokenize(currentCandidate.canonicalName).at(-1) ?? '')
    ));
    if (!stateRepresentsCandidate) return input.deterministicPlan;
    const referencedEntities = referencedDiscourseEntities(input.request.question, state.entitySet);
    const singleReference = referencedEntities.length === 1 ? referencedEntities : [];
    const comparisonFrame = state.entitySet.length > 1 && singleReference.length === 0;
    const entitySet = singleReference.length === 1
        ? singleReference
        : comparisonFrame ? [...state.entitySet] : input.deterministicPlan.entitySet;
    const contextSubject = singleReference[0]?.label ?? state.semanticSubject.join(' ');
    return {
        ...input.deterministicPlan,
        variants: comparisonFrame
            ? entitySet.map(entity => ({
                kind: 'entity_branch' as const,
                query: entityBranchQuery(input.request.question, entity, entitySet),
                entityId: entity.id,
            }))
            : [
                { kind: 'original', query: input.request.question },
                { kind: 'context_enriched', query: `${input.request.question} Regarding ${contextSubject}.` },
            ],
        contextSelected: true,
        conversationState: 'validated_subject_and_evidence',
        requiresClarification: false,
        taskType: 'contextual_followup',
        retrievalTask: comparisonFrame ? 'multi_entity_comparison' : 'point_question',
        entity: comparisonFrame ? null : input.deterministicPlan.entity,
        entitySet,
        primaryEntity: singleReference[0] ?? (comparisonFrame ? state.primaryEntity : input.deterministicPlan.primaryEntity),
        explicitEntity: input.deterministicPlan.explicitEntity,
    };
}

export function buildChatQueryPlan(input: Readonly<{
    request: NoorChatRequest;
    validatedConversationState?: ValidatedConversationState | null;
}>): ChatQueryPlan {
    const interpretedQuestion = normalizeQueryInterpretation(input.request.question);
    const questionTokens = tokenize(interpretedQuestion);
    const finalToken = questionTokens.at(-1) ?? '';
    const ellipticalNormative = questionTokens.length >= 2
        && ELLIPTICAL_NORMATIVE_PREDICATES.has(finalToken)
        && !questionTokens.some(token => EXPLICIT_QUESTION_FRAME_TOKENS.has(token));
    const retrievalQuestion = ellipticalNormative
        ? `Is ${interpretedQuestion.trim().replace(/^is\s+/iu, '')}`
        : interpretedQuestion;
    const original: QueryVariant = { kind: 'original', query: retrievalQuestion };
    const state = input.validatedConversationState
        ? parseValidatedConversationState(input.validatedConversationState)
        : null;
    const verseReference = input.request.verseContext
        ? ` Regarding Quran ${input.request.verseContext.surah}:${input.request.verseContext.verse}.`
        : '';
    const directEntity = resolveQuranSurahEntity(interpretedQuestion);
    const summarySignal = hasEntitySummarySignal(interpretedQuestion)
        || (directEntity !== null && hasWholeEntityScopeSignal(interpretedQuestion));
    const directEntitySet = extractComparisonEntitySet(interpretedQuestion);
    const structuralFollowUp = (isStructuralFollowUp(interpretedQuestion)
        || isAmbiguousStandaloneFragment(interpretedQuestion))
        && directEntity === null
        && directEntitySet.length === 0;
    const priorMatches = state !== null && hasPriorSubjectMatch(input.request, state);
    const stateEntityReferences = state === null
        ? []
        : referencedDiscourseEntities(interpretedQuestion, state.entitySet);
    const ambiguousSingularMultiEntityReference = state !== null
        && state.entitySet.length > 1
        && structuralFollowUp
        && !isPluralReference(interpretedQuestion)
        && stateEntityReferences.length !== 1;
    const contextualSummary = summarySignal && directEntity === null && state?.entity !== undefined && priorMatches;
    const entity = directEntity ?? (contextualSummary ? state?.entity ?? null : null);
    const contextualMultiEntity = directEntitySet.length === 0
        && state !== null
        && state.entitySet.length > 1
        && isPluralReference(interpretedQuestion)
        && priorMatches;
    const entitySet = directEntitySet.length > 1
        ? directEntitySet
        : contextualMultiEntity ? [...state!.entitySet]
            : directEntity ? [discourseEntityForSurah(directEntity)] : [];
    const retrievalTask: NoorRetrievalTask = directEntitySet.length > 1 || contextualMultiEntity
        ? 'multi_entity_comparison'
        : summarySignal && entity !== null ? 'entity_summary' : 'point_question';
    const unresolvedSurahReference = directEntity === null && /\b(?:surah|surat)\b/iu.test(interpretedQuestion);
    const summaryNeedsEntity = summarySignal
        && entity === null
        && (unresolvedSurahReference
            || extractSubjectTokens(interpretedQuestion).every(token => SUMMARY_TASK_TOKENS.has(token)));
    const contextSelected = state !== null
        && (structuralFollowUp || contextualSummary || contextualMultiEntity)
        && !ambiguousSingularMultiEntityReference
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
        query: entityBranchQuery(interpretedQuestion, item, entitySet),
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
            requiresClarification: (structuralFollowUp && !input.request.verseContext)
                || ambiguousSingularMultiEntityReference,
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
                query: `${retrievalQuestion} Regarding ${state.semanticSubject.join(' ')}.${verseReference}`,
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
