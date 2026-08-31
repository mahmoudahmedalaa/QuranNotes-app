import type { NoorCitation } from './generatedContract';
import { containsAbstentionLanguage } from './outcome';
import type { RetrievedEvidence } from './types';

const MAX_ANSWER_CHARACTERS = 8000;
const CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/g;
const PARAGRAPH_CITATION_MARKER = /\[S\d+(?:\s*,\s*S\d+)*\]/;
const COMPLETE_CITATION_MARKER = /^\[S\d+(?:\s*,\s*S\d+)*\]$/;
const CITATION_LIKE_BRACKET = /\[[^\]\n]{1,64}\]/g;
const SOURCE_ID = /^S[1-9]\d*$/;

export const GENERATION_ABSTENTION_REASONS = [
    'missing_subject_support',
    'missing_relation_support',
    'missing_required_context',
    'evidence_conflict',
    'other_evidence_gap',
] as const;
export type GenerationAbstentionReason = typeof GENERATION_ABSTENTION_REASONS[number];

export interface ValidatedGeneratedAnswer {
    status: 'answered' | 'insufficient_evidence';
    abstentionReason: GenerationAbstentionReason | null;
    answer: string;
    citationIds: string[];
    citations: NoorCitation[];
}

export type CitationValidationFailureSubtype =
    | 'unknown_citation_id'
    | 'malformed_citation'
    | 'missing_required_citation'
    | 'entity_provenance_violation'
    | 'unused_citation'
    | 'duplicate_citation';

export type GeneratedAnswerValidationFailure = Readonly<
    | { phase: 'structural_validation'; errorClass: 'answer_validation_failure'; citationSubtype: null }
    | { phase: 'citation_validation'; errorClass: 'citation_validation_failure'; citationSubtype: CitationValidationFailureSubtype }
>;

export interface GeneratedAnswerValidationOptions {
    requireInlineCitations?: boolean;
    comparisonCitationContract?: ComparisonCitationContract | null;
}

export interface ComparisonCitationEntityContract {
    id: string;
    label: string;
    evidenceIds: string[];
}

export interface ComparisonCitationContract {
    taskType: 'multi_entity_comparison';
    entities: ComparisonCitationEntityContract[];
    allowedEvidenceIds: string[];
}

function invalidGeneratedAnswer(): never {
    throw new Error('Invalid generated answer');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedWords(value: string): string[] {
    return value
        .normalize('NFKC')
        .toLocaleLowerCase('en')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .split(/\s+/u)
        .filter(Boolean);
}

function mentionsEntity(value: string, label: string): boolean {
    const paragraphWords = normalizedWords(value);
    const labelWords = normalizedWords(label);
    if (labelWords.length === 0 || labelWords.length > paragraphWords.length) return false;
    return paragraphWords.some((_word, index) => labelWords.every((labelWord, offset) => (
        paragraphWords[index + offset] === labelWord
    )));
}

const FORMATTING_HEADING_WORDS = new Set([
    'and', 'comparison', 'conclusion', 'differences', 'introduction', 'key', 'lessons',
    'of', 'overview', 'similarities', 'stories', 'story', 'versus', 'vs',
]);

function isFormattingOnlyComparisonHeading(paragraph: string, contract: ComparisonCitationContract): boolean {
    const markdownMatch = paragraph.match(/^#{1,6}\s+(.+)$/u);
    const plainLabel = !markdownMatch && paragraph.includes(':') && !/[.!?]\s*$/u.test(paragraph)
        ? paragraph
        : null;
    const headingText = markdownMatch?.[1] ?? plainLabel;
    if (!headingText || PARAGRAPH_CITATION_MARKER.test(paragraph)) return false;
    const words = normalizedWords(headingText);
    if (words.length === 0 || words.length > 6 || words.some(word => /^\d+$/u.test(word))) return false;
    const entityWords = new Set(contract.entities.flatMap(entity => normalizedWords(entity.label)));
    return words.every(word => entityWords.has(word) || FORMATTING_HEADING_WORDS.has(word));
}

function comparisonContractIsValid(
    contract: ComparisonCitationContract,
    availableEvidenceIds: ReadonlySet<string>,
): boolean {
    if (contract.taskType !== 'multi_entity_comparison' || contract.entities.length < 2) return false;
    const allowed = contract.allowedEvidenceIds;
    if (allowed.length === 0
        || new Set(allowed).size !== allowed.length
        || allowed.some(id => !SOURCE_ID.test(id) || !availableEvidenceIds.has(id))) return false;
    const entityIds = contract.entities.map(entity => entity.id);
    const labels = contract.entities.map(entity => entity.label.trim());
    if (new Set(entityIds).size !== entityIds.length
        || labels.some(label => label.length === 0)
        || new Set(labels.map(label => label.toLocaleLowerCase('en'))).size !== labels.length) return false;
    const allowedSet = new Set(allowed);
    return contract.entities.every(entity => (
        entity.evidenceIds.length > 0
        && new Set(entity.evidenceIds).size === entity.evidenceIds.length
        && entity.evidenceIds.every(id => allowedSet.has(id))
    ));
}

function hasDistinctCitationSupport(
    entities: readonly ComparisonCitationEntityContract[],
    citationIds: readonly string[],
): boolean {
    const assign = (index: number, used: ReadonlySet<string>): boolean => {
        if (index >= entities.length) return true;
        return entities[index]!.evidenceIds.some(id => (
            citationIds.includes(id) && !used.has(id) && assign(index + 1, new Set([...used, id]))
        ));
    };
    return assign(0, new Set());
}

function comparisonParagraphFailure(
    paragraphs: readonly string[],
    contract: ComparisonCitationContract,
): GeneratedAnswerValidationFailure | null {
    const allowedIds = new Set(contract.allowedEvidenceIds);
    for (const paragraph of paragraphs) {
        if (isFormattingOnlyComparisonHeading(paragraph, contract)) continue;
        const paragraphMarkers = paragraph.match(CITATION_MARKER) ?? [];
        const paragraphCitationIds = [...new Set(paragraphMarkers.flatMap(marker => marker
            .slice(1, -1)
            .split(',')
            .map(id => id.trim())))];
        if (paragraphCitationIds.length === 0) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'missing_required_citation' };
        }
        if (paragraphCitationIds.some(id => !allowedIds.has(id))) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'entity_provenance_violation' };
        }
        const mentioned = contract.entities.filter(entity => mentionsEntity(paragraph, entity.label));
        const requiredEntities = mentioned.length === 0 ? contract.entities : mentioned;
        if (!hasDistinctCitationSupport(requiredEntities, paragraphCitationIds)) {
            return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'entity_provenance_violation' };
        }
    }
    return null;
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
            && keys !== 'abstentionReason|answer|citationIds|status'
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
    const abstentionReason = value.abstentionReason;
    const validAbstentionReason = typeof abstentionReason === 'string'
        && GENERATION_ABSTENTION_REASONS.includes(abstentionReason as GenerationAbstentionReason);
    if ((status === 'insufficient_evidence' && !validAbstentionReason)
        || (status === 'answered'
            && Object.prototype.hasOwnProperty.call(value, 'abstentionReason')
            && abstentionReason !== 'not_applicable')) {
        return { phase: 'structural_validation', errorClass: 'answer_validation_failure', citationSubtype: null };
    }
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
    const comparisonContract = options.comparisonCitationContract ?? null;
    if (comparisonContract !== null && !comparisonContractIsValid(comparisonContract, new Set(byId.keys()))) {
        return { phase: 'citation_validation', errorClass: 'citation_validation_failure', citationSubtype: 'malformed_citation' };
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
        if (comparisonContract !== null) {
            const comparisonFailure = comparisonParagraphFailure(paragraphs, comparisonContract);
            if (comparisonFailure !== null) return comparisonFailure;
        } else if (paragraphs.some(paragraph => !PARAGRAPH_CITATION_MARKER.test(paragraph))) {
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

    const generated = value as {
        status?: 'answered' | 'insufficient_evidence';
        abstentionReason?: GenerationAbstentionReason | 'not_applicable';
        answer: string;
        citationIds: string[];
    };
    const citationIds = generated.citationIds;
    const byId = new Map(evidence.map(item => [item.promptSourceId, item]));

    return {
        status: generated.status ?? 'answered',
        abstentionReason: generated.status === 'insufficient_evidence'
            ? generated.abstentionReason as GenerationAbstentionReason
            : null,
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
