import type { NoorRuntimeConfig } from './config';
import { normalizeQueryInterpretation } from './queryInterpretation';
import type { RetrievedEvidence } from './types';
import { hasEntitySummarySignal, type QuranSurahEntity } from './quranEntities';
import { describeSynthesisEvidenceCapacity } from './synthesisCoverage';

const ENTITY_SUMMARY_COVERAGE_SECTIONS = 6;
const MIN_ENTITY_SUMMARY_UNITS = 4;

const ANSWERABILITY_IGNORED_TOKENS = new Set([
    'a', 'about', 'abt', 'after', 'alike', 'an', 'and', 'are', 'at', 'before', 'but', 'can', 'compare', 'compared', 'comparison', 'contrast', 'could', 'describe', 'did', 'differ', 'difference', 'different', 'does', 'do', 'doing', 'during',
    'explain', 'for', 'from', 'give', 'had', 'has', 'have', 'he', 'her', 'him', 'his', 'how', 'i',
    'happen', 'happened', 'happens', 'in', 'is', 'islam', 'islamic', 'it', 'its', 'may', 'me', 'mention', 'mentioned', 'mentions', 'might', 'most', 'my', 'of', 'on', 'or',
    'our', 'passage', 'please', 'prophet', 'quran', 'question', 'regarding', 'say', 'she', 'should',
    'right', 'similar', 'surah', 'tafsir', 'tell', 'than', 'the', 'their', 'them', 'then', 'they', 'this', 'to', 'us', 'verse', 'was',
    'we', 'were', 'what', "what's", 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'without', 'would', 'you', 'your',
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
const BROAD_SUMMARY_SYNTHESIS_RELATIONS = new Set([
    'description', 'teaching', 'lexical:learn', 'lexical:understand',
]);
const CURRENT_TIME_TOKENS = new Set(['current', 'currently', 'latest', 'now', 'recent', 'rn', 'today', 'yesterday']);
const CAUSAL_TOKENS = new Set([
    'because', 'cause', 'caused', 'causes', 'consequence', 'consequently', 'due',
    'if', 'reason', 'reasons', 'since', 'therefore', 'thus',
]);
const PROGRESSION_TOKENS = new Set([
    'after', 'continued', 'continues', 'following', 'later', 'next', 'subsequently', 'then',
]);
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
    | 'entity'
    | 'relation_or_attribute'
    | 'temporal_or_current_requirement'
    | 'comparison'
    | 'normative_strength';

export interface AnswerabilitySemanticDecision {
    relation: string | null;
    requiredSemanticSlots: readonly AnswerabilitySemanticSlot[];
    satisfiedSemanticSlots: readonly AnswerabilitySemanticSlot[];
    unsatisfiedSemanticSlots: readonly AnswerabilitySemanticSlot[];
    currentExternalStateRequired: boolean;
}

export type EvidenceQualificationTask =
    | 'point_question'
    | 'contextual_followup'
    | 'multi_entity_comparison'
    | 'entity_summary';

export interface EvidenceEntityProvenance {
    entityId: string;
    label?: string;
    evidenceIds: readonly string[];
}

export interface EvidenceQualificationContract extends AnswerabilitySemanticDecision {
    task: EvidenceQualificationTask;
    selectedEvidenceIds: readonly string[];
    entityProvenance: readonly EvidenceEntityProvenance[];
}

export interface BuildEvidenceQualificationContractInput {
    evidence: readonly RetrievedEvidence[];
    task: EvidenceQualificationTask;
    qualification: AnswerabilitySemanticDecision;
    entityProvenance?: readonly EvidenceEntityProvenance[];
}

export interface AnswerabilityQualificationResult {
    evidence: readonly RetrievedEvidence[];
    decision: AnswerabilitySemanticDecision;
}

interface AnswerabilitySemanticRequirements {
    subjectTokens: readonly string[];
    relationConcept: string | null;
    causalSupportRequired: boolean;
    currentExternalStateRequired: boolean;
    requiredSemanticSlots: readonly AnswerabilitySemanticSlot[];
}

function meaningfulQueryTokens(query: string): readonly string[] {
    return [...evidenceTokens(query)].filter(token => !ANSWERABILITY_IGNORED_TOKENS.has(token));
}

function framedSubjectTokens(query: string): readonly string[] | null {
    const normalized = query.normalize('NFKC').toLocaleLowerCase();
    const patterns = [
        /\b(?:about|abt)\s+(.+)$/iu,
        /\b(?:tell\s+me\s+(?:about|abt)|what\s+(?:does|do|did)\b.{0,40}\bsay\s+(?:about|abt)|(?:explanation|warning)\s+(?:of|about|abt))\s+(.+)$/iu,
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
        // Canonical tafsir headings can concatenate an entity and the next
        // capitalized heading word (for example, `ZenthoraThe`). Restore that
        // lost boundary before case-folding; this is exact normalization, not
        // fuzzy subject matching.
        .replace(/([\p{Ll}])([\p{Lu}])/gu, '$1 $2')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean)
        .map(token => token.endsWith("'s") ? token.slice(0, -2) : token)
        .map(token => token.replace(/^'+|'+$/gu, ''))
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
    if (/\b(?:tell\s+me\s+(?:about|abt)|(?:explanation|warning)\s+(?:of|about|abt)|what\s+(?:does|do|did)\b.{0,40}\bsay\s+(?:about|abt)|what\s+(?:about|abt)\b|what\s+happened\b)\b/iu.test(normalized)) {
        return 'description';
    }
    if (/\b(?:can|could|may)\b.{1,80}\bwithout\b/iu.test(normalized)) return 'obligation';
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
    if (stem.length > 7 && stem.endsWith('antly')) stem = stem.slice(0, -5);
    else if (stem.length > 6 && (stem.endsWith('ance') || stem.endsWith('ancy'))) stem = stem.slice(0, -4);
    else if (stem.length > 5 && stem.endsWith('ant')) stem = stem.slice(0, -3);
    else if (stem.length > 5 && stem.endsWith('ing')) stem = stem.slice(0, -3);
    else if (stem.length > 4 && stem.endsWith('ed')) stem = stem.slice(0, -2);
    else if (stem.length > 4 && stem.endsWith('es')) stem = stem.slice(0, -2);
    else if (stem.length > 3 && stem.endsWith('s')) stem = stem.slice(0, -1);
    else if (stem.length > 5 && stem.endsWith('er')) stem = stem.slice(0, -2);
    if (stem.length > 4 && stem.endsWith('e')) stem = stem.slice(0, -1);
    return stem;
}

function semanticRequirements(query: string): AnswerabilitySemanticRequirements {
    const interpretedQuery = normalizeQueryInterpretation(query);
    const tokens = [...evidenceTokens(interpretedQuery)];
    const relationConcept = relationConceptForQuery(interpretedQuery, tokens);
    const requiresCurrentExternalState = currentExternalStateRequired(interpretedQuery, tokens, relationConcept);
    const subjectTokens = (framedSubjectTokens(interpretedQuery) ?? meaningfulQueryTokens(interpretedQuery)).filter(token => (
        (!CURRENT_TIME_TOKENS.has(token) || relationConcept === 'definition')
        && semanticConcept(token) !== relationConcept
        && !RELATION_CONCEPTS.has(semanticConcept(token))
        && relationConcept !== `lexical:${token}`
    ));
    const requiredSemanticSlots: AnswerabilitySemanticSlot[] = ['subject', 'relation_or_attribute'];
    if (relationConcept !== null && ['obligation', 'permission', 'prohibition'].includes(relationConcept)) {
        requiredSemanticSlots.push('normative_strength');
    }
    if (requiresCurrentExternalState) requiredSemanticSlots.push('temporal_or_current_requirement');
    return {
        subjectTokens,
        relationConcept,
        causalSupportRequired: /(?:^|\s)why\b|\b(?:cause|caused|causes|reason|reasons)\b/iu.test(interpretedQuery.toLocaleLowerCase()),
        currentExternalStateRequired: requiresCurrentExternalState,
        requiredSemanticSlots,
    };
}

function semanticSegments(value: string): readonly string[] {
    const segments = value
        .normalize('NFKC')
        .split(/(?:[.!?;]+\s+)|\n+/u)
        .map(segment => segment.trim())
        .filter(Boolean);
    return segments.length > 0 ? segments : [value];
}

function causalSupportPresent(segment: string, tokens: ReadonlySet<string>): boolean {
    return [...tokens].some(token => CAUSAL_TOKENS.has(semanticConcept(token)) || CAUSAL_TOKENS.has(token))
        || /\bjust\s+as\b/iu.test(segment.normalize('NFKC'));
}

function subjectSupported(requirements: AnswerabilitySemanticRequirements, chunkTokens: ReadonlySet<string>): boolean {
    const chunkConcepts = new Set([...chunkTokens].map(semanticConcept));
    const chunkStems = new Set([...chunkTokens].map(lexicalStem));
    return requirements.subjectTokens.length > 0 && requirements.subjectTokens.every(token => (
        chunkTokens.has(token)
        || chunkConcepts.has(semanticConcept(token))
        || chunkStems.has(lexicalStem(token))
        || hasCrossSpellingSubjectMatch([token], chunkTokens)
    ));
}

function satisfiedSemanticSlots(
    requirements: AnswerabilitySemanticRequirements,
    evidence: RetrievedEvidence,
): Set<AnswerabilitySemanticSlot> {
    let best = new Set<AnswerabilitySemanticSlot>();
    for (const segment of semanticSegments(evidence.chunk.retrievalText)) {
        const segmentTokens = evidenceTokens(segment);
        const segmentConcepts = new Set([...segmentTokens].map(semanticConcept));
        const satisfied = new Set<AnswerabilitySemanticSlot>();
        const hasSubject = subjectSupported(requirements, segmentTokens);
        if (hasSubject) satisfied.add('subject');
        let relationSupported = false;
        if (requirements.relationConcept === 'description' && hasSubject) {
            relationSupported = true;
        } else if (requirements.relationConcept?.startsWith('lexical:')) {
            const relationToken = requirements.relationConcept.slice('lexical:'.length);
            relationSupported = [...segmentTokens].some(token => lexicalStem(token) === lexicalStem(relationToken));
        } else if (requirements.relationConcept !== null && segmentConcepts.has(requirements.relationConcept)) {
            relationSupported = true;
        }
        if (relationSupported && (!requirements.causalSupportRequired || causalSupportPresent(segment, segmentTokens))) {
            satisfied.add('relation_or_attribute');
            if (requirements.requiredSemanticSlots.includes('normative_strength')) {
                satisfied.add('normative_strength');
            }
        }
        if (satisfied.size > best.size) best = satisfied;
    }
    // The approved tafsir corpus is static. It cannot establish a material
    // relative/current external-state fact, even when a nearby chunk shares words.
    return best;
}

function hasDirectQuestionSupport(requirements: AnswerabilitySemanticRequirements, evidence: RetrievedEvidence): boolean {
    if (requirements.requiredSemanticSlots.length === 0) return false;
    const satisfied = satisfiedSemanticSlots(requirements, evidence);
    return requirements.requiredSemanticSlots.every(slot => satisfied.has(slot));
}

function contextualOppositionSupported(segment: string, concepts: ReadonlySet<string>): boolean {
    if (concepts.has('opposition')) return true;
    const normalized = segment.normalize('NFKC').toLocaleLowerCase();
    return /\b(?:disbeliev\p{L}*|den(?:y|ied|ies|ial)|resist\p{L}*)\b/iu.test(normalized)
        || /\b(?:do|does|did|will|would|can|could|shall|should)\s+not\s+(?:believe|follow|accept|obey)\b/iu.test(normalized);
}

function contextualConditionalRationaleSupported(segment: string): boolean {
    const normalized = segment.normalize('NFKC').toLocaleLowerCase();
    return /\b(?:shall|should|would|could|can)\b.{0,120}\b(?:believe|follow|accept|obey)\b.{0,180}\bwhen\b/isu.test(normalized)
        || /\b(?:do|does|did|will|would|can|could)\s+not\s+(?:believe|follow|accept|obey)\b.{0,180}\bwhen\b/isu.test(normalized);
}

function contextualRelationSupported(
    relationConcept: string,
    segment: string,
    tokens: ReadonlySet<string>,
): boolean {
    const concepts = new Set([...tokens].map(semanticConcept));
    if (relationConcept === 'description') return true;
    if (relationConcept === 'progression') {
        return [...tokens].some(token => PROGRESSION_TOKENS.has(token));
    }
    if (relationConcept === 'opposition') return contextualOppositionSupported(segment, concepts);
    if (relationConcept.startsWith('lexical:')) {
        const relationToken = relationConcept.slice('lexical:'.length);
        return [...tokens].some(token => lexicalStem(token) === lexicalStem(relationToken));
    }
    return concepts.has(relationConcept);
}

function contextualCausalSupportPresent(relationConcept: string, segment: string, tokens: ReadonlySet<string>): boolean {
    return causalSupportPresent(segment, tokens)
        || (relationConcept === 'opposition' && contextualConditionalRationaleSupported(segment));
}

/**
 * Qualifies a contextual follow-up against a previously validated discourse
 * subject. State resolves the intended subject but does not establish evidence
 * support: the resolved subject, material terms, relation, and causal
 * requirements must bind in one semantic segment.
 */
export function selectContextualAnswerableEvidence(
    resolvedSubject: readonly string[],
    question: string,
    evidence: readonly RetrievedEvidence[],
    config: NoorRuntimeConfig,
): RetrievedEvidence[] {
    return [...qualifyContextualAnswerableEvidence(resolvedSubject, question, evidence, config).evidence];
}

export function qualifyContextualAnswerableEvidence(
    resolvedSubject: readonly string[],
    question: string,
    evidence: readonly RetrievedEvidence[],
    config: NoorRuntimeConfig,
): AnswerabilityQualificationResult {
    const stateSubjectTokens = meaningfulQueryTokens(resolvedSubject.join(' '));
    const interpretedQuestion = normalizeQueryInterpretation(question);
    const ordinary = semanticRequirements(interpretedQuestion);
    const progressionCue = /^\s*(?:and\s+then|then\s+what|what\s+happened\s+next|what\s+next|go\s+on)\b/iu;
    const progression = progressionCue.test(interpretedQuestion);
    const relationConcept = progression ? 'progression' : ordinary.relationConcept ?? 'description';
    const materialSubjectTokens = progression
        ? meaningfulQueryTokens(interpretedQuestion.replace(progressionCue, ''))
            .filter(token => !PROGRESSION_TOKENS.has(token))
        : ordinary.subjectTokens;
    const requiredSemanticSlots: AnswerabilitySemanticSlot[] = ['subject', 'entity', 'relation_or_attribute'];
    if (ordinary.requiredSemanticSlots.includes('normative_strength')) requiredSemanticSlots.push('normative_strength');
    if (ordinary.currentExternalStateRequired) requiredSemanticSlots.push('temporal_or_current_requirement');
    const emptyDecision = (satisfiedSemanticSlots: readonly AnswerabilitySemanticSlot[]): AnswerabilitySemanticDecision => ({
        relation: relationConcept,
        requiredSemanticSlots,
        satisfiedSemanticSlots,
        unsatisfiedSemanticSlots: requiredSemanticSlots.filter(slot => !satisfiedSemanticSlots.includes(slot)),
        currentExternalStateRequired: ordinary.currentExternalStateRequired,
    });
    if (stateSubjectTokens.length === 0 || ordinary.currentExternalStateRequired) {
        return { evidence: [], decision: emptyDecision([]) };
    }
    const stateRequirements: AnswerabilitySemanticRequirements = {
        subjectTokens: stateSubjectTokens,
        relationConcept: 'description',
        causalSupportRequired: false,
        currentExternalStateRequired: false,
        requiredSemanticSlots: ['subject', 'relation_or_attribute'],
    };
    const directlySupported = evidence.filter(item => {
        return semanticSegments(item.chunk.retrievalText).some(segment => {
            const tokens = evidenceTokens(segment);
            const resolvedSubjectSupported = subjectSupported(stateRequirements, tokens);
            const materialSubjectSupported = materialSubjectTokens.length === 0
                || subjectSupported({ ...ordinary, subjectTokens: materialSubjectTokens }, tokens);
            if (!resolvedSubjectSupported
                || !materialSubjectSupported
                || !contextualRelationSupported(relationConcept, segment, tokens)) return false;
            return !ordinary.causalSupportRequired
                || contextualCausalSupportPresent(relationConcept, segment, tokens);
        });
    });
    const selected = directlySupported.filter(item => item.kind !== 'semantic'
        || item.similarity >= (config.sourceThresholds[item.chunk.source] ?? 1));
    return {
        evidence: selected,
        decision: emptyDecision(selected.length > 0 ? requiredSemanticSlots : []),
    };
}

export function describeAnswerabilitySemantics(
    query: string,
    evidence: readonly RetrievedEvidence[],
): AnswerabilitySemanticDecision {
    return decisionForRequirements(semanticRequirements(query), evidence);
}

export function buildEvidenceQualificationContract(
    input: BuildEvidenceQualificationContractInput,
): EvidenceQualificationContract {
    const selectedEvidenceIds = input.evidence.map(item => item.promptSourceId);
    const selected = new Set(selectedEvidenceIds);
    const entityProvenance = (input.entityProvenance ?? []).map(entity => ({
        entityId: entity.entityId,
        ...(entity.label === undefined ? {} : { label: entity.label }),
        evidenceIds: [...new Set(entity.evidenceIds.filter(id => selected.has(id)))],
    })).filter(entity => entity.evidenceIds.length > 0);
    return {
        task: input.task,
        relation: input.qualification.relation,
        requiredSemanticSlots: [...input.qualification.requiredSemanticSlots],
        satisfiedSemanticSlots: [...input.qualification.satisfiedSemanticSlots],
        unsatisfiedSemanticSlots: [...input.qualification.unsatisfiedSemanticSlots],
        currentExternalStateRequired: input.qualification.currentExternalStateRequired,
        selectedEvidenceIds,
        entityProvenance,
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

function comparisonSemanticRequirements(entityLabel: string, question: string): AnswerabilitySemanticRequirements {
    const interpretedQuestion = normalizeQueryInterpretation(question);
    const queryTokens = [...evidenceTokens(interpretedQuestion)];
    const explicitRelation = queryTokens
        .map(semanticConcept)
        .find(concept => RELATION_CONCEPTS.has(concept) && concept !== 'narrative');
    const relationConcept = explicitRelation ?? 'description';
    const subjectTokens = meaningfulQueryTokens(entityLabel);
    const requiresCurrentExternalState = currentExternalStateRequired(interpretedQuestion, queryTokens, relationConcept);
    const requiredSemanticSlots: AnswerabilitySemanticSlot[] = ['subject', 'relation_or_attribute'];
    if (['obligation', 'permission', 'prohibition'].includes(relationConcept)) {
        requiredSemanticSlots.push('normative_strength');
    }
    if (requiresCurrentExternalState) requiredSemanticSlots.push('temporal_or_current_requirement');
    return {
        subjectTokens,
        relationConcept,
        causalSupportRequired: /(?:^|\s)why\b|\b(?:cause|caused|causes|reason|reasons)\b/iu.test(interpretedQuestion.toLocaleLowerCase()),
        currentExternalStateRequired: requiresCurrentExternalState,
        requiredSemanticSlots,
    };
}

export function selectComparisonAnswerableEvidence(
    entityLabel: string,
    question: string,
    evidence: readonly RetrievedEvidence[],
    config: NoorRuntimeConfig,
): RetrievedEvidence[] {
    return [...qualifyComparisonAnswerableEvidence(entityLabel, question, evidence, config).evidence];
}

export function qualifyComparisonAnswerableEvidence(
    entityLabel: string,
    question: string,
    evidence: readonly RetrievedEvidence[],
    config: NoorRuntimeConfig,
): AnswerabilityQualificationResult {
    const requirements = comparisonSemanticRequirements(entityLabel, question);
    const directlySupported = evidence.filter(item => hasDirectQuestionSupport(requirements, item));
    if (directlySupported.length === 0) {
        return { evidence: [], decision: decisionForRequirements(requirements, evidence) };
    }
    const directIds = new Set(directlySupported.map(item => item.chunk.chunkId));
    const selected = evidence.filter(item => {
        if (directIds.has(item.chunk.chunkId)) return true;
        if (item.kind !== 'semantic') return false;
        const threshold = config.sourceThresholds[item.chunk.source] ?? 1;
        return item.similarity >= threshold
            && directlySupported.some(direct => verseRangesOverlap(direct, item));
    });
    return { evidence: selected, decision: decisionForRequirements(requirements, selected) };
}

export function qualifyEntitySummaryAnswerableEvidence(
    question: string,
    entity: QuranSurahEntity,
    evidence: readonly RetrievedEvidence[],
    capacity?: Readonly<{ canonicalUnits: number; sections: number; span: number }>,
): AnswerabilityQualificationResult {
    const ordinary = semanticRequirements(question);
    const broadSynthesisOperation = hasEntitySummarySignal(question)
        && !ordinary.currentExternalStateRequired
        && !ordinary.requiredSemanticSlots.includes('normative_strength')
        && (ordinary.relationConcept === null
            || BROAD_SUMMARY_SYNTHESIS_RELATIONS.has(ordinary.relationConcept));
    const relationConcept = broadSynthesisOperation
        && ordinary.relationConcept !== null
        && ordinary.relationConcept !== 'description'
        ? 'teaching'
        : ordinary.relationConcept ?? 'description';
    const requiredSemanticSlots: AnswerabilitySemanticSlot[] = ['entity', 'relation_or_attribute'];
    if (ordinary.requiredSemanticSlots.includes('normative_strength')) requiredSemanticSlots.push('normative_strength');
    if (ordinary.currentExternalStateRequired) requiredSemanticSlots.push('temporal_or_current_requirement');

    const coverageSatisfied = isEntitySummaryEvidenceSufficient(entity, evidence, capacity);
    const relationSatisfied = coverageSatisfied && (broadSynthesisOperation
        || relationConcept === 'description'
        || evidence.some(item => semanticSegments(item.chunk.retrievalText).some(segment => {
            const tokens = evidenceTokens(segment);
            return contextualRelationSupported(relationConcept, segment, tokens)
                && (!ordinary.causalSupportRequired
                    || contextualCausalSupportPresent(relationConcept, segment, tokens));
        })));
    const satisfiedSemanticSlots: AnswerabilitySemanticSlot[] = [];
    if (coverageSatisfied) satisfiedSemanticSlots.push('entity');
    if (relationSatisfied) {
        satisfiedSemanticSlots.push('relation_or_attribute');
        if (requiredSemanticSlots.includes('normative_strength')) satisfiedSemanticSlots.push('normative_strength');
    }
    const decision: AnswerabilitySemanticDecision = {
        relation: relationConcept,
        requiredSemanticSlots,
        satisfiedSemanticSlots,
        unsatisfiedSemanticSlots: requiredSemanticSlots.filter(slot => !satisfiedSemanticSlots.includes(slot)),
        currentExternalStateRequired: ordinary.currentExternalStateRequired,
    };
    return {
        evidence: decision.unsatisfiedSemanticSlots.length === 0 ? evidence : [],
        decision,
    };
}

function decisionForRequirements(
    requirements: AnswerabilitySemanticRequirements,
    evidence: readonly RetrievedEvidence[],
): AnswerabilitySemanticDecision {
    let satisfied = new Set<AnswerabilitySemanticSlot>();
    for (const item of evidence) {
        const candidate = satisfiedSemanticSlots(requirements, item);
        if (candidate.size > satisfied.size) satisfied = candidate;
    }
    const satisfiedSemanticSlotList = requirements.requiredSemanticSlots.filter(slot => satisfied.has(slot));
    return {
        relation: requirements.relationConcept,
        requiredSemanticSlots: requirements.requiredSemanticSlots,
        satisfiedSemanticSlots: satisfiedSemanticSlotList,
        unsatisfiedSemanticSlots: requirements.requiredSemanticSlots.filter(slot => !satisfied.has(slot)),
        currentExternalStateRequired: requirements.currentExternalStateRequired,
    };
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
