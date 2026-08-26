import type { NoorRuntimeConfig } from './config';
import type { RetrievedEvidence } from './types';
import type { QuranSurahEntity } from './quranEntities';
import { describeSynthesisEvidenceCapacity } from './synthesisCoverage';

const ENTITY_SUMMARY_COVERAGE_SECTIONS = 6;
const MIN_ENTITY_SUMMARY_UNITS = 4;

const ANSWERABILITY_IGNORED_TOKENS = new Set([
    'a', 'about', 'after', 'alike', 'an', 'and', 'are', 'at', 'before', 'but', 'can', 'compare', 'compared', 'comparison', 'contrast', 'could', 'describe', 'did', 'differ', 'difference', 'different', 'does', 'do', 'doing', 'during',
    'explain', 'for', 'from', 'give', 'had', 'has', 'have', 'he', 'her', 'him', 'his', 'how',
    'happen', 'happened', 'happens', 'in', 'is', 'islam', 'islamic', 'it', 'its', 'may', 'me', 'mention', 'mentioned', 'mentions', 'might', 'most', 'my', 'of', 'on', 'or',
    'our', 'passage', 'please', 'prophet', 'quran', 'question', 'regarding', 'say', 'she', 'should',
    'right', 'similar', 'surah', 'tafsir', 'tell', 'than', 'the', 'their', 'them', 'then', 'they', 'this', 'to', 'us', 'verse', 'was',
    'we', 'were', 'what', "what's", 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);
const ANSWERABILITY_CONCEPTS = new Map<string, string>([
    ['importance', 'importance'],
    ['important', 'importance'],
    ['significance', 'importance'],
    ['significant', 'importance'],
    ['special', 'importance'],
    ['virtue', 'importance'],
    ['virtues', 'importance'],
    ['alternative', 'alternative'],
    ['alternatives', 'alternative'],
    ['instead', 'alternative'],
    ['option', 'alternative'],
    ['options', 'alternative'],
    ['trade', 'alternative'],
    ['trading', 'alternative'],
    ['story', 'narrative'],
    ['stories', 'narrative'],
    ['account', 'narrative'],
    ['accounts', 'narrative'],
    ['haram', 'prohibition'],
    ['forbidden', 'prohibition'],
    ['prohibited', 'prohibition'],
    ['impermissible', 'prohibition'],
    ['halal', 'permission'],
    ['lawful', 'permission'],
    ['permitted', 'permission'],
    ['allowed', 'permission'],
    ['obligatory', 'obligation'],
    ['required', 'obligation'],
    ['commanded', 'obligation'],
    ['mandatory', 'obligation'],
    ['bad', 'condemnation'],
    ['blame', 'condemnation'],
    ['blamed', 'condemnation'],
    ['blameworthy', 'condemnation'],
    ['condemn', 'condemnation'],
    ['condemned', 'condemnation'],
    ['condemnation', 'condemnation'],
    ['disgrace', 'condemnation'],
    ['disgraced', 'condemnation'],
    ['evil', 'condemnation'],
    ['punish', 'condemnation'],
    ['punished', 'condemnation'],
    ['punishment', 'condemnation'],
    ['define', 'definition'],
    ['defined', 'definition'],
    ['definition', 'definition'],
    ['mean', 'definition'],
    ['meaning', 'definition'],
    ['means', 'definition'],
    ['lesson', 'teaching'],
    ['lessons', 'teaching'],
    ['teaching', 'teaching'],
    ['teachings', 'teaching'],
    ['wisdom', 'teaching'],
    ['best', 'performance'],
    ['perform', 'performance'],
    ['performed', 'performance'],
    ['performing', 'performance'],
    ['performance', 'performance'],
    ['well', 'performance'],
    ['cost', 'value'],
    ['price', 'value'],
    ['value', 'value'],
    ['valued', 'value'],
    ['worth', 'value'],
    ['result', 'result'],
    ['results', 'result'],
    ['score', 'result'],
    ['scored', 'result'],
    ['win', 'result'],
    ['winner', 'result'],
    ['won', 'result'],
    ['oppose', 'opposition'],
    ['opposed', 'opposition'],
    ['opposition', 'opposition'],
    ['refuse', 'opposition'],
    ['refused', 'opposition'],
    ['reject', 'opposition'],
    ['rejected', 'opposition'],
]);
const RELATION_CONCEPTS = new Set([
    'alternative', 'condemnation', 'definition', 'importance', 'narrative', 'obligation',
    'opposition', 'performance', 'permission', 'prohibition', 'result', 'teaching', 'value',
]);
const CURRENT_TIME_TOKENS = new Set(['current', 'currently', 'latest', 'now', 'recent', 'rn', 'today', 'yesterday']);
const STATIC_CORPUS_FRAME_TOKENS = new Set([
    'ayah', 'islam', 'islamic', 'prophet', 'quran', 'religion', 'surah', 'tafsir', 'verse',
]);
const SUBJECT_IDENTITY_ALIASES = new Map([
    ['noah', 'nuh'],
    ['nooh', 'nuh'],
    ['nuh', 'nuh'],
]);
const LATIN_TOKEN = /^[a-z'-]+$/;

export type AnswerabilitySemanticSlot =
    | 'subject'
    | 'relation_or_attribute'
    | 'temporal_or_current_requirement';

export interface AnswerabilitySemanticDecision {
    requiredSemanticSlots: readonly AnswerabilitySemanticSlot[];
    satisfiedSemanticSlots: readonly AnswerabilitySemanticSlot[];
    unsatisfiedSemanticSlots: readonly AnswerabilitySemanticSlot[];
    currentExternalStateRequired: boolean;
}

interface AnswerabilitySemanticRequirements {
    subjectTokens: readonly string[];
    relationConcept: string | null;
    currentExternalStateRequired: boolean;
    requiredSemanticSlots: readonly AnswerabilitySemanticSlot[];
}

function meaningfulQueryTokens(query: string): readonly string[] {
    return [...evidenceTokens(query)].filter(token => !ANSWERABILITY_IGNORED_TOKENS.has(token));
}

function framedSubjectTokens(query: string): readonly string[] | null {
    const normalized = query.normalize('NFKC').toLocaleLowerCase();
    const patterns = [
        /\babout\s+(.+)$/iu,
        /\b(?:tell\s+me\s+about|what\s+(?:does|do|did)\b.{0,40}\bsay\s+about|(?:explanation|warning)\s+(?:of|about))\s+(.+)$/iu,
        /\b(?:describe|explain)\s+(.+)$/iu,
        /\bwhat\s+happened\s+(?:after|before|to)\s+(.+)$/iu,
    ];
    for (const pattern of patterns) {
        const captured = pattern.exec(normalized)?.[1];
        if (captured) return meaningfulQueryTokens(captured);
    }
    return null;
}

function evidenceTokens(value: string): Set<string> {
    return new Set(value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean)
        .map(token => token.endsWith("'s") ? token.slice(0, -2) : token)
        .filter(Boolean));
}

function semanticConcept(token: string): string {
    const direct = ANSWERABILITY_CONCEPTS.get(token);
    if (direct !== undefined) return direct;
    const collapsed = token.replace(/(.)\1+/gu, '$1');
    return ANSWERABILITY_CONCEPTS.get(collapsed) ?? token;
}

function hasCrossSpellingSubjectMatch(queryTokens: readonly string[], chunkTokens: ReadonlySet<string>): boolean {
    const normalizedEvidence = new Set([...chunkTokens]
        .filter(token => LATIN_TOKEN.test(token))
        .map(token => SUBJECT_IDENTITY_ALIASES.get(token)
            ?? token.replace(/['-]/gu, '').replace(/(.)\1+/gu, '$1')));
    return queryTokens.some(token => LATIN_TOKEN.test(token)
        && normalizedEvidence.has(SUBJECT_IDENTITY_ALIASES.get(token)
            ?? token.replace(/['-]/gu, '').replace(/(.)\1+/gu, '$1')));
}

function relationConceptForQuery(query: string, tokens: readonly string[]): string | null {
    const normalized = query.normalize('NFKC').toLocaleLowerCase();
    if (/\b(?:tell\s+me\s+about|(?:explanation|warning)\s+(?:of|about)|what\s+(?:does|do|did)\b.{0,40}\bsay\s+about|what\s+happened\b)\b/iu.test(normalized)) {
        return 'description';
    }
    for (const token of tokens) {
        const concept = semanticConcept(token);
        if (RELATION_CONCEPTS.has(concept)) return concept;
    }
    if (/\b(?:describe|explain)\b|\bwho\s+(?:is|was|are|were)\b|\bwhat\s+(?:is|are|was|were)\b/iu.test(normalized)) {
        return 'description';
    }
    const meaningful = meaningfulQueryTokens(query);
    const auxiliaryIndex = tokens.findIndex(token => ['did', 'do', 'does', 'has', 'have', 'had', 'will', 'would'].includes(token));
    if (auxiliaryIndex >= 0) {
        const predicateCandidates = tokens.slice(auxiliaryIndex + 1)
            .filter(token => !ANSWERABILITY_IGNORED_TOKENS.has(token) && !CURRENT_TIME_TOKENS.has(token));
        if (predicateCandidates.length >= 2) return `lexical:${predicateCandidates[1]}`;
    }
    if (/^\s*(?:how|why)\b/iu.test(normalized) && meaningful.length >= 2) {
        return `lexical:${meaningful.at(-1)}`;
    }
    if (/^\s*what\b/iu.test(normalized) && meaningful.length >= 2) {
        return `lexical:${meaningful[0]}`;
    }
    if (/^\s*(?:is|are|was|were)\b/iu.test(normalized) && meaningful.length >= 2) {
        return `lexical:${meaningful.at(-1)}`;
    }
    return meaningful.length === 1 ? 'description' : null;
}

function currentExternalStateRequired(query: string, tokens: readonly string[], relationConcept: string | null): boolean {
    const normalized = query.normalize('NFKC').toLocaleLowerCase().trim();
    const staticCorpusFrame = tokens.some(token => STATIC_CORPUS_FRAME_TOKENS.has(token));
    if (staticCorpusFrame && relationConcept === 'definition') return false;
    if (tokens.some(token => ['current', 'currently', 'rn', 'today', 'yesterday'].includes(token))) return true;
    if (/\bat\s+present\b|\bthis\s+week\b|\blast\s+night\b/iu.test(normalized)) return true;
    if (tokens.includes('now')) {
        return !/^now\b[\s,;:-]*(?:describe|explain|tell\b|what\s+(?:does|do|did)\b.{0,40}\bsay\b)/iu.test(normalized);
    }
    const fixedHistoricalSelection = /\b(?:who|what)\s+(?:was|were)\b.*\b(?:latest|most\s+recent)\b.*\b(?:in|within|mentioned)\b/iu.test(normalized);
    if (fixedHistoricalSelection) return false;
    if (tokens.some(token => token === 'latest' || token === 'recent')) return true;
    if (staticCorpusFrame || relationConcept !== 'description') return false;
    return /^what\s+(?:is|are)\s+(?:the\s+)?(?:[\p{L}'-]+\s+){1,4}(?:in|at)\s+[\p{L}'-]+(?:\s+[\p{L}'-]+){0,3}/iu.test(normalized);
}

function lexicalStem(token: string): string {
    let stem = token.replace(/['-]/gu, '').replace(/(.)\1+/gu, '$1');
    if (stem.length > 5 && stem.endsWith('ing')) stem = stem.slice(0, -3);
    else if (stem.length > 4 && stem.endsWith('ed')) stem = stem.slice(0, -2);
    else if (stem.length > 4 && stem.endsWith('es')) stem = stem.slice(0, -2);
    else if (stem.length > 3 && stem.endsWith('s')) stem = stem.slice(0, -1);
    if (stem.length > 4 && stem.endsWith('e')) stem = stem.slice(0, -1);
    return stem;
}

function semanticRequirements(query: string): AnswerabilitySemanticRequirements {
    const tokens = [...evidenceTokens(query)];
    const relationConcept = relationConceptForQuery(query, tokens);
    const requiresCurrentExternalState = currentExternalStateRequired(query, tokens, relationConcept);
    const subjectTokens = (framedSubjectTokens(query) ?? meaningfulQueryTokens(query)).filter(token => (
        (!CURRENT_TIME_TOKENS.has(token) || relationConcept === 'definition')
        && semanticConcept(token) !== relationConcept
        && !RELATION_CONCEPTS.has(semanticConcept(token))
        && relationConcept !== `lexical:${token}`
    ));
    const requiredSemanticSlots: AnswerabilitySemanticSlot[] = ['subject', 'relation_or_attribute'];
    if (requiresCurrentExternalState) requiredSemanticSlots.push('temporal_or_current_requirement');
    return {
        subjectTokens,
        relationConcept,
        currentExternalStateRequired: requiresCurrentExternalState,
        requiredSemanticSlots,
    };
}

function subjectSupported(requirements: AnswerabilitySemanticRequirements, chunkTokens: ReadonlySet<string>): boolean {
    return requirements.subjectTokens.length > 0 && requirements.subjectTokens.every(token => (
        chunkTokens.has(token) || hasCrossSpellingSubjectMatch([token], chunkTokens)
    ));
}

function satisfiedSemanticSlots(
    requirements: AnswerabilitySemanticRequirements,
    evidence: RetrievedEvidence,
): Set<AnswerabilitySemanticSlot> {
    const chunkTokens = evidenceTokens(evidence.chunk.retrievalText);
    const chunkConcepts = new Set([...chunkTokens].map(semanticConcept));
    const satisfied = new Set<AnswerabilitySemanticSlot>();
    const hasSubject = subjectSupported(requirements, chunkTokens);
    if (hasSubject) satisfied.add('subject');
    if (requirements.relationConcept === 'description' && hasSubject) {
        satisfied.add('relation_or_attribute');
    } else if (requirements.relationConcept?.startsWith('lexical:')) {
        const relationToken = requirements.relationConcept.slice('lexical:'.length);
        if ([...chunkTokens].some(token => lexicalStem(token) === lexicalStem(relationToken))) {
            satisfied.add('relation_or_attribute');
        }
    } else if (requirements.relationConcept !== null && chunkConcepts.has(requirements.relationConcept)) {
        satisfied.add('relation_or_attribute');
    }
    // The approved tafsir corpus is static. It cannot establish a material
    // relative/current external-state fact, even when a nearby chunk shares words.
    return satisfied;
}

function hasDirectQuestionSupport(requirements: AnswerabilitySemanticRequirements, evidence: RetrievedEvidence): boolean {
    if (requirements.requiredSemanticSlots.length === 0) return false;
    const satisfied = satisfiedSemanticSlots(requirements, evidence);
    return requirements.requiredSemanticSlots.every(slot => satisfied.has(slot));
}

export function describeAnswerabilitySemantics(
    query: string,
    evidence: readonly RetrievedEvidence[],
): AnswerabilitySemanticDecision {
    const requirements = semanticRequirements(query);
    let satisfied = new Set<AnswerabilitySemanticSlot>();
    for (const item of evidence) {
        const candidate = satisfiedSemanticSlots(requirements, item);
        if (candidate.size > satisfied.size) satisfied = candidate;
    }
    const satisfiedSemanticSlotList = requirements.requiredSemanticSlots.filter(slot => satisfied.has(slot));
    return {
        requiredSemanticSlots: requirements.requiredSemanticSlots,
        satisfiedSemanticSlots: satisfiedSemanticSlotList,
        unsatisfiedSemanticSlots: requirements.requiredSemanticSlots.filter(slot => !satisfied.has(slot)),
        currentExternalStateRequired: requirements.currentExternalStateRequired,
    };
}

function verseRangesOverlap(left: RetrievedEvidence, right: RetrievedEvidence): boolean {
    return left.chunk.surah === right.chunk.surah
        && left.chunk.verseStart <= right.chunk.verseEnd
        && right.chunk.verseStart <= left.chunk.verseEnd;
}

export function selectAnswerableEvidence(
    query: string,
    evidence: readonly RetrievedEvidence[],
    config: NoorRuntimeConfig,
): RetrievedEvidence[] {
    const requirements = semanticRequirements(query);
    const directlySupported = evidence.filter(item => hasDirectQuestionSupport(requirements, item));
    if (directlySupported.length === 0) return [];
    const directIds = new Set(directlySupported.map(item => item.chunk.chunkId));
    return evidence.filter(item => {
        if (directIds.has(item.chunk.chunkId)) return true;
        if (item.kind !== 'semantic') return false;
        const threshold = config.sourceThresholds[item.chunk.source] ?? 1;
        return item.similarity >= threshold
            && directlySupported.some(direct => verseRangesOverlap(direct, item));
    });
}

export function isEntitySummaryEvidenceSufficient(
    entity: QuranSurahEntity,
    evidence: readonly RetrievedEvidence[],
    capacity?: Readonly<{ canonicalUnits: number; sections: number; span: number }>,
): boolean {
    if (evidence.length === 0 || evidence.some(item => item.chunk.surah !== entity.surahNumber)) return false;
    const description = describeSynthesisEvidenceCapacity(entity, evidence);
    const availableUnits = Math.max(description.canonicalUnits, Math.floor(capacity?.canonicalUnits ?? description.canonicalUnits));
    const availableSections = Math.max(description.positionalSections, Math.floor(capacity?.sections ?? description.positionalSections));
    const selectableUnits = Math.min(8, availableUnits);
    const requiredUnits = selectableUnits <= MIN_ENTITY_SUMMARY_UNITS
        ? selectableUnits
        : Math.ceil(selectableUnits * 0.75);
    const requiredSections = Math.min(
        ENTITY_SUMMARY_COVERAGE_SECTIONS,
        availableSections,
        Math.max(1, Math.ceil(availableSections * 0.67)),
    );
    const requiredConceptClusters = Math.min(3, evidence.length);
    const availableSpan = Math.max(0, Math.min(entity.verseCount - 1, Math.floor(capacity?.span ?? entity.verseCount - 1)));
    const requiredSpan = availableSpan <= 1 ? 0 : Math.ceil(availableSpan / 2);
    return description.canonicalUnits >= requiredUnits
        && description.positionalSections >= requiredSections
        && description.conceptClusters >= requiredConceptClusters
        && description.span >= requiredSpan;
}
