import type { NoorAnswer, NoorChatRequest, NoorRequest } from './types';
import type { RetrievedEvidence } from './types';

const MAX_SUBJECT_TOKENS = 8;
const MAX_STORED_EVIDENCE_IDS = 8;
export const CONVERSATION_STATE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SAFE_TOKEN = /^[\p{L}\p{N}_'-]{2,48}$/u;
const STOP_WORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'can', 'does', 'do', 'for', 'from', 'how',
    'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
    'was', 'what', 'when', 'where', 'which', 'why', 'with', 'halal', 'haram',
    'permissible', 'forbidden', 'islam', 'islamic',
]);

export interface ValidatedConversationState {
    subjectTokens: readonly string[];
    evidenceIds: readonly string[];
    evidenceCount: number;
    expiresAt: string;
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
    return value
        .filter(isSafeToken)
        .map(token => token.normalize('NFKC').toLocaleLowerCase())
        .filter(token => !STOP_WORDS.has(token))
        .slice(0, MAX_SUBJECT_TOKENS);
}

export function extractSubjectTokens(question: string): string[] {
    const tokens = question
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}_'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean);
    return boundedTokens(tokens);
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
    if (!isRecord(value)
        || !Array.isArray(value.subjectTokens)
        || !Array.isArray(value.evidenceIds)
        || typeof evidenceCount !== 'number'
        || !Number.isInteger(evidenceCount)
        || evidenceCount < 1
        || evidenceCount > MAX_STORED_EVIDENCE_IDS
        || expiresAtMs === null
        || expiresAtMs <= nowMs) {
        return null;
    }
    const subjectTokens = boundedTokens(value.subjectTokens.filter((item): item is string => typeof item === 'string'));
    const evidenceIds = value.evidenceIds
        .filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 256)
        .slice(0, MAX_STORED_EVIDENCE_IDS);
    if (subjectTokens.length === 0 || evidenceIds.length === 0 || evidenceIds.length !== evidenceCount) return null;
    return { subjectTokens, evidenceIds, evidenceCount: evidenceIds.length, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function createValidatedConversationState(
    input: CreateValidatedConversationStateInput,
    nowMs = Date.now(),
): ValidatedConversationState | null {
    if (input.request.mode !== 'chat' || input.response.status !== 'answered' || input.response.citations.length === 0) {
        return null;
    }
    const evidenceByChunkId = new Map(input.evidence.map(item => [item.chunk.chunkId, item]));
    const citedEvidence = input.response.citations
        .map(citation => evidenceByChunkId.get(citation.chunkId))
        .filter((item): item is RetrievedEvidence => item !== undefined)
        .slice(0, MAX_STORED_EVIDENCE_IDS);
    const subjectTokens = extractSubjectTokens(input.request.question);
    if (citedEvidence.length === 0 || subjectTokens.length === 0) return null;
    return parseValidatedConversationState({
        subjectTokens,
        evidenceIds: citedEvidence.map(item => item.chunk.chunkId),
        evidenceCount: citedEvidence.length,
        expiresAt: new Date(nowMs + CONVERSATION_STATE_RETENTION_MS).toISOString(),
    }, nowMs);
}

function isStructuralFollowUp(question: string): boolean {
    return /\b(?:alternative|alternatives|what about|what happened next|tell me more|him|her|it|they|this)\b/i.test(question)
        || /^\s*(?:why|how)\s*[?!.]?\s*$/i.test(question);
}

function hasPriorSubjectMatch(request: NoorChatRequest, state: ValidatedConversationState): boolean {
    const priorUserTurn = [...request.history]
        .reverse()
        .find(turn => turn.role === 'user' && turn.content !== request.question);
    if (!priorUserTurn) return false;
    const priorTokens = new Set(extractSubjectTokens(priorUserTurn.content));
    return state.subjectTokens.some(token => priorTokens.has(token));
}

export function buildChatQueryPlan(input: Readonly<{
    request: NoorChatRequest;
    validatedConversationState?: ValidatedConversationState | null;
}>): ChatQueryPlan {
    const original: QueryVariant = { kind: 'original', query: input.request.question };
    const state = input.validatedConversationState
        ? parseValidatedConversationState(input.validatedConversationState)
        : null;
    const structuralFollowUp = isStructuralFollowUp(input.request.question);
    const contextSelected = state !== null
        && structuralFollowUp
        && hasPriorSubjectMatch(input.request, state);
    if (!contextSelected || state === null) {
        return {
            variants: structuralFollowUp ? [] : [original],
            contextSelected: false,
            conversationState: 'none',
            requiresClarification: structuralFollowUp,
        };
    }
    return {
        variants: [
            original,
            { kind: 'context_enriched', query: `${input.request.question} Regarding ${state.subjectTokens.join(' ')}.` },
        ],
        contextSelected: true,
        conversationState: 'validated_subject_and_evidence',
        requiresClarification: false,
    };
}
