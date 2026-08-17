import type { NoorCitation } from './generatedContract';
import type { RetrievedEvidence } from './types';

const MAX_ANSWER_CHARACTERS = 8000;
const CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/g;
const PARAGRAPH_CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/;
const SOURCE_ID = /^S[1-9]\d*$/;

export interface ValidatedGeneratedAnswer {
    answer: string;
    citationIds: string[];
    citations: NoorCitation[];
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

export function validateGeneratedAnswer(value: unknown, evidence: readonly RetrievedEvidence[]): ValidatedGeneratedAnswer {
    if (!isRecord(value)
        || Object.keys(value).length !== 2
        || !Object.prototype.hasOwnProperty.call(value, 'answer')
        || !Object.prototype.hasOwnProperty.call(value, 'citationIds')
        || typeof value.answer !== 'string'
        || value.answer.trim().length === 0
        || value.answer.length > MAX_ANSWER_CHARACTERS
        || !Array.isArray(value.citationIds)
        || !value.citationIds.every(id => typeof id === 'string')) {
        return invalidGeneratedAnswer();
    }

    const citationIds: string[] = value.citationIds;
    if (new Set(citationIds).size !== citationIds.length
        || citationIds.some(id => !SOURCE_ID.test(id))) return invalidGeneratedAnswer();

    const byId = new Map(evidence.map(item => [item.promptSourceId, item]));
    if (byId.size !== evidence.length
        || evidence.some(item => !SOURCE_ID.test(item.promptSourceId))
        || citationIds.some(id => !byId.has(id))) return invalidGeneratedAnswer();

    if (citationIds.length === 0) return invalidGeneratedAnswer();

    const markers = value.answer.match(CITATION_MARKER) ?? [];
    const usedIds = markers.flatMap(marker => marker
        .slice(1, -1)
        .split(',')
        .map(id => id.trim()));
    if (markers.length > 0) {
        if (usedIds.some(id => !byId.has(id))) return invalidGeneratedAnswer();
        const uniqueUsedIds = [...new Set(usedIds)];
        if (uniqueUsedIds.length !== citationIds.length
            || uniqueUsedIds.some(id => !citationIds.includes(id))
            || citationIds.some(id => !uniqueUsedIds.includes(id))) {
            return invalidGeneratedAnswer();
        }

        const paragraphs = value.answer.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
        if (paragraphs.some(paragraph => !PARAGRAPH_CITATION_MARKER.test(paragraph))) return invalidGeneratedAnswer();
    }

    return {
        answer: value.answer.trim(),
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
