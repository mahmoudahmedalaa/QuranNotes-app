import { createHash } from 'node:crypto';

import type { NoorAnswer, NoorChatRequest, NoorRequest } from './types';
import type { RetrievedEvidence } from './types';

const MAX_SUBJECT_TOKENS = 8;
const MAX_STORED_EVIDENCE_IDS = 8;
export const CONVERSATION_STATE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SAFE_TOKEN = /^[\p{L}\p{N}_'-]{2,48}$/u;
const SAFE_QUESTION_FINGERPRINT = /^[a-f0-9]{64}$/;
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

export interface ValidatedConversationState {
    subjectTokens: readonly string[];
    evidenceIds: readonly string[];
    evidenceCount: number;
    expiresAt: string;
    sourceQuestionFingerprint: string;
}

export interface QueryVariant {
    kind: 'original' | 'context_enriched';
    query: string;
}

export interface ChatQueryPlan {
    variants: readonly QueryVariant[];
    contextSelected: boolean;
    conversationState: 'validated_subject_and_evidence' | 'none';
    requiresClarification: boolean;
}

export interface CreateValidatedConversationStateInput {
    request: Extract<NoorRequest, { mode: 'chat' }>;
    response: NoorAnswer;
    evidence: readonly RetrievedEvidence[];
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
    return {
        subjectTokens,
        evidenceIds,
        evidenceCount: evidenceIds.length,
        expiresAt: new Date(expiresAtMs).toISOString(),
        sourceQuestionFingerprint,
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
    const questionTokens = extractSubjectTokens(input.request.question);
    const subjectTokens = !isStructuralFollowUp(input.request.question) && questionTokens.length > 0
        ? questionTokens
        : extractCitedEvidenceTokens(citedEvidence);
    if (citedEvidence.length === 0 || subjectTokens.length === 0) return null;
    return parseValidatedConversationState({
        subjectTokens,
        evidenceIds: citedEvidence.map(item => item.chunk.chunkId),
        evidenceCount: citedEvidence.length,
        expiresAt: new Date(nowMs + CONVERSATION_STATE_RETENTION_MS).toISOString(),
        sourceQuestionFingerprint: fingerprintQuestion(input.request.question),
    }, nowMs);
}

function isStructuralFollowUp(question: string): boolean {
    const subjectTokens = extractSubjectTokens(question);
    const hasOnlyFollowUpTokens = subjectTokens.length === 0
        || subjectTokens.every(token => FOLLOW_UP_TOKENS.has(token));
    const hasReferentialPronoun = /\b(?:its|it|this|that|these|those|his|her|their|them)\b/i.test(question);
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
    const structuralFollowUp = isStructuralFollowUp(input.request.question);
    const contextSelected = state !== null
        && structuralFollowUp
        && hasPriorSubjectMatch(input.request, state);
    if (!contextSelected || state === null) {
        return {
            variants: structuralFollowUp
                ? (input.request.verseContext ? [{ kind: 'original', query: `${original.query}${verseReference}` }] : [])
                : [{ kind: 'original', query: `${original.query}${verseReference}` }],
            contextSelected: false,
            conversationState: 'none',
            requiresClarification: structuralFollowUp && !input.request.verseContext,
        };
    }
    return {
        variants: [
            { kind: 'original', query: `${original.query}${verseReference}` },
            {
                kind: 'context_enriched',
                query: `${input.request.question} Regarding ${state.subjectTokens.join(' ')}.${verseReference}`,
            },
        ],
        contextSelected: true,
        conversationState: 'validated_subject_and_evidence',
        requiresClarification: false,
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
        if (plan.contextSelected) return state.subjectTokens.join(' ');
    }
    if (input.request.verseContext) {
        return `Quran ${input.request.verseContext.surah}:${input.request.verseContext.verse}`;
    }
    return null;
}
