import type { NoorCitation } from './generatedContract';
import type { RetrievedEvidence } from './types';

const MAX_ANSWER_CHARACTERS = 8000;
const CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/g;
const PARAGRAPH_CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/;
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
        || value.answer.trim().length === 0
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
        return citationIds.length === 0
            ? null
            : { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'unused_citation' };
    }
    if (citationIds.length === 0) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'missing_required_citation' };
    }

    const markers = value.answer.match(CITATION_MARKER) ?? [];
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

export function validateGeneratedAnswer(value: unknown, evidence: readonly RetrievedEvidence[]): ValidatedGeneratedAnswer {
    if (diagnoseGeneratedAnswer(value, evidence) !== null) return invalidGeneratedAnswer();

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

export function parseAndValidateGeneratedAnswer(text: string, evidence: readonly RetrievedEvidence[]): ValidatedGeneratedAnswer {
    let value: unknown;
    try {
        value = JSON.parse(text) as unknown;
    } catch {
        return invalidGeneratedAnswer();
    }
    return validateGeneratedAnswer(value, evidence);
}
