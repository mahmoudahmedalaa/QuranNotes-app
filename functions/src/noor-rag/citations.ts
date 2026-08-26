import type { NoorCitation } from './generatedContract';
import { containsAbstentionLanguage } from './outcome';
import type { RetrievedEvidence } from './types';

const MAX_ANSWER_CHARACTERS = 8000;
const CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/g;
const PARAGRAPH_CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/;
const COMPLETE_CITATION_MARKER = /^\[S\d+(?:\s*,\s*S\d+)*\]$/;
const CITATION_LIKE_BRACKET = /\[[^\]\n]{1,64}\]/g;
const SOURCE_ID = /^S[1-9]\d*$/;

export interface ValidatedGeneratedAnswer {
    status: 'answered' | 'insufficient_evidence';
    answer: string;
    citationIds: string[];
    citations: NoorCitation[];
}

export type CitationValidationFailureSubtype =
    | 'unknown_citation_id'
    | 'malformed_citation'
    | 'missing_required_citation'
    | 'unused_citation'
    | 'duplicate_citation';

export type GeneratedAnswerValidationFailure = Readonly<
    | { phase: 'structural_validation'; errorClass: 'answer_validation_failure'; citationSubtype: null }
    | { phase: 'citation_validation'; errorClass: 'citation_validation_failure'; citationSubtype: CitationValidationFailureSubtype }
>;

export interface GeneratedAnswerValidationOptions {
    requireInlineCitations?: boolean;
}

function invalidGeneratedAnswer(): never {
    throw new Error('Invalid generated answer');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function citationFor(evidence: RetrievedEvidence): NoorCitation {
    const { chunk } = evidence;
    return {
        chunkId: chunk.chunkId,
        canonicalUnitId: chunk.canonicalUnitId,
        source: chunk.source,
        sourceTitle: chunk.sourceTitle,
        surah: chunk.surah,
        verseStart: chunk.verseStart,
        verseEnd: chunk.verseEnd,
        corpusVersion: chunk.corpusVersion,
    };
}

export function diagnoseGeneratedAnswer(
    value: unknown,
    evidence: readonly RetrievedEvidence[],
    options: GeneratedAnswerValidationOptions = {},
): GeneratedAnswerValidationFailure | null {
    const keys = isRecord(value) ? Object.keys(value).sort().join('|') : '';
    if (!isRecord(value)
        || (keys !== 'answer|citationIds' && keys !== 'answer|citationIds|status')
        || !Object.prototype.hasOwnProperty.call(value, 'answer')
        || !Object.prototype.hasOwnProperty.call(value, 'citationIds')
        || (Object.prototype.hasOwnProperty.call(value, 'status')
            && value.status !== 'answered'
            && value.status !== 'insufficient_evidence')
        || typeof value.answer !== 'string'
        || value.answer.length > MAX_ANSWER_CHARACTERS
        || !Array.isArray(value.citationIds)
        || !value.citationIds.every(id => typeof id === 'string')) {
        return { phase: 'structural_validation', errorClass: 'answer_validation_failure', citationSubtype: null };
    }

    const citationIds: string[] = value.citationIds;
    const status = value.status === 'insufficient_evidence' ? 'insufficient_evidence' : 'answered';
    if (new Set(citationIds).size !== citationIds.length) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'duplicate_citation' };
    }
    if (citationIds.some(id => !SOURCE_ID.test(id))) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'malformed_citation' };
    }

    const byId = new Map(evidence.map(item => [item.promptSourceId, item]));
    if (byId.size !== evidence.length || evidence.some(item => !SOURCE_ID.test(item.promptSourceId))) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'malformed_citation' };
    }
    if (citationIds.some(id => !byId.has(id))) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'unknown_citation_id' };
    }
    if (status === 'insufficient_evidence') {
        if (citationIds.length > 0) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'unused_citation' };
        }
        return value.answer.trim().length === 0 || containsAbstentionLanguage(value.answer)
            ? null
            : { phase: 'structural_validation', errorClass: 'answer_validation_failure', citationSubtype: null };
    }
    if (value.answer.trim().length === 0) {
        return { phase: 'structural_validation', errorClass: 'answer_validation_failure', citationSubtype: null };
    }
    if (citationIds.length === 0) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'missing_required_citation' };
    }

    const markers = value.answer.match(CITATION_MARKER) ?? [];
    const citationLikeBrackets = value.answer.match(CITATION_LIKE_BRACKET) ?? [];
    if (citationLikeBrackets.some(marker => /S\s*\d/iu.test(marker) && !COMPLETE_CITATION_MARKER.test(marker))) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'malformed_citation' };
    }
    if (options.requireInlineCitations === true && markers.length === 0) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'missing_required_citation' };
    }
    const usedIds = markers.flatMap(marker => marker
        .slice(1, -1)
        .split(',')
        .map(id => id.trim()));
    if (markers.length > 0) {
        if (usedIds.some(id => !SOURCE_ID.test(id))) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'malformed_citation' };
        }
        if (usedIds.some(id => !byId.has(id))) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'unknown_citation_id' };
        }
        const uniqueUsedIds = [...new Set(usedIds)];
        if (citationIds.some(id => !uniqueUsedIds.includes(id))) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'unused_citation' };
        }
        if (uniqueUsedIds.some(id => !citationIds.includes(id))) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'missing_required_citation' };
        }

        const paragraphs = value.answer.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
        if (paragraphs.some(paragraph => !PARAGRAPH_CITATION_MARKER.test(paragraph))) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'missing_required_citation' };
        }
    }
    return null;
}

export function validateGeneratedAnswer(
    value: unknown,
    evidence: readonly RetrievedEvidence[],
    options: GeneratedAnswerValidationOptions = {},
): ValidatedGeneratedAnswer {
    if (diagnoseGeneratedAnswer(value, evidence, options) !== null) return invalidGeneratedAnswer();

    const generated = value as { status?: 'answered' | 'insufficient_evidence'; answer: string; citationIds: string[] };
    const citationIds = generated.citationIds;
    const byId = new Map(evidence.map(item => [item.promptSourceId, item]));

    return {
        status: generated.status ?? 'answered',
        answer: generated.answer.trim(),
        citationIds: [...citationIds],
        citations: citationIds.map(id => citationFor(byId.get(id) as RetrievedEvidence)),
    };
}

export function parseAndValidateGeneratedAnswer(
    text: string,
    evidence: readonly RetrievedEvidence[],
    options: GeneratedAnswerValidationOptions = {},
): ValidatedGeneratedAnswer {
    let value: unknown;
    try {
        value = JSON.parse(text) as unknown;
    } catch {
        return invalidGeneratedAnswer();
    }
    return validateGeneratedAnswer(value, evidence, options);
}
